"""Idempotent demo seed: one account per role, sample assets, and a queue in progress.

Run: cd /app/backend && python seed.py
"""

import asyncio
from datetime import timedelta

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from lib.engine import activate_entry, create_campaign, fresh_checklist, go_live, reindex_pending
from lib.workflow import audit, holiday_set, ist_today, new_id, now_utc

PASSWORD = "Password123"

USERS = [
    ("admin@ims.test", "Asha Rao", "admin"),
    ("sales@ims.test", "Vikram Sales", "sales"),
    ("sales2@ims.test", "Neha Kapoor", "sales"),
    ("ops@ims.test", "Ravi Field", "ops"),
    ("finance@ims.test", "Priya Ledger", "finance"),
    ("fm@ims.test", "Deepak Grover", "finance_manager"),
]

PHOTOS = [
    "https://images.unsplash.com/photo-1731957764616-4b5f30b4c616?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    "https://images.unsplash.com/photo-1558910034-2145cd06626f?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    "https://images.unsplash.com/photo-1767580737456-ccaa37023040?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    "https://images.unsplash.com/photo-1759326739735-fd2b783c763d?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
]

ASSETS = [
    ("Metro Bench", "Metro", "RJPM", "Rajiv Chowk Metro — Platform 2", "Delhi", 6, 3),
    ("Metro Bench", "Metro", "RJPM", "Rajiv Chowk Metro — Concourse East", "Delhi", 6, 3),
    ("Metro Bench", "Metro", "HKMT", "Hauz Khas Metro — Platform 1", "Delhi", 6, 3),
    ("Mall Bench", "Mall", "SLCT", "Select Citywalk — Atrium Level 1", "Delhi", 8, 3),
    ("Mall Bench", "Mall", "SLCT", "Select Citywalk — Food Court", "Delhi", 8, 3),
    ("Mall Bench", "Mall", "PHNX", "Phoenix Marketcity — North Wing", "Mumbai", 8, 3),
    ("Metro Bench", "Metro", "ANDH", "Andheri Metro — Platform 3", "Mumbai", 6, 3),
    ("Mall Bench", "Mall", "ORIN", "Orion Mall — Ground Concourse", "Bengaluru", 8, 3),
]

HOLIDAYS = [("2026-01-26", "Republic Day"), ("2026-03-04", "Holi"), ("2026-08-15", "Independence Day")]


