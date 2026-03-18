import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.db.fastapi_users_config import (
    UserCreate,
    UserRead,
    UserUpdate,
    auth_backend,
        cookie_transport,
    fastapi_users,
    get_jwt_strategy,
    get_user_manager,
)
from app.db.user_manager import UserManager
from app.schemas.label import LegacyLoginRequest, LegacyLoginResponse

router = APIRouter()
logger = logging.getLogger(__name__)

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


@router.post("/auth/login", response_model=LegacyLoginResponse, tags=["auth"])
async def legacy_login(
    payload: LegacyLoginRequest,
    request: Request,
    response: Response,
    user_manager: UserManager = Depends(get_user_manager),
) -> LegacyLoginResponse:
    creds = OAuth2PasswordRequestForm(
        username=payload.username,
        password=payload.password,
        scope="",
        client_id=None,
        client_secret=None,
    )
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
    login_resp = await cookie_transport.get_login_response(token)
    for k, v in login_resp.headers.items():
        response.headers.append(k, v)

    return LegacyLoginResponse(
        user_id=str(user.id),
        username=user.username or user.email,
        email=user.email,
        role=user.role,
        message="login success",
    )

