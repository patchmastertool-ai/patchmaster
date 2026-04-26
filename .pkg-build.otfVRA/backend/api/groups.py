"""Host Groups & Tags API."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from database import get_db
from auth import get_current_user, require_role
from models.db_models import HostGroup, Tag, Host, UserRole, User

router = APIRouter(prefix="/api/groups", tags=["groups"])


class GroupOut(BaseModel):
    id: int
    name: str
    description: str
    host_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GroupCreate(BaseModel):
    name: str
    description: str = ""

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class GroupDetail(BaseModel):
    id: int
    name: str
    description: str
    host_count: int
    hosts: list[dict]


@router.get("/", response_model=List[GroupOut])
async def list_groups(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(HostGroup).options(selectinload(HostGroup.hosts)).order_by(HostGroup.name))
    groups = result.scalars().all()
    return [
        {**{c.name: getattr(g, c.name) for c in g.__table__.columns}, "host_count": len(g.hosts)}
        for g in groups
    ]


@router.post("/", response_model=GroupOut)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    existing = await db.execute(select(HostGroup).where(HostGroup.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Group already exists")
    grp = HostGroup(name=body.name, description=body.description)
    db.add(grp)
    await db.flush()
    await db.commit()
    await db.refresh(grp)
    return {**{c.name: getattr(grp, c.name) for c in grp.__table__.columns}, "host_count": 0}


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(HostGroup).options(selectinload(HostGroup.hosts)).where(HostGroup.id == group_id)
    )
    grp = result.scalar_one_or_none()
    if not grp:
        raise HTTPException(404, "Group not found")
    return {
        **{c.name: getattr(grp, c.name) for c in grp.__table__.columns},
        "host_count": len(grp.hosts),
        "hosts": [
            {
                "id": h.id,
                "hostname": h.hostname,
                "ip": h.ip,
                "os": h.os,
            }
            for h in grp.hosts
        ],
    }


@router.put("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    result = await db.execute(
        select(HostGroup).options(selectinload(HostGroup.hosts)).where(HostGroup.id == group_id)
    )
    grp = result.scalar_one_or_none()
    if not grp:
        raise HTTPException(404, "Group not found")
    if body.name is not None:
        grp.name = body.name
    if body.description is not None:
        grp.description = body.description
    await db.flush()
    await db.commit()
    return {**{c.name: getattr(grp, c.name) for c in grp.__table__.columns}, "host_count": len(grp.hosts)}


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(HostGroup).where(HostGroup.id == group_id))
    grp = result.scalar_one_or_none()
    if not grp:
        raise HTTPException(404, "Group not found")
    await db.delete(grp)
    await db.commit()
    return {"ok": True}


@router.post("/{group_id}/hosts/{host_id}")
async def add_host_to_group(
    group_id: int,
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    grp = await db.get(HostGroup, group_id)
    host = await db.get(Host, host_id)
    if not grp or not host:
        raise HTTPException(404, "Group or host not found")
    result = await db.execute(
        select(HostGroup).options(selectinload(HostGroup.hosts)).where(HostGroup.id == group_id)
    )
    grp = result.scalar_one()
    if host not in grp.hosts:
        grp.hosts.append(host)
        await db.flush()
    await db.commit()
    return {"ok": True}


@router.delete("/{group_id}/hosts/{host_id}")
async def remove_host_from_group(
    group_id: int,
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    result = await db.execute(
        select(HostGroup).options(selectinload(HostGroup.hosts)).where(HostGroup.id == group_id)
    )
    grp = result.scalar_one_or_none()
    if not grp:
        raise HTTPException(404, "Group not found")
    host = await db.get(Host, host_id)
    if host in grp.hosts:
        grp.hosts.remove(host)
        await db.flush()
    await db.commit()
    return {"ok": True}


# ── Tags ──

tags_router = APIRouter(prefix="/api/tags", tags=["tags"])

class TagOut(BaseModel):
    id: int
    name: str
    host_count: int = 0

    model_config = ConfigDict(from_attributes=True)


@tags_router.get("/", response_model=List[TagOut])
async def list_tags(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).options(selectinload(Tag.hosts)).order_by(Tag.name))
    tags = result.scalars().all()
    return [{"id": t.id, "name": t.name, "host_count": len(t.hosts)} for t in tags]


@tags_router.delete("/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(404, "Tag not found")
    await db.delete(tag)
    await db.commit()
    return {"ok": True}
