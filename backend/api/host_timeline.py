"""Host Timeline API — per-host event history (patches, CVEs, reboots, agent updates)."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from database import get_db
from auth import get_current_user
from models.db_models import Host, HostTimelineEvent, User

router = APIRouter(prefix="/api/hosts", tags=["host-timeline"])


class TimelineEventOut(BaseModel):
    id: int
    host_id: int
    event_type: str
    title: str
    detail: Optional[dict] = None
    severity: str
    ref_id: Optional[str] = None
    created_at: datetime


class TimelineEventCreate(BaseModel):
    event_type: str
    title: str
    detail: Optional[dict] = None
    severity: str = "info"
    ref_id: Optional[str] = None


@router.get("/{host_id}/timeline", response_model=list[TimelineEventOut])
async def get_host_timeline(
    host_id: int,
    limit: int = Query(default=100, le=500),
    event_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Use scalar_one_or_none via execute to get the ORM object, not just the first column
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(404, "Host not found")

    q = select(HostTimelineEvent).where(HostTimelineEvent.host_id == host_id)
    if event_type:
        q = q.where(HostTimelineEvent.event_type == event_type)
    q = q.order_by(desc(HostTimelineEvent.created_at)).limit(limit)

    events = (await db.execute(q)).scalars().all()
    return [
        TimelineEventOut(
            id=e.id,
            host_id=e.host_id,
            event_type=e.event_type,
            title=e.title,
            detail=e.detail,
            severity=e.severity,
            ref_id=e.ref_id,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.post("/{host_id}/timeline", response_model=TimelineEventOut)
async def add_timeline_event(
    host_id: int,
    body: TimelineEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(404, "Host not found")

    event = HostTimelineEvent(
        host_id=host_id,
        event_type=body.event_type,
        title=body.title,
        detail=body.detail,
        severity=body.severity,
        ref_id=body.ref_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return TimelineEventOut(
        id=event.id,
        host_id=event.host_id,
        event_type=event.event_type,
        title=event.title,
        detail=event.detail,
        severity=event.severity,
        ref_id=event.ref_id,
        created_at=event.created_at,
    )
