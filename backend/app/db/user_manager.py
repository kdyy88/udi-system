from __future__ import annotations

import logging

from fastapi import Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users import BaseUserManager, IntegerIDMixin, exceptions, schemas
from pwdlib.exceptions import UnknownHashError

from app.core.config import settings
from app.db.models import User
from app.services.email_service import send_reset_email, send_verification_email

logger = logging.getLogger(__name__)


class UserManager(IntegerIDMixin, BaseUserManager[User, int]):
    reset_password_token_secret = settings.JWT_SECRET
    verification_token_secret = settings.JWT_SECRET

    async def create(
        self,
        user_create: schemas.UC,
        safe: bool = False,
        request: Request | None = None,
    ) -> User:
        if not getattr(user_create, "username", None):
            base = user_create.email.split("@")[0]
            username = await self._unique_username(base)
            user_create = user_create.model_copy(update={"username": username})
            logger.info("Auto-assigned username '%s' for %s", username, user_create.email)
        return await super().create(user_create, safe=safe, request=request)

    async def _unique_username(self, base: str) -> str:
        from sqlalchemy import select

        candidate = base
        suffix = 0
        while True:
            result = await self.user_db.session.execute(
                select(User).where(User.username == candidate)
            )
            if result.scalar_one_or_none() is None:
                return candidate
            suffix += 1
            candidate = f"{base}{suffix}"

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        logger.info("User %s registered — requesting email verification", user.email)
        await self.request_verify(user, request)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        logger.info("Password reset requested for %s", user.email)
        await send_reset_email(user.email, token, request)

    async def on_after_request_verify(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        logger.info("Verification email requested for %s", user.email)
        await send_verification_email(user.email, token, request)

    async def on_after_verify(self, user: User, request: Request | None = None) -> None:
        logger.info("User %s verified their email", user.email)

    async def authenticate(
        self,
        credentials: OAuth2PasswordRequestForm,
    ) -> User | None:
        user: User | None = None
        try:
            user = await self.get_by_email(credentials.username)
        except exceptions.UserNotExists:
            user = None

        if user is None:
            from sqlalchemy import select

            result = await self.user_db.session.execute(
                select(User).where(User.username == credentials.username)
            )
            user = result.scalar_one_or_none()

        if user is None:
            self.password_helper.hash(credentials.password)
            return None

        try:
            verified, updated_hash = self.password_helper.verify_and_update(
                credentials.password, user.hashed_password
            )
        except UnknownHashError:
            verified = False
            updated_hash = None

        if not verified:
            from app.services.auth_service import verify_password as _verify_legacy

            if _verify_legacy(credentials.password, user.hashed_password):
                new_hash = self.password_helper.hash(credentials.password)
                await self.user_db.update(user, {"hashed_password": new_hash})
                logger.info("Migrated password hash for user %s to bcrypt", user.email)
            else:
                return None
        elif updated_hash is not None:
            await self.user_db.update(user, {"hashed_password": updated_hash})

        return user
