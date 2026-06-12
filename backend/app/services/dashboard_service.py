from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Customer, Opportunity, FactSheet, User
from app.repositories.factsheet_repo import FactSheetRepository, FactRegistryRepository
from app.schemas.factsheet import FactSheetCreate, FactSheetUpdate


class FactSheetService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FactSheetRepository(db)
        self.registry_repo = FactRegistryRepository(db)

    async def get_by_opportunity(self, opportunity_id: UUID, category: str | None = None) -> list[FactSheet]:
        return await self.repo.get_by_opportunity(opportunity_id, category)

    async def create(self, data: FactSheetCreate, user_id: UUID) -> FactSheet:
        latest = await self.repo.get_latest_by_opportunity_and_category(data.opportunity_id, data.category)
        version = (latest.version + 1) if latest else 1
        fact_sheet = FactSheet(
            opportunity_id=data.opportunity_id,
            category=data.category,
            facts=data.facts,
            version=version,
            created_by=user_id,
        )
        return await self.repo.create(fact_sheet)

    async def update(self, fact_sheet_id: UUID, data: FactSheetUpdate, user_id: UUID) -> FactSheet:
        existing = await self.repo.get_by_id(fact_sheet_id)
        if not existing:
            raise ValueError("Fact Sheet not found")
        new_version = existing.version + 1
        fact_sheet = FactSheet(
            opportunity_id=existing.opportunity_id,
            category=data.category or existing.category,
            facts=data.facts if data.facts is not None else existing.facts,
            version=new_version,
            created_by=user_id,
        )
        return await self.repo.create(fact_sheet)

    async def get_registry(self, category: str | None = None):
        return await self.registry_repo.get_all(category)


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> dict:
        customer_count = (await self.db.execute(select(func.count(Customer.id)))).scalar_one()
        opportunity_count = (await self.db.execute(select(func.count(Opportunity.id)))).scalar_one()
        active_opportunity_count = (
            await self.db.execute(select(func.count(Opportunity.id)).where(Opportunity.status != "closed_lost"))
        ).scalar_one()
        total_revenue = float(
            (await self.db.execute(select(func.sum(Opportunity.estimated_revenue)))).scalar_one() or 0
        )
        user_count = (await self.db.execute(select(func.count(User.id)))).scalar_one()

        by_status = {}
        status_result = await self.db.execute(
            select(Opportunity.status, func.count(Opportunity.id)).group_by(Opportunity.status)
        )
        for row in status_result.all():
            by_status[row[0]] = row[1]

        by_type = {}
        type_result = await self.db.execute(
            select(Opportunity.type, func.count(Opportunity.id)).group_by(Opportunity.type)
        )
        for row in type_result.all():
            by_type[row[0]] = row[1]

        recent_opportunities_result = await self.db.execute(
            select(Opportunity).order_by(Opportunity.created_at.desc()).limit(5)
        )
        recent_opportunities = []
        for opp in recent_opportunities_result.scalars().all():
            customer = await self.db.get(Customer, opp.customer_id)
            recent_opportunities.append({
                "id": str(opp.id),
                "name": opp.name,
                "status": opp.status,
                "customer_name": customer.name if customer else "Unknown",
                "estimated_revenue": float(opp.estimated_revenue) if opp.estimated_revenue else None,
                "created_at": opp.created_at.isoformat() if opp.created_at else None,
            })

        return {
            "customer_count": customer_count,
            "opportunity_count": opportunity_count,
            "active_opportunity_count": active_opportunity_count,
            "total_revenue": total_revenue,
            "user_count": user_count,
            "opportunities_by_status": by_status,
            "opportunities_by_type": by_type,
            "recent_opportunities": recent_opportunities,
        }
