"""Session auth — httpOnly cookie, sessions stored in Mongo. No tokens in JSON."""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Depends, HTTPException

from lib.db import db

COOKIE_NAME = "ims_session"
SESSION_DAYS = 14

ROLES = ["admin", "sales", "ops", "finance", "finance_manager"]
ROLE_LABELS = {
    "admin": "Admin",
    "sales": "Sales",
    "ops": "Operations",
    "finance": "Finance",
    "finance_manager": "Finance Manager",
}


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return secrets.compare_digest(hash_password(password, salt), stored)


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one(
        {
            "token": token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
        }
    )
    return token


async def destroy_session(token: str) -> None:
    await db.sessions.delete_one({"token": token})


def public_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "email": doc["email"],
        "name": doc["name"],
        "role": doc["role"],
        "role_label": ROLE_LABELS.get(doc["role"], doc["role"]),
        "active": doc.get("active", True),
    }


async def current_user(ims_session: str | None = Cookie(default=None)) -> dict:
    if not ims_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.sessions.find_one({"token": ims_session})
    if not sess:
        raise HTTPException(status_code=401, detail="Session expired")
    exp = sess.get("expires_at")
    if exp and exp.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await db.sessions.delete_one({"token": ims_session})
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"id": sess["user_id"], "active": True})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def _dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles and user["role"] != "admin":
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user

    return _dep


def cookie_kwargs() -> dict:
    secure = os.environ.get("APP_URL", "").startswith("https")
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "max_age": SESSION_DAYS * 86400,
        "path": "/",
    }
