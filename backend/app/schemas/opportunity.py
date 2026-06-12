from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OpportunityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    customer_id: UUID
    type: str | None = None
    status: str = "discovery"
    estimated_revenue: float | None = None
    probability: int = Field(default=50, ge=0, le=100)
    description: str | None = None


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    type: str | None = None
    status: str | None = None
    estimated_revenue: float | None = None
    probability: int | None = Field(None, ge=0, le=100)
    description: str | None = None


class OpportunityResponse(OpportunityBase):
    id: UUID
    owner_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    customer_name: str | None = None

    model_config = {"from_attributes": True}


class OpportunityListResponse(BaseModel):
    items: list[OpportunityResponse]
    total: int
    page: int
    page_size: int
