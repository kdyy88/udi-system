from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.label import LabelHistoryResponse, LabelInput


class BatchCreateRequest(BaseModel):
    user_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=200)
    source: Literal["excel", "form"] = "excel"
    items: list[LabelInput] = Field(min_length=1, max_length=500)


class BatchCreateResponse(BaseModel):
    batch_id: int
    name: str
    source: str
    total_count: int
    created_at: datetime


class LabelBatchSummary(BaseModel):
    id: int
    user_id: int
    name: str
    source: str
    total_count: int
    created_at: datetime


class LabelBatchListResponse(BaseModel):
    total: int
    next_cursor: int | None
    items: list[LabelBatchSummary]


class LabelBatchDetailResponse(LabelBatchSummary):
    next_cursor: int | None
    labels: list[LabelHistoryResponse]
