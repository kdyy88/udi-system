from datetime import UTC, datetime
import logging
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import LabelHistory, User
from app.db.session import SessionLocal, get_db
from app.schemas.label import (
    LabelCreateRequest,
    LabelGenerateResponse,
    LabelHistoryDetailResponse,
    LabelHistoryListResponse,
    LabelHistoryResponse,
    LabelInput,
    LabelPreviewResponse,
    LabelPreviewSvgResponse,
)
from app.services.barcode_gen import (
    render_gs1_128_base64,
    render_gs1_128_svg,
    render_gs1_datamatrix_base64,
    render_gs1_datamatrix_svg,
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


def _build_gs1_and_hri(payload: LabelInput) -> tuple[str, str]:
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


def _build_dual_hri(payload: LabelInput) -> tuple[str, str | None]:
    di_only_hri = f"(01){payload.di}"
    full_without_serial = build_hri_string(
        di=payload.di,
        lot=payload.lot,
        expiry=payload.expiry,
        serial=None,
        production_date=payload.production_date,
    )
    pi_only_hri = full_without_serial.removeprefix(di_only_hri)
    return di_only_hri, (pi_only_hri or None)


def _render_and_persist_barcodes(history_id: int, hri: str) -> None:
    started_at = perf_counter()
    db = SessionLocal()
    try:
        row = db.execute(
            select(LabelHistory).where(LabelHistory.id == history_id)
        ).scalar_one_or_none()
        if row is None:
            logger.warning("background render skipped: history_id=%s not found", history_id)
            return

        row.datamatrix_base64 = render_gs1_datamatrix_base64(hri)
        row.gs1_128_base64 = render_gs1_128_base64(hri)
        db.add(row)
        db.commit()
        _log_timing("BACKGROUND /labels/generate render", started_at, history_id=history_id)
    except Exception:
        db.rollback()
        logger.exception("background render failed for history_id=%s", history_id)
    finally:
        db.close()


@router.get("/ping")
async def labels_ping() -> dict[str, str]:
    return {
        "message": "labels module ready",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.post("/preview", response_model=LabelPreviewResponse)
async def preview_label(payload: LabelInput) -> LabelPreviewResponse:
    started_at = perf_counter()
    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
        base64_png = render_gs1_datamatrix_base64(hri)
        gs1_128_base64 = render_gs1_128_base64(hri)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        _log_timing("POST /labels/preview", started_at)

    return LabelPreviewResponse(
        di=payload.di,
        hri=hri,
        gs1_element_string=gs1_element_string,
        gs1_element_string_escaped=_escaped_gs1(gs1_element_string),
        datamatrix_base64=base64_png,
        gs1_128_base64=gs1_128_base64,
        gs1_128_di_only_base64=None,
        gs1_128_pi_only_base64=None,
    )


@router.post("/preview-svg", response_model=LabelPreviewSvgResponse)
async def preview_label_svg(payload: LabelInput) -> LabelPreviewSvgResponse:
    started_at = perf_counter()
    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
        datamatrix_svg = render_gs1_datamatrix_svg(hri)
        gs1_128_svg = render_gs1_128_svg(hri)
        di_only_hri, pi_only_hri = _build_dual_hri(payload)
        gs1_128_di_only_svg = render_gs1_128_svg(di_only_hri)
        gs1_128_pi_only_svg = render_gs1_128_svg(pi_only_hri) if pi_only_hri else None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        _log_timing("POST /labels/preview-svg", started_at)

    return LabelPreviewSvgResponse(
        di=payload.di,
        hri=hri,
        gs1_element_string=gs1_element_string,
        gs1_element_string_escaped=_escaped_gs1(gs1_element_string),
        datamatrix_svg=datamatrix_svg,
        gs1_128_svg=gs1_128_svg,
        gs1_128_di_only_svg=gs1_128_di_only_svg,
        gs1_128_pi_only_svg=gs1_128_pi_only_svg,
    )


@router.post("/generate", response_model=LabelGenerateResponse)
async def generate_label(
    payload: LabelCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> LabelGenerateResponse:
    started_at = perf_counter()
    user = db.execute(select(User).where(User.id == payload.user_id)).scalar_one_or_none()
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
        datamatrix_base64="",
        gs1_128_base64="",
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    background_tasks.add_task(_render_and_persist_barcodes, history.id, hri)

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
        datamatrix_base64="",
        gs1_128_base64="",
        gs1_128_di_only_base64=None,
        gs1_128_pi_only_base64=None,
    )


@router.get("/history", response_model=LabelHistoryListResponse)
async def list_label_history(
    user_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
    gtin: Annotated[str | None, Query(min_length=14, max_length=14)] = None,
    batch_no: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> LabelHistoryListResponse:
    started_at = perf_counter()
    base_statement = select(LabelHistory).where(LabelHistory.user_id == user_id)

    if gtin:
        base_statement = base_statement.where(LabelHistory.gtin == gtin)
    if batch_no:
        base_statement = base_statement.where(LabelHistory.batch_no == batch_no)

    count_statement = select(func.count()).select_from(base_statement.subquery())
    total = db.execute(count_statement).scalar_one()

    statement = base_statement.order_by(LabelHistory.created_at.desc(), LabelHistory.id.desc())
    statement = statement.offset((page - 1) * page_size).limit(page_size)

    records = db.execute(statement).scalars().all()

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

    response = LabelHistoryListResponse(total=total, page=page, page_size=page_size, items=items)
    _log_timing(
        "GET /labels/history",
        started_at,
        user_id=user_id,
        page=page,
        page_size=page_size,
        rows=len(items),
    )
    return response


@router.get("/history/{history_id}", response_model=LabelHistoryDetailResponse)
async def get_label_history_detail(
    history_id: int,
    user_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
) -> LabelHistoryDetailResponse:
    started_at = perf_counter()
    row = db.execute(
        select(LabelHistory).where(LabelHistory.id == history_id)
    ).scalar_one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="history record not found")

    if row.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this record",
        )

    if not row.datamatrix_base64 or not row.gs1_128_base64:
        row.datamatrix_base64 = render_gs1_datamatrix_base64(row.hri)
        row.gs1_128_base64 = render_gs1_128_base64(row.hri)
        db.add(row)
        db.commit()
        db.refresh(row)

    response = LabelHistoryDetailResponse(
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
        datamatrix_base64=row.datamatrix_base64,
        gs1_128_base64=row.gs1_128_base64,
        created_at=row.created_at,
    )
    _log_timing("GET /labels/history/{history_id}", started_at, history_id=history_id)
    return response


@router.delete("/history/{history_id}")
async def delete_label_history(
    history_id: int,
    user_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    record = db.execute(
        select(LabelHistory).where(LabelHistory.id == history_id)
    ).scalar_one_or_none()

    if record is None:
        raise HTTPException(status_code=404, detail="history record not found")

    if record.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this record",
        )

    db.delete(record)
    db.commit()

    return {"message": "deleted successfully"}
