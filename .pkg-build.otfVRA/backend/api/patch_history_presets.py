from datetime import datetime

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user, require_role
from database import get_db
from models.db_models import PatchHistoryPreset, User, UserRole

router = APIRouter(prefix="/api/patch-history", tags=["patch-history"])


class PresetIn(BaseModel):
    name: str
    scope_type: str = "user"  # user | role | global
    role: Optional[str] = None
    filters: dict = Field(default_factory=dict)


class PresetUpdate(BaseModel):
    name: Optional[str] = None
    filters: Optional[dict] = None
    is_active: Optional[bool] = None


def _role_name(user: User) -> str:
    r = getattr(user, "role", "")
    return r.value if hasattr(r, "value") else str(r)


def _is_admin(user: User) -> bool:
    return _role_name(user) == UserRole.admin.value


def _serialize(row: PatchHistoryPreset) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "scope_type": row.scope_type,
        "role": row.role,
        "user_id": row.user_id,
        "filters": row.filters or {},
        "is_active": bool(row.is_active),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/presets")
async def list_presets(
    include_inactive: bool = False,
    include_all: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(PatchHistoryPreset)
    if not include_inactive:
        q = q.where(PatchHistoryPreset.is_active == True)
    if include_all and _is_admin(user):
        rows = (await db.execute(q.order_by(PatchHistoryPreset.scope_type.asc(), PatchHistoryPreset.name.asc()))).scalars().all()
        return [_serialize(r) for r in rows]
    role = _role_name(user)
    rows = (
        await db.execute(
            q.where(
                or_(
                    PatchHistoryPreset.scope_type == "global",
                    (PatchHistoryPreset.scope_type == "role") & (PatchHistoryPreset.role == role),
                    (PatchHistoryPreset.scope_type == "user") & (PatchHistoryPreset.user_id == user.id),
                )
            ).order_by(PatchHistoryPreset.scope_type.asc(), PatchHistoryPreset.name.asc())
        )
    ).scalars().all()
    return [_serialize(r) for r in rows]


@router.post("/presets")
async def create_preset(
    body: PresetIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scope = (body.scope_type or "user").strip().lower()
    if scope not in {"user", "role", "global"}:
        raise HTTPException(400, "scope_type must be one of: user, role, global")
    if scope in {"role", "global"} and not _is_admin(user):
        raise HTTPException(403, "Only admin can create role/global shared presets")
    role = (body.role or "").strip().lower() if scope == "role" else None
    if scope == "role" and role not in {r.value for r in UserRole}:
        raise HTTPException(400, "Invalid role for role-scoped preset")
    row = PatchHistoryPreset(
        name=(body.name or "").strip()[:120],
        scope_type=scope,
        role=role,
        user_id=user.id if scope == "user" else None,
        filters=body.filters or {},
        is_active=True,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


@router.put("/presets/{preset_id}")
async def update_preset(
    preset_id: int,
    body: PresetUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = await db.get(PatchHistoryPreset, preset_id)
    if not row:
        raise HTTPException(404, "Preset not found")
    if row.scope_type == "user":
        if row.user_id != user.id and not _is_admin(user):
            raise HTTPException(403, "Not allowed to update this preset")
    elif not _is_admin(user):
        raise HTTPException(403, "Only admin can update role/global presets")
    if body.name is not None:
        row.name = body.name.strip()[:120]
    if body.filters is not None:
        row.filters = body.filters
    if body.is_active is not None:
        row.is_active = bool(body.is_active)
    row.updated_at = _utcnow()
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


@router.delete("/presets/{preset_id}")
async def delete_preset(
    preset_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = await db.get(PatchHistoryPreset, preset_id)
    if not row:
        raise HTTPException(404, "Preset not found")
    if row.scope_type == "user":
        if row.user_id != user.id and not _is_admin(user):
            raise HTTPException(403, "Not allowed to delete this preset")
    elif not _is_admin(user):
        raise HTTPException(403, "Only admin can delete role/global presets")
    await db.delete(row)
    await db.commit()
    return {"ok": True}

