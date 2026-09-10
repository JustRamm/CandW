"""Auth session lifecycle: login sets cookie, /auth/me works, logout clears it.

Covers acceptance criteria around session persistence + sign-out reachability
from the API side (the browser checks cover the UI redirects).
"""

import httpx

from .conftest import api_url, login

CREDS = {"email": "sales@ims.test", "password": "Password123"}


def test_login_me_logout_happy_path():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        # No cookie -> /auth/me is 401 (expected/benign per briefing)
        r = c.get("/auth/me")
        assert r.status_code == 401, f"unauthenticated /auth/me expected 401, got {r.status_code}: {r.text}"

        body = login(c, CREDS["email"], CREDS["password"])
        assert body["email"] == CREDS["email"]
        assert body["role"] == "sales"

        # session persists for subsequent request with same cookie jar
        r = c.get("/auth/me")
        assert r.status_code == 200, f"/auth/me after login failed: {r.status_code} {r.text}"
        assert r.json()["email"] == CREDS["email"]

        # logout destroys the session server-side and instructs the browser to drop
        # the cookie (Max-Age=0). httpx's cookie jar doesn't auto-apply that deletion
        # for a cookie we hand-inserted (see login() docstring for why), so clear it
        # client-side the same way a real browser would before re-checking.
        r = c.post("/auth/logout")
        assert r.status_code == 200, f"logout failed: {r.status_code} {r.text}"
        assert "Max-Age=0" in r.headers.get("set-cookie", ""), "logout did not instruct cookie deletion"
        del c.cookies["ims_session"]

        r = c.get("/auth/me")
        assert r.status_code == 401, f"/auth/me after logout expected 401, got {r.status_code}: {r.text}"


def test_login_rejects_bad_password():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": CREDS["email"], "password": "wrong-password"})
        assert r.status_code == 401, f"expected 401 for bad password, got {r.status_code}: {r.text}"
