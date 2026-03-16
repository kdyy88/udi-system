"""fastapi-users UserManager.

Handles registration, verification, password reset, and lazy SHA-256→bcrypt
migration for existing accounts.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import Request
from fastapi_users import BaseUserManager, IntegerIDMixin, exceptions, schemas

from app.core.config import settings
from app.db.models import User
from app.services.email_service import send_reset_email, send_verification_email

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class UserManager(IntegerIDMixin, BaseUserManager[User, int]):
    reset_password_token_secret = settings.JWT_SECRET
    verification_token_secret = settings.JWT_SECRET

    # ── Lifecycle hooks ───────────────────────────────────────────────────

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        logger.info("User %s registered — requesting email verification", user.email)
        await self.request_verify(user, request)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        logger.info("Password reset requested for %s", user.email)
        await send_reset_email(user.email, token)

    async def on_after_request_verify(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        logger.info("Verification email requested for %s", user.email)
        await send_verification_email(user.email, token)

    async def on_after_verify(self, user: User, request: Request | None = None) -> None:
        logger.info("User %s verified their email", user.email)

    # ── Custom authenticate: supports email OR username, lazy bcrypt migration ──

    async def authenticate(
        self, credentials: schemas.model_field.ModelField  # type: ignore[override]
    ) -> User | None:
        # credentials is OAuth2PasswordRequestForm — has .username and .password
        from fastapi.security import OAuth2PasswordRequestForm as _Form

        creds: _Form = credentials  # type: ignore[assignment]

        # Step 1: look up by email
        user: User | None = None
        try:
            user = await self.get_by_email(creds.username)
        except exceptions.UserNotExists:
            pass

        # Step 2: fallback — look up by username (for existing accounts)
        if user is None:
            from sqlalchemy import select

            result = await self.user_db.session.execute(
                select(User).where(User.username == creds.username)
            )
            user = result.scalar_one_or_none()

        if user is None:
            # Prevent timing attacks
            self.password_helper.hash(creds.password)
            return None

        # Step 3: try bcrypt first (standard fastapi-users path)
        # pwdlib raises UnknownHashError if the hash format is unrecognised (e.g. legacy SHA-256 hex)
        try:
            verified, updated_hash = self.password_helper.verify_and_update(
                creds.password, user.hashed_password
            )
        except Exception:
            verified = False
            updated_hash = None

        if not verified:
            # Step 4: legacy SHA-256 fallback
            from app.services.auth_service import verify_password as _verify_legacy

            if _verify_legacy(creds.password, user.hashed_password):
                # Lazy-migrate to bcrypt
                new_hash = self.password_helper.hash(creds.password)
                await self.user_db.update(user, {"hashed_password": new_hash})
                logger.info("Migrated password hash for user %s to bcrypt", user.email)
            else:
                return None
        elif updated_hash is not None:
            # passlib wants to upgrade the internal cost factor
            await self.user_db.update(user, {"hashed_password": updated_hash})

        return user
