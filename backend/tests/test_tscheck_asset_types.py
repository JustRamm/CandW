"""Admin asset-type CRUD: add/rename persists, delete-in-use refused, non-admin blocked."""

import uuid

from .conftest import login


def _unique_name() -> str:
    return f"tscheck-type-{uuid.uuid4().hex[:8]}"


def test_admin_can_add_rename_and_delete_unused_type(client):
    login(client, "admin@ims.test")
    name = _unique_name()
    r = client.post("/asset-types", json={"name": name, "location_type": "Metro"})
    assert r.status_code == 201, r.text
    type_id = r.json()["id"]

    listing = client.get("/asset-types").json()
    assert any(t["id"] == type_id and t["asset_count"] == 0 for t in listing)

    renamed = f"{name}-renamed"
    r2 = client.put(f"/asset-types/{type_id}", json={"name": renamed, "location_type": "Metro"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["name"] == renamed

    listing2 = client.get("/asset-types").json()
    assert any(t["id"] == type_id and t["name"] == renamed for t in listing2)

    r3 = client.delete(f"/asset-types/{type_id}")
    assert r3.status_code == 200, r3.text

    listing3 = client.get("/asset-types").json()
    assert not any(t["id"] == type_id for t in listing3)


def test_admin_cannot_delete_type_in_use(client):
    login(client, "admin@ims.test")
    types = client.get("/asset-types").json()
    used = next(t for t in types if t["asset_count"] > 0)
    r = client.delete(f"/asset-types/{used['id']}")
    assert r.status_code == 409, r.text
    assert "still use" in r.json()["detail"].lower()


def test_non_admin_cannot_manage_asset_types(client):
    login(client, "ops@ims.test")
    r = client.post("/asset-types", json={"name": _unique_name()})
    assert r.status_code == 403, r.text
