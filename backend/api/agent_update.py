"""Agent Update Policy API — manage auto-update policies for agents."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List

from database import get_db
from auth import get_current_user, require_role
from models.db_models import AgentUpdatePolicy, AgentUpdateChannel, UserRole, User, Host

router = APIRouter(prefix="/api/agent-updates", tags=["agent-updates"])


class PolicyOut(BaseModel):
    id: int
    name: str
    channel: str
    auto_update: bool
    target_version: Optional[str]
    applies_to_groups: list
    applies_to_hosts: list
    created_at: datetime


class PolicyCreate(BaseModel):
    name: str
    channel: str = "stable"
    auto_update: bool = False
    target_version: Optional[str] = None
    applies_to_groups: List[int] = []
    applies_to_hosts: List[int] = []


@router.get("/policies", response_model=List[PolicyOut])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (await db.execute(select(AgentUpdatePolicy).order_by(desc(AgentUpdatePolicy.created_at)))).scalars().all()
    return [PolicyOut(
        id=r.id, name=r.name, channel=r.channel.value if hasattr(r.channel, 'value') else r.channel,
        auto_update=r.auto_update, target_version=r.target_version,
        applies_to_groups=r.applies_to_groups or [], applies_to_hosts=r.applies_to_hosts or [],
        created_at=r.created_at,
    ) for r in rows]


@router.post("/policies", response_model=PolicyOut)
async def create_policy(
    body: PolicyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    try:
        channel = AgentUpdateChannel(body.channel)
    except ValueError:
        raise HTTPException(400, f"Invalid channel. Use: {[c.value for c in AgentUpdateChannel]}")

    policy = AgentUpdatePolicy(
        name=body.name,
        channel=channel,
        auto_update=body.auto_update,
        target_version=body.target_version,
        applies_to_groups=body.applies_to_groups,
        applies_to_hosts=body.applies_to_hosts,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return PolicyOut(
        id=policy.id, name=policy.name,
        channel=policy.channel.value if hasattr(policy.channel, 'value') else policy.channel,
        auto_update=policy.auto_update, target_version=policy.target_version,
        applies_to_groups=policy.applies_to_groups or [], applies_to_hosts=policy.applies_to_hosts or [],
        created_at=policy.created_at,
    )


@router.delete("/policies/{policy_id}")
async def delete_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(AgentUpdatePolicy).where(AgentUpdatePolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(404, "Policy not found")
    await db.delete(policy)
    await db.commit()
    return {"ok": True}


@router.get("/versions")
async def get_agent_versions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get distinct agent versions across the fleet."""
    hosts = (await db.execute(select(Host.agent_version, Host.os).where(Host.agent_version.isnot(None)))).all()
    version_map: dict = {}
    for h in hosts:
        v = h.agent_version or "unknown"
        version_map[v] = version_map.get(v, 0) + 1
    return {
        "versions": [{"version": k, "count": v} for k, v in sorted(version_map.items())],
        "total_hosts": len(hosts),
    }
