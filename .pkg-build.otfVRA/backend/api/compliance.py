"""Compliance Dashboard API — aggregated patch compliance metrics."""
from datetime import datetime, timedelta

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from auth import get_current_user
from models.db_models import Host, HostGroup, PatchJob, JobStatus, HostCVE, CVE, Severity, User, host_group_assoc

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("/overview")
async def compliance_overview(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """High-level compliance dashboard data."""
    total_hosts = await db.scalar(select(func.count(Host.id)))
    online_hosts = await db.scalar(select(func.count(Host.id)).where(Host.is_online == True))
    avg_compliance = await db.scalar(select(func.avg(Host.compliance_score))) or 0
    reboot_required = await db.scalar(select(func.count(Host.id)).where(Host.reboot_required == True))
    total_upgradable = await db.scalar(select(func.sum(Host.upgradable_count))) or 0

    # CVE breakdown
    crit_cves = await db.scalar(
        select(func.count())
        .select_from(HostCVE)
        .join(CVE, CVE.id == HostCVE.cve_id)
        .where(HostCVE.status == "active", CVE.severity == Severity.critical)
    ) or 0
    high_cves = await db.scalar(
        select(func.count())
        .select_from(HostCVE)
        .join(CVE, CVE.id == HostCVE.cve_id)
        .where(HostCVE.status == "active", CVE.severity == Severity.high)
    ) or 0
    medium_cves = await db.scalar(
        select(func.count())
        .select_from(HostCVE)
        .join(CVE, CVE.id == HostCVE.cve_id)
        .where(HostCVE.status == "active", CVE.severity == Severity.medium)
    ) or 0

    # Job stats (last 30 days)
    cutoff = _utcnow() - timedelta(days=30)
    jobs_success = await db.scalar(
        select(func.count(PatchJob.id)).where(PatchJob.status == JobStatus.success, PatchJob.created_at >= cutoff)
    )
    jobs_failed = await db.scalar(
        select(func.count(PatchJob.id)).where(PatchJob.status == JobStatus.failed, PatchJob.created_at >= cutoff)
    )

    # Compliance distribution: how many hosts at 100%, 80-99%, <80%
    fully_patched = await db.scalar(select(func.count(Host.id)).where(Host.compliance_score >= 100))
    mostly_patched = await db.scalar(
        select(func.count(Host.id)).where(Host.compliance_score >= 80, Host.compliance_score < 100)
    )
    needs_attention = await db.scalar(select(func.count(Host.id)).where(Host.compliance_score < 80))

    return {
        "total_hosts": total_hosts,
        "online_hosts": online_hosts,
        "avg_compliance": round(avg_compliance, 1),
        "reboot_required": reboot_required,
        "total_upgradable": total_upgradable,
        "cves": {"critical": crit_cves, "high": high_cves, "medium": medium_cves},
        "jobs_30d": {"success": jobs_success, "failed": jobs_failed},
        "compliance_distribution": {
            "fully_patched": fully_patched,
            "mostly_patched": mostly_patched,
            "needs_attention": needs_attention,
        },
    }


@router.get("/by-group")
async def compliance_by_group(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Compliance score per host group."""
    result = await db.execute(
        select(HostGroup).options(selectinload(HostGroup.hosts)).order_by(HostGroup.name)
    )
    groups = result.scalars().all()
    data = []
    for g in groups:
        if not g.hosts:
            continue
        scores = [h.compliance_score for h in g.hosts]
        cves = sum(h.cve_count for h in g.hosts)
        upgradable = sum(h.upgradable_count for h in g.hosts)
        online = sum(1 for h in g.hosts if h.is_online)
        data.append({
            "group": g.name,
            "host_count": len(g.hosts),
            "online": online,
            "avg_compliance": round(sum(scores) / len(scores), 1),
            "min_compliance": round(min(scores), 1),
            "total_cves": cves,
            "total_upgradable": upgradable,
        })
    return data


@router.get("/hosts-detail")
async def compliance_hosts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Per-host compliance detail list."""
    result = await db.execute(
        select(Host).options(selectinload(Host.groups)).order_by(Host.compliance_score)
    )
    hosts = result.scalars().all()
    return [
        {
            "id": h.id,
            "hostname": h.hostname,
            "ip": h.ip,
            "os": f"{h.os} {h.os_version}".strip(),
            "is_online": h.is_online,
            "compliance_score": h.compliance_score,
            "upgradable_count": h.upgradable_count,
            "cve_count": h.cve_count,
            "reboot_required": h.reboot_required,
            "last_patched": h.last_patched.isoformat() if h.last_patched else None,
            "groups": [g.name for g in h.groups],
        }
        for h in hosts
    ]
