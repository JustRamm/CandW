from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import ROLES, ROLE_LABELS, current_user, hash_password, public_user, require_roles
from lib.db import db
from lib.engine import clean, gtp_state, sweep_queues
from lib.workflow import audit, get_settings, holiday_set, ist_today, new_id, now_utc

router = APIRouter(tags=["admin"])


# ---------- notifications ----------
@router.get("/notifications")
async def my_notifications(user: dict = Depends(current_user)):
    docs = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    items = [clean(d) for d in docs]
    return {"items": items, "unread": sum(1 for i in items if not i["read"])}


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(current_user)):
    res = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- audit ----------
@router.get("/audit")
async def audit_log(
    entity_type: str | None = None,
    asset_id: str | None = None,
    actor_id: str | None = None,
    user: dict = Depends(current_user),
):
    q: dict = {}
    if entity_type and entity_type != "all":
        q["entity_type"] = entity_type
    if asset_id:
        q["asset_id"] = asset_id
    if actor_id and actor_id != "all":
        q["actor_id"] = actor_id
    docs = await db.audit_logs.find(q).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


# ---------- dashboard ----------
@router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    await sweep_queues()
    role = user["role"]
    today = ist_today()
    settings = await get_settings()
    campaigns = [clean(c) for c in await db.campaigns.find({"stage": {"$ne": "closed"}}).to_list(500)]
    for c in campaigns:
        c.update(gtp_state(c))
        c.setdefault("priority", "high")
        items = c.get("checklist", [])
        c["checklist_done"] = sum(1 for i in items if i["status"] == "done")
        c["checklist_total"] = len(items)

    gtps_due = [
        c
        for c in campaigns
        if c.get("next_due")
        and (date.fromisoformat(c["next_due"]) - today).days <= settings["gtp_reminder_days"]
    ]
    gtp_pending_review = [
        {**c, "pending_gtps": [g for g in c.get("gtps", []) if g["status"] == "submitted"]}
        for c in campaigns
        if any(g["status"] == "submitted" for g in c.get("gtps", []))
    ]
    cancellations = [
        c for c in campaigns if c.get("cancellation") and c["cancellation"]["status"] == "requested"
    ]
    assets = [clean(a) for a in await db.assets.find().to_list(500)]
    holidays = await holiday_set()
    from lib.engine import decorate_entry

    queue = [
        decorate_entry(e, holidays)
        for e in await db.queue_entries.find({"state": {"$in": ["active", "pending"]}})
        .sort([("asset_code", 1), ("position", 1)])
        .to_list(500)
    ]

    kpis = []
    if role in ("sales", "admin"):
        mine = [q for q in queue if q["salesperson_id"] == user["id"]]
        kpis += [
            {"label": "My active slots", "value": sum(1 for q in mine if q["state"] == "active")},
            {"label": "My waitlisted", "value": sum(1 for q in mine if q["state"] == "pending")},
            {"label": "Available assets", "value": sum(1 for a in assets if a["status"] == "available")},
            {"label": "Live campaigns", "value": sum(1 for c in campaigns if c["stage"] == "live")},
        ]
    if role in ("ops", "admin"):
        kpis += [
            {"label": "Onboarding tasks", "value": sum(1 for c in campaigns if c["stage"] == "onboarding")},
            {"label": "High priority", "value": sum(1 for c in campaigns if c.get("priority") == "high" and c["stage"] in ("onboarding", "closing"))},
            {"label": "GTPs due soon", "value": len(gtps_due)},
            {"label": "Overdue GTPs", "value": sum(1 for c in campaigns if c.get("overdue"))},
            {"label": "Closure tasks", "value": sum(1 for c in campaigns if c["stage"] == "closing")},
        ]
    if role in ("finance", "finance_manager", "admin"):
        kpis += [
            {"label": "Confirmation queue", "value": sum(1 for q in queue if q["state"] == "active")},
            {"label": "Invoice requests", "value": sum(1 for c in campaigns if c["stage"] == "invoicing")},
            {"label": "GTP approvals", "value": len(gtp_pending_review)},
            {"label": "Cancellations", "value": len(cancellations)},
        ]
    if role == "admin":
        kpis += [
            {"label": "Users", "value": await db.users.count_documents({"active": True})},
            {"label": "Total assets", "value": len(assets)},
            {"label": "Audit entries", "value": await db.audit_logs.count_documents({})},
            {"label": "Holidays", "value": len(holidays)},
        ]

    return {
        "role": role,
        "kpis": kpis,
        "queue": queue,
        "campaigns": campaigns,
        "gtps_due": gtps_due,
        "gtp_pending_review": gtp_pending_review,
        "cancellations": cancellations,
        "asset_summary": {
            "available": sum(1 for a in assets if a["status"] == "available"),
            "reserved": sum(1 for a in assets if a["status"] == "reserved"),
            "onboarding": sum(1 for a in assets if a["status"] == "onboarding"),
            "live": sum(1 for a in assets if a["status"] == "live"),
            "total": len(assets),
        },
    }


