"""Finance-Manager interest-confirmation flow (API side).

Verifies the seeded state the briefing/UI check relies on (METRO-RJPM-001 active
slot Tata Neu + waitlist Cred #1 / Zepto #2), that only finance_manager/admin can
confirm, and that a supporting document is mandatory.
"""

import httpx

from .conftest import api_url, login

FM_CREDS = {"email": "fm@ims.test", "password": "Password123"}
SALES_CREDS = {"email": "sales@ims.test", "password": "Password123"}
ASSET_CODE = "METRO-RJPM-001"


def test_metro_rjpm_001_seeded_queue_state():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        login(c, FM_CREDS["email"], FM_CREDS["password"])
        assets = c.get("/assets").json()
        asset = next((a for a in assets if a["asset_code"] == ASSET_CODE), None)
        assert asset, f"{ASSET_CODE} not found in /assets: {assets}"

        entries = c.get(f"/queue/asset/{asset['id']}").json()
        active = [e for e in entries if e["state"] == "active"]
        pending = sorted([e for e in entries if e["state"] == "pending"], key=lambda e: e["position"])

        assert len(active) == 1, f"expected exactly one active slot, got {active}"
        assert active[0]["brand"] == "Tata Neu", f"expected active slot Tata Neu, got {active[0]['brand']}"

        assert [p["brand"] for p in pending] == ["Cred", "Zepto"], f"unexpected waitlist order: {pending}"
        assert pending[0]["position"] == 1
        assert pending[1]["position"] == 2


def test_confirm_requires_finance_manager_role():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        login(c, SALES_CREDS["email"], SALES_CREDS["password"])
        assets = c.get("/assets").json()
        asset = next(a for a in assets if a["asset_code"] == ASSET_CODE)
        entries = c.get(f"/queue/asset/{asset['id']}").json()
        active_entry = next(e for e in entries if e["state"] == "active")

        r = c.post(
            f"/queue/{active_entry['id']}/confirm",
            json={"reason_type": "advance_payment", "doc_ids": [], "final_duration_days": 90},
        )
        assert r.status_code == 403, f"sales role should be rejected from confirm, got {r.status_code}: {r.text}"


def test_confirm_requires_supporting_document():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        login(c, FM_CREDS["email"], FM_CREDS["password"])
        assets = c.get("/assets").json()
        asset = next(a for a in assets if a["asset_code"] == ASSET_CODE)
        entries = c.get(f"/queue/asset/{asset['id']}").json()
        active_entry = next(e for e in entries if e["state"] == "active")

        r = c.post(
            f"/queue/{active_entry['id']}/confirm",
            json={"reason_type": "advance_payment", "doc_ids": [], "final_duration_days": 90},
        )
        assert r.status_code == 422, f"confirm without doc_ids should be rejected, got {r.status_code}: {r.text}"
