from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.schemas.label import LoginRequest, LoginResponse
from app.services.auth_service import verify_password

router = APIRouter(prefix="/auth")


@router.get("/ping")
async def auth_ping() -> dict[str, str]:
    return {"message": "auth module ready"}


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.execute(
        select(User).where(User.username == payload.username)
    ).scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    return LoginResponse(
        user_id=user.id,
        username=user.username,
        message="login success",
    )
