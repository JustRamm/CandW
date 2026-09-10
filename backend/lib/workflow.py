"""Shared workflow helpers: IST business-day math, audit log, notifications."""

import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from lib.db import db

IST = ZoneInfo("Asia/Kolkata")

DEFAULT_SETTINGS = {
    "gtp_interval_days": 28,
    "queue_active_business_days": 5,
    "gtp_reminder_days": 5,
}


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt):
    if isinstance(dt, datetime) and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def ist_today() -> date:
    return datetime.now(IST).date()


async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": "global"}) or {}
    return {**DEFAULT_SETTINGS, **{k: v for k, v in doc.items() if k in DEFAULT_SETTINGS}}


async def holiday_set() -> set[str]:
    docs = await db.holidays.find().to_list(500)
    return {d["date"] for d in docs}


def is_business_day(d: date, holidays: set[str]) -> bool:
    return d.weekday() < 5 and d.isoformat() not in holidays


def add_business_days(start: date, n: int, holidays: set[str]) -> date:
    d = start
    added = 0
    while added < n:
        d += timedelta(days=1)
        if is_business_day(d, holidays):
            added += 1
    return d


def business_days_between(start: date, end: date, holidays: set[str]) -> int:
    """Business days remaining from start (exclusive) to end (inclusive). Negative if past."""
    if end < start:
        d, count, sign = end, 0, -1
        while d < start:
            d += timedelta(days=1)
            if is_business_day(d, holidays):
                count += 1
        return sign * count
    d, count = start, 0
    while d < end:
        d += timedelta(days=1)
        if is_business_day(d, holidays):
            count += 1
    return count


async def audit(
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    actor: dict | None,
    before=None,
    after=None,
    comment: str = "",
    doc_ids: list[str] | None = None,
    asset_id: str | None = None,
):
    await db.audit_logs.insert_one(
        {
            "id": new_id(),
            "entity_type": entity_type,
            "entity_id": entity_id,
            "asset_id": asset_id,
            "action": action,
            "actor_id": (actor or {}).get("id", "system"),
            "actor_name": (actor or {}).get("name", "System"),
            "actor_role": (actor or {}).get("role", "system"),
            "before": before,
            "after": after,
            "comment": comment,
            "doc_ids": doc_ids or [],
            "created_at": now_utc(),
        }
    )


async def notify(user_ids, *, title: str, body: str, kind: str = "info", link: str = ""):
    if isinstance(user_ids, str):
        user_ids = [user_ids]
    user_ids = [u for u in dict.fromkeys(user_ids) if u]
    if not user_ids:
        return
    await db.notifications.insert_many(
        [
            {
                "id": new_id(),
                "user_id": uid,
                "title": title,
                "body": body,
                "kind": kind,
                "link": link,
                "read": False,
                "created_at": now_utc(),
            }
            for uid in user_ids
        ]
    )


async def users_with_roles(*roles: str) -> list[str]:
    docs = await db.users.find({"role": {"$in": list(roles)}, "active": True}).to_list(200)
    return [d["id"] for d in docs]


def urgency_for(days_left: int) -> str:
    if days_left <= 1:
        return "urgent"
    if days_left <= 2:
        return "warning"
    return "normal"
