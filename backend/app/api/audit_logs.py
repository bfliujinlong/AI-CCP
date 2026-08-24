"""Audit Log API - 审计日志查询接口"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id
from app.core.database import get_db
from app.models.models import AuditLog, User
from uuid import UUID

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    username: str | None = Query(None),
    ip_address: str | None = Query(None),
    action: str | None = Query(None),
    method: str | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """查询审计日志（支持按用户名、IP、操作类型筛选）。"""

    # 构建查询
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if username:
        query = query.where(AuditLog.username.ilike(f"%{username}%"))
        count_query = count_query.where(AuditLog.username.ilike(f"%{username}%"))
    if ip_address:
        query = query.where(AuditLog.ip_address == ip_address)
        count_query = count_query.where(AuditLog.ip_address == ip_address)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if method:
        query = query.where(AuditLog.method == method.upper())
        count_query = count_query.where(AuditLog.method == method.upper())

    # 总数
    total = (await db.execute(count_query)).scalar() or 0

    # 分页
    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    )
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "username": log.username,
                "ip_address": log.ip_address,
                "method": log.method,
                "path": log.path,
                "status_code": log.status_code,
                "duration_ms": log.duration_ms,
                "user_agent": log.user_agent,
                "action": log.action,
                "detail": log.detail,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats")
async def audit_log_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """审计日志统计：按操作类型和IP分组统计。"""
    # 按操作类型统计
    action_stats = await db.execute(
        select(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.id)))
    )
    by_action = [{"action": a, "count": c} for a, c in action_stats if a]

    # 按IP统计（Top 10）
    ip_stats = await db.execute(
        select(AuditLog.ip_address, func.count(AuditLog.id))
        .where(AuditLog.ip_address.isnot(None))
        .group_by(AuditLog.ip_address)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    by_ip = [{"ip": ip, "count": c} for ip, c in ip_stats if ip]

    # 按用户统计（Top 10）
    user_stats = await db.execute(
        select(AuditLog.username, func.count(AuditLog.id))
        .where(AuditLog.username.isnot(None))
        .group_by(AuditLog.username)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )
    by_user = [{"username": u, "count": c} for u, c in user_stats if u]

    return {
        "by_action": by_action,
        "by_ip": by_ip,
        "by_user": by_user,
    }
