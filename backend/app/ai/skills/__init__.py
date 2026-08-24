"""AICC AI Skills 内置定义。

入口:
    from app.ai.skills import list_builtin_skills, get_builtin_skill

新增 skill 流程:
    1. 在 builtin.py 的 BUILTIN_SKILLS 列表中追加 dict
    2. 启动时由 app.ai.registry.seed_builtin_skills 自动同步到 DB
"""

from app.ai.skills.builtin import BUILTIN_SKILLS, list_builtin_skills, get_builtin_skill

__all__ = ["BUILTIN_SKILLS", "list_builtin_skills", "get_builtin_skill"]
