from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Opportunity


class OpportunityRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, opportunity_id: UUID) -> Opportunity | None:
        result = await self.db.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
        return result.scalar_one_or_none()

    async def get_by_customer(self, customer_id: UUID, skip: int = 0, limit: int = 20) -> list[Opportunity]:
        result = await self.db.execute(
            select(Opportunity)
            .where(Opportunity.customer_id == customer_id)
            .order_by(Opportunity.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        status: str | None = None,
        customer_id: UUID | None = None,
    ) -> list[Opportunity]:
        query = select(Opportunity)
        if search:
            query = query.where(Opportunity.name.ilike(f"%{search}%"))
        if status:
            query = query.where(Opportunity.status == status)
        if customer_id:
            query = query.where(Opportunity.customer_id == customer_id)
        query = query.order_by(Opportunity.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(
        self,
        search: str | None = None,
        status: str | None = None,
        customer_id: UUID | None = None,
    ) -> int:
        query = select(func.count(Opportunity.id))
        if search:
            query = query.where(Opportunity.name.ilike(f"%{search}%"))
        if status:
            query = query.where(Opportunity.status == status)
        if customer_id:
            query = query.where(Opportunity.customer_id == customer_id)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def create(self, opportunity: Opportunity) -> Opportunity:
        self.db.add(opportunity)
        await self.db.flush()
        return opportunity

    async def update(self, opportunity: Opportunity) -> Opportunity:
        await self.db.flush()
        return opportunity

    async def delete(self, opportunity: Opportunity) -> None:
        await self.db.delete(opportunity)
        await self.db.flush()
