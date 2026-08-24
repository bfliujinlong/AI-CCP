from __future__ import annotations
from typing import List, Dict, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers import get_ai_provider
from app.ai.registry import get_builtin_skill_def
from app.export import save_document
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
        """执行 Skill：DB 优先，缺失则 fallback 到内置定义。

        链路: Skill → Prompt → LLM → Structured Output → Document(PDF/DOCX/MD)
        """
        skill = await self.repo.get_by_name(request.skill_name)

        # Fallback：DB 无此 skill 时，从内置定义加载（提升健壮性）
        if skill is None:
            builtin = get_builtin_skill_def(request.skill_name)
            if builtin is None:
                raise ValueError(f"Skill '{request.skill_name}' not found")
            prompt_template = builtin.get("prompt_template", "")
            output_schema = builtin.get("output_schema", {})
            category = builtin.get("category", "unknown")
            skill_name = builtin.get("name", request.skill_name)
            document_format = builtin.get("document_format", "docx")
        else:
            prompt_template = skill.prompt_template or ""
            output_schema = skill.output_schema or {}
            category = skill.category
            skill_name = skill.name
            # DB 路径：优先读 builtin 的 document_format（Skill model 无此字段）
            builtin = get_builtin_skill_def(skill_name)
            document_format = (builtin or {}).get("document_format", "docx")

        # 变量替换
        prompt = prompt_template
        for key, value in request.inputs.items():
            prompt = prompt.replace(f"{{{key}}}", str(value))

        # 调用 AI Provider
        ai_provider = get_ai_provider()
        structured_output = await ai_provider.generate_structured(
            prompt=prompt,
            output_schema=output_schema,
            system_prompt=f"You are a cloud consulting expert. Execute the skill: {skill_name}. Category: {category}",
        )

        # 自动生成文档（PDF/DOCX/MD）
        document_info = None
        try:
            title = request.title or f"{skill_name} 输出"
            project_meta = request.project_meta or {}
            document_info = save_document(
                outputs=structured_output,
                skill_name=skill_name,
                format=document_format,
                title=title,
                project_meta=project_meta,
            )
        except Exception as e:
            # 文档生成失败不影响 skill 输出（避免阻塞主流程）
            print(f"[SkillService] document generation failed for {skill_name}: {e}")

        return SkillExecuteResponse(
            skill_name=skill_name,
            outputs=structured_output,
            raw_response=str(structured_output),
            document=document_info,
        )
