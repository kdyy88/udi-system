from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.label import LabelHistoryResponse, LabelInput


class BatchTemplateDefinition(BaseModel):
    widthPx: float = Field(gt=0)
    heightPx: float = Field(gt=0)
    elements: list[Any] = Field(default_factory=list)


class BatchCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source: Literal["excel", "form"] = "excel"
    template_definition: BatchTemplateDefinition
    items: list[LabelInput] = Field(min_length=1, max_length=500)


class BatchCreateResponse(BaseModel):
    batch_id: int
    name: str
    source: str
    total_count: int
    created_at: datetime


class LabelBatchSummary(BaseModel):
    id: int
    owner_id: str
    name: str
    source: str
    total_count: int
    created_at: datetime
    template_definition: BatchTemplateDefinition | None = None


class LabelBatchListResponse(BaseModel):
    total: int | None
    next_cursor: int | None
    items: list[LabelBatchSummary]


class LabelBatchDetailResponse(LabelBatchSummary):
    next_cursor: int | None
    labels: list[LabelHistoryResponse]
