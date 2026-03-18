from datetime import UTC, datetime
from time import perf_counter
import logging

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.helpers import get_owned_record_or_404, log_request_timing
from app.core.auth_deps import CurrentUser, get_current_user
from app.db.models import LabelTemplate
from app.db.session import get_db
from app.schemas.template import TemplateCreate, TemplateListResponse, TemplateRead, TemplateUpdate

router = APIRouter(prefix="/templates")
logger = logging.getLogger(__name__)

PAGE_SIZE = 24


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    cursor: Annotated[int | None, Query(gt=0)] = None,
    page_size: Annotated[int, Query(ge=1, le=100)] = PAGE_SIZE,
) -> TemplateListResponse:
    started_at = perf_counter()

    total: int | None = None
    if cursor is None:
        count_result = await db.execute(
            select(func.count()).where(LabelTemplate.owner_id == current_user.id)
        )
        total = count_result.scalar_one()

    filters = [LabelTemplate.owner_id == current_user.id]
    if cursor is not None:
        filters.append(LabelTemplate.id < cursor)

    stmt = (
        select(LabelTemplate)
        .where(*filters)
        .order_by(LabelTemplate.id.desc())
        .limit(page_size + 1)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    has_more = len(rows) > page_size
    page_rows = rows[:page_size]
    next_cursor = page_rows[-1].id if has_more and page_rows else None

    log_request_timing(
        logger,
        "GET /templates",
        started_at,
        owner_id=current_user.id,
        cursor=cursor,
        rows=len(page_rows),
    )
    return TemplateListResponse(
        total=total,
        next_cursor=next_cursor,
        items=[TemplateRead.model_validate(r) for r in page_rows],
    )


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TemplateRead:
    started_at = perf_counter()

    tmpl = LabelTemplate(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description,
        canvas_width_px=payload.canvas_width_px,
        canvas_height_px=payload.canvas_height_px,
        canvas_json=payload.canvas_json,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)

    log_request_timing(logger, "POST /templates", started_at, id=tmpl.id)
    return TemplateRead.model_validate(tmpl)


@router.get("/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TemplateRead:
    tmpl = await _get_owned(template_id, current_user.id, db)
    return TemplateRead.model_validate(tmpl)


@router.put("/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TemplateRead:
    started_at = perf_counter()
    tmpl = await _get_owned(template_id, current_user.id, db)

    if payload.name is not None:
        tmpl.name = payload.name
    if payload.description is not None:
        tmpl.description = payload.description
    if payload.canvas_width_px is not None:
        tmpl.canvas_width_px = payload.canvas_width_px
    if payload.canvas_height_px is not None:
        tmpl.canvas_height_px = payload.canvas_height_px
    if payload.canvas_json is not None:
        tmpl.canvas_json = payload.canvas_json
    tmpl.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(tmpl)

    log_request_timing(logger, "PUT /templates/{id}", started_at, id=template_id)
    return TemplateRead.model_validate(tmpl)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    tmpl = await _get_owned(template_id, current_user.id, db)
    await db.delete(tmpl)
    await db.commit()


# ─── helper ───────────────────────────────────────────────────────────────────

async def _get_owned(template_id: int, owner_id: str, db: AsyncSession) -> LabelTemplate:
    return await get_owned_record_or_404(
        db=db,
        model=LabelTemplate,
        record_id=template_id,
        owner_id=owner_id,
        object_name="template",
        forbidden_detail="access denied",
    )
