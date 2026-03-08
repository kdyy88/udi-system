from datetime import datetime

from pydantic import BaseModel, Field


class LabelInput(BaseModel):
    di: str = Field(min_length=14, max_length=14)
    lot: str | None = None
    expiry: str | None = None
    serial: str | None = None
    production_date: str | None = None
    remarks: str | None = None


class LabelCreateRequest(LabelInput):
    user_id: int = Field(ge=1)


class LabelPreviewResponse(BaseModel):
    di: str
    hri: str
    gs1_element_string: str
    gs1_element_string_escaped: str
    datamatrix_base64: str
    gs1_128_base64: str


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
    created_at: datetime


class LabelHistoryListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[LabelHistoryResponse]


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=3, max_length=100)


class LoginResponse(BaseModel):
    user_id: int
    username: str
    message: str
