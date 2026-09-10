"""Lifecycle engine: queue expiry/promotion, campaign creation, GTP scheduling."""

from datetime import date, datetime, time, timedelta, timezone

from lib.db import db
from lib.workflow import (
    IST,
    add_business_days,
    audit,
    aware,
    business_days_between,
    get_settings,
    holiday_set,
    ist_today,
    new_id,
    notify,
    now_utc,
    users_with_roles,
)

CHECKLIST_TEMPLATE = [
    {"key": "creative_requested", "label": "Creative Requested", "mandatory": True},
    {"key": "mall_metro_approval", "label": "Mall / Metro Approval", "mandatory": True},
    {"key": "printing_quotation", "label": "Printing — Quotation", "mandatory": True},
    {"key": "printing_completed", "label": "Printing Completed", "mandatory": True},
    {"key": "printing_proof", "label": "Printing — Proof Approved", "mandatory": True},
    {"key": "work_permit", "label": "Work Permit", "mandatory": True},
    {"key": "gtp_upload", "label": "Installation GTP Upload", "mandatory": True},
]

PRIORITIES = ["high", "medium", "low"]


def fresh_checklist() -> list[dict]:
    return [
        {**item, "status": "pending", "notes": "", "doc_ids": [], "completed_at": None, "completed_by": None}
        for item in CHECKLIST_TEMPLATE
    ]


async def activate_entry(entry: dict, holidays: set[str], biz_days: int) -> dict:
    expires = add_business_days(ist_today(), biz_days, holidays)
    await db.queue_entries.update_one(
        {"id": entry["id"]},
        {
            "$set": {
                "state": "active",
                "position": 0,
                "active_since": now_utc(),
                "expires_on": expires.isoformat(),
            }
        },
    )
    entry = {**entry, "state": "active", "position": 0, "expires_on": expires.isoformat()}
    return entry


async def reindex_pending(asset_id: str):
    pending = (
        await db.queue_entries.find({"asset_id": asset_id, "state": "pending"})
        .sort("created_at", 1)
        .to_list(200)
    )
    for i, e in enumerate(pending, start=1):
        if e.get("position") != i:
            await db.queue_entries.update_one({"id": e["id"]}, {"$set": {"position": i}})


async def sweep_queues() -> int:
    """Expire elapsed active slots and promote the next pending entry. Idempotent."""
    settings = await get_settings()
    holidays = await holiday_set()
    today = ist_today()
    expired = 0
    actives = await db.queue_entries.find({"state": "active"}).to_list(500)
    for entry in actives:
        exp = entry.get("expires_on")
        if not exp or date.fromisoformat(exp) >= today:
            continue
        await db.queue_entries.update_one(
            {"id": entry["id"]}, {"$set": {"state": "expired", "closed_at": now_utc()}}
        )
        expired += 1
        await audit(
            entity_type="queue_entry",
            entity_id=entry["id"],
            asset_id=entry["asset_id"],
            action="queue_expired",
            actor=None,
            before={"state": "active"},
            after={"state": "expired"},
            comment=f"Active slot for {entry['brand']} expired on {exp}",
        )
        await notify(
            entry["salesperson_id"],
            title="Interest slot expired",
            body=f"Your active slot for {entry['brand']} on {entry['asset_code']} expired.",
            kind="warning",
            link=f"/assets/{entry['asset_id']}",
        )
        nxt = (
            await db.queue_entries.find({"asset_id": entry["asset_id"], "state": "pending"})
            .sort("created_at", 1)
            .to_list(1)
        )
        if nxt:
            promoted = await activate_entry(nxt[0], holidays, settings["queue_active_business_days"])
            await reindex_pending(entry["asset_id"])
            await audit(
                entity_type="queue_entry",
                entity_id=promoted["id"],
                asset_id=entry["asset_id"],
                action="queue_promoted",
                actor=None,
                after={"state": "active", "expires_on": promoted["expires_on"]},
                comment=f"Auto-promoted to active; expires {promoted['expires_on']}",
            )
            await notify(
                promoted["salesperson_id"],
                title="Your interest is now active",
                body=f"{promoted['brand']} is now the active slot on {promoted['asset_code']}. Expires {promoted['expires_on']}.",
                kind="success",
                link=f"/assets/{entry['asset_id']}",
            )
        else:
            await db.assets.update_one(
                {"id": entry["asset_id"], "status": "reserved"}, {"$set": {"status": "available"}}
            )
    return expired


def decorate_entry(entry: dict, holidays: set[str]) -> dict:
    out = dict(entry)
    out.pop("_id", None)
    if entry.get("state") == "active" and entry.get("expires_on"):
        left = business_days_between(ist_today(), date.fromisoformat(entry["expires_on"]), holidays)
        out["days_remaining"] = left
        out["urgency"] = "urgent" if left <= 1 else ("warning" if left <= 2 else "normal")
    else:
        out["days_remaining"] = None
        out["urgency"] = "none"
    return out


