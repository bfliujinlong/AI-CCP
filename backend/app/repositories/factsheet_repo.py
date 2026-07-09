from __future__ import annotations
from typing import List, Dict, Optional, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import FactSheet, FactRegistry


class FactSheetRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, fact_sheet_id: UUID) -> FactSheet | None:
        result = await self.db.execute(select(FactSheet).where(FactSheet.id == fact_sheet_id))
        return result.scalar_one_or_none()

    async def get_by_opportunity(self, opportunity_id: UUID, category: str | None = None) -> List[FactSheet]:
        query = select(FactSheet).where(FactSheet.opportunity_id == opportunity_id)
        if category:
            query = query.where(FactSheet.category == category)
        query = query.order_by(FactSheet.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_latest_by_opportunity_and_category(self, opportunity_id: UUID, category: str) -> FactSheet | None:
        result = await self.db.execute(
            select(FactSheet)
            .where(FactSheet.opportunity_id == opportunity_id, FactSheet.category == category)
            .order_by(FactSheet.version.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(self, fact_sheet: FactSheet) -> FactSheet:
        self.db.add(fact_sheet)
        await self.db.flush()
        return fact_sheet

    async def update(self, fact_sheet: FactSheet) -> FactSheet:
        await self.db.flush()
        return fact_sheet


class FactRegistryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, category: str | None = None) -> List[FactRegistry]:
        query = select(FactRegistry)
        if category:
            query = query.where(FactRegistry.category == category)
        result = await self.db.execute(query.order_by(FactRegistry.category, FactRegistry.fact_name))
        return list(result.scalars().all())

    async def get_by_name(self, fact_name: str) -> FactRegistry | None:
        result = await self.db.execute(select(FactRegistry).where(FactRegistry.fact_name == fact_name))
        return result.scalar_one_or_none()
