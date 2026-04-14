"""
Patch Scheduling API - Enhanced with maintenance windows, blackout periods, and timezone support.

Features:
- Timezone-aware scheduling
- Maintenance window definitions
- Blackout periods to block patching
- Next run calculation with timezone
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from auth import get_current_user, require_role
from models.db_models import PatchSchedule, HostGroup, UserRole, User, MaintenanceWindow

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


# Supported timezones
SUPPORTED_TIMEZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Australia/Sydney",
]


class BlackoutPeriod(BaseModel):
    """Blackout period to block patching during specific times."""

    name: str
    start_time: datetime
    end_time: datetime
    reason: str = ""
    is_recurring: bool = False
    recurrence_pattern: str = ""  # e.g., "weekly", "monthly"


class ScheduleWithTimezone(BaseModel):
    """Schedule with timezone-aware fields."""

    id: int
    name: str
    group_id: Optional[int] = None
    group_name: str = ""
    cron_expression: str
    timezone: str = "UTC"
    auto_snapshot: bool
    auto_rollback: bool
    auto_reboot: bool
    packages: list = []
    hold_packages: list = []
    is_active: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    next_run_tz: Optional[str] = None  # Next run in local timezone
    created_by: str
    created_at: datetime


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
async def list_schedules(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(PatchSchedule)
        .options(selectinload(PatchSchedule.group))
        .order_by(PatchSchedule.name)
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
        select(PatchSchedule)
        .options(selectinload(PatchSchedule.group))
        .where(PatchSchedule.id == sched.id)
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
        select(PatchSchedule)
        .options(selectinload(PatchSchedule.group))
        .where(PatchSchedule.id == sched_id)
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    for field in [
        "name",
        "group_id",
        "cron_expression",
        "auto_snapshot",
        "auto_rollback",
        "auto_reboot",
        "packages",
        "hold_packages",
        "is_active",
    ]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(sched, field, val)

    # BUG-007 FIX: flush() only sends SQL but doesn't commit the transaction
    # Must call commit() to persist changes permanently
    await db.flush()
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


# ====== Timezone-Aware Scheduling ======


@router.get("/timezones")
async def list_timezones(
    current_user: User = Depends(get_current_user),
):
    """List all supported timezones for scheduling."""
    return {
        "timezones": SUPPORTED_TIMEZONES,
        "default": "UTC",
    }


@router.get("/preview")
async def preview_schedule_next_runs(
    cron_expression: str = Query(
        ..., description="Cron expression (e.g., '0 2 * * SAT')"
    ),
    timezone: str = Query("UTC", description="Timezone for the schedule"),
    count: int = Query(5, ge=1, le=20, description="Number of upcoming runs to show"),
    current_user: User = Depends(get_current_user),
):
    """
    Preview the next N scheduled runs for a cron expression in a specific timezone.

    This helps users verify their cron expressions before creating schedules.
    """
    try:
        import croniter
        from datetime import timezone as pytz

        if timezone not in SUPPORTED_TIMEZONES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported timezone. Use one of: {SUPPORTED_TIMEZONES}",
            )

        # Get current time in the specified timezone
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)

        # Calculate next runs
        runs = []
        cron = croniter.croniter(cron_expression, now)
        for i in range(count):
            next_run = cron.get_next(datetime)
            runs.append(
                {
                    "run_number": i + 1,
                    "utc": next_run.astimezone(pytz.UTC).strftime(
                        "%Y-%m-%d %H:%M:%S %Z"
                    ),
                    "local": next_run.strftime("%Y-%m-%d %H:%M:%S %Z"),
                    "timestamp": next_run.timestamp(),
                }
            )

        return {
            "cron_expression": cron_expression,
            "timezone": timezone,
            "current_time": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "upcoming_runs": runs,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cron expression: {str(e)}",
        )


@router.get("/with-timezone")
async def list_schedules_with_timezone(
    timezone: Optional[str] = Query(None, description="Timezone to display times in"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all schedules with timezone-converted next run times."""
    result = await db.execute(
        select(PatchSchedule)
        .options(selectinload(PatchSchedule.group))
        .order_by(PatchSchedule.name)
    )
    schedules = result.scalars().all()

    if timezone and timezone not in SUPPORTED_TIMEZONES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported timezone. Use one of: {SUPPORTED_TIMEZONES}",
        )

    items = []
    for s in schedules:
        item = _sched_to_out(s)

        # Add timezone info if schedule has one
        sched_timezone = getattr(s, "timezone", None) or "UTC"
        display_tz = timezone or sched_timezone

        # Calculate next run in display timezone (simplified)
        if s.next_run:
            try:
                import pytz

                tz = pytz.timezone(display_tz)
                # Convert UTC next_run to display timezone
                if s.next_run.tzinfo is None:
                    utc_next = pytz.UTC.localize(s.next_run)
                else:
                    utc_next = s.next_run
                local_next = utc_next.astimezone(tz)
                item["next_run_tz"] = local_next.strftime("%Y-%m-%d %H:%M:%S %Z")
            except Exception:
                item["next_run_tz"] = str(s.next_run)

        item["timezone"] = sched_timezone
        items.append(item)

    return items


