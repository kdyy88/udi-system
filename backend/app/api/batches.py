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
from app.db.fastapi_users_config import current_active_user
from app.db.models import LabelBatch, LabelHistory, User
from app.db.session import get_db
from app.schemas.batch import (
    BatchCreateRequest,
    BatchCreateResponse,
    BatchTemplateDefinition,
    LabelBatchDetailResponse,
    LabelBatchListResponse,
    LabelBatchSummary,
)
from app.services.gs1_engine import build_gs1_element_string, build_hri_string

router = APIRouter(prefix="/batches")
logger = logging.getLogger(__name__)

PAGE_SIZE = 20


@router.post("/generate", response_model=BatchCreateResponse, status_code=201)
async def create_batch(
    payload: BatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
) -> BatchCreateResponse:
    """
    Create a label batch and bulk-insert all label_history records.
    """
    started_at = perf_counter()

    gs1_results: list[tuple[str, str]] = []
    for idx, item in enumerate(payload.items):
        try:
            gs1_str = build_gs1_element_string(
                di=item.di, lot=item.lot, expiry=item.expiry,
                serial=item.serial, production_date=item.production_date,
            )
            hri = build_hri_string(
                di=item.di, lot=item.lot, expiry=item.expiry,
                serial=item.serial, production_date=item.production_date,
            )
            gs1_results.append((gs1_str, hri))
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail=f"Row {idx + 1} (GTIN {item.di}): {exc}",
            ) from exc

    batch = LabelBatch(
        user_id=user.id,
        name=payload.name,
        source=payload.source,
        total_count=len(payload.items),
        template_definition=payload.template_definition.model_dump(),
        created_at=datetime.now(UTC),
    )
    db.add(batch)
    await db.flush()

    db.add_all([
        LabelHistory(
            user_id=user.id,
            batch_id=batch.id,
            gtin=item.di, batch_no=item.lot, expiry_date=item.expiry,
            serial_no=item.serial, production_date=item.production_date,
            remarks=item.remarks, full_string=gs1_str, hri=hri,
        )
        for item, (gs1_str, hri) in zip(payload.items, gs1_results)
    ])
    await db.commit()

    log_request_timing(logger, "POST /batches/generate", started_at, batch_id=batch.id, count=len(payload.items))
    return BatchCreateResponse(
        batch_id=batch.id, name=batch.name, source=batch.source,
        total_count=batch.total_count, created_at=batch.created_at,
    )


@router.get("", response_model=LabelBatchListResponse)
async def list_batches(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
    cursor: Annotated[int | None, Query(gt=0)] = None,
    page_size: Annotated[int, Query(ge=1, le=100)] = PAGE_SIZE,
) -> LabelBatchListResponse:
    started_at = perf_counter()

    count_result = await db.execute(select(func.count()).where(LabelBatch.user_id == user.id))
    total = count_result.scalar_one()

    data_filter = [LabelBatch.user_id == user.id]
    if cursor is not None:
        data_filter.append(LabelBatch.id < cursor)

    result = await db.execute(
        select(LabelBatch).where(*data_filter).order_by(LabelBatch.id.desc()).limit(page_size)
    )
    batches = result.scalars().all()
    next_cursor = batches[-1].id if len(batches) == page_size else None

    log_request_timing(logger, "GET /batches", started_at, user_id=user.id, rows=len(batches))
    return LabelBatchListResponse(
        total=total,
        next_cursor=next_cursor,
        items=[
            LabelBatchSummary(
                id=b.id, user_id=b.user_id, name=b.name, source=b.source,
                total_count=b.total_count, created_at=b.created_at,
                template_definition=(
                    BatchTemplateDefinition.model_validate(b.template_definition)
                    if b.template_definition is not None else None
                ),
            )
            for b in batches
        ],
    )


@router.get("/{batch_id}", response_model=LabelBatchDetailResponse)
async def get_batch_detail(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
    cursor: Annotated[int | None, Query(gt=0)] = None,
    page_size: Annotated[int, Query(ge=1, le=200)] = PAGE_SIZE,
) -> LabelBatchDetailResponse:
    started_at = perf_counter()

    batch = await get_owned_record_or_404(
        db=db, model=LabelBatch, record_id=batch_id, user_id=user.id,
        object_name="batch", forbidden_detail="Forbidden",
    )

    data_filter = [LabelHistory.batch_id == batch_id]
    if cursor is not None:
        data_filter.append(LabelHistory.id > cursor)

    records_result = await db.execute(
        select(LabelHistory).where(*data_filter).order_by(LabelHistory.id.asc()).limit(page_size)
    )
    records = records_result.scalars().all()
    next_cursor = records[-1].id if len(records) == page_size else None

    log_request_timing(logger, "GET /batches/{id}", started_at, batch_id=batch_id, rows=len(records))
    return LabelBatchDetailResponse(
        id=batch.id, user_id=batch.user_id, name=batch.name, source=batch.source,
        total_count=batch.total_count, created_at=batch.created_at,
        template_definition=(
            BatchTemplateDefinition.model_validate(batch.template_definition)
            if batch.template_definition is not None else None
        ),
        next_cursor=next_cursor,
        labels=[to_label_history_response(r) for r in records],
    )


@router.delete("/{batch_id}", status_code=204)
async def delete_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
) -> None:
    batch = await get_owned_record_or_404(
        db=db, model=LabelBatch, record_id=batch_id, user_id=user.id,
        object_name="batch", forbidden_detail="Forbidden",
    )
    await db.delete(batch)
    await db.commit()
