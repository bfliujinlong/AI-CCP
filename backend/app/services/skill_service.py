from __future__ import annotations
from typing import List, Dict, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers import get_ai_provider
from app.models.models import Skill
from app.repositories.skill_repo import SkillRepository
from app.repositories.factsheet_repo import FactSheetRepository
from app.schemas.skill import SkillCreate, SkillUpdate, SkillExecuteRequest, SkillExecuteResponse


class SkillService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SkillRepository(db)
        self.factsheet_repo = FactSheetRepository(db)

    async def get_by_id(self, skill_id: UUID) -> Skill | None:
        return await self.repo.get_by_id(skill_id)

    async def get_all(self, category: str | None = None) -> List[Skill]:
        return await self.repo.get_all(category)

    async def create(self, data: SkillCreate) -> Skill:
        skill = Skill(
            name=data.name,
            category=data.category,
            version=data.version,
            description=data.description,
            prompt_template=data.prompt_template,
            input_schema=data.input_schema,
            output_schema=data.output_schema,
            status=data.status,
        )
        return await self.repo.create(skill)

    async def update(self, skill_id: UUID, data: SkillUpdate) -> Skill:
        skill = await self.repo.get_by_id(skill_id)
        if not skill:
            raise ValueError("Skill not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(skill, field, value)
        return await self.repo.update(skill)

    async def delete(self, skill_id: UUID) -> None:
        skill = await self.repo.get_by_id(skill_id)
        if not skill:
            raise ValueError("Skill not found")
        await self.repo.delete(skill)

    async def execute(self, request: SkillExecuteRequest) -> SkillExecuteResponse:
        skill = await self.repo.get_by_name(request.skill_name)
        if not skill:
            raise ValueError(f"Skill '{request.skill_name}' not found")

        prompt = skill.prompt_template or ""
        for key, value in request.inputs.items():
            prompt = prompt.replace(f"{{{key}}}", str(value))

        ai_provider = get_ai_provider()
        structured_output = await ai_provider.generate_structured(
            prompt=prompt,
            output_schema=skill.output_schema,
            system_prompt=f"You are a cloud consulting expert. Execute the skill: {skill.name}. Category: {skill.category}",
        )

        return SkillExecuteResponse(
            skill_name=skill.name,
            outputs=structured_output,
            raw_response=str(structured_output),
        )
