from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import current_user, require_roles
from lib.db import db
from lib.engine import clean, close_campaign, go_live, gtp_state
from lib.workflow import audit, get_settings, ist_today, notify, now_utc, users_with_roles

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


async def _get(campaign_id: str) -> dict:
    doc = await db.campaigns.find_one({"id": campaign_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return doc


def _decorate(c: dict) -> dict:
    out = clean(c)
    items = out.get("checklist", [])
    done = [i for i in items if i["status"] == "done"]
    out["checklist_done"] = len(done)
    out["checklist_total"] = len(items)
    out["checklist_complete"] = len(items) > 0 and len(done) == len(items)
    out.setdefault("priority", "high")
    out.update(gtp_state(out))
    return out


@router.get("")
async def list_campaigns(stage: str | None = None, user: dict = Depends(current_user)):
    q: dict = {}
    if stage and stage != "all":
        q["stage"] = stage
    docs = await db.campaigns.find(q).sort("created_at", -1).to_list(500)
    return [_decorate(d) for d in docs]


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, user: dict = Depends(current_user)):
    c = _decorate(await _get(campaign_id))
    c["audit"] = [
        clean(a)
        for a in await db.audit_logs.find({"asset_id": c["asset_id"]}).sort("created_at", -1).to_list(200)
    ]
    return c


class PriorityIn(BaseModel):
    priority: str = Field(pattern="^(high|medium|low)$")
    gtp_id: str | None = None


@router.post("/{campaign_id}/priority")
async def set_priority(
    campaign_id: str, payload: PriorityIn, user: dict = Depends(require_roles("ops", "admin"))
):
    """Set the priority of the onboarding task, or of a single GTP task when gtp_id is given."""
    c = await _get(campaign_id)
    if payload.gtp_id:
        gtps = c.get("gtps", [])
        g = next((x for x in gtps if x["id"] == payload.gtp_id), None)
        if not g:
            raise HTTPException(status_code=404, detail="GTP checkpoint not found")
        before = g.get("priority", "medium")
        g["priority"] = payload.priority
        await db.campaigns.update_one({"id": campaign_id}, {"$set": {"gtps": gtps}})
        label = f"GTP #{g['seq']}"
    else:
        before = c.get("priority", "high")
        await db.campaigns.update_one({"id": campaign_id}, {"$set": {"priority": payload.priority}})
        label = "Onboarding task"
    await audit(
        entity_type="campaign",
        entity_id=campaign_id,
        asset_id=c["asset_id"],
        action="priority_changed",
        actor=user,
        before={"priority": before},
        after={"priority": payload.priority},
        comment=f"{label} priority set to {payload.priority}",
    )
    return _decorate(await _get(campaign_id))


# ---------- Ops checklist ----------
class ChecklistIn(BaseModel):
    status: str = Field(pattern="^(pending|in_progress|done)$")
    notes: str = ""
    doc_ids: list[str] = []


@router.post("/{campaign_id}/checklist/{key}")
async def update_checklist(
    campaign_id: str, key: str, payload: ChecklistIn, user: dict = Depends(require_roles("ops"))
):
    c = await _get(campaign_id)
    if c["stage"] != "onboarding":
        raise HTTPException(status_code=409, detail="Checklist is closed for this campaign")
    items = c["checklist"]
    match = next((i for i in items if i["key"] == key), None)
    if not match:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    if payload.status == "done" and not payload.doc_ids and not match["doc_ids"]:
        raise HTTPException(status_code=422, detail="Attach at least one document before completing this step")
    before = match["status"]
    match.update(
        {
            "status": payload.status,
            "notes": payload.notes or match["notes"],
            "doc_ids": (match["doc_ids"] + payload.doc_ids) if payload.doc_ids else match["doc_ids"],
            "completed_at": now_utc() if payload.status == "done" else None,
            "completed_by": user["name"] if payload.status == "done" else None,
        }
    )
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"checklist": items}})
    await audit(
        entity_type="campaign",
        entity_id=campaign_id,
        asset_id=c["asset_id"],
        action="checklist_updated",
        actor=user,
        before={key: before},
        after={key: payload.status},
        comment=f"{match['label']} → {payload.status}. {payload.notes}".strip(),
        doc_ids=payload.doc_ids,
    )
    return _decorate(await _get(campaign_id))


@router.post("/{campaign_id}/onboard")
async def mark_onboarded(campaign_id: str, user: dict = Depends(require_roles("ops"))):
    c = await _get(campaign_id)
    if c["stage"] != "onboarding":
        raise HTTPException(status_code=409, detail="Campaign is not in onboarding")
    incomplete = [i["label"] for i in c["checklist"] if i["mandatory"] and i["status"] != "done"]
    if incomplete:
        raise HTTPException(status_code=409, detail=f"Incomplete mandatory items: {', '.join(incomplete)}")
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"stage": "invoicing"}})
    await audit(
        entity_type="campaign",
        entity_id=campaign_id,
        asset_id=c["asset_id"],
        action="ad_onboarded",
        actor=user,
        before={"stage": "onboarding"},
        after={"stage": "invoicing"},
        comment="All mandatory checklist items complete — GST invoice request raised",
    )
    await notify(
        await users_with_roles("finance", "finance_manager"),
        title="GST invoice request",
        body=f"{c['brand']} on {c['asset_code']} is onboarded — raise the invoice to go live.",
        kind="info",
        link=f"/campaigns/{campaign_id}",
    )
    return _decorate(await _get(campaign_id))


