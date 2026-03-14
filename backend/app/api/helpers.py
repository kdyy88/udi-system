import logging
from time import perf_counter
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.schemas.label import LabelHistoryResponse


def log_request_timing(
    logger: logging.Logger,
    endpoint: str,
    started_at: float,
    **extra: object,
) -> None:
    elapsed_ms = round((perf_counter() - started_at) * 1000, 2)
    if extra:
        logger.info("%s finished in %sms | %s", endpoint, elapsed_ms, extra)
        return
    logger.info("%s finished in %sms", endpoint, elapsed_ms)


async def get_user_or_404(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_id not found")
    return user


async def require_admin(user_id: int, db: AsyncSession) -> User:
    user = await get_user_or_404(user_id, db)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return user


async def get_owned_record_or_404(
    *,
    db: AsyncSession,
    model: type[Any],
    record_id: int,
    user_id: int,
    object_name: str,
    forbidden_detail: str,
) -> Any:
    result = await db.execute(select(model).where(model.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail=f"{object_name} not found")
    if getattr(record, "user_id", None) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=forbidden_detail,
        )
    return record


def to_label_history_response(row: Any) -> LabelHistoryResponse:
    return LabelHistoryResponse(
        id=row.id,
        user_id=row.user_id,
        batch_id=row.batch_id,
        gtin=row.gtin,
        batch_no=row.batch_no,
        expiry_date=row.expiry_date,
        serial_no=row.serial_no,
        production_date=row.production_date,
        remarks=row.remarks,
        full_string=row.full_string,
        hri=row.hri,
        created_at=row.created_at,
    )