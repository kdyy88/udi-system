"""System-wide configuration endpoints.

GET  /system/hidden-templates               → public; returns list of hidden system-template IDs
PUT  /system/hidden-templates               → admin only; replaces the hidden-ID list

GET  /system/template-overrides             → public; returns canvas overrides keyed by sys template ID
PUT  /system/template-override/{sys_id}     → admin only; upsert a canvas override for one system template
DELETE /system/template-override/{sys_id}   → admin only; remove override (restores factory default)
"""
import logging
from time import perf_counter
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.helpers import log_request_timing
from app.db.fastapi_users_config import current_admin_user
from app.db.models import SystemConfig, User
from app.db.session import get_db

router = APIRouter(prefix="/system")
logger = logging.getLogger(__name__)

_KEY = "hidden_system_templates"


class HiddenTemplatesResponse(BaseModel):
    value: list[str]


class HiddenTemplatesRequest(BaseModel):
    value: list[str]


async def _get_or_create_config(db: AsyncSession, key: str, default: Any = None) -> SystemConfig:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        row = SystemConfig(key=key, value=default if default is not None else [])
        db.add(row)
        await db.flush()
    return row


@router.get("/hidden-templates", response_model=HiddenTemplatesResponse)
async def get_hidden_templates(db: AsyncSession = Depends(get_db)) -> HiddenTemplatesResponse:
    started_at = perf_counter()
    row = await _get_or_create_config(db, _KEY, [])
    await db.commit()
    log_request_timing(logger, "GET /system/hidden-templates", started_at, count=len(row.value or []))
    return HiddenTemplatesResponse(value=row.value or [])


@router.put("/hidden-templates", response_model=HiddenTemplatesResponse)
async def set_hidden_templates(
    payload: HiddenTemplatesRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_admin_user),
) -> HiddenTemplatesResponse:
    started_at = perf_counter()
    row = await _get_or_create_config(db, _KEY, [])
    row.value = payload.value
    flag_modified(row, "value")
    await db.commit()
    await db.refresh(row)
    log_request_timing(logger, "PUT /system/hidden-templates", started_at, count=len(row.value or []))
    return HiddenTemplatesResponse(value=row.value or [])


# ─── System template canvas overrides ────────────────────────────────────────

_OVERRIDES_KEY = "system_template_overrides"


class TemplateOverridesResponse(BaseModel):
    """Map of sys-template-id → serialised CanvasDefinition."""
    value: dict[str, Any]


class TemplateOverrideRequest(BaseModel):
    widthPx: float
    heightPx: float
    elements: list[Any]


@router.get("/template-overrides", response_model=TemplateOverridesResponse)
async def get_template_overrides(db: AsyncSession = Depends(get_db)) -> TemplateOverridesResponse:
    started_at = perf_counter()
    row = await _get_or_create_config(db, _OVERRIDES_KEY, {})
    await db.commit()
    log_request_timing(logger, "GET /system/template-overrides", started_at, count=len(row.value or {}))
    return TemplateOverridesResponse(value=row.value or {})


@router.put("/template-override/{sys_id}", response_model=TemplateOverridesResponse)
async def set_template_override(
    sys_id: str,
    payload: TemplateOverrideRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_admin_user),
) -> TemplateOverridesResponse:
    started_at = perf_counter()
    row = await _get_or_create_config(db, _OVERRIDES_KEY, {})
    overrides: dict[str, Any] = dict(row.value or {})
    overrides[sys_id] = payload.model_dump()
    row.value = overrides
    flag_modified(row, "value")
    await db.commit()
    await db.refresh(row)
    log_request_timing(logger, "PUT /system/template-override/{sys_id}", started_at, sys_id=sys_id)
    return TemplateOverridesResponse(value=row.value or {})


@router.delete("/template-override/{sys_id}", response_model=TemplateOverridesResponse)
async def delete_template_override(
    sys_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_admin_user),
) -> TemplateOverridesResponse:
    started_at = perf_counter()
    row = await _get_or_create_config(db, _OVERRIDES_KEY, {})
    overrides: dict[str, Any] = dict(row.value or {})
    overrides.pop(sys_id, None)
    row.value = overrides
    flag_modified(row, "value")
    await db.commit()
    await db.refresh(row)
    log_request_timing(logger, "DELETE /system/template-override/{sys_id}", started_at, sys_id=sys_id)
    return TemplateOverridesResponse(value=row.value or {})
