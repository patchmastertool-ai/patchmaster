"""Patch Scheduling API + background scheduler."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from database import get_db
from auth import get_current_user, require_role
from models.db_models import PatchSchedule, HostGroup, UserRole, User

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


class ScheduleOut(BaseModel):
    id: int
    name: str
    group_id: Optional[int] = None
    group_name: str = ""
    cron_expression: str
    auto_snapshot: bool
    auto_rollback: bool
    auto_reboot: bool
    packages: list = []
    hold_packages: list = []
    is_active: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    created_by: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ScheduleCreate(BaseModel):
    name: str
    group_id: Optional[int] = None
    cron_expression: str = "0 2 * * SAT"  # Default: Saturday 2 AM
    auto_snapshot: bool = True
    auto_rollback: bool = True
    auto_reboot: bool = False
    packages: List[str] = []
    hold_packages: List[str] = []

class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    group_id: Optional[int] = None
    cron_expression: Optional[str] = None
    auto_snapshot: Optional[bool] = None
    auto_rollback: Optional[bool] = None
    auto_reboot: Optional[bool] = None
    packages: Optional[list] = None
    hold_packages: Optional[list] = None
    is_active: Optional[bool] = None


def _sched_to_out(s: PatchSchedule) -> dict:
    d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
    d["group_name"] = s.group.name if s.group else ""
    return d


@router.get("/", response_model=List[ScheduleOut])
async def list_schedules(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(PatchSchedule).options(selectinload(PatchSchedule.group)).order_by(PatchSchedule.name)
    )
    return [_sched_to_out(s) for s in result.scalars().all()]


@router.post("/", response_model=ScheduleOut)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    if body.group_id:
        grp = await db.get(HostGroup, body.group_id)
        if not grp:
            raise HTTPException(404, "Group not found")

    sched = PatchSchedule(
        name=body.name,
        group_id=body.group_id,
        cron_expression=body.cron_expression,
        auto_snapshot=body.auto_snapshot,
        auto_rollback=body.auto_rollback,
        auto_reboot=body.auto_reboot,
        packages=body.packages,
        hold_packages=body.hold_packages,
        created_by=user.username,
    )
    db.add(sched)
    await db.flush()
    await db.commit()
    await db.refresh(sched)
    result = await db.execute(
        select(PatchSchedule).options(selectinload(PatchSchedule.group)).where(PatchSchedule.id == sched.id)
    )
    return _sched_to_out(result.scalar_one())


@router.put("/{sched_id}", response_model=ScheduleOut)
async def update_schedule(
    sched_id: int,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    result = await db.execute(
        select(PatchSchedule).options(selectinload(PatchSchedule.group)).where(PatchSchedule.id == sched_id)
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    for field in ["name", "group_id", "cron_expression", "auto_snapshot", "auto_rollback",
                   "auto_reboot", "packages", "hold_packages", "is_active"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(sched, field, val)
    await db.flush()
    # Bug #7 fix: flush alone doesn't persist — commit is required
    await db.commit()
    await db.refresh(sched)
    return _sched_to_out(sched)


@router.delete("/{sched_id}")
async def delete_schedule(
    sched_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(PatchSchedule).where(PatchSchedule.id == sched_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    await db.delete(sched)
    await db.commit()
    return {"ok": True}
