from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Request

from app.core.config import settings


@dataclass(frozen=True)
class CurrentUser:
    """Auth-agnostic user representation used by all API endpoints."""

    id: str
    username: str
    role: str
    email: str | None = None


ANONYMOUS_USER = CurrentUser(
    id="anonymous",
    username="local-user",
    role="admin",
    email=None,
)

if settings.ENABLE_AUTH:
    from app.db.fastapi_users_config import (
        current_active_user as _fau_active,
        current_admin_user as _fau_admin,
    )
    from app.db.models import User as _User

    async def get_current_user(user: _User = Depends(_fau_active)) -> CurrentUser:
        return CurrentUser(
            id=str(user.id),
            username=user.username or user.email.split("@")[0],
            role=user.role,
            email=user.email,
        )

    async def get_current_admin(user: _User = Depends(_fau_admin)) -> CurrentUser:
        return CurrentUser(
            id=str(user.id),
            username=user.username or user.email.split("@")[0],
            role=user.role,
            email=user.email,
        )

else:
    async def _anonymous_user() -> CurrentUser:
        return ANONYMOUS_USER

    get_current_user = _anonymous_user
    get_current_admin = _anonymous_user
