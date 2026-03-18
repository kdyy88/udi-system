from datetime import UTC, datetime
import logging
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.helpers import (
    get_owned_record_or_404,
    log_request_timing,
    to_label_history_response,
)
from app.core.auth_deps import CurrentUser, get_current_user
from app.db.models import LabelBatch, LabelHistory
from app.db.session import get_db
from app.schemas.label import (
    LabelCreateRequest,
    LabelGenerateResponse,
    LabelHistoryDetailResponse,
    LabelHistoryListResponse,
)
from app.services.gs1_engine import build_gs1_element_string, build_hri_string

router = APIRouter(prefix="/labels")
logger = logging.getLogger(__name__)


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
    current_user: CurrentUser = Depends(get_current_user),
) -> LabelGenerateResponse:
    """Save UDI metadata to history. Called only when user explicitly exports a label."""
    started_at = perf_counter()

    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    batch = LabelBatch(
        owner_id=current_user.id,
        name=f"单标签 {payload.di}",
        source="form",
        total_count=1,
        created_at=datetime.now(UTC),
    )
    db.add(batch)
    await db.flush()

    history = LabelHistory(
        owner_id=current_user.id,
        batch_id=batch.id,
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

    log_request_timing(
        logger,
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
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    gtin: Annotated[str | None, Query(min_length=14, max_length=14)] = None,
    batch_no: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    cursor: Annotated[int | None, Query(gt=0)] = None,
    page_size: Annotated[int, Query(ge=1, le=100)] = PAGE_SIZE,
) -> LabelHistoryListResponse:
    """Cursor-based history list, scoped to authenticated user."""
    started_at = perf_counter()
    owner_id = current_user.id

    base_filter = [LabelHistory.owner_id == owner_id]
    if gtin:
        base_filter.append(LabelHistory.gtin == gtin)
    if batch_no:
        base_filter.append(LabelHistory.batch_no == batch_no)

    # COUNT does NOT include cursor — always reflects total matching records
    total: int | None = None
    if cursor is None:
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
        .limit(page_size + 1)
    )
    records_result = await db.execute(stmt)
    records = records_result.scalars().all()
    has_more = len(records) > page_size
    page_records = records[:page_size]

    items = [to_label_history_response(row) for row in page_records]

    # next_cursor = smallest id in this page → used as cursor for the next page
    next_cursor = page_records[-1].id if has_more and page_records else None

    log_request_timing(
        logger,
        "GET /labels/history",
        started_at,
        owner_id=owner_id,
        cursor=cursor,
        page_size=page_size,
        rows=len(items),
    )
    return LabelHistoryListResponse(total=total, next_cursor=next_cursor, items=items)


@router.get("/history/{history_id}", response_model=LabelHistoryDetailResponse)
async def get_label_history_detail(
    history_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> LabelHistoryDetailResponse:
    """Return history record metadata. Barcode rendering is handled client-side via bwip-js."""
    started_at = perf_counter()
    row = await get_owned_record_or_404(
        db=db,
        model=LabelHistory,
        record_id=history_id,
        owner_id=current_user.id,
        object_name="history record",
        forbidden_detail="You do not have permission to view this record",
    )

    log_request_timing(logger, "GET /labels/history/{history_id}", started_at, history_id=history_id)
    return LabelHistoryDetailResponse(
        **to_label_history_response(row).model_dump()
    )


@router.delete("/history/{history_id}")
async def delete_label_history(
    history_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    record = await get_owned_record_or_404(
        db=db,
        model=LabelHistory,
        record_id=history_id,
        owner_id=current_user.id,
        object_name="history record",
        forbidden_detail="You do not have permission to delete this record",
    )

    await db.delete(record)
    await db.commit()
    return {"message": "deleted successfully"}



