"""Skill Registry —— 启动时同步内置 Skill 到数据库。

职责:
1. 启动时遍历 app.ai.skills.BUILTIN_SKILLS
2. 对 DB 中不存在的 skill，插入；版本更高的，更新
3. 提供 in-memory 查询接口（fallback，避免 DB 无数据时 skill 执行失败）

使用:
    from app.ai.registry import seed_builtin_skills, get_builtin_skill_def
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.skills import BUILTIN_SKILLS, get_builtin_skill
from app.models.models import Skill

logger = logging.getLogger(__name__)


async def seed_builtin_skills(db: AsyncSession) -> Dict[str, int]:
    """将内置 Skill 同步到数据库。

    - DB 中不存在 name 的 → 插入
    - DB 中存在 name 但 version 低于内置 → 更新（保留 id）
    - DB 中存在 name 且 version 相同或更高 → 跳过

    返回: {"inserted": N, "updated": M, "skipped": K}
    """
    inserted = updated = skipped = 0

    for skill_def in BUILTIN_SKILLS:
        try:
            result = await db.execute(select(Skill).where(Skill.name == skill_def["name"]))
            existing = result.scalar_one_or_none()

            if existing is None:
                # 新增
                skill = Skill(
                    name=skill_def["name"],
                    category=skill_def["category"],
                    version=skill_def.get("version", "1.0"),
                    description=skill_def.get("description"),
                    prompt_template=skill_def.get("prompt_template"),
                    input_schema=skill_def.get("input_schema", {}),
                    output_schema=skill_def.get("output_schema", {}),
                    status=skill_def.get("status", "active"),
                )
                db.add(skill)
                await db.flush()
                inserted += 1
                logger.info("[SkillRegistry] inserted skill: %s", skill_def["name"])
            else:
                # 版本比对
                if _version_gt(skill_def.get("version", "1.0"), existing.version or "1.0"):
                    existing.category = skill_def["category"]
                    existing.version = skill_def.get("version", "1.0")
                    existing.description = skill_def.get("description")
                    existing.prompt_template = skill_def.get("prompt_template")
                    existing.input_schema = skill_def.get("input_schema", {})
                    existing.output_schema = skill_def.get("output_schema", {})
                    existing.status = skill_def.get("status", "active")
                    await db.flush()
                    updated += 1
                    logger.info("[SkillRegistry] updated skill: %s -> v%s", skill_def["name"], skill_def.get("version"))
                else:
                    skipped += 1
        except Exception as e:
            # 单个 skill 失败不影响其它
            logger.error("[SkillRegistry] failed to seed skill %s: %s", skill_def.get("name"), e)

    await db.commit()
    stats = {"inserted": inserted, "updated": updated, "skipped": skipped}
    logger.info("[SkillRegistry] seed complete: %s", stats)
    return stats


def _version_gt(a: str, b: str) -> bool:
    """简单语义版本比较：a > b 返回 True。仅支持 X.Y 形式。"""
    try:
        a_parts = [int(x) for x in (a or "0.0").split(".")]
        b_parts = [int(x) for x in (b or "0.0").split(".")]
        # 补齐
        while len(a_parts) < len(b_parts):
            a_parts.append(0)
        while len(b_parts) < len(a_parts):
            b_parts.append(0)
        return a_parts > b_parts
    except (ValueError, AttributeError):
        return (a or "") > (b or "")


def list_builtin_skill_defs() -> List[Dict[str, Any]]:
    """返回内存中的内置 skill 定义（不查 DB）。"""
    return list(BUILTIN_SKILLS)


def get_builtin_skill_def(name: str) -> Dict[str, Any] | None:
    """按 name 查找内置 skill 定义（不查 DB，用于 fallback）。"""
    return get_builtin_skill(name)
