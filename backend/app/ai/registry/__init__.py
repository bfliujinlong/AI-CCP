"""AICC AI Skill Registry。

入口:
    from app.ai.registry import seed_builtin_skills, get_builtin_skill_def, list_builtin_skill_defs
"""

from app.ai.registry.skill_registry import (
    seed_builtin_skills,
    get_builtin_skill_def,
    list_builtin_skill_defs,
)

__all__ = ["seed_builtin_skills", "get_builtin_skill_def", "list_builtin_skill_defs"]