async def main():
    for coll in (
        "users",
        "sessions",
        "assets",
        "asset_types",
        "brands",
        "queue_entries",
        "campaigns",
        "audit_logs",
        "notifications",
        "documents",
        "holidays",
        "settings",
        "reminder_log",
    ):
        await db[coll].delete_many({})
    await ensure_indexes()

    for t in (
        {"name": "Metro Bench", "location_type": "Metro", "default_width_ft": 6, "default_height_ft": 3},
        {"name": "Mall Bench", "location_type": "Mall", "default_width_ft": 8, "default_height_ft": 3},
    ):
        await db.asset_types.insert_one({"id": new_id(), **t, "created_at": now_utc()})

    users = {}
    for email, name, role in USERS:
        doc = {
            "id": new_id(),
            "email": email,
            "name": name,
            "role": role,
            "password_hash": hash_password(PASSWORD),
            "active": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(doc)
        users[role if role not in users else email] = doc
    sales = await db.users.find_one({"email": "sales@ims.test"})
    sales2 = await db.users.find_one({"email": "sales2@ims.test"})
    ops = await db.users.find_one({"email": "ops@ims.test"})
    fm = await db.users.find_one({"email": "fm@ims.test"})
    finance = await db.users.find_one({"email": "finance@ims.test"})

    await db.settings.update_one(
        {"id": "global"},
        {"$set": {"id": "global", "gtp_interval_days": 28, "queue_active_business_days": 5, "gtp_reminder_days": 5}},
        upsert=True,
    )
    for d, n in HOLIDAYS:
        await db.holidays.insert_one({"id": new_id(), "date": d, "name": n})

    assets = []
    seq: dict[str, int] = {}
    for i, (atype, ltype, lcode, lname, city, w, h) in enumerate(ASSETS):
        prefix = f"{atype.upper().replace(' ', '')[:5]}-{lcode}"
        seq[prefix] = seq.get(prefix, 0) + 1
        doc = {
            "id": new_id(),
            "asset_code": f"{prefix}-{seq[prefix]:03d}",
            "asset_type": atype,
            "location_type": ltype,
            "location_code": lcode,
            "location_name": lname,
            "city": city,
            "width_ft": w,
            "height_ft": h,
            "photo_url": PHOTOS[i % len(PHOTOS)],
            "photo_ids": [],
            "description": f"{atype} display at {lname}. High-footfall {ltype.lower()} location.",
            "notes": "",
            "status": "available",
            "current_campaign_id": None,
            "created_at": now_utc(),
        }
        await db.assets.insert_one(dict(doc))
        doc.pop("_id", None)
        assets.append(doc)
        await audit(
            entity_type="asset",
            entity_id=doc["id"],
            asset_id=doc["id"],
            action="asset_created",
            actor=ops,
            after={"asset_code": doc["asset_code"], "status": "available"},
            comment=f"Asset {doc['asset_code']} onboarded",
        )

    holidays = await holiday_set()

    async def add_entry(asset, brand, person, days, make_active):
        pending = await db.queue_entries.count_documents({"asset_id": asset["id"], "state": "pending"})
        brand_doc = await db.brands.find_one({"name": brand})
        if not brand_doc:
            brand_doc = {
                "id": new_id(),
                "name": brand,
                "contact_person": f"{brand.split()[0]} Brand Team",
                "contact_email": f"marketing@{brand.split()[0].lower()}.example",
                "contact_phone": "+91 98200 00000",
                "industry": "Retail",
                "notes": "Seeded brand record",
                "created_by": person["id"],
                "created_by_name": person["name"],
                "created_at": now_utc(),
            }
            await db.brands.insert_one(dict(brand_doc))
        start = ist_today() + timedelta(days=7)
        entry = {
            "id": new_id(),
            "asset_id": asset["id"],
            "asset_code": asset["asset_code"],
            "asset_location": asset["location_name"],
            "brand": brand,
            "brand_id": brand_doc["id"],
            "notes": "",
            "salesperson_id": person["id"],
            "salesperson_name": person["name"],
            "proposed_duration_days": days,
            "proposed_start_date": start.isoformat(),
            "proposed_end_date": (start + timedelta(days=days)).isoformat(),
            "state": "pending",
            "position": pending + 1,
            "active_since": None,
            "expires_on": None,
            "created_at": now_utc(),
            "closed_at": None,
        }
        await db.queue_entries.insert_one(dict(entry))
        entry.pop("_id", None)
        if make_active:
            entry = await activate_entry(entry, holidays, 5)
            await reindex_pending(asset["id"])
        await db.assets.update_one({"id": asset["id"]}, {"$set": {"status": "reserved"}})
        await audit(
            entity_type="queue_entry",
            entity_id=entry["id"],
            asset_id=asset["id"],
            action="interest_added",
            actor=person,
            after={"brand": brand, "state": entry["state"]},
            comment=f"{brand} added to queue ({entry['state']})",
        )
        return entry

    # Asset 0: active slot + 2 pending waitlist — ready for Finance Manager confirmation
    active_entry = await add_entry(assets[0], "Tata Neu", sales, 90, True)
    await add_entry(assets[0], "Cred", sales2, 60, False)
    await add_entry(assets[0], "Zepto", sales, 45, False)

    # Asset 1: active slot expiring tomorrow (urgent state)
    urgent = await add_entry(assets[1], "Boat Lifestyle", sales2, 30, True)
    await db.queue_entries.update_one(
        {"id": urgent["id"]}, {"$set": {"expires_on": ist_today().isoformat()}}
    )

    # Asset 3: confirmed → onboarding task waiting for Ops
    onb_entry = await add_entry(assets[3], "Swiggy Instamart", sales, 120, True)
    await db.queue_entries.update_one(
        {"id": onb_entry["id"]},
        {
            "$set": {
                "state": "confirmed",
                "closed_at": now_utc(),
                "confirmation": {
                    "reason_type": "advance_payment",
                    "doc_ids": [],
                    "final_duration_days": 100,
                    "original_proposed_days": 120,
                    "confirmed_by": fm["id"],
                    "confirmed_by_name": fm["name"],
                    "confirmed_at": now_utc(),
                    "comment": "50% advance received",
                },
            }
        },
    )
    await db.assets.update_one({"id": assets[3]["id"]}, {"$set": {"status": "onboarding"}})
    await create_campaign(onb_entry, 100, fm)

    # Asset 5: fully live campaign with GTP schedule + one submitted GTP awaiting Finance
    live_entry = await add_entry(assets[5], "Amul", sales2, 180, True)
    await db.queue_entries.update_one({"id": live_entry["id"]}, {"$set": {"state": "confirmed"}})
    live_campaign = await create_campaign(live_entry, 180, fm)
    checklist = fresh_checklist()
    for item in checklist:
        item.update({"status": "done", "completed_at": now_utc(), "completed_by": ops["name"], "notes": "Seeded"})
    await db.campaigns.update_one(
        {"id": live_campaign["id"]}, {"$set": {"checklist": checklist, "stage": "invoicing"}}
    )
    await db.campaigns.update_one(
        {"id": live_campaign["id"]},
        {
            "$set": {
                "invoice": {
                    "invoice_number": "INV-2026-0041",
                    "amount": 450000,
                    "gst_percent": 18,
                    "total_amount": 531000.0,
                    "doc_ids": [],
                    "notes": "Seeded invoice",
                    "raised_by": finance["name"],
                    "raised_at": now_utc(),
                }
            }
        },
    )
    live_campaign = await db.campaigns.find_one({"id": live_campaign["id"]})
    await go_live(live_campaign, finance)
    live_campaign = await db.campaigns.find_one({"id": live_campaign["id"]})
    # backdate the start so GTP #1 is already due, and mark it submitted
    start = ist_today() - timedelta(days=30)
    gtps = live_campaign["gtps"]
    gtps[0].update(
        {
            "status": "submitted",
            "notes": "Site photos captured at 19.1176N, 72.8562E",
            "submitted_at": now_utc(),
            "submitted_by": ops["name"],
        }
    )
    await db.campaigns.update_one(
        {"id": live_campaign["id"]},
        {"$set": {"start_date": start.isoformat(), "gtps": gtps}},
    )
    await audit(
        entity_type="gtp",
        entity_id=gtps[0]["id"],
        asset_id=live_campaign["asset_id"],
        action="gtp_submitted",
        actor=ops,
        after={"status": "submitted", "seq": 1},
        comment="GTP #1 submitted (seed)",
    )

    print("Seed complete.")
    print(f"  users: {len(USERS)} (password: {PASSWORD})")
    for email, name, role in USERS:
        print(f"    {email:20s} {role}")
    print(f"  assets: {await db.assets.count_documents({})}")
    print(f"  queue entries: {await db.queue_entries.count_documents({})}")
    print(f"  campaigns: {await db.campaigns.count_documents({})}")


if __name__ == "__main__":
    asyncio.run(main())
