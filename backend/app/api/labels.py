from datetime import UTC, datetime
import logging
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LabelHistory, User
from app.db.session import get_db
from app.schemas.label import (
    LabelCreateRequest,
    LabelGenerateResponse,
    LabelHistoryDetailResponse,
    LabelHistoryListResponse,
    LabelHistoryResponse,
)
from app.services.gs1_engine import build_gs1_element_string, build_hri_string

router = APIRouter(prefix="/labels")
logger = logging.getLogger(__name__)


def _log_timing(endpoint: str, started_at: float, **extra: object) -> None:
    elapsed_ms = round((perf_counter() - started_at) * 1000, 2)
    if extra:
        logger.info("%s finished in %sms | %s", endpoint, elapsed_ms, extra)
        return
    logger.info("%s finished in %sms", endpoint, elapsed_ms)


def _build_gs1_and_hri(payload) -> tuple[str, str]:
    gs1_element_string = build_gs1_element_string(
        di=payload.di,
        lot=payload.lot,
        expiry=payload.expiry,
        serial=payload.serial,
        production_date=payload.production_date,
    )
    hri = build_hri_string(
        di=payload.di,
        lot=payload.lot,
        expiry=payload.expiry,
        serial=payload.serial,
        production_date=payload.production_date,
    )
    return gs1_element_string, hri


def _escaped_gs1(gs1_element_string: str) -> str:
    return gs1_element_string.encode("unicode_escape").decode("utf-8")


@router.get("/ping")
async def labels_ping() -> dict[str, str]:
    return {
        "message": "labels module ready",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.post("/generate", response_model=LabelGenerateResponse)
async def generate_label(
    payload: LabelCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> LabelGenerateResponse:
    """Save UDI metadata to history. Called only when user explicitly exports a label."""
    started_at = perf_counter()

    user_result = await db.execute(select(User).where(User.id == payload.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_id not found")

    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    history = LabelHistory(
        user_id=payload.user_id,
        gtin=payload.di,
        batch_no=payload.lot,
        expiry_date=payload.expiry,
        serial_no=payload.serial,
        production_date=payload.production_date,
        remarks=payload.remarks,
        full_string=gs1_element_string,
        hri=hri,
    )
    db.add(history)
    await db.commit()
    await db.refresh(history)

    _log_timing(
        "POST /labels/generate",
        started_at,
        history_id=history.id,
        hri_length=len(hri),
    )

    return LabelGenerateResponse(
        history_id=history.id,
        created_at=history.created_at,
        di=payload.di,
        hri=hri,
        gs1_element_string=gs1_element_string,
        gs1_element_string_escaped=_escaped_gs1(gs1_element_string),
    )


PAGE_SIZE = 10


@router.get("/history", response_model=LabelHistoryListResponse)
async def list_label_history(
    user_id: int = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
    gtin: Annotated[str | None, Query(min_length=14, max_length=14)] = None,
    batch_no: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    cursor: Annotated[int | None, Query(gt=0)] = None,
    page_size: Annotated[int, Query(ge=1, le=100)] = PAGE_SIZE,
) -> LabelHistoryListResponse:
    """Cursor-based history list. Pass cursor=<last_id> to get the next page."""
    started_at = perf_counter()

    # Base filter (shared by COUNT and data queries)
    base_filter = [LabelHistory.user_id == user_id]
    if gtin:
        base_filter.append(LabelHistory.gtin == gtin)
    if batch_no:
        base_filter.append(LabelHistory.batch_no == batch_no)

    # COUNT does NOT include cursor — always reflects total matching records
    count_result = await db.execute(
        select(func.count()).where(*base_filter)
    )
    total = count_result.scalar_one()

    # Data query with optional cursor (id < cursor for "next page")
    data_filter = list(base_filter)
    if cursor is not None:
        data_filter.append(LabelHistory.id < cursor)

    stmt = (
        select(LabelHistory)
        .where(*data_filter)
        .order_by(LabelHistory.id.desc())
        .limit(page_size)
    )
    records_result = await db.execute(stmt)
    records = records_result.scalars().all()

    items = [
        LabelHistoryResponse(
            id=row.id,
            user_id=row.user_id,
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
        for row in records
    ]

    # next_cursor = smallest id in this page → used as cursor for the next page
    next_cursor = records[-1].id if len(records) == page_size else None

    _log_timing(
        "GET /labels/history",
        started_at,
        user_id=user_id,
        cursor=cursor,
        page_size=page_size,
        rows=len(items),
    )
    return LabelHistoryListResponse(total=total, next_cursor=next_cursor, items=items)


@router.get("/history/{history_id}", response_model=LabelHistoryDetailResponse)
async def get_label_history_detail(
    history_id: int,
    user_id: int = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
) -> LabelHistoryDetailResponse:
    """Return history record metadata. Barcode rendering is handled client-side via bwip-js."""
    started_at = perf_counter()
    result = await db.execute(
        select(LabelHistory).where(LabelHistory.id == history_id)
    )
    row = result.scalar_one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="history record not found")

    if row.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this record",
        )

    _log_timing("GET /labels/history/{history_id}", started_at, history_id=history_id)
    return LabelHistoryDetailResponse(
        id=row.id,
        user_id=row.user_id,
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


@router.delete("/history/{history_id}")
async def delete_label_history(
    history_id: int,
    user_id: int = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(LabelHistory).where(LabelHistory.id == history_id)
    )
    record = result.scalar_one_or_none()

    if record is None:
        raise HTTPException(status_code=404, detail="history record not found")

    if record.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this record",
        )

    await db.delete(record)
    await db.commit()
    return {"message": "deleted successfully"}



