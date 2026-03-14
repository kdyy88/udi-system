"""System-wide configuration endpoints.

GET  /system/hidden-templates               → public; returns list of hidden system-template IDs
PUT  /system/hidden-templates?user_id=      → admin only; replaces the hidden-ID list

GET  /system/template-overrides             → public; returns canvas overrides keyed by sys template ID
PUT  /system/template-override/{sys_id}     → admin only; upsert a canvas override for one system template
DELETE /system/template-override/{sys_id}   → admin only; remove override (restores factory default)
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import SystemConfig, User
from app.db.session import get_db

router = APIRouter(prefix="/system")

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


async def _require_admin(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user


@router.get("/hidden-templates", response_model=HiddenTemplatesResponse)
async def get_hidden_templates(db: AsyncSession = Depends(get_db)) -> HiddenTemplatesResponse:
    row = await _get_or_create_config(db, _KEY, [])
    await db.commit()
    return HiddenTemplatesResponse(value=row.value or [])


@router.put("/hidden-templates", response_model=HiddenTemplatesResponse)
async def set_hidden_templates(
    payload: HiddenTemplatesRequest,
    user_id: int = Query(..., description="Requesting user ID"),
    db: AsyncSession = Depends(get_db),
) -> HiddenTemplatesResponse:
    await _require_admin(user_id, db)
    row = await _get_or_create_config(db, _KEY, [])
    row.value = payload.value
    await db.commit()
    await db.refresh(row)
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
    row = await _get_or_create_config(db, _OVERRIDES_KEY, {})
    await db.commit()
    return TemplateOverridesResponse(value=row.value or {})


@router.put("/template-override/{sys_id}", response_model=TemplateOverridesResponse)
async def set_template_override(
    sys_id: str,
    payload: TemplateOverrideRequest,
    user_id: int = Query(..., description="Requesting user ID"),
    db: AsyncSession = Depends(get_db),
) -> TemplateOverridesResponse:
    await _require_admin(user_id, db)
    row = await _get_or_create_config(db, _OVERRIDES_KEY, {})
    overrides: dict[str, Any] = dict(row.value or {})
    overrides[sys_id] = payload.model_dump()
    row.value = overrides
    await db.commit()
    await db.refresh(row)
    return TemplateOverridesResponse(value=row.value or {})


@router.delete("/template-override/{sys_id}", response_model=TemplateOverridesResponse)
async def delete_template_override(
    sys_id: str,
    user_id: int = Query(..., description="Requesting user ID"),
    db: AsyncSession = Depends(get_db),
) -> TemplateOverridesResponse:
    await _require_admin(user_id, db)
    row = await _get_or_create_config(db, _OVERRIDES_KEY, {})
    overrides: dict[str, Any] = dict(row.value or {})
    overrides.pop(sys_id, None)
    row.value = overrides
    await db.commit()
    await db.refresh(row)
    return TemplateOverridesResponse(value=row.value or {})
