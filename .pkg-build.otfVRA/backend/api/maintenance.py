"""Maintenance Windows — define allowed patching windows."""
from datetime import datetime

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, require_role
from models.db_models import MaintenanceWindow, User, UserRole

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


class WindowCreate(BaseModel):
    name: str
    description: str = ""
    day_of_week: List[int] = []
    start_hour: int = 2
    end_hour: int = 6
    timezone: str = "UTC"
    applies_to_groups: List[int] = []
    applies_to_hosts: List[int] = []
    block_outside: bool = True


class WindowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    day_of_week: Optional[List[int]] = None
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None
    timezone: Optional[str] = None
    applies_to_groups: Optional[List[int]] = None
    applies_to_hosts: Optional[List[int]] = None
    is_active: Optional[bool] = None
    block_outside: Optional[bool] = None


DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _window_dict(w: MaintenanceWindow) -> dict:
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "day_of_week": w.day_of_week,
        "day_names": [DAY_NAMES[d] for d in (w.day_of_week or []) if 0 <= d <= 6],
        "start_hour": w.start_hour,
        "end_hour": w.end_hour,
        "timezone": w.timezone,
        "applies_to_groups": w.applies_to_groups,
        "applies_to_hosts": w.applies_to_hosts,
        "is_active": w.is_active,
        "block_outside": w.block_outside,
        "created_by": w.created_by,
        "created_at": w.created_at.isoformat(),
    }


@router.get("/")
async def list_windows(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(MaintenanceWindow).order_by(MaintenanceWindow.name))
    return [_window_dict(w) for w in result.scalars().all()]


@router.post("/")
async def create_window(
    body: WindowCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    w = MaintenanceWindow(**body.model_dump(), created_by=user.username)
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return _window_dict(w)


@router.put("/{win_id}")
async def update_window(
    win_id: int,
    body: WindowUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    w = await db.get(MaintenanceWindow, win_id)
    if not w:
        raise HTTPException(404, "Window not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(w, k, v)
    await db.commit()
    return _window_dict(w)


@router.delete("/{win_id}")
async def delete_window(
    win_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    w = await db.get(MaintenanceWindow, win_id)
    if not w:
        raise HTTPException(404, "Window not found")
    await db.delete(w)
    await db.commit()
    return {"ok": True}


@router.get("/check")
async def check_current_window(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Check if current time falls within any active maintenance window."""
    now = _utcnow()
    current_dow = now.weekday()  # 0=Mon
    current_hour = now.hour
    result = await db.execute(select(MaintenanceWindow).where(MaintenanceWindow.is_active == True))
    windows = result.scalars().all()
    active = []
    for w in windows:
        days = w.day_of_week or []
        if current_dow in days and w.start_hour <= current_hour < w.end_hour:
            active.append(_window_dict(w))
    return {"in_window": len(active) > 0, "active_windows": active}
