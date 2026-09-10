from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from lib.auth import (
    COOKIE_NAME,
    cookie_kwargs,
    create_session,
    current_user,
    destroy_session,
    public_user,
    verify_password,
)
from lib.db import db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    role_label: str
    active: bool


@router.post("/login", response_model=UserOut)
async def login(payload: LoginRequest, response: Response):
    user = await db.users.find_one({"email": payload.email.lower(), "active": True})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["id"])
    response.set_cookie(COOKIE_NAME, token, **cookie_kwargs())
    return public_user(user)


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(current_user)):
    sess = await db.sessions.find_one({"user_id": user["id"]})
    if sess:
        await destroy_session(sess["token"])
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return public_user(user)
