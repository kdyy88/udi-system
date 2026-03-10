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


class LabelPreviewResponse(BaseModel):
    di: str
    hri: str
    gs1_element_string: str
    gs1_element_string_escaped: str
    datamatrix_base64: str
    gs1_128_base64: str
    gs1_128_di_only_base64: str | None = None
    gs1_128_pi_only_base64: str | None = None


class LabelGenerateResponse(LabelPreviewResponse):
    history_id: int
    created_at: datetime


class LabelHistoryResponse(BaseModel):
    id: int
    user_id: int
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
    datamatrix_base64: str
    gs1_128_base64: str


class LabelHistoryListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[LabelHistoryResponse]


class LabelPreviewSvgResponse(BaseModel):
    di: str
    hri: str
    gs1_element_string: str
    gs1_element_string_escaped: str
    datamatrix_svg: str
    gs1_128_svg: str
    gs1_128_di_only_svg: str | None = None
    gs1_128_pi_only_svg: str | None = None


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=3, max_length=100)


class LoginResponse(BaseModel):
    user_id: int
    username: str
    message: str
