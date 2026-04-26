"""Dashboard summary API."""
from datetime import datetime, timedelta, timezone

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth import get_current_user
from models.db_models import Host, PatchJob, JobStatus, CVE, HostCVE, Severity, User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    now = _utcnow()
    total_hosts = await db.scalar(select(func.count(Host.id))) or 0
    online_hosts = await db.scalar(select(func.count(Host.id)).where(Host.is_online == True)) or 0
    reboot_required = await db.scalar(select(func.count(Host.id)).where(Host.reboot_required == True)) or 0
    total_cves = await db.scalar(select(func.count(HostCVE.host_id))) or 0
    critical_cves = await db.scalar(
        select(func.count(HostCVE.host_id))
        .join(CVE, CVE.id == HostCVE.cve_id)
        .where(CVE.severity == Severity.critical, HostCVE.status == "active")
    ) or 0
    since = now - timedelta(days=30)
    total_jobs = await db.scalar(select(func.count(PatchJob.id)).where(PatchJob.created_at >= since)) or 0
    success_jobs = await db.scalar(
        select(func.count(PatchJob.id)).where(PatchJob.status == JobStatus.success, PatchJob.created_at >= since)
    ) or 0
    failed_jobs = await db.scalar(
        select(func.count(PatchJob.id)).where(PatchJob.status == JobStatus.failed, PatchJob.created_at >= since)
    ) or 0

    risk = 0
    if total_hosts > 0:
        high_cves = await db.scalar(
            select(func.count(HostCVE.host_id))
            .join(CVE, CVE.id == HostCVE.cve_id)
            .where(CVE.severity == Severity.high, HostCVE.status == "active")
        ) or 0
        offline_ratio = (total_hosts - online_hosts) / total_hosts
        cve_ratio = min((critical_cves * 3 + high_cves) / max(total_hosts, 1), 10) / 10
        risk = int(min(100, (offline_ratio * 30) + (cve_ratio * 50) + (failed_jobs / max(total_jobs, 1)) * 20))

    velocity = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.scalar(
            select(func.count(PatchJob.id)).where(
                PatchJob.created_at >= day_start,
                PatchJob.created_at < day_end,
                PatchJob.status == JobStatus.success,
            )
        ) or 0
        velocity.append({"date": day_start.strftime("%m/%d"), "jobs": count})

    vuln_result = await db.execute(select(Host).order_by(desc(Host.cve_count)).limit(5))
    top_vulnerable = [
        {"id": h.id, "hostname": h.hostname, "cve_count": h.cve_count, "is_online": h.is_online, "os": h.os}
        for h in vuln_result.scalars().all()
    ]

    needs_result = await db.execute(
        select(Host).where(Host.is_online == False, Host.cve_count > 0).limit(5)
    )
    needs_attention = [
        {
            "id": h.id,
            "hostname": h.hostname,
            "cve_count": h.cve_count,
            "last_heartbeat": h.last_heartbeat.isoformat() if h.last_heartbeat else None,
        }
        for h in needs_result.scalars().all()
    ]

    recent_result = await db.execute(
        select(PatchJob)
        .options(selectinload(PatchJob.host))  # ✅ Eager load hosts in one query
        .order_by(desc(PatchJob.created_at))
        .limit(5)
    )
    recent_jobs = []
    for j in recent_result.scalars().all():
        recent_jobs.append({
            "id": j.id,
            "hostname": j.host.hostname if j.host else f"host#{j.host_id}",
            "action": j.action.value,
            "status": j.status.value,
            "created_at": j.created_at.isoformat(),
        })

    return {
        "risk_score": risk,
        "total_hosts": total_hosts,
        "online_hosts": online_hosts,
        "offline_hosts": total_hosts - online_hosts,
        "reboot_required": reboot_required,
        "total_cves": total_cves,
        "critical_cves": critical_cves,
        "total_jobs_30d": total_jobs,
        "success_jobs_30d": success_jobs,
        "failed_jobs_30d": failed_jobs,
        "patch_velocity": velocity,
        "top_vulnerable": top_vulnerable,
        "needs_attention": needs_attention,
        "recent_activity": recent_jobs,
    }


@router.get("/health-ring")
async def health_ring(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    total = await db.scalar(select(func.count(Host.id))) or 0
    online = await db.scalar(select(func.count(Host.id)).where(Host.is_online == True)) or 0
    patched_today = await db.scalar(
        select(func.count(PatchJob.id)).where(
            PatchJob.status == JobStatus.success,
            PatchJob.completed_at >= _utcnow().replace(hour=0, minute=0, second=0),
        )
    ) or 0
    return {
        "total": total,
        "online": online,
        "offline": total - online,
        "patched_today": patched_today,
        "health_pct": round((online / total * 100) if total else 0, 1),
    }
