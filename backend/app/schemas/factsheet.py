from __future__ import annotations
from datetime import datetime
from uuid import UUID
from typing import Any

from pydantic import BaseModel, Field


class FactSheetBase(BaseModel):
    opportunity_id: UUID
    category: str = Field(..., min_length=1, max_length=100)
    facts: dict[str, Any] = Field(default_factory=dict)


class FactSheetCreate(FactSheetBase):
    pass


class FactSheetUpdate(BaseModel):
    category: str | None = Field(None, min_length=1, max_length=100)
    facts: dict[str, Any] | None = None


class FactSheetResponse(FactSheetBase):
    id: UUID
    version: int
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FactRegistryResponse(BaseModel):
    id: UUID
    fact_name: str
    fact_type: str
    description: str | None = None
    validation_rule: dict[str, Any] = Field(default_factory=dict)
    required: bool
    category: str | None = None

    model_config = {"from_attributes": True}
