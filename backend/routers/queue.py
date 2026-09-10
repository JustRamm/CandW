from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import current_user, require_roles
from lib.db import db
from lib.engine import activate_entry, clean, create_campaign, decorate_entry, reindex_pending, sweep_queues
from lib.workflow import audit, get_settings, holiday_set, new_id, notify, now_utc, users_with_roles

router = APIRouter(prefix="/queue", tags=["queue"])


class InterestIn(BaseModel):
    asset_id: str
    brand_id: str = ""
    brand: str = Field(min_length=1)
    proposed_start_date: str = ""
    proposed_end_date: str = ""
    proposed_duration_days: int = Field(ge=1, le=730)
    notes: str = ""


class ConfirmIn(BaseModel):
    reason_type: str = Field(pattern="^(advance_payment|signed_agreement|purchase_order|invoice)$")
    doc_ids: list[str] = []
    final_duration_days: int = Field(ge=1, le=730)
    comment: str = ""


@router.get("")
async def list_queue(user: dict = Depends(current_user)):
    await sweep_queues()
    holidays = await holiday_set()
    entries = (
        await db.queue_entries.find({"state": {"$in": ["active", "pending"]}})
        .sort([("asset_code", 1), ("position", 1)])
        .to_list(1000)
    )
    return [decorate_entry(e, holidays) for e in entries]


