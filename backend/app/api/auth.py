"""Auth routes — fastapi-users + legacy JSON login.

Standard endpoints (fastapi-users):
  POST /auth/jwt/login            OAuth2 form email+password → HTTP-only JWT cookie
  POST /auth/jwt/logout           clear cookie
  POST /auth/register             create account
  POST /auth/forgot-password      send reset email
  POST /auth/reset-password       apply new password via token
  POST /auth/request-verify-token resend activation email
  POST /auth/verify               activate via token
  GET  /auth/users/me             current user info

Legacy (backward compat):
  POST /auth/login                JSON {username, password} → sets cookie + returns user info
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.db.fastapi_users_config import (
    UserCreate,
    UserRead,
    UserUpdate,
    auth_backend,
    fastapi_users,
    get_jwt_strategy,
    get_user_manager,
)
from app.db.user_manager import UserManager
from app.schemas.label import LegacyLoginRequest, LegacyLoginResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Standard fastapi-users routes ─────────────────────────────────────────────

router.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/auth/users",
    tags=["auth"],
)


# ── Legacy login endpoint ──────────────────────────────────────────────────────

@router.post("/auth/login", response_model=LegacyLoginResponse, tags=["auth"])
async def legacy_login(
    payload: LegacyLoginRequest,
    request: Request,
    response: Response,
    user_manager: UserManager = Depends(get_user_manager),
) -> LegacyLoginResponse:
    """Accept JSON {username, password}, authenticate, issue JWT cookie."""
    from fastapi.security import OAuth2PasswordRequestForm as _Form

    creds = _Form(username=payload.username, password=payload.password, scope="")  # type: ignore[call-arg]
    user = await user_manager.authenticate(creds)

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="邮箱尚未验证，请先点击注册邮件中的激活链接",
        )

    strategy = get_jwt_strategy()
    token = await strategy.write_token(user)
    login_resp = await auth_backend.transport.get_login_response(token)  # type: ignore[attr-defined]
    for k, v in login_resp.headers.items():
        response.headers.append(k, v)

    return LegacyLoginResponse(
        user_id=user.id,
        username=user.username or user.email,
        email=user.email,
        role=user.role,
        message="login success",
    )

