"""Central fastapi-users wiring.

Exports:
  fastapi_users         — the FastAPIUsers[User, int] instance
  auth_backend           — JWT + Cookie backend
  current_active_user    — Depends()-ready: any active user
  current_admin_user     — Depends()-ready: active user with role == "admin"
  UserRead, UserCreate, UserUpdate — Pydantic schemas
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi_users import FastAPIUsers, schemas
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from pydantic import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import User
from app.db.session import get_db
from app.db.user_manager import UserManager


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class UserRead(schemas.BaseUser[int]):
    username: str | None = None
    role: str = "operator"


class UserCreate(schemas.BaseUserCreate):
    username: str | None = None
    role: str = "operator"


class UserUpdate(schemas.BaseUserUpdate):
    username: str | None = None
    role: str | None = None


# ─── DB adapter ───────────────────────────────────────────────────────────────

async def get_user_db(
    session: AsyncSession = Depends(get_db),
) -> AsyncGenerator[SQLAlchemyUserDatabase, None]:
    yield SQLAlchemyUserDatabase(session, User)


# ─── UserManager dependency ───────────────────────────────────────────────────

async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)


# ─── Authentication backend ───────────────────────────────────────────────────

# CookieTransport — no domain set so the browser binds it to the current origin,
# which works correctly through Next.js /api rewrites without any special config.
cookie_transport = CookieTransport(
    cookie_name="udi_auth",
    cookie_max_age=settings.JWT_LIFETIME_SECONDS,
    cookie_httponly=True,
    cookie_secure=settings.COOKIE_SECURE,  # True in production (HTTPS)
    cookie_samesite="lax",
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.JWT_SECRET,
        lifetime_seconds=settings.JWT_LIFETIME_SECONDS,
    )


auth_backend = AuthenticationBackend(
    name="jwt-cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)


# ─── FastAPIUsers instance ────────────────────────────────────────────────────

fastapi_users = FastAPIUsers[User, int](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True, verified=True)


async def current_admin_user(
    user: User = Depends(current_active_user),
) -> User:
    """Dependency that additionally requires role == 'admin'."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return user