@router.post("", status_code=201)
async def add_interest(payload: InterestIn, user: dict = Depends(require_roles("sales"))):
    await sweep_queues()
    asset = await db.assets.find_one({"id": payload.asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["status"] not in ("available", "reserved"):
        raise HTTPException(status_code=409, detail=f"Asset is {asset['status']} — not open for interest")
    dupe = await db.queue_entries.find_one(
        {"asset_id": asset["id"], "brand": payload.brand, "state": {"$in": ["active", "pending"]}}
    )
    if dupe:
        raise HTTPException(status_code=409, detail="This brand is already in the queue for this asset")

    # Resolve (or lazily create) the brand record so every entry links to a real brand.
    brand_doc = None
    if payload.brand_id:
        brand_doc = await db.brands.find_one({"id": payload.brand_id})
        if not brand_doc:
            raise HTTPException(status_code=404, detail="Brand not found")
    else:
        brand_doc = await db.brands.find_one(
            {"name": {"$regex": f"^{payload.brand.strip()}$", "$options": "i"}}
        )
        if not brand_doc:
            brand_doc = {
                "id": new_id(),
                "name": payload.brand.strip(),
                "contact_person": "",
                "contact_email": "",
                "contact_phone": "",
                "industry": "",
                "notes": "",
                "created_by": user["id"],
                "created_by_name": user["name"],
                "created_at": now_utc(),
            }
            await db.brands.insert_one(dict(brand_doc))
            await audit(
                entity_type="brand",
                entity_id=brand_doc["id"],
                action="brand_created",
                actor=user,
                after={"name": brand_doc["name"]},
                comment=f"Brand {brand_doc['name']} created from the interest queue",
            )
    brand_id = brand_doc["id"]
    brand_name = brand_doc["name"]

    settings = await get_settings()
    holidays = await holiday_set()
    has_active = await db.queue_entries.find_one({"asset_id": asset["id"], "state": "active"})
    pending_count = await db.queue_entries.count_documents({"asset_id": asset["id"], "state": "pending"})

    entry = {
        "id": new_id(),
        "asset_id": asset["id"],
        "asset_code": asset["asset_code"],
        "asset_location": asset["location_name"],
        "brand": brand_name,
        "brand_id": brand_id,
        "notes": payload.notes,
        "salesperson_id": user["id"],
        "salesperson_name": user["name"],
        "proposed_duration_days": payload.proposed_duration_days,
        "proposed_start_date": payload.proposed_start_date or None,
        "proposed_end_date": payload.proposed_end_date or None,
        "state": "pending",
        "position": pending_count + 1,
        "active_since": None,
        "expires_on": None,
        "created_at": now_utc(),
        "closed_at": None,
    }
    await db.queue_entries.insert_one(dict(entry))
    entry.pop("_id", None)
    if not has_active:
        entry = await activate_entry(entry, holidays, settings["queue_active_business_days"])
        await reindex_pending(asset["id"])
    await db.assets.update_one({"id": asset["id"]}, {"$set": {"status": "reserved"}})
    await audit(
        entity_type="queue_entry",
        entity_id=entry["id"],
        asset_id=asset["id"],
        action="interest_added",
        actor=user,
        after={"brand": brand_name, "state": entry["state"], "position": entry["position"]},
        comment=f"{brand_name} added to queue ({entry['state']})",
    )
    await notify(
        await users_with_roles("finance_manager"),
        title="New interest in queue",
        body=f"{brand_name} on {asset['asset_code']} ({entry['state']}).",
        kind="info",
        link="/queue",
    )
    return decorate_entry(entry, holidays)


@router.get("/asset/{asset_id}")
async def asset_queue(asset_id: str, user: dict = Depends(current_user)):
    await sweep_queues()
    holidays = await holiday_set()
    entries = (
        await db.queue_entries.find({"asset_id": asset_id})
        .sort([("state", 1), ("position", 1), ("created_at", 1)])
        .to_list(200)
    )
    return [decorate_entry(e, holidays) for e in entries]


@router.post("/{entry_id}/confirm")
async def confirm_entry(entry_id: str, payload: ConfirmIn, user: dict = Depends(require_roles("finance_manager"))):
    entry = await db.queue_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    if entry["state"] != "active":
        raise HTTPException(status_code=409, detail="Only the active slot can be confirmed")
    if not payload.doc_ids:
        raise HTTPException(status_code=422, detail="A supporting document is required")

    await db.queue_entries.update_one(
        {"id": entry_id},
        {
            "$set": {
                "state": "confirmed",
                "closed_at": now_utc(),
                "confirmation": {
                    "reason_type": payload.reason_type,
                    "doc_ids": payload.doc_ids,
                    "final_duration_days": payload.final_duration_days,
                    "original_proposed_days": entry["proposed_duration_days"],
                    "confirmed_by": user["id"],
                    "confirmed_by_name": user["name"],
                    "confirmed_at": now_utc(),
                    "comment": payload.comment,
                },
            }
        },
    )
    await audit(
        entity_type="queue_entry",
        entity_id=entry_id,
        asset_id=entry["asset_id"],
        action="queue_confirmed",
        actor=user,
        before={"state": "active", "duration_days": entry["proposed_duration_days"]},
        after={"state": "confirmed", "duration_days": payload.final_duration_days},
        comment=f"Confirmed via {payload.reason_type}. {payload.comment}".strip(),
        doc_ids=payload.doc_ids,
    )
    await notify(
        entry["salesperson_id"],
        title="Interest confirmed",
        body=f"{entry['brand']} confirmed on {entry['asset_code']} for {payload.final_duration_days} days.",
        kind="success",
        link="/queue",
    )

    # auto-cancel the rest of the waitlist
    losers = await db.queue_entries.find(
        {"asset_id": entry["asset_id"], "state": "pending"}
    ).to_list(200)
    for l in losers:
        await db.queue_entries.update_one(
            {"id": l["id"]},
            {"$set": {"state": "cancelled", "closed_at": now_utc(), "cancel_reason": "Asset confirmed to another brand"}},
        )
        await audit(
            entity_type="queue_entry",
            entity_id=l["id"],
            asset_id=entry["asset_id"],
            action="queue_auto_cancelled",
            actor=user,
            before={"state": "pending"},
            after={"state": "cancelled"},
            comment=f"Auto-cancelled — {entry['brand']} confirmed on this asset",
        )
        await notify(
            l["salesperson_id"],
            title="Waitlist entry cancelled",
            body=f"{l['brand']} was removed from {entry['asset_code']} — the asset was confirmed to {entry['brand']}.",
            kind="warning",
            link="/queue",
        )

    await db.assets.update_one({"id": entry["asset_id"]}, {"$set": {"status": "onboarding"}})
    campaign = await create_campaign(entry, payload.final_duration_days, user)
    return {"campaign_id": campaign["id"], "cancelled_entries": len(losers), "stage": campaign["stage"]}


@router.post("/{entry_id}/withdraw")
async def withdraw_entry(entry_id: str, user: dict = Depends(require_roles("sales"))):
    entry = await db.queue_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    if entry["state"] not in ("active", "pending"):
        raise HTTPException(status_code=409, detail="Entry is not open")
    if entry["salesperson_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the owning salesperson can withdraw")
    await db.queue_entries.update_one(
        {"id": entry_id},
        {"$set": {"state": "cancelled", "closed_at": now_utc(), "cancel_reason": "Withdrawn by sales"}},
    )
    await audit(
        entity_type="queue_entry",
        entity_id=entry_id,
        asset_id=entry["asset_id"],
        action="queue_withdrawn",
        actor=user,
        before={"state": entry["state"]},
        after={"state": "cancelled"},
        comment=f"{entry['brand']} withdrawn",
    )
    if entry["state"] == "active":
        settings = await get_settings()
        holidays = await holiday_set()
        nxt = (
            await db.queue_entries.find({"asset_id": entry["asset_id"], "state": "pending"})
            .sort("created_at", 1)
            .to_list(1)
        )
        if nxt:
            promoted = await activate_entry(nxt[0], holidays, settings["queue_active_business_days"])
            await notify(
                promoted["salesperson_id"],
                title="Your interest is now active",
                body=f"{promoted['brand']} is now active on {promoted['asset_code']}.",
                kind="success",
                link="/queue",
            )
        else:
            await db.assets.update_one(
                {"id": entry["asset_id"], "status": "reserved"}, {"$set": {"status": "available"}}
            )
    await reindex_pending(entry["asset_id"])
    return {"ok": True}
