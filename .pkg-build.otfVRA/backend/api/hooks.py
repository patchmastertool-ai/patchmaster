"""Pre/Post Patch Hooks — run scripts before/after patching."""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, require_role
from models.db_models import PatchHook, HookExecution, HookTrigger, User, UserRole

router = APIRouter(prefix="/api/hooks", tags=["hooks"])


class HookCreate(BaseModel):
    name: str
    trigger: HookTrigger
    script_type: str = "bash"
    script_content: str
    timeout_seconds: int = 120
    applies_to_groups: List[int] = []
    applies_to_hosts: List[int] = []
    stop_on_failure: bool = True


class HookUpdate(BaseModel):
    name: Optional[str] = None
    script_type: Optional[str] = None
    script_content: Optional[str] = None
    timeout_seconds: Optional[int] = None
    applies_to_groups: Optional[List[int]] = None
    applies_to_hosts: Optional[List[int]] = None
    is_active: Optional[bool] = None
    stop_on_failure: Optional[bool] = None


def _hook_dict(h: PatchHook) -> dict:
    return {
        "id": h.id,
        "name": h.name,
        "trigger": h.trigger.value,
        "script_type": h.script_type,
        "script_content": h.script_content,
        "timeout_seconds": h.timeout_seconds,
        "applies_to_groups": h.applies_to_groups,
        "applies_to_hosts": h.applies_to_hosts,
        "is_active": h.is_active,
        "stop_on_failure": h.stop_on_failure,
        "created_by": h.created_by,
        "created_at": h.created_at.isoformat(),
    }


@router.get("/")
async def list_hooks(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(PatchHook).order_by(PatchHook.trigger, PatchHook.name))
    return [_hook_dict(h) for h in result.scalars().all()]


@router.post("/")
async def create_hook(
    body: HookCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    h = PatchHook(**body.model_dump(), created_by=user.username)
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return _hook_dict(h)


@router.put("/{hook_id}")
async def update_hook(
    hook_id: int,
    body: HookUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    h = await db.get(PatchHook, hook_id)
    if not h:
        raise HTTPException(404, "Hook not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(h, k, v)
    await db.commit()
    return _hook_dict(h)


@router.delete("/{hook_id}")
async def delete_hook(
    hook_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    h = await db.get(PatchHook, hook_id)
    if not h:
        raise HTTPException(404, "Hook not found")
    await db.delete(h)
    await db.commit()
    return {"ok": True}


@router.get("/executions")
async def list_executions(
    hook_id: Optional[int] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(HookExecution).order_by(desc(HookExecution.started_at)).limit(limit)
    if hook_id:
        q = q.where(HookExecution.hook_id == hook_id)
    result = await db.execute(q)
    execs = result.scalars().all()
    out = []
    for e in execs:
        hook = await db.get(PatchHook, e.hook_id)
        out.append({
            "id": e.id,
            "hook_id": e.hook_id,
            "hook_name": hook.name if hook else "—",
            "job_id": e.job_id,
            "host_id": e.host_id,
            "trigger": e.trigger.value,
            "status": e.status,
            "output": e.output,
            "exit_code": e.exit_code,
            "started_at": e.started_at.isoformat(),
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        })
    return out
