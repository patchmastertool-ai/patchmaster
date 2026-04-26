"""CVE Remediation workflow — assign, track, resolve CVE findings."""
from datetime import datetime

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user, require_role
from models.db_models import (
    CVERemediation, RemediationStatus, Host, CVE, User, UserRole
)

router = APIRouter(prefix="/api/remediation", tags=["remediation"])


class RemediationCreate(BaseModel):
    host_id: int
    cve_id: str
    assigned_to: Optional[int] = None
    notes: str = ""
    due_date: Optional[datetime] = None


class RemediationUpdate(BaseModel):
    status: Optional[RemediationStatus] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None


@router.get("/")
async def list_remediations(
    status: Optional[str] = None,
    host_id: Optional[int] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(CVERemediation).order_by(desc(CVERemediation.created_at))
    if status:
        # Bug #17 fix: validate status is a known RemediationStatus value
        try:
            q = q.where(CVERemediation.status == RemediationStatus(status))
        except ValueError:
            raise HTTPException(400, f"Invalid status '{status}'. Valid values: {[s.value for s in RemediationStatus]}")
    if host_id:
        q = q.where(CVERemediation.host_id == host_id)
    q = q.limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()
    out = []
    for r in items:
        host = await db.get(Host, r.host_id)
        cve = await db.get(CVE, r.cve_id)
        assignee = await db.get(User, r.assigned_to) if r.assigned_to else None
        out.append({
            "id": r.id,
            "host_id": r.host_id,
            "hostname": host.hostname if host else "—",
            "cve_id": r.cve_id,
            "severity": cve.severity.value if cve else "—",
            "cvss_score": cve.cvss_score if cve else 0,
            "status": r.status.value,
            "assigned_to": r.assigned_to,
            "assignee_name": assignee.username if assignee else None,
            "notes": r.notes,
            "due_date": r.due_date.isoformat() if r.due_date else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "created_at": r.created_at.isoformat(),
        })
    return out


@router.get("/summary")
async def remediation_summary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    counts = {}
    for s in RemediationStatus:
        counts[s.value] = await db.scalar(
            select(func.count(CVERemediation.id)).where(CVERemediation.status == s)
        ) or 0
    overdue = await db.scalar(
        select(func.count(CVERemediation.id)).where(
            CVERemediation.due_date < _utcnow(),
            CVERemediation.status.notin_([RemediationStatus.resolved, RemediationStatus.false_positive])
        )
    ) or 0
    return {**counts, "overdue": overdue}


@router.post("/")
async def create_remediation(
    body: RemediationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    # Bug #5 fix: db.scalar() returns the first column of the first row, not the ORM object.
    # Use execute + scalar_one_or_none() to get the actual model instance.
    existing_result = await db.execute(
        select(CVERemediation).where(
            CVERemediation.host_id == body.host_id,
            CVERemediation.cve_id == body.cve_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing
    rem = CVERemediation(**body.model_dump())
    db.add(rem)
    await db.commit()
    await db.refresh(rem)
    return rem


@router.put("/{rem_id}")
async def update_remediation(
    rem_id: int,
    body: RemediationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    rem = await db.get(CVERemediation, rem_id)
    if not rem:
        raise HTTPException(404, "Remediation not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(rem, k, v)
    if body.status is not None and body.status in (RemediationStatus.resolved, RemediationStatus.false_positive):
        rem.resolved_at = _utcnow()
    rem.updated_at = _utcnow()
    await db.commit()
    return {"ok": True}


@router.delete("/{rem_id}")
async def delete_remediation(
    rem_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    rem = await db.get(CVERemediation, rem_id)
    if not rem:
        raise HTTPException(404, "Remediation not found")
    await db.delete(rem)
    await db.commit()
    return {"ok": True}
