"""Global search API — search across hosts, CVEs, jobs, and audit logs."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth import get_current_user
from models.db_models import Host, CVE, PatchJob, User

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search across hosts, CVEs, and jobs."""
    term = f"%{q}%"
    results = {"hosts": [], "cves": [], "jobs": []}

    # Hosts
    host_result = await db.execute(
        select(Host).where(
            or_(Host.hostname.ilike(term), Host.ip.ilike(term), Host.os.ilike(term))
        ).limit(10)
    )
    results["hosts"] = [
        {"id": h.id, "hostname": h.hostname, "ip": h.ip, "os": h.os, "is_online": h.is_online, "type": "host"}
        for h in host_result.scalars().all()
    ]

    # CVEs
    cve_result = await db.execute(
        select(CVE).where(
            or_(CVE.id.ilike(term), CVE.description.ilike(term))
        ).limit(10)
    )
    results["cves"] = [
        {"id": c.id, "severity": c.severity.value, "cvss_score": c.cvss_score, "description": (c.description or "")[:80], "type": "cve"}
        for c in cve_result.scalars().all()
    ]

    # Jobs
    job_result = await db.execute(
        select(PatchJob).where(PatchJob.initiated_by.ilike(term)).limit(5)
    )
    results["jobs"] = [
        {"id": j.id, "action": j.action.value, "status": j.status.value, "host_id": j.host_id, "type": "job"}
        for j in job_result.scalars().all()
    ]

    total = len(results["hosts"]) + len(results["cves"]) + len(results["jobs"])
    return {"query": q, "total": total, "results": results}
