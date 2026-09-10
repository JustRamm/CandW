from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import current_user, require_roles
from lib.db import db
from lib.engine import clean
from lib.workflow import audit, new_id, now_utc

router = APIRouter(prefix="/brands", tags=["brands"])


class BrandIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    contact_person: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    industry: str = ""
    notes: str = ""


@router.get("")
async def list_brands(q: Optional[str] = None, user: dict = Depends(current_user)):
    query = {"name": {"$regex": q, "$options": "i"}} if q else {}
    docs = await db.brands.find(query).sort("name", 1).to_list(500)
    brands = [clean(d) for d in docs]

    # Attach a lightweight activity summary so the list is useful on its own.
    entries = await db.queue_entries.find({"state": {"$in": ["active", "pending"]}}).to_list(1000)
    campaigns = await db.campaigns.find().to_list(1000)
    for b in brands:
        b["open_queue_entries"] = sum(1 for e in entries if e.get("brand_id") == b["id"])
        mine = [c for c in campaigns if c.get("brand_id") == b["id"]]
        b["campaign_count"] = len(mine)
        b["live_campaigns"] = sum(1 for c in mine if c["stage"] == "live")
    return brands


@router.post("", status_code=201)
async def create_brand(payload: BrandIn, user: dict = Depends(require_roles("sales", "admin"))):
    existing = await db.brands.find_one({"name": {"$regex": f"^{payload.name.strip()}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=409, detail="A brand with that name already exists")
    brand = {
        "id": new_id(),
        **payload.model_dump(),
        "name": payload.name.strip(),
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_utc(),
    }
    await db.brands.insert_one(dict(brand))
    brand.pop("_id", None)
    await audit(
        entity_type="brand",
        entity_id=brand["id"],
        action="brand_created",
        actor=user,
        after={"name": brand["name"], "contact_person": brand["contact_person"]},
        comment=f"Brand {brand['name']} created",
    )
    return brand


@router.put("/{brand_id}")
async def update_brand(brand_id: str, payload: BrandIn, user: dict = Depends(require_roles("sales", "admin"))):
    before = await db.brands.find_one({"id": brand_id})
    if not before:
        raise HTTPException(status_code=404, detail="Brand not found")
    await db.brands.update_one({"id": brand_id}, {"$set": payload.model_dump()})
    # Keep the denormalised brand name on queue entries and campaigns in step.
    if payload.name.strip() != before["name"]:
        await db.queue_entries.update_many({"brand_id": brand_id}, {"$set": {"brand": payload.name.strip()}})
        await db.campaigns.update_many({"brand_id": brand_id}, {"$set": {"brand": payload.name.strip()}})
    await audit(
        entity_type="brand",
        entity_id=brand_id,
        action="brand_updated",
        actor=user,
        before={"name": before["name"], "contact_person": before.get("contact_person", "")},
        after={"name": payload.name.strip(), "contact_person": payload.contact_person},
        comment=f"Brand {payload.name.strip()} updated",
    )
    return clean(await db.brands.find_one({"id": brand_id}))


@router.get("/{brand_id}")
async def get_brand(brand_id: str, user: dict = Depends(current_user)):
    doc = await db.brands.find_one({"id": brand_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Brand not found")
    brand = clean(doc)
    # Asset history: every campaign and queue entry this brand has ever had.
    brand["campaigns"] = [
        clean(c)
        for c in await db.campaigns.find({"brand_id": brand_id}).sort("created_at", -1).to_list(200)
    ]
    brand["queue_entries"] = [
        clean(e)
        for e in await db.queue_entries.find({"brand_id": brand_id}).sort("created_at", -1).to_list(200)
    ]
    brand["assets"] = [
        clean(a)
        for a in await db.assets.find(
            {"id": {"$in": list({c["asset_id"] for c in brand["campaigns"]})}}
        ).to_list(200)
    ]
    brand["audit"] = [
        clean(a)
        for a in await db.audit_logs.find({"entity_type": "brand", "entity_id": brand_id})
        .sort("created_at", -1)
        .to_list(100)
    ]
    return brand
