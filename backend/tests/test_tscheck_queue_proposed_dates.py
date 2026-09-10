"""Sales can propose start/end dates on an interest; duration is derived and persists."""

import uuid
from datetime import date, timedelta

from .conftest import login


def _make_available_asset(admin_client) -> dict:
    suffix = uuid.uuid4().hex[:5].upper()
    payload = {
        "asset_type": "Metro Bench",
        "location_type": "Metro",
        "location_code": f"TS{suffix}",
        "location_name": f"tscheck location {suffix}",
        "city": "Delhi",
        "width_ft": 6,
        "height_ft": 3,
        "description": "tscheck fixture asset",
    }
    r = admin_client.post("/assets", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_proposed_dates_derive_duration_and_persist(client, aclient=None):
    import httpx

    with httpx.Client(base_url=client.base_url, timeout=30.0) as ops_client:
        login(ops_client, "ops@ims.test")
        asset = _make_available_asset(ops_client)

    login(client, "sales@ims.test")
    start = date.today() + timedelta(days=10)
    end = start + timedelta(days=29)  # 30 days inclusive
    expected_duration = (end - start).days + 1

    brand_name = f"tscheck-brand-dates-{uuid.uuid4().hex[:6]}"
    payload = {
        "asset_id": asset["id"],
        "brand": brand_name,
        "proposed_start_date": start.isoformat(),
        "proposed_end_date": end.isoformat(),
        "proposed_duration_days": expected_duration,
    }
    r = client.post("/queue", json=payload)
    assert r.status_code == 201, r.text
    entry = r.json()
    assert entry["proposed_start_date"] == start.isoformat()
    assert entry["proposed_end_date"] == end.isoformat()
    assert entry["proposed_duration_days"] == expected_duration

    # a new brand record was auto-created
    brands = client.get("/brands", params={"q": brand_name}).json()
    assert any(b["name"] == brand_name for b in brands)

    # renders on the queue board
    board = client.get("/queue").json()
    mine = next(e for e in board if e["id"] == entry["id"])
    assert mine["proposed_start_date"] == start.isoformat()
    assert mine["proposed_end_date"] == end.isoformat()
