from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _normalize_transfer_date(value: str, field_name: str) -> str:
    raw = value.strip()

    if len(raw) == 8 and raw[2] == "/" and raw[5] == "/":
        yy, mm, dd = raw.split("/")
        if yy.isdigit() and mm.isdigit() and dd.isdigit():
            if 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31:
                return raw
        raise ValueError(f"{field_name} must be YY/MM/DD")

    if len(raw) == 6 and raw.isdigit():
        mm = int(raw[2:4])
        dd = int(raw[4:6])
        if 1 <= mm <= 12 and 1 <= dd <= 31:
            return f"{raw[:2]}/{raw[2:4]}/{raw[4:6]}"
        raise ValueError(f"{field_name} must be YY/MM/DD")

    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        yyyy, mm, dd = raw.split("-")
        if yyyy.isdigit() and mm.isdigit() and dd.isdigit():
            if 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31:
                return f"{yyyy[-2:]}/{mm}/{dd}"
        raise ValueError(f"{field_name} must be YY/MM/DD")

    raise ValueError(f"{field_name} must be YY/MM/DD")


class LabelInput(BaseModel):
    di: str = Field(min_length=14, max_length=14)
    lot: str | None = None
    expiry: str | None = None
    serial: str | None = None
    production_date: str | None = None
    remarks: str | None = None

    @field_validator("expiry", "production_date", mode="before")
    @classmethod
    def normalize_date_fields(cls, value: str | None, info) -> str | None:
        if value is None or value == "":
            return None
        return _normalize_transfer_date(str(value), info.field_name)


class LabelCreateRequest(LabelInput):
    user_id: int = Field(ge=1)


class LabelGenerateResponse(BaseModel):
    history_id: int
    created_at: datetime
    di: str
    hri: str
    gs1_element_string: str
    gs1_element_string_escaped: str


class LabelHistoryResponse(BaseModel):
    id: int
    user_id: int
    batch_id: int | None = None
    gtin: str
    batch_no: str | None
    expiry_date: str | None
    serial_no: str | None
    production_date: str | None
    remarks: str | None
    full_string: str
    hri: str
    created_at: datetime


class LabelHistoryDetailResponse(LabelHistoryResponse):
    """Detail endpoint — same fields as list item; barcodes rendered client-side."""


class LabelHistoryListResponse(BaseModel):
    total: int
    next_cursor: int | None
    items: list[LabelHistoryResponse]


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=3, max_length=100)


class LoginResponse(BaseModel):
    user_id: int
    username: str
    role: str
    message: str

