"""Global search API — search across hosts, CVEs, jobs, and audit logs."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import array
import logging

from database import get_db
from auth import get_current_user
from models.db_models import Host, CVE, PatchJob, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search across hosts, CVEs, and jobs with optimized queries."""
    term = f"%{q}%"
    results = {"hosts": [], "cves": [], "jobs": []}

    try:
        # Hosts - optimized with index hints and limit
        host_result = await db.execute(
            select(Host)
            .where(
                or_(Host.hostname.ilike(term), Host.ip.ilike(term), Host.os.ilike(term))
            )
            .limit(limit)
        )
        results["hosts"] = [
            {
                "id": h.id,
                "hostname": h.hostname,
                "ip": h.ip,
                "os": h.os,
                "is_online": h.is_online,
                "type": "host",
            }
            for h in host_result.scalars().all()
        ]

        # CVEs - optimized with limit
        cve_result = await db.execute(
            select(CVE)
            .where(or_(CVE.id.ilike(term), CVE.description.ilike(term)))
            .limit(limit)
        )
        results["cves"] = [
            {
                "id": c.id,
                "severity": c.severity.value if c.severity else "unknown",
                "cvss_score": c.cvss_score,
                "description": (c.description or "")[:80],
                "type": "cve",
            }
            for c in cve_result.scalars().all()
        ]

        # Jobs - search by initiated_by with limit
        job_result = await db.execute(
            select(PatchJob).where(PatchJob.initiated_by.ilike(term)).limit(limit)
        )
        results["jobs"] = [
            {
                "id": j.id,
                "action": j.action.value if j.action else "unknown",
                "status": j.status.value if j.status else "unknown",
                "host_id": j.host_id,
                "type": "job",
            }
            for j in job_result.scalars().all()
        ]

        total = len(results["hosts"]) + len(results["cves"]) + len(results["jobs"])
        return {"query": q, "total": total, "results": results}

    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")
