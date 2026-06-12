from datetime import datetime
from uuid import UUID
from typing import Any

from pydantic import BaseModel, Field


class SkillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    version: str = "1.0"
    description: str | None = None
    prompt_template: str | None = None
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    status: str = "active"


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    version: str | None = None
    description: str | None = None
    prompt_template: str | None = None
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    status: str | None = None


class SkillResponse(SkillBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SkillExecuteRequest(BaseModel):
    skill_name: str
    inputs: dict[str, Any] = Field(default_factory=dict)


class SkillExecuteResponse(BaseModel):
    skill_name: str
    outputs: dict[str, Any]
    raw_response: str | None = None