def gtp_schedule(start: date, end: date, interval: int) -> list[dict]:
    """Fixed cadence anchored to campaign start, plus a final GTP at campaign end."""
    items, seq, d = [], 1, start + timedelta(days=interval)
    while d < end:
        items.append({"seq": seq, "due_date": d.isoformat(), "is_final": False})
        seq += 1
        d = start + timedelta(days=interval * seq)
    items.append({"seq": seq, "due_date": end.isoformat(), "is_final": True})
    return [
        {
            "id": new_id(),
            **it,
            "status": "pending",
            "doc_ids": [],
            "notes": "",
            "submitted_at": None,
            "submitted_by": None,
            "reviewed_at": None,
            "reviewed_by": None,
            "reject_reason": "",
            "priority": "high" if it["is_final"] else "medium",
        }
        for it in items
    ]


async def create_campaign(entry: dict, duration_days: int, actor: dict) -> dict:
    campaign = {
        "id": new_id(),
        "asset_id": entry["asset_id"],
        "asset_code": entry["asset_code"],
        "brand": entry["brand"],
        "salesperson_id": entry["salesperson_id"],
        "salesperson_name": entry.get("salesperson_name", ""),
        "queue_entry_id": entry["id"],
        "proposed_duration_days": entry["proposed_duration_days"],
        "proposed_start_date": entry.get("proposed_start_date"),
        "proposed_end_date": entry.get("proposed_end_date"),
        "brand_id": entry.get("brand_id"),
        "priority": "high",
        "duration_days": duration_days,
        "stage": "onboarding",
        "start_date": None,
        "end_date": None,
        "checklist": fresh_checklist(),
        "invoice": None,
        "gtps": [],
        "cancellation": None,
        "created_at": now_utc(),
        "closed_at": None,
    }
    await db.campaigns.insert_one(dict(campaign))
    campaign.pop("_id", None)
    await audit(
        entity_type="campaign",
        entity_id=campaign["id"],
        asset_id=entry["asset_id"],
        action="campaign_created",
        actor=actor,
        after={"stage": "onboarding", "duration_days": duration_days},
        comment=f"Onboarding task created for {entry['brand']}",
    )
    await notify(
        await users_with_roles("ops"),
        title="New onboarding task",
        body=f"{entry['brand']} confirmed on {entry['asset_code']} — checklist ready.",
        kind="info",
        link=f"/campaigns/{campaign['id']}",
    )
    return campaign


async def go_live(campaign: dict, actor: dict) -> dict:
    settings = await get_settings()
    start = ist_today()
    end = start + timedelta(days=campaign["duration_days"])
    gtps = gtp_schedule(start, end, settings["gtp_interval_days"])
    await db.campaigns.update_one(
        {"id": campaign["id"]},
        {
            "$set": {
                "stage": "live",
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "gtps": gtps,
            }
        },
    )
    await db.assets.update_one(
        {"id": campaign["asset_id"]},
        {"$set": {"status": "live", "current_campaign_id": campaign["id"]}},
    )
    await audit(
        entity_type="campaign",
        entity_id=campaign["id"],
        asset_id=campaign["asset_id"],
        action="campaign_live",
        actor=actor,
        before={"stage": "invoicing"},
        after={"stage": "live", "start_date": start.isoformat(), "end_date": end.isoformat()},
        comment=f"{len(gtps)} GTP checkpoints scheduled at {settings['gtp_interval_days']}-day intervals",
    )
    await notify(
        (await users_with_roles("ops", "sales")) + [campaign["salesperson_id"]],
        title="Campaign is live",
        body=f"{campaign['brand']} is live on {campaign['asset_code']} until {end.isoformat()}.",
        kind="success",
        link=f"/campaigns/{campaign['id']}",
    )
    return await db.campaigns.find_one({"id": campaign["id"]})


async def close_campaign(campaign: dict, actor: dict, reason: str) -> None:
    await db.campaigns.update_one(
        {"id": campaign["id"]}, {"$set": {"stage": "closed", "closed_at": now_utc()}}
    )
    await db.assets.update_one(
        {"id": campaign["asset_id"]},
        {"$set": {"status": "available", "current_campaign_id": None}},
    )
    await audit(
        entity_type="campaign",
        entity_id=campaign["id"],
        asset_id=campaign["asset_id"],
        action="asset_released",
        actor=actor,
        before={"stage": campaign["stage"]},
        after={"stage": "closed", "asset_status": "available"},
        comment=reason,
    )
    await notify(
        await users_with_roles("sales", "ops", "finance", "finance_manager"),
        title="Asset released",
        body=f"{campaign['asset_code']} is available again after {campaign['brand']}.",
        kind="info",
        link=f"/assets/{campaign['asset_id']}",
    )
    # promote any waiting interest
    await sweep_queues()


def clean(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


def gtp_state(campaign: dict) -> dict:
    """Next due GTP + reminder flag."""
    today = ist_today()
    for g in campaign.get("gtps", []):
        if g["status"] in ("pending", "rejected"):
            due = date.fromisoformat(g["due_date"])
            return {
                "next_gtp_id": g["id"],
                "next_due": g["due_date"],
                "days_to_due": (due - today).days,
                "overdue": due < today,
            }
    return {"next_gtp_id": None, "next_due": None, "days_to_due": None, "overdue": False}
