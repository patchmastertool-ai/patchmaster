"""Audit Trail API — every important action is logged."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, Session
from typing import List, Optional

from database import get_db
from auth import get_current_user
from models.db_models import AuditLog, User

router = APIRouter(prefix="/api/audit", tags=["audit"])


async def log_action(
    db: AsyncSession,
    user: Optional[User],
    action: str,
    target_type: str = "",
    target_id: str = "",
    details: dict = None,
    ip_address: str = "",
):
    """Call this from any endpoint to record an audit entry."""
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=details or {},
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()


class AuditOut(dict):
    pass


@router.get("/")
async def list_audit_logs(
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    user_id: Optional[int] = None,
    days: int = Query(30, le=365),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=500, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    q = (
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .where(AuditLog.created_at >= cutoff)
        .order_by(desc(AuditLog.created_at))
    )
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    if target_type:
        q = q.where(AuditLog.target_type == target_type)
    if user_id:
        q = q.where(AuditLog.user_id == user_id)

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total = await db.scalar(count_q) or 0

    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    logs = result.scalars().all()
    items = [
        {
            "id": l.id,
            "user": l.user.username if l.user else "system",
            "action": l.action,
            "target_type": l.target_type,
            "target_id": l.target_id,
            "details": l.details,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else "",
        }
        for l in logs
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, (total + per_page - 1) // per_page),
    }


@router.get("/stats")
async def audit_stats(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    today = datetime.now(timezone.utc).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    total_today = await db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= today)
    )
    total_week = await db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= week_ago)
    )
    return {"today": total_today, "this_week": total_week}
