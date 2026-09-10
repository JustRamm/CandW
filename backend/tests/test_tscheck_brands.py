"""Brand records: contacts, campaign/interest history, dup rejection, sales/admin gating."""

import uuid

from .conftest import login


def _unique_name() -> str:
    return f"tscheck-brand-{uuid.uuid4().hex[:8]}"


def test_sales_can_create_and_edit_brand_with_contacts(client):
    login(client, "sales@ims.test")
    name = _unique_name()
    payload = {
        "name": name,
        "contact_person": "Test Contact",
        "contact_email": "contact@tscheck.test",
        "contact_phone": "9999900000",
        "industry": "FMCG",
    }
    r = client.post("/brands", json=payload)
    assert r.status_code == 201, r.text
    brand = r.json()
    assert brand["contact_person"] == "Test Contact"
    bid = brand["id"]

    # detail page shows contacts + history sections
    detail = client.get(f"/brands/{bid}")
    assert detail.status_code == 200
    d = detail.json()
    assert d["contact_email"] == "contact@tscheck.test"
    assert "campaigns" in d and "queue_entries" in d

    # edit persists
    payload2 = dict(payload)
    payload2["contact_person"] = "Updated Contact"
    r2 = client.put(f"/brands/{bid}", json=payload2)
    assert r2.status_code == 200, r2.text
    assert r2.json()["contact_person"] == "Updated Contact"

    reget = client.get(f"/brands/{bid}")
    assert reget.json()["contact_person"] == "Updated Contact"


def test_duplicate_brand_name_rejected(client):
    login(client, "sales@ims.test")
    name = _unique_name()
    r1 = client.post("/brands", json={"name": name, "contact_person": "A"})
    assert r1.status_code == 201

    r2 = client.post("/brands", json={"name": name, "contact_person": "B"})
    assert r2.status_code == 409, r2.text
    assert "already exists" in r2.json()["detail"].lower()


def test_ops_cannot_create_brand(client):
    login(client, "ops@ims.test")
    r = client.post("/brands", json={"name": _unique_name()})
    assert r.status_code == 403, r.text


def test_amul_brand_shows_campaign_history(client):
    login(client, "sales@ims.test")
    brands = client.get("/brands").json()
    amul = next((b for b in brands if b["name"] == "Amul"), None)
    assert amul, "seeded Amul brand should exist"
    detail = client.get(f"/brands/{amul['id']}")
    assert detail.status_code == 200
    campaigns = detail.json()["campaigns"]
    assert any(c["asset_code"] == "MALLB-PHNX-001" for c in campaigns)
