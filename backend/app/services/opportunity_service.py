from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Opportunity, Customer
from app.repositories.opportunity_repo import OpportunityRepository
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate


class OpportunityService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = OpportunityRepository(db)

    async def get_by_id(self, opportunity_id: UUID) -> Opportunity | None:
        opportunity = await self.repo.get_by_id(opportunity_id)
        if opportunity:
            customer = await self.db.get(Customer, opportunity.customer_id)
            opportunity.customer_name = customer.name if customer else None
        return opportunity

    async def get_list(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        status: str | None = None,
        customer_id: UUID | None = None,
    ) -> tuple[list[Opportunity], int]:
        skip = (page - 1) * page_size
        opportunities = await self.repo.get_all(skip=skip, limit=page_size, search=search, status=status, customer_id=customer_id)
        for opp in opportunities:
            customer = await self.db.get(Customer, opp.customer_id)
            opp.customer_name = customer.name if customer else None
        total = await self.repo.count(search=search, status=status, customer_id=customer_id)
        return opportunities, total

    async def create(self, data: OpportunityCreate, owner_id: UUID) -> Opportunity:
        opportunity = Opportunity(
            name=data.name,
            customer_id=data.customer_id,
            type=data.type,
            status=data.status,
            estimated_revenue=data.estimated_revenue,
            probability=data.probability,
            description=data.description,
            owner_id=owner_id,
        )
        return await self.repo.create(opportunity)

    async def update(self, opportunity_id: UUID, data: OpportunityUpdate) -> Opportunity:
        opportunity = await self.repo.get_by_id(opportunity_id)
        if not opportunity:
            raise ValueError("Opportunity not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(opportunity, field, value)
        return await self.repo.update(opportunity)

    async def delete(self, opportunity_id: UUID) -> None:
        opportunity = await self.repo.get_by_id(opportunity_id)
        if not opportunity:
            raise ValueError("Opportunity not found")
        await self.repo.delete(opportunity)

    async def get_stats(self) -> dict:
        total_result = await self.db.execute(select(func.count(Opportunity.id)))
        total = total_result.scalar_one()

        by_status_result = await self.db.execute(
            select(Opportunity.status, func.count(Opportunity.id)).group_by(Opportunity.status)
        )
        by_status = {row[0]: row[1] for row in by_status_result.all()}

        revenue_result = await self.db.execute(
            select(func.sum(Opportunity.estimated_revenue))
        )
        total_revenue = float(revenue_result.scalar_one() or 0)

        return {
            "total": total,
            "by_status": by_status,
            "total_revenue": total_revenue,
        }
