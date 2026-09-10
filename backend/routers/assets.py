import base64
import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

from lib.auth import current_user, require_roles
from lib.db import db
from lib.engine import clean, gtp_state
from lib.workflow import audit, new_id, now_utc

router = APIRouter(tags=["assets"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_TYPES = ("image/", "application/pdf")


# ---------- documents ----------
@router.post("/uploads")
async def upload_document(
    file: UploadFile = File(...),
    label: str = Form(""),
    geo: str = Form(""),
    user: dict = Depends(current_user),
):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")
    ctype = file.content_type or "application/octet-stream"
    if not ctype.startswith(ALLOWED_TYPES):
        raise HTTPException(status_code=415, detail="Only images and PDF are accepted")
    doc = {
        "id": new_id(),
        "filename": file.filename,
        "content_type": ctype,
        "size": len(data),
        "label": label,
        "geo": geo,
        "data": base64.b64encode(data).decode(),
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "created_at": now_utc(),
    }
    await db.documents.insert_one(doc)
    return {
        "id": doc["id"],
        "filename": doc["filename"],
        "content_type": ctype,
        "size": doc["size"],
        "url": f"/api/uploads/{doc['id']}",
        "geo": geo,
    }


@router.get("/uploads/{doc_id}")
async def get_document(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(
        content=base64.b64decode(doc["data"]),
        media_type=doc["content_type"],
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"'},
    )


@router.get("/uploads/{doc_id}/meta")
async def get_document_meta(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id}, {"data": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    d = clean(doc)
    d["url"] = f"/api/uploads/{doc_id}"
    return d


# ---------- assets ----------
class AssetIn(BaseModel):
    asset_type: str = Field(min_length=2)
    location_type: str = "Metro"
    location_code: str = Field(min_length=2)
    location_name: str
    city: str = "Delhi"
    width_ft: float = 6
    height_ft: float = 3
    photo_url: str = ""
    photo_ids: list[str] = []
    description: str = ""
    notes: str = ""


async def next_asset_code(asset_type: str, location_code: str) -> str:
    prefix = f"{asset_type.upper().replace(' ', '')[:5]}-{location_code.upper()}"
    count = await db.assets.count_documents({"asset_code": {"$regex": f"^{prefix}-"}})
    return f"{prefix}-{count + 1:03d}"


@router.get("/assets")
async def list_assets(status: Optional[str] = None, q: Optional[str] = None, user: dict = Depends(current_user)):
    query: dict = {}
    if status and status != "all":
        query["status"] = status
    if q:
        query["$or"] = [
            {"asset_code": {"$regex": q, "$options": "i"}},
            {"location_name": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.assets.find(query).sort("asset_code", 1).to_list(500)
    assets = [clean(d) for d in docs]
    codes = {a["id"] for a in assets}
    counts: dict[str, int] = {}
    for e in await db.queue_entries.find(
        {"asset_id": {"$in": list(codes)}, "state": {"$in": ["active", "pending"]}}
    ).to_list(1000):
        counts[e["asset_id"]] = counts.get(e["asset_id"], 0) + 1
    live = {
        c["asset_id"]: c["brand"]
        for c in await db.campaigns.find({"stage": {"$ne": "closed"}}).to_list(500)
    }
    gtp_by_asset = {}
    for c in await db.campaigns.find({"stage": {"$in": ["live", "closing"]}}).to_list(500):
        state = gtp_state(c)
        gtp_by_asset[c["asset_id"]] = {
            "next_gtp_date": state["next_due"],
            "gtp_overdue": state["overdue"],
            "campaign_start_date": c.get("start_date"),
            "campaign_end_date": c.get("end_date"),
        }
    for a in assets:
        a["queue_count"] = counts.get(a["id"], 0)
        a["current_brand"] = live.get(a["id"])
        a.setdefault("photo_ids", [])
        a.update(gtp_by_asset.get(a["id"], {}))
    return assets


@router.post("/assets", status_code=201)
async def create_asset(payload: AssetIn, user: dict = Depends(require_roles("ops", "admin"))):
    code = await next_asset_code(payload.asset_type, payload.location_code)
    asset = {
        "id": new_id(),
        "asset_code": code,
        **payload.model_dump(),
        "asset_type": payload.asset_type,
        "status": "available",
        "current_campaign_id": None,
        "created_at": now_utc(),
    }
    await db.assets.insert_one(dict(asset))
    asset.pop("_id", None)
    await audit(
        entity_type="asset",
        entity_id=asset["id"],
        asset_id=asset["id"],
        action="asset_created",
        actor=user,
        after={"asset_code": code, "status": "available"},
        comment=f"Asset {code} onboarded",
    )
    return asset


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str, user: dict = Depends(current_user)):
    doc = await db.assets.find_one({"id": asset_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset = clean(doc)
    asset["campaigns"] = [
        clean(c) for c in await db.campaigns.find({"asset_id": asset_id}).sort("created_at", -1).to_list(100)
    ]
    asset["audit"] = [
        clean(a) for a in await db.audit_logs.find({"asset_id": asset_id}).sort("created_at", -1).to_list(200)
    ]
    return asset


class AssetTypeIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    location_type: str = "Metro"
    default_width_ft: float = 6
    default_height_ft: float = 3


DEFAULT_ASSET_TYPES = [
    {"name": "Metro Bench", "location_type": "Metro", "default_width_ft": 6, "default_height_ft": 3},
    {"name": "Mall Bench", "location_type": "Mall", "default_width_ft": 8, "default_height_ft": 3},
]


@router.get("/asset-types")
async def list_asset_types(user: dict = Depends(current_user)):
    docs = await db.asset_types.find().sort("name", 1).to_list(200)
    if not docs:
        # Seed the two launch types on first read so the picker is never empty.
        for t in DEFAULT_ASSET_TYPES:
            await db.asset_types.insert_one({"id": new_id(), **t, "created_at": now_utc()})
        docs = await db.asset_types.find().sort("name", 1).to_list(200)
    types = [clean(d) for d in docs]
    for t in types:
        t["asset_count"] = await db.assets.count_documents({"asset_type": t["name"]})
    return types


@router.post("/asset-types", status_code=201)
async def create_asset_type(payload: AssetTypeIn, user: dict = Depends(require_roles("admin"))):
    if await db.asset_types.find_one({"name": {"$regex": f"^{payload.name.strip()}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail="That asset type already exists")
    doc = {"id": new_id(), **payload.model_dump(), "name": payload.name.strip(), "created_at": now_utc()}
    await db.asset_types.insert_one(dict(doc))
    doc.pop("_id", None)
    await audit(
        entity_type="asset_type",
        entity_id=doc["id"],
        action="asset_type_created",
        actor=user,
        after={"name": doc["name"], "location_type": doc["location_type"]},
        comment=f"Asset type {doc['name']} added",
    )
    return doc


@router.put("/asset-types/{type_id}")
async def update_asset_type(type_id: str, payload: AssetTypeIn, user: dict = Depends(require_roles("admin"))):
    before = await db.asset_types.find_one({"id": type_id})
    if not before:
        raise HTTPException(status_code=404, detail="Asset type not found")
    new_name = payload.name.strip()
    await db.asset_types.update_one({"id": type_id}, {"$set": {**payload.model_dump(), "name": new_name}})
    if new_name != before["name"]:
        # Existing assets keep their generated codes but follow the renamed type.
        await db.assets.update_many({"asset_type": before["name"]}, {"$set": {"asset_type": new_name}})
    await audit(
        entity_type="asset_type",
        entity_id=type_id,
        action="asset_type_updated",
        actor=user,
        before={"name": before["name"], "location_type": before.get("location_type")},
        after={"name": new_name, "location_type": payload.location_type},
        comment=f"Asset type renamed to {new_name}" if new_name != before["name"] else "Asset type updated",
    )
    return clean(await db.asset_types.find_one({"id": type_id}))


@router.delete("/asset-types/{type_id}")
async def delete_asset_type(type_id: str, user: dict = Depends(require_roles("admin"))):
    doc = await db.asset_types.find_one({"id": type_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Asset type not found")
    in_use = await db.assets.count_documents({"asset_type": doc["name"]})
    if in_use:
        raise HTTPException(
            status_code=409, detail=f"{in_use} asset(s) still use this type — reassign them first"
        )
    await db.asset_types.delete_one({"id": type_id})
    await audit(
        entity_type="asset_type",
        entity_id=type_id,
        action="asset_type_deleted",
        actor=user,
        before={"name": doc["name"]},
        comment=f"Asset type {doc['name']} deleted",
    )
    return {"ok": True}


@router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, payload: AssetIn, user: dict = Depends(require_roles("ops", "admin"))):
    before = await db.assets.find_one({"id": asset_id})
    if not before:
        raise HTTPException(status_code=404, detail="Asset not found")
    fields = payload.model_dump()
    # asset_code encodes type + location, so regenerate it when either changes.
    new_code = before["asset_code"]
    if (
        payload.asset_type != before["asset_type"]
        or payload.location_code.upper() != before["location_code"].upper()
    ):
        new_code = await next_asset_code(payload.asset_type, payload.location_code)
    fields["asset_code"] = new_code
    await db.assets.update_one({"id": asset_id}, {"$set": fields})
    if new_code != before["asset_code"]:
        await db.queue_entries.update_many({"asset_id": asset_id}, {"$set": {"asset_code": new_code}})
        await db.campaigns.update_many({"asset_id": asset_id}, {"$set": {"asset_code": new_code}})
    await audit(
        entity_type="asset",
        entity_id=asset_id,
        asset_id=asset_id,
        action="asset_updated",
        actor=user,
        before={"asset_code": before["asset_code"], "asset_type": before["asset_type"]},
        after={"asset_code": new_code, "asset_type": payload.asset_type},
        comment=f"Asset {new_code} updated",
    )
    return clean(await db.assets.find_one({"id": asset_id}))


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, user: dict = Depends(require_roles("admin"))):
    asset = await db.assets.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["status"] not in ("available",):
        raise HTTPException(
            status_code=409,
            detail=f"Only an Available asset can be deleted — this one is {asset['status']}",
        )
    open_entries = await db.queue_entries.count_documents(
        {"asset_id": asset_id, "state": {"$in": ["active", "pending"]}}
    )
    if open_entries:
        raise HTTPException(status_code=409, detail="Withdraw the open interest queue entries first")
    if await db.campaigns.count_documents({"asset_id": asset_id}):
        raise HTTPException(
            status_code=409,
            detail="This asset has historical campaigns — records must be retained, so it cannot be deleted",
        )
    await db.assets.delete_one({"id": asset_id})
    await audit(
        entity_type="asset",
        entity_id=asset_id,
        asset_id=asset_id,
        action="asset_deleted",
        actor=user,
        before={"asset_code": asset["asset_code"], "status": asset["status"]},
        comment=f"Asset {asset['asset_code']} deleted",
    )
    return {"ok": True, "asset_code": asset["asset_code"]}


@router.post("/assets/import-csv")
async def import_assets(file: UploadFile = File(...), user: dict = Depends(require_roles("ops", "admin"))):
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    created, errors = [], []
    for i, row in enumerate(reader, start=2):
        try:
            payload = AssetIn(
                asset_type=(row.get("asset_type") or "").strip(),
                location_code=(row.get("location_code") or "").strip(),
                location_name=(row.get("location_name") or "").strip(),
                city=(row.get("city") or "Delhi").strip(),
                width_ft=float(row.get("width_ft") or 6),
                height_ft=float(row.get("height_ft") or 3),
                photo_url=(row.get("photo_url") or "").strip(),
            )
            asset = await create_asset(payload, user)
            created.append(asset["asset_code"])
        except Exception as exc:  # noqa: BLE001 - report per-row
            errors.append(f"Row {i}: {exc}")
    return {"created": len(created), "codes": created, "errors": errors}