# ---------- admin ----------
class UserIn(BaseModel):
    email: str = Field(min_length=3, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str = Field(min_length=2)
    role: str
    password: str = Field(min_length=6)


class SettingsIn(BaseModel):
    gtp_interval_days: int = Field(ge=1, le=365)
    queue_active_business_days: int = Field(ge=1, le=30)
    gtp_reminder_days: int = Field(ge=0, le=30)


class HolidayIn(BaseModel):
    date: str
    name: str


@router.get("/admin/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    docs = await db.users.find().sort("name", 1).to_list(200)
    return [public_user(d) for d in docs]


@router.get("/roles")
async def roles(user: dict = Depends(current_user)):
    return [{"value": r, "label": ROLE_LABELS[r]} for r in ROLES]


@router.post("/admin/users", status_code=201)
async def create_user(payload: UserIn, user: dict = Depends(require_roles("admin"))):
    if payload.role not in ROLES:
        raise HTTPException(status_code=422, detail="Unknown role")
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=409, detail="A user with that email already exists")
    doc = {
        "id": new_id(),
        "email": payload.email.lower(),
        "name": payload.name,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "active": True,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    await audit(
        entity_type="user",
        entity_id=doc["id"],
        action="user_created",
        actor=user,
        after={"email": doc["email"], "role": doc["role"]},
        comment=f"Invited {doc['name']} as {ROLE_LABELS[doc['role']]}",
    )
    return public_user(doc)


@router.post("/admin/users/{user_id}/toggle")
async def toggle_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    new_state = not target.get("active", True)
    await db.users.update_one({"id": user_id}, {"$set": {"active": new_state}})
    await audit(
        entity_type="user",
        entity_id=user_id,
        action="user_toggled",
        actor=user,
        before={"active": not new_state},
        after={"active": new_state},
        comment=f"{target['name']} {'enabled' if new_state else 'disabled'}",
    )
    return {"id": user_id, "active": new_state}


@router.get("/admin/settings")
async def read_settings(user: dict = Depends(current_user)):
    return await get_settings()


@router.put("/admin/settings")
async def write_settings(payload: SettingsIn, user: dict = Depends(require_roles("admin"))):
    before = await get_settings()
    await db.settings.update_one({"id": "global"}, {"$set": payload.model_dump()}, upsert=True)
    await audit(
        entity_type="settings",
        entity_id="global",
        action="settings_updated",
        actor=user,
        before=before,
        after=payload.model_dump(),
        comment="Workflow configuration updated",
    )
    return await get_settings()


@router.get("/admin/holidays")
async def list_holidays(user: dict = Depends(current_user)):
    return [clean(d) for d in await db.holidays.find().sort("date", 1).to_list(500)]


@router.post("/admin/holidays", status_code=201)
async def add_holiday(payload: HolidayIn, user: dict = Depends(require_roles("admin"))):
    try:
        date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    if await db.holidays.find_one({"date": payload.date}):
        raise HTTPException(status_code=409, detail="Holiday already configured")
    doc = {"id": new_id(), "date": payload.date, "name": payload.name}
    await db.holidays.insert_one(dict(doc))
    await audit(
        entity_type="settings",
        entity_id="holidays",
        action="holiday_added",
        actor=user,
        after=doc,
        comment=f"{payload.name} on {payload.date}",
    )
    return doc


@router.delete("/admin/holidays/{holiday_id}", status_code=204)
async def delete_holiday(holiday_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.holidays.delete_one({"id": holiday_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return None
