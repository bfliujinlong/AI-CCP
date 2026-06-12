from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Skill


class SkillRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, skill_id: UUID) -> Skill | None:
        result = await self.db.execute(select(Skill).where(Skill.id == skill_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Skill | None:
        result = await self.db.execute(select(Skill).where(Skill.name == name))
        return result.scalar_one_or_none()

    async def get_all(self, category: str | None = None) -> list[Skill]:
        query = select(Skill)
        if category:
            query = query.where(Skill.category == category)
        result = await self.db.execute(query.order_by(Skill.category, Skill.name))
        return list(result.scalars().all())

    async def create(self, skill: Skill) -> Skill:
        self.db.add(skill)
        await self.db.flush()
        return skill

    async def update(self, skill: Skill) -> Skill:
        await self.db.flush()
        return skill

    async def delete(self, skill: Skill) -> None:
        await self.db.delete(skill)
        await self.db.flush()