# ---------- Finance invoicing ----------
class InvoiceIn(BaseModel):
    invoice_number: str = Field(min_length=1)
    amount: float = Field(gt=0)
    gst_percent: float = Field(ge=0, le=100, default=18)
    doc_ids: list[str] = []
    notes: str = ""


@router.post("/{campaign_id}/invoice")
async def submit_invoice(
    campaign_id: str, payload: InvoiceIn, user: dict = Depends(require_roles("finance", "finance_manager"))
):
    c = await _get(campaign_id)
    if c["stage"] != "invoicing":
        raise HTTPException(status_code=409, detail="Campaign is not awaiting an invoice")
    total = round(payload.amount * (1 + payload.gst_percent / 100), 2)
    invoice = {
        **payload.model_dump(),
        "total_amount": total,
        "raised_by": user["name"],
        "raised_at": now_utc(),
    }
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"invoice": invoice}})
    await audit(
        entity_type="campaign",
        entity_id=campaign_id,
        asset_id=c["asset_id"],
        action="invoice_raised",
        actor=user,
        after={"invoice_number": payload.invoice_number, "total_amount": total},
        comment=f"GST invoice {payload.invoice_number} for {total}",
        doc_ids=payload.doc_ids,
    )
    updated = await go_live(await _get(campaign_id), user)
    return _decorate(updated)


# ---------- GTP ----------
class GtpSubmitIn(BaseModel):
    doc_ids: list[str] = Field(min_length=1)
    notes: str = ""


class GtpReviewIn(BaseModel):
    approve: bool
    reason: str = ""


@router.post("/{campaign_id}/gtp/{gtp_id}/submit")
async def submit_gtp(campaign_id: str, gtp_id: str, payload: GtpSubmitIn, user: dict = Depends(require_roles("ops"))):
    c = await _get(campaign_id)
    gtps = c.get("gtps", [])
    g = next((x for x in gtps if x["id"] == gtp_id), None)
    if not g:
        raise HTTPException(status_code=404, detail="GTP checkpoint not found")
    if g["status"] == "approved":
        raise HTTPException(status_code=409, detail="This GTP is already approved")
    g.update(
        {
            "status": "submitted",
            "doc_ids": g["doc_ids"] + payload.doc_ids,
            "notes": payload.notes,
            "submitted_at": now_utc(),
            "submitted_by": user["name"],
            "reject_reason": "",
        }
    )
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"gtps": gtps}})
    await audit(
        entity_type="gtp",
        entity_id=gtp_id,
        asset_id=c["asset_id"],
        action="gtp_submitted",
        actor=user,
        after={"status": "submitted", "seq": g["seq"]},
        comment=f"GTP #{g['seq']} submitted ({len(payload.doc_ids)} file(s)). {payload.notes}".strip(),
        doc_ids=payload.doc_ids,
    )
    await notify(
        await users_with_roles("finance", "finance_manager"),
        title="GTP awaiting approval",
        body=f"GTP #{g['seq']} for {c['brand']} on {c['asset_code']} is ready for review.",
        kind="info",
        link=f"/campaigns/{campaign_id}",
    )
    return _decorate(await _get(campaign_id))


@router.post("/{campaign_id}/gtp/{gtp_id}/review")
async def review_gtp(
    campaign_id: str,
    gtp_id: str,
    payload: GtpReviewIn,
    user: dict = Depends(require_roles("finance", "finance_manager")),
):
    c = await _get(campaign_id)
    gtps = c.get("gtps", [])
    g = next((x for x in gtps if x["id"] == gtp_id), None)
    if not g:
        raise HTTPException(status_code=404, detail="GTP checkpoint not found")
    if g["status"] != "submitted":
        raise HTTPException(status_code=409, detail="Only a submitted GTP can be reviewed")
    if not payload.approve and not payload.reason.strip():
        raise HTTPException(status_code=422, detail="A rejection reason is required")
    g.update(
        {
            "status": "approved" if payload.approve else "rejected",
            "reviewed_at": now_utc(),
            "reviewed_by": user["name"],
            "reject_reason": "" if payload.approve else payload.reason,
        }
    )
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"gtps": gtps}})
    await audit(
        entity_type="gtp",
        entity_id=gtp_id,
        asset_id=c["asset_id"],
        action="gtp_approved" if payload.approve else "gtp_rejected",
        actor=user,
        before={"status": "submitted"},
        after={"status": g["status"]},
        comment=payload.reason or f"GTP #{g['seq']} approved",
    )
    await notify(
        await users_with_roles("ops"),
        title="GTP approved" if payload.approve else "GTP rejected",
        body=f"GTP #{g['seq']} on {c['asset_code']}: {'approved' if payload.approve else payload.reason}",
        kind="success" if payload.approve else "warning",
        link=f"/campaigns/{campaign_id}",
    )
    c = await _get(campaign_id)
    if payload.approve and g.get("is_final"):
        await close_campaign(c, user, f"Final GTP #{g['seq']} approved — asset released")
        c = await _get(campaign_id)
    return _decorate(c)


