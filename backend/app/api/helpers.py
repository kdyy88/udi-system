import logging
from time import perf_counter
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import CurrentUser, get_current_admin
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


async def require_admin(
    admin: CurrentUser = Depends(get_current_admin),
) -> CurrentUser:
    """Dependency that resolves the current admin user.

    Delegates to ``get_current_admin`` from the auth abstraction layer.
    When ``ENABLE_AUTH=false`` this always succeeds (ANONYMOUS_USER has
    role="admin").  When ``ENABLE_AUTH=true`` it validates the JWT cookie
    and raises 403 if the user is not an admin.

    Usage::

        @router.put("/something")
        async def handler(admin: CurrentUser = Depends(require_admin)):
            ...
    """
    return admin


async def get_owned_record_or_404(
    *,
    db: AsyncSession,
    model: type[Any],
    record_id: int,
    owner_id: str,
    object_name: str,
    forbidden_detail: str,
) -> Any:
    result = await db.execute(
        select(model).where(model.id == record_id, model.owner_id == owner_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail=f"{object_name} not found")
    return record


def to_label_history_response(row: Any) -> LabelHistoryResponse:
    return LabelHistoryResponse(
        id=row.id,
        owner_id=row.owner_id,
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