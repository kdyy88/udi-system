from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import LabelHistory, User
from app.db.session import get_db
from app.schemas.label import (
    LabelCreateRequest,
    LabelGenerateResponse,
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


def _build_gs1_and_hri(payload: LabelInput) -> tuple[str, str]:
    gs1_element_string = build_gs1_element_string(
        di=payload.di,
        lot=payload.lot,
        expiry=payload.expiry,
        serial=payload.serial,
    )
    hri = build_hri_string(
        di=payload.di,
        lot=payload.lot,
        expiry=payload.expiry,
        serial=payload.serial,
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


@router.post("/preview", response_model=LabelPreviewResponse)
async def preview_label(payload: LabelInput) -> LabelPreviewResponse:
    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
        base64_png = render_gs1_datamatrix_base64(hri)
        gs1_128_base64 = render_gs1_128_base64(hri)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return LabelPreviewResponse(
        di=payload.di,
        hri=hri,
        gs1_element_string=gs1_element_string,
        gs1_element_string_escaped=_escaped_gs1(gs1_element_string),
        datamatrix_base64=base64_png,
        gs1_128_base64=gs1_128_base64,
    )


@router.post("/preview-svg", response_model=LabelPreviewSvgResponse)
async def preview_label_svg(payload: LabelInput) -> LabelPreviewSvgResponse:
    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
        datamatrix_svg = render_gs1_datamatrix_svg(hri)
        gs1_128_svg = render_gs1_128_svg(hri)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return LabelPreviewSvgResponse(
        di=payload.di,
        hri=hri,
        gs1_element_string=gs1_element_string,
        gs1_element_string_escaped=_escaped_gs1(gs1_element_string),
        datamatrix_svg=datamatrix_svg,
        gs1_128_svg=gs1_128_svg,
    )


@router.post("/generate", response_model=LabelGenerateResponse)
async def generate_label(
    payload: LabelCreateRequest,
    db: Session = Depends(get_db),
) -> LabelGenerateResponse:
    user = db.execute(select(User).where(User.id == payload.user_id)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user_id not found")

    try:
        gs1_element_string, hri = _build_gs1_and_hri(payload)
        base64_png = render_gs1_datamatrix_base64(hri)
        gs1_128_base64 = render_gs1_128_base64(hri)
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
        datamatrix_base64=base64_png,
        gs1_128_base64=gs1_128_base64,
    )
    db.add(history)
    db.commit()
    db.refresh(history)

    return LabelGenerateResponse(
        history_id=history.id,
        created_at=history.created_at,
        di=payload.di,
        hri=hri,
        gs1_element_string=gs1_element_string,
        gs1_element_string_escaped=_escaped_gs1(gs1_element_string),
        datamatrix_base64=base64_png,
        gs1_128_base64=gs1_128_base64,
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
            datamatrix_base64=row.datamatrix_base64,
            gs1_128_base64=row.gs1_128_base64,
            created_at=row.created_at,
        )
        for row in records
    ]

    return LabelHistoryListResponse(total=total, page=page, page_size=page_size, items=items)


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
