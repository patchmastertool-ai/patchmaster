"""Patch SLA tracking — define SLA per severity, track violations."""
from datetime import datetime, timedelta

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, require_role
from models.db_models import (
    PatchSLA, SLAViolation, Host, CVE, HostCVE, Severity, User, UserRole
)

router = APIRouter(prefix="/api/sla", tags=["sla"])


class SLACreate(BaseModel):
    name: str
    severity: Severity
    days_to_patch: int = 7
    notify_before_days: int = 1


class SLAUpdate(BaseModel):
    name: Optional[str] = None
    days_to_patch: Optional[int] = None
    notify_before_days: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_slas(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(PatchSLA).order_by(PatchSLA.severity))
    return result.scalars().all()


@router.post("/")
async def create_sla(
    body: SLACreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    sla = PatchSLA(**body.model_dump(), created_by=user.username)
    db.add(sla)
    await db.commit()
    await db.refresh(sla)
    return sla


@router.put("/{sla_id}")
async def update_sla(
    sla_id: int,
    body: SLAUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    sla = await db.get(PatchSLA, sla_id)
    if not sla:
        raise HTTPException(404, "SLA not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(sla, k, v)
    await db.commit()
    return sla


@router.delete("/{sla_id}")
async def delete_sla(
    sla_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    sla = await db.get(PatchSLA, sla_id)
    if not sla:
        raise HTTPException(404, "SLA not found")
    await db.delete(sla)
    await db.commit()
    return {"ok": True}


@router.get("/violations")
async def list_violations(
    resolved: Optional[bool] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(SLAViolation).order_by(desc(SLAViolation.deadline))
    if resolved is not None:
        q = q.where(SLAViolation.is_resolved == resolved)
    q = q.limit(limit)
    result = await db.execute(q)
    violations = result.scalars().all()
    out = []
    for v in violations:
        host = await db.get(Host, v.host_id)
        cve = await db.get(CVE, v.cve_id)
        out.append({
            "id": v.id,
            "host_id": v.host_id,
            "hostname": host.hostname if host else "—",
            "cve_id": v.cve_id,
            "severity": cve.severity.value if cve else "—",
            "deadline": v.deadline.isoformat(),
            "detected_at": v.detected_at.isoformat(),
            "patched_at": v.patched_at.isoformat() if v.patched_at else None,
            "is_violated": v.is_violated,
            "is_resolved": v.is_resolved,
            "days_overdue": max(0, (_utcnow() - v.deadline).days) if not v.is_resolved else 0,
        })
    return out


@router.get("/violations/summary")
async def violations_summary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    total = await db.scalar(select(func.count(SLAViolation.id))) or 0
    violated = await db.scalar(select(func.count(SLAViolation.id)).where(SLAViolation.is_violated == True, SLAViolation.is_resolved == False)) or 0
    resolved = await db.scalar(select(func.count(SLAViolation.id)).where(SLAViolation.is_resolved == True)) or 0
    upcoming = await db.scalar(
        select(func.count(SLAViolation.id)).where(
            SLAViolation.is_resolved == False,
            SLAViolation.deadline > _utcnow(),
            SLAViolation.deadline <= _utcnow() + timedelta(days=3),
        )
    ) or 0
    return {"total": total, "violated": violated, "resolved": resolved, "upcoming_deadline": upcoming}


@router.post("/scan")
async def scan_violations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    """Scan all active CVEs against SLA policies and create/update violations."""
    slas_result = await db.execute(select(PatchSLA).where(PatchSLA.is_active == True))
    slas = {s.severity: s for s in slas_result.scalars().all()}

    hcve_result = await db.execute(
        select(HostCVE).where(HostCVE.status == "active")
    )
    host_cves = hcve_result.scalars().all()

    created = 0
    for hc in host_cves:
        cve = await db.get(CVE, hc.cve_id)
        if not cve or cve.severity not in slas:
            continue
        sla = slas[cve.severity]
        detected = hc.detected_at or _utcnow()
        deadline = detected + timedelta(days=sla.days_to_patch)

        # Check if violation already exists
        existing_result = await db.execute(
            select(SLAViolation).where(
                SLAViolation.host_id == hc.host_id,
                SLAViolation.cve_id == hc.cve_id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            if not existing.is_resolved and _utcnow() > existing.deadline:
                existing.is_violated = True
                await db.commit()
            continue

        v = SLAViolation(
            host_id=hc.host_id,
            cve_id=hc.cve_id,
            sla_id=sla.id,
            detected_at=detected,
            deadline=deadline,
            is_violated=_utcnow() > deadline,
        )
        db.add(v)
        created += 1

    await db.commit()
    return {"scanned": len(host_cves), "created": created}
