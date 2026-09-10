"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os

import httpx
import pytest
import pytest_asyncio

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"


def api_url(path: str = "") -> str:
    """Absolute URL for an /api route: api_url("/status") -> http://localhost:8001/api/status."""
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


@pytest.fixture
def client():
    """Sync httpx client rooted at /api — the default for endpoint tests.

    Example:
        def test_status(client):
            assert client.get("/status").status_code == 200
    """
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        yield c


@pytest_asyncio.fixture
async def aclient():
    """Async variant, for tests that also await motor/backend helpers directly."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as c:
        yield c


# --- app-specific fixtures below this line ---


def login(c: httpx.Client, email: str, password: str = "Password123") -> dict:
    """Log a plain httpx.Client into the API and carry the session cookie forward.

    The app issues the session cookie with Secure=True whenever APP_URL is https
    (see lib/auth.cookie_kwargs), which is the case in this preview environment.
    httpx enforces the Secure attribute against the request scheme, so a cookie
    obtained while POSTing to a plain http:// backend URL would otherwise be
    silently dropped on the next request. Re-set it as a plain (non-secure)
    cookie on the client's jar so subsequent calls stay authenticated.
    """
    r = c.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    token = r.cookies.get("ims_session")
    assert token, "login response did not include ims_session cookie"
    c.cookies.set("ims_session", token)
    return r.json()
