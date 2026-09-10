"""Expiry urgency on the queue board reflects business-days-left; seeded slot expiring
today renders urgent."""

from .conftest import login


def test_seeded_expiring_slot_is_urgent(client):
    login(client, "sales@ims.test")
    entries = client.get("/queue").json()
    boat = next(
        e for e in entries if e["asset_code"] == "METRO-RJPM-002" and e["brand"] == "Boat Lifestyle"
    )
    assert boat["state"] == "active"
    assert boat["urgency"] == "urgent", boat


def test_urgency_values_are_constrained(client):
    login(client, "sales@ims.test")
    entries = client.get("/queue").json()
    allowed = {"urgent", "warning", "normal", "none"}
    for e in entries:
        assert e.get("urgency") in allowed, e