# ---------- Cancellation ----------
class CancelRequestIn(BaseModel):
    reason: str = Field(min_length=3)
    proposed_cancel_date: str
    doc_ids: list[str] = []


class CancelReviewIn(BaseModel):
    approve: bool
    comment: str = ""


@router.post("/{campaign_id}/cancellation")
async def request_cancellation(
    campaign_id: str, payload: CancelRequestIn, user: dict = Depends(require_roles("sales"))
):
    c = await _get(campaign_id)
    if c["stage"] not in ("live", "invoicing", "onboarding"):
        raise HTTPException(status_code=409, detail="Campaign cannot be cancelled at this stage")
    if c.get("cancellation") and c["cancellation"]["status"] == "requested":
        raise HTTPException(status_code=409, detail="A cancellation request is already pending")
    cancellation = {
        "status": "requested",
        "reason": payload.reason,
        "proposed_cancel_date": payload.proposed_cancel_date,
        "doc_ids": payload.doc_ids,
        "requested_by": user["id"],
        "requested_by_name": user["name"],
        "requested_at": now_utc(),
        "reviewed_by": None,
        "reviewed_at": None,
        "comment": "",
    }
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"cancellation": cancellation}})
    await audit(
        entity_type="campaign",
        entity_id=campaign_id,
        asset_id=c["asset_id"],
        action="cancellation_requested",
        actor=user,
        after={"proposed_cancel_date": payload.proposed_cancel_date},
        comment=payload.reason,
        doc_ids=payload.doc_ids,
    )
    await notify(
        await users_with_roles("finance", "finance_manager"),
        title="Cancellation request",
        body=f"{user['name']} requested premature cancellation of {c['brand']} on {c['asset_code']}.",
        kind="warning",
        link=f"/campaigns/{campaign_id}",
    )
    return _decorate(await _get(campaign_id))


@router.post("/{campaign_id}/cancellation/review")
async def review_cancellation(
    campaign_id: str,
    payload: CancelReviewIn,
    user: dict = Depends(require_roles("finance", "finance_manager")),
):
    c = await _get(campaign_id)
    canc = c.get("cancellation")
    if not canc or canc["status"] != "requested":
        raise HTTPException(status_code=409, detail="No pending cancellation request")
    canc.update(
        {
            "status": "approved" if payload.approve else "rejected",
            "reviewed_by": user["name"],
            "reviewed_at": now_utc(),
            "comment": payload.comment,
        }
    )
    update: dict = {"cancellation": canc}
    if payload.approve:
        gtps = [g for g in c.get("gtps", []) if g["status"] == "approved"]
        next_seq = max([g["seq"] for g in c.get("gtps", [])] or [0]) + 1
        from lib.workflow import new_id as _nid

        gtps.append(
            {
                "id": _nid(),
                "seq": next_seq,
                "due_date": canc["proposed_cancel_date"],
                "is_final": True,
                "status": "pending",
                "doc_ids": [],
                "notes": "Closure GTP after approved premature cancellation",
                "submitted_at": None,
                "submitted_by": None,
                "reviewed_at": None,
                "reviewed_by": None,
                "reject_reason": "",
            }
        )
        update["gtps"] = gtps
        update["stage"] = "closing"
        update["end_date"] = canc["proposed_cancel_date"]
    await db.campaigns.update_one({"id": campaign_id}, {"$set": update})
    await audit(
        entity_type="campaign",
        entity_id=campaign_id,
        asset_id=c["asset_id"],
        action="cancellation_approved" if payload.approve else "cancellation_rejected",
        actor=user,
        before={"stage": c["stage"]},
        after={"stage": update.get("stage", c["stage"])},
        comment=payload.comment or ("Approved — closure GTP created" if payload.approve else "Rejected"),
    )
    recipients = [canc["requested_by"]] + (await users_with_roles("ops") if payload.approve else [])
    await notify(
        recipients,
        title="Cancellation approved" if payload.approve else "Cancellation rejected",
        body=(
            f"Closure GTP created for {c['asset_code']}, due {canc['proposed_cancel_date']}."
            if payload.approve
            else f"Cancellation of {c['brand']} was rejected. {payload.comment}"
        ),
        kind="warning",
        link=f"/campaigns/{campaign_id}",
    )
    return _decorate(await _get(campaign_id))