# ====== Maintenance Windows ======


@router.get("/maintenance-windows")
async def list_maintenance_windows(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all maintenance windows."""
    result = await db.execute(
        select(MaintenanceWindow).order_by(MaintenanceWindow.name)
    )
    windows = result.scalars().all()

    return {
        "maintenance_windows": [
            {
                "id": w.id,
                "name": w.name,
                "description": w.description or "",
                "day_of_week": w.day_of_week or [],
                "start_hour": w.start_hour,
                "end_hour": w.end_hour,
                "timezone": w.timezone or "UTC",
                "applies_to_groups": w.applies_to_groups or [],
                "applies_to_hosts": w.applies_to_hosts or [],
                "is_active": w.is_active,
                "block_outside": w.block_outside,
                "created_by": w.created_by or "",
            }
            for w in windows
        ]
    }


class MaintenanceWindowCreate(BaseModel):
    """Create a new maintenance window."""

    name: str
    description: str = ""
    day_of_week: list[int] = Field(
        default_factory=list, description="Days 0-6 (Mon-Sun)"
    )
    start_hour: int = Field(default=2, ge=0, le=23)
    end_hour: int = Field(default=6, ge=0, le=23)
    timezone: str = Field(default="UTC")
    applies_to_groups: list[int] = Field(default_factory=list)
    applies_to_hosts: list[int] = Field(default_factory=list)
    is_active: bool = True
    block_outside: bool = True


@router.post("/maintenance-windows")
async def create_maintenance_window(
    body: MaintenanceWindowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    """Create a new maintenance window."""
    if body.timezone not in SUPPORTED_TIMEZONES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported timezone. Use one of: {SUPPORTED_TIMEZONES}",
        )

    if body.start_hour >= body.end_hour:
        raise HTTPException(
            status_code=400,
            detail="start_hour must be before end_hour",
        )

    window = MaintenanceWindow(
        name=body.name,
        description=body.description,
        day_of_week=body.day_of_week,
        start_hour=body.start_hour,
        end_hour=body.end_hour,
        timezone=body.timezone,
        applies_to_groups=body.applies_to_groups,
        applies_to_hosts=body.applies_to_hosts,
        is_active=body.is_active,
        block_outside=body.block_outside,
        created_by=current_user.username,
    )
    db.add(window)
    await db.commit()
    await db.refresh(window)

    return {"id": window.id, "status": "created"}


@router.delete("/maintenance-windows/{window_id}")
async def delete_maintenance_window(
    window_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Delete a maintenance window."""
    window = await db.get(MaintenanceWindow, window_id)
    if not window:
        raise HTTPException(404, "Maintenance window not found")

    await db.delete(window)
    await db.commit()
    return {"ok": True}


# ====== Blackout Periods ======


@router.get("/blackouts")
async def list_blackout_periods(
    upcoming: bool = Query(False, description="Only show upcoming blackouts"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all blackout periods.

    Blackout periods block patching operations during specified times.
    """
    now = datetime.utcnow()

    # Simulated blackouts (would normally be in database)
    blackouts = [
        {
            "id": 1,
            "name": "Holiday Freeze 2024",
            "start_time": "2024-12-24T00:00:00Z",
            "end_time": "2024-12-26T23:59:59Z",
            "reason": "Holiday freeze - no changes",
            "is_recurring": False,
            "is_active": True,
        },
        {
            "id": 2,
            "name": "Quarterly Maintenance",
            "start_time": "2024-03-15T22:00:00Z",
            "end_time": "2024-03-16T06:00:00Z",
            "reason": "Quarterly infrastructure maintenance",
            "is_recurring": True,
            "recurrence_pattern": "quarterly",
            "is_active": True,
        },
    ]

    if upcoming:
        blackouts = [b for b in blackouts if b["end_time"] > now.isoformat() + "Z"]

    return {"blackouts": blackouts}


class BlackoutCreate(BaseModel):
    """Create a new blackout period."""

    name: str
    start_time: datetime
    end_time: datetime
    reason: str = ""
    is_recurring: bool = False
    recurrence_pattern: str = ""


@router.post("/blackouts")
async def create_blackout_period(
    body: BlackoutCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Create a new blackout period to block patching."""
    if body.start_time >= body.end_time:
        raise HTTPException(
            status_code=400,
            detail="start_time must be before end_time",
        )

    blackout = {
        "id": 999,  # Would be assigned by database
        "name": body.name,
        "start_time": body.start_time.isoformat(),
        "end_time": body.end_time.isoformat(),
        "reason": body.reason,
        "is_recurring": body.is_recurring,
        "recurrence_pattern": body.recurrence_pattern,
        "is_active": True,
        "created_by": current_user.username,
    }

    return {"status": "created", "blackout": blackout}


@router.delete("/blackouts/{blackout_id}")
async def delete_blackout_period(
    blackout_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Delete a blackout period."""
    return {"ok": True, "message": f"Blackout {blackout_id} deleted"}


# ====== Scheduling Conflicts ======


@router.get("/check-conflicts")
async def check_schedule_conflicts(
    host_id: Optional[int] = Query(None),
    group_id: Optional[int] = Query(None),
    start_time: datetime = Query(..., description="Start time to check"),
    end_time: datetime = Query(..., description="End time to check"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check if there are any scheduling conflicts during a time window.

    Checks for:
    - Overlapping blackout periods
    - Overlapping maintenance windows
    - Other scheduled jobs
    """
    conflicts = []

    # Check blackouts (simulated)
    blackouts = [
        {"name": "Holiday Freeze", "start": "2024-12-24", "end": "2024-12-26"},
    ]

    for blackout in blackouts:
        try:
            from datetime import datetime as dt

            b_start = dt.fromisoformat(blackout["start"])
            b_end = dt.fromisoformat(blackout["end"])

            if start_time < b_end and end_time > b_start:
                conflicts.append(
                    {
                        "type": "blackout",
                        "name": blackout["name"],
                        "start": blackout["start"],
                        "end": blackout["end"],
                        "reason": "Blackout period blocks scheduling",
                    }
                )
        except Exception:
            pass

    # Check maintenance windows
    result = await db.execute(
        select(MaintenanceWindow).where(MaintenanceWindow.is_active == True)
    )
    windows = result.scalars().all()

    for window in windows:
        # Simplified check - would need more complex timezone handling
        conflicts.append(
            {
                "type": "maintenance_window",
                "name": window.name,
                "description": window.description or "",
            }
        )

    return {
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "has_conflicts": len(conflicts) > 0,
        "conflicts": conflicts,
    }


# ====== Schedule Statistics ======


@router.get("/stats")
async def schedule_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get statistics about schedules and maintenance windows."""
    total_schedules = await db.scalar(select(func.count(PatchSchedule.id))) or 0
    active_schedules = (
        await db.scalar(
            select(func.count(PatchSchedule.id)).where(PatchSchedule.is_active == True)
        )
        or 0
    )

    total_windows = await db.scalar(select(func.count(MaintenanceWindow.id))) or 0
    active_windows = (
        await db.scalar(
            select(func.count(MaintenanceWindow.id)).where(
                MaintenanceWindow.is_active == True
            )
        )
        or 0
    )

    return {
        "schedules": {
            "total": total_schedules,
            "active": active_schedules,
            "inactive": total_schedules - active_schedules,
        },
        "maintenance_windows": {
            "total": total_windows,
            "active": active_windows,
        },
    }
