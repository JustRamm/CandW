"""Task priority on campaigns and GTP checkpoints (ops/admin only, persists)."""

import httpx

from .conftest import login


def _get_live_campaign(c: httpx.Client) -> dict:
    resp = c.get("/campaigns")
    assert resp.status_code == 200
    campaigns = resp.json()
    live = next(x for x in campaigns if x["asset_code"] == "MALLB-PHNX-001")
    return live


def test_ops_can_change_campaign_priority_and_it_persists(client):
    login(client, "ops@ims.test")
    campaign = _get_live_campaign(client)
    cid = campaign["id"]
    original = campaign["priority"]
    new_value = "low" if original != "low" else "medium"

    r = client.post(f"/campaigns/{cid}/priority", json={"priority": new_value})
    assert r.status_code == 200, r.text
    assert r.json()["priority"] == new_value

    # persists on reload
    r2 = client.get(f"/campaigns/{cid}")
    assert r2.status_code == 200
    assert r2.json()["priority"] == new_value

    # restore
    client.post(f"/campaigns/{cid}/priority", json={"priority": original})


def test_sales_cannot_change_campaign_priority(client):
    login(client, "sales@ims.test")
    campaign = _get_live_campaign(client)
    r = client.post(f"/campaigns/{campaign['id']}/priority", json={"priority": "low"})
    assert r.status_code == 403, r.text


def test_gtp_priority_is_independent_per_checkpoint_and_persists(client):
    login(client, "ops@ims.test")
    campaign = _get_live_campaign(client)
    cid = campaign["id"]
    gtps = campaign["gtps"]
    assert len(gtps) >= 2, "seeded live campaign should have a multi-step GTP schedule"

    g0, g1 = gtps[0], gtps[1]
    g0_original = g0["priority"]
    g1_original = g1["priority"]
    g0_new = "low" if g0_original != "low" else "high"

    r = client.post(f"/campaigns/{cid}/priority", json={"priority": g0_new, "gtp_id": g0["id"]})
    assert r.status_code == 200, r.text
    updated = r.json()
    updated_gtps = {g["id"]: g for g in updated["gtps"]}
    assert updated_gtps[g0["id"]]["priority"] == g0_new
    # the other GTP's priority is untouched
    assert updated_gtps[g1["id"]]["priority"] == g1_original

    # persists on reload
    r2 = client.get(f"/campaigns/{cid}")
    reloaded_gtps = {g["id"]: g for g in r2.json()["gtps"]}
    assert reloaded_gtps[g0["id"]]["priority"] == g0_new
    assert reloaded_gtps[g1["id"]]["priority"] == g1_original

    # restore
    client.post(f"/campaigns/{cid}/priority", json={"priority": g0_original, "gtp_id": g0["id"]})
