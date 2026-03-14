from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    canvas_width_px: float = Field(default=378.0, gt=0)
    canvas_height_px: float = Field(default=227.0, gt=0)
    canvas_json: list[Any] = Field(default_factory=list)


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    canvas_width_px: float | None = Field(default=None, gt=0)
    canvas_height_px: float | None = Field(default=None, gt=0)
    canvas_json: list[Any] | None = None


class TemplateRead(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None
    canvas_width_px: float
    canvas_height_px: float
    canvas_json: list[Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    total: int
    items: list[TemplateRead]
