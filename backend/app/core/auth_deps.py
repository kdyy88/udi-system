"""Core & Shell auth abstraction layer.

Provides ``get_current_user`` and ``get_current_admin`` — FastAPI Depends()
callables that either:
  * ENABLE_AUTH=false  →  return a static ANONYMOUS_USER (pure-tool mode)
  * ENABLE_AUTH=true   →  delegate to fastapi-users (commercial mode)

Business-layer code MUST import from here, never from fastapi_users_config
directly.  This keeps the tool layer free of any concrete auth dependency.
"""

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


# ---------------------------------------------------------------------------
# Dependency factories
# ---------------------------------------------------------------------------

if settings.ENABLE_AUTH:
    # Import the real fastapi-users dependencies only when auth is enabled.
    # This avoids loading fastapi-users (and triggering DB / User model init)
    # when running in pure-tool mode.
    from app.db.fastapi_users_config import (
        current_active_user as _fau_active,
        current_admin_user as _fau_admin,
    )
    from app.db.models import User as _User

    async def get_current_user(user: _User = Depends(_fau_active)) -> CurrentUser:
        """Resolve the authenticated user and return a ``CurrentUser``."""
        return CurrentUser(
            id=str(user.id),
            username=user.username or user.email.split("@")[0],
            role=user.role,
            email=user.email,
        )

    async def get_current_admin(user: _User = Depends(_fau_admin)) -> CurrentUser:
        """Resolve an admin user and return a ``CurrentUser``."""
        return CurrentUser(
            id=str(user.id),
            username=user.username or user.email.split("@")[0],
            role=user.role,
            email=user.email,
        )

else:
    # ── Pure-tool mode: no auth required ──────────────────────────────────
    async def get_current_user() -> CurrentUser:  # type: ignore[misc]
        """Always returns ANONYMOUS_USER when auth is disabled."""
        return ANONYMOUS_USER

    async def get_current_admin() -> CurrentUser:  # type: ignore[misc]
        """Always returns ANONYMOUS_USER (admin) when auth is disabled."""
        return ANONYMOUS_USER
