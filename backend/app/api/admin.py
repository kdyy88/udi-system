"""Admin-only API endpoints (Shell layer — only loaded when ENABLE_AUTH=true).

Provides:
  GET    /admin/users          — List all registered users
  PATCH  /admin/users/{id}     — Update user status / role
  DELETE /admin/users/{id}     — Permanently delete a user
  GET    /admin/stats          — Aggregate usage statistics
  GET    /admin/health         — Extended health (DB + Redis status)

All endpoints require ENABLE_AUTH=true and role == "admin".
The GS1 engine and label-template core remain completely untouched.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, date
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import CurrentUser, get_current_admin
from app.db.models import LabelBatch, LabelHistory, User
from app.db.session import get_db

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AdminUserSummary(BaseModel):
    id: int
    email: str
    username: str | None
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime


class AdminUserListResponse(BaseModel):
    total: int
    items: list[AdminUserSummary]


class AdminUserUpdateRequest(BaseModel):
    is_active: bool | None = None
    role: str | None = None


class AdminStatsResponse(BaseModel):
    total_labels: int
    today_labels: int
    total_batches: int
    total_users: int
    active_users: int  # distinct users who created a label in the last 30 days


class ServiceStatus(BaseModel):
    ok: bool
    detail: str


class AdminHealthResponse(BaseModel):
    timestamp: str
    database: ServiceStatus
    redis: ServiceStatus


# ── User management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(get_current_admin),
) -> AdminUserListResponse:
    """Return all registered users."""
    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar_one()

    users_result = await db.execute(
        select(User).order_by(User.id.asc())
    )
    users = users_result.scalars().all()

    items = [
        AdminUserSummary(
            id=u.id,
            email=u.email,
            username=u.username,
            role=u.role,
            is_active=u.is_active,
            is_verified=u.is_verified,
            created_at=u.created_at,
        )
        for u in users
    ]
    return AdminUserListResponse(total=total, items=items)


@router.patch("/users/{user_id}", response_model=AdminUserSummary)
async def update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: CurrentUser = Depends(get_current_admin),
) -> AdminUserSummary:
    """Enable/disable a user or change their role."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # Prevent admin from disabling themselves
    if str(user.id) == admin.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用当前登录的管理员账号",
        )

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        if payload.role not in ("admin", "operator"):
            raise HTTPException(status_code=400, detail="role 只能为 admin 或 operator")
        user.role = payload.role

    await db.commit()
    await db.refresh(user)
    logger.info(
        "Admin %s updated user %d: is_active=%s role=%s",
        admin.username,
        user_id,
        user.is_active,
        user.role,
    )
    return AdminUserSummary(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: CurrentUser = Depends(get_current_admin),
) -> None:
    """Permanently delete a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if str(user.id) == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除当前登录的管理员账号",
        )

    await db.delete(user)
    await db.commit()
    logger.info("Admin %s deleted user %d (%s)", admin.username, user_id, user.email)


# ── Dashboard stats ───────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(get_current_admin),
) -> AdminStatsResponse:
    """Aggregate usage statistics from LabelHistory and LabelBatch."""
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=UTC)
    thirty_days_ago = datetime.fromtimestamp(
        datetime.now(UTC).timestamp() - 30 * 86400, tz=UTC
    )

    total_labels_result = await db.execute(select(func.count()).select_from(LabelHistory))
    total_labels = total_labels_result.scalar_one()

    today_labels_result = await db.execute(
        select(func.count()).where(LabelHistory.created_at >= today_start)
    )
    today_labels = today_labels_result.scalar_one()

    total_batches_result = await db.execute(select(func.count()).select_from(LabelBatch))
    total_batches = total_batches_result.scalar_one()

    total_users_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_users_result.scalar_one()

    # Active = distinct users who generated at least one label in the last 30 days
    active_users_result = await db.execute(
        select(func.count(func.distinct(LabelHistory.owner_id))).where(
            LabelHistory.created_at >= thirty_days_ago
        )
    )
    active_users = active_users_result.scalar_one()

    return AdminStatsResponse(
        total_labels=total_labels,
        today_labels=today_labels,
        total_batches=total_batches,
        total_users=total_users,
        active_users=active_users,
    )


# ── Extended health check ─────────────────────────────────────────────────────

@router.get("/health", response_model=AdminHealthResponse)
async def admin_health(
    db: AsyncSession = Depends(get_db),
    _admin: CurrentUser = Depends(get_current_admin),
) -> AdminHealthResponse:
    """Extended health check: database + Redis status."""
    # — Database probe —
    try:
        await db.execute(text("SELECT 1"))
        db_status = ServiceStatus(ok=True, detail="connected")
    except Exception as exc:  # noqa: BLE001
        db_status = ServiceStatus(ok=False, detail=str(exc)[:120])

    # — Redis probe —
    try:
        from app.db.redis import _redis_pool  # noqa: PLC0415
        if _redis_pool is not None:
            await _redis_pool.ping()
            redis_status = ServiceStatus(ok=True, detail="connected")
        else:
            redis_status = ServiceStatus(ok=False, detail="未连接（限流功能已禁用）")
    except Exception as exc:  # noqa: BLE001
        redis_status = ServiceStatus(ok=False, detail=str(exc)[:120])

    return AdminHealthResponse(
        timestamp=datetime.now(UTC).isoformat(),
        database=db_status,
        redis=redis_status,
    )
