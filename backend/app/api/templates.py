from datetime import UTC, datetime
from time import perf_counter
import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.helpers import get_owned_record_or_404, log_request_timing
from app.db.fastapi_users_config import current_active_user
from app.db.models import LabelTemplate, User
from app.db.session import get_db
from app.schemas.template import TemplateCreate, TemplateListResponse, TemplateRead, TemplateUpdate

router = APIRouter(prefix="/templates")
logger = logging.getLogger(__name__)


@router.get("", response_model=TemplateListResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
) -> TemplateListResponse:
    started_at = perf_counter()

    count_result = await db.execute(
        select(func.count()).where(LabelTemplate.user_id == user.id)
    )
    total = count_result.scalar_one()

    stmt = (
        select(LabelTemplate)
        .where(LabelTemplate.user_id == user.id)
        .order_by(LabelTemplate.id.desc())
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    log_request_timing(logger, "GET /templates", started_at, user_id=user.id, count=len(rows))
    return TemplateListResponse(
        total=total,
        items=[TemplateRead.model_validate(r) for r in rows],
    )


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
) -> TemplateRead:
    started_at = perf_counter()

    tmpl = LabelTemplate(
        user_id=user.id,
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
    user: User = Depends(current_active_user),
) -> TemplateRead:
    tmpl = await _get_owned(template_id, user.id, db)
    return TemplateRead.model_validate(tmpl)


@router.put("/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
) -> TemplateRead:
    started_at = perf_counter()
    tmpl = await _get_owned(template_id, user.id, db)

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
    user: User = Depends(current_active_user),
) -> None:
    tmpl = await _get_owned(template_id, user.id, db)
    await db.delete(tmpl)
    await db.commit()


# ─── helper ───────────────────────────────────────────────────────────────────

async def _get_owned(template_id: int, user_id: int, db: AsyncSession) -> LabelTemplate:
    return await get_owned_record_or_404(
        db=db,
        model=LabelTemplate,
        record_id=template_id,
        user_id=user_id,
        object_name="template",
        forbidden_detail="access denied",
    )
