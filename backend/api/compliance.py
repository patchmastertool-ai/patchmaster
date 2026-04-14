"""Compliance Dashboard API — aggregated patch compliance metrics with framework-specific reports.

Supports PCI-DSS, HIPAA, SOC2 compliance frameworks.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional


def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(tzinfo=None)


from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from auth import get_current_user
from models.db_models import (
    Host,
    HostGroup,
    PatchJob,
    JobStatus,
    HostCVE,
    CVE,
    Severity,
    User,
    host_group_assoc,
)

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


class ComplianceFramework(str, Enum):
    """Supported compliance frameworks."""

    PCI_DSS = "pci_dss"
    HIPAA = "hipaa"
    SOC2 = "soc2"
    GDPR = "gdpr"
    NIST = "nist"
    CUSTOM = "custom"


# Framework-specific compliance requirements
FRAMEWORK_REQUIREMENTS = {
    ComplianceFramework.PCI_DSS: {
        "name": "PCI-DSS (Payment Card Industry Data Security Standard)",
        "version": "4.0",
        "critical_requirements": [
            "All critical/high CVEs must be patched within 30 days",
            "System components must have current security patches",
            "Patch management process must be documented",
        ],
        "severity_threshold": Severity.high,  # Treat high+ as critical for PCI
        "patch_window_days": 30,
    },
    ComplianceFramework.HIPAA: {
        "name": "HIPAA (Health Insurance Portability and Accountability Act)",
        "version": "164.312",
        "critical_requirements": [
            "Technical safeguards for ePHI systems",
            "Patch management to address security vulnerabilities",
            "Risk analysis and management",
        ],
        "severity_threshold": Severity.medium,  # More strict for healthcare
        "patch_window_days": 15,
    },
    ComplianceFramework.SOC2: {
        "name": "SOC 2 (Service Organization Control 2)",
        "version": "2017",
        "critical_requirements": [
            "Security controls must be operational",
            "Change management for security patches",
            "Monitoring and incident response",
        ],
        "severity_threshold": Severity.high,
        "patch_window_days": 30,
    },
    ComplianceFramework.GDPR: {
        "name": "GDPR (General Data Protection Regulation)",
        "version": "2016/679",
        "critical_requirements": [
            "Appropriate technical measures for data protection",
            "Security of processing",
            "Breach notification within 72 hours",
        ],
        "severity_threshold": Severity.medium,
        "patch_window_days": 72,  # 72 hours for breaches
    },
    ComplianceFramework.NIST: {
        "name": "NIST Cybersecurity Framework",
        "version": "2.0",
        "critical_requirements": [
            "Identify vulnerabilities and threats",
            "Protect against threats",
            "Detect anomalies and incidents",
            "Respond to detected incidents",
            "Recover from incidents",
        ],
        "severity_threshold": Severity.high,
        "patch_window_days": 30,
    },
}


class FrameworkReportResponse(BaseModel):
    """Response model for framework compliance reports."""

    framework: str
    framework_name: str
    version: str
    overall_score: float
    compliance_status: str  # compliant, non_compliant, partially_compliant
    host_count: int
    compliant_hosts: int
    non_compliant_hosts: int
    total_cves: int
    unpatched_critical: int
    unpatched_high: int
    patch_deadline: str
    requirements: list
    non_compliant_hosts_detail: list


@router.get("/overview")
async def compliance_overview(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """High-level compliance dashboard data."""
    total_hosts = await db.scalar(select(func.count(Host.id)))
    online_hosts = await db.scalar(
        select(func.count(Host.id)).where(Host.is_online == True)
    )
    avg_compliance = await db.scalar(select(func.avg(Host.compliance_score))) or 0
    reboot_required = await db.scalar(
        select(func.count(Host.id)).where(Host.reboot_required == True)
    )
    total_upgradable = await db.scalar(select(func.sum(Host.upgradable_count))) or 0

    # CVE breakdown
    crit_cves = (
        await db.scalar(
            select(func.count())
            .select_from(HostCVE)
            .join(CVE, CVE.id == HostCVE.cve_id)
            .where(HostCVE.status == "active", CVE.severity == Severity.critical)
        )
        or 0
    )
    high_cves = (
        await db.scalar(
            select(func.count())
            .select_from(HostCVE)
            .join(CVE, CVE.id == HostCVE.cve_id)
            .where(HostCVE.status == "active", CVE.severity == Severity.high)
        )
        or 0
    )
    medium_cves = (
        await db.scalar(
            select(func.count())
            .select_from(HostCVE)
            .join(CVE, CVE.id == HostCVE.cve_id)
            .where(HostCVE.status == "active", CVE.severity == Severity.medium)
        )
        or 0
    )

    # Job stats (last 30 days)
    cutoff = _utcnow() - timedelta(days=30)
    jobs_success = await db.scalar(
        select(func.count(PatchJob.id)).where(
            PatchJob.status == JobStatus.success, PatchJob.created_at >= cutoff
        )
    )
    jobs_failed = await db.scalar(
        select(func.count(PatchJob.id)).where(
            PatchJob.status == JobStatus.failed, PatchJob.created_at >= cutoff
        )
    )

    # Compliance distribution: how many hosts at 100%, 80-99%, <80%
    fully_patched = await db.scalar(
        select(func.count(Host.id)).where(Host.compliance_score >= 100)
    )
    mostly_patched = await db.scalar(
        select(func.count(Host.id)).where(
            Host.compliance_score >= 80, Host.compliance_score < 100
        )
    )
    needs_attention = await db.scalar(
        select(func.count(Host.id)).where(Host.compliance_score < 80)
    )

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
async def compliance_by_group(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Compliance score per host group."""
    result = await db.execute(
        select(HostGroup)
        .options(selectinload(HostGroup.hosts))
        .order_by(HostGroup.name)
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
        data.append(
            {
                "group": g.name,
                "host_count": len(g.hosts),
                "online": online,
                "avg_compliance": round(sum(scores) / len(scores), 1),
                "min_compliance": round(min(scores), 1),
                "total_cves": cves,
                "total_upgradable": upgradable,
            }
        )
    return data


@router.get("/hosts-detail")
async def compliance_hosts(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
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


@router.get("/frameworks")
async def list_compliance_frameworks(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """List all available compliance frameworks and their requirements."""
    return {
        "frameworks": [
            {
                "id": f.value,
                "name": req["name"],
                "version": req["version"],
                "requirements": req["critical_requirements"],
            }
            for f, req in FRAMEWORK_REQUIREMENTS.items()
        ]
    }


@router.get("/reports/{framework}", response_model=FrameworkReportResponse)
async def generate_framework_report(
    framework: ComplianceFramework,
    group_id: Optional[int] = Query(None, description="Filter by host group ID"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Generate a compliance report for a specific framework.

    Supports: pci_dss, hipaa, soc2, gdpr, nist
    """
    if framework not in FRAMEWORK_REQUIREMENTS:
        return {
            "error": f"Unknown framework: {framework}",
            "available": [f.value for f in ComplianceFramework],
        }

    req = FRAMEWORK_REQUIREMENTS[framework]
    patch_window_days = req["patch_window_days"]

    # Build base query
    query = select(Host)
    if group_id:
        query = query.join(host_group_assoc).where(
            host_group_assoc.c.group_id == group_id
        )

    result = await db.execute(query)
    hosts = result.scalars().all()

    # Calculate compliance per host
    cutoff = _utcnow() - timedelta(days=patch_window_days)
    compliant_hosts = 0
    non_compliant_hosts_detail = []
    total_unpatched_critical = 0
    total_unpatched_high = 0

    for host in hosts:
        is_compliant = True
        reasons = []

        # Check compliance score threshold
        if host.compliance_score < 80:
            is_compliant = False
            reasons.append(f"Low compliance score: {host.compliance_score}%")

        # Check for critical/high unpatched CVEs
        cve_result = await db.execute(
            select(func.count(HostCVE.id))
            .join(CVE)
            .where(
                HostCVE.host_id == host.id,
                HostCVE.status == "active",
                CVE.severity.in_([Severity.critical, Severity.high]),
            )
        )
        critical_high_cves = cve_result.scalar() or 0

        if critical_high_cves > 0:
            is_compliant = False
            reasons.append(f"Has {critical_high_cves} unpatched critical/high CVEs")
            total_unpatched_critical += critical_high_cves

        # Check if host was patched recently
        if host.last_patched and host.last_patched < cutoff:
            is_compliant = False
            reasons.append(f"Not patched in last {patch_window_days} days")

        # Check reboot required (could mean patches pending)
        if host.reboot_required:
            reasons.append("Reboot required (patches pending)")

        if is_compliant:
            compliant_hosts += 1
        else:
            non_compliant_hosts_detail.append(
                {
                    "hostname": host.hostname,
                    "ip": host.ip,
                    "compliance_score": host.compliance_score,
                    "reasons": reasons,
                }
            )

    total_hosts = len(hosts)
    overall_score = (compliant_hosts / total_hosts * 100) if total_hosts > 0 else 0

    if overall_score >= 90:
        status = "compliant"
    elif overall_score >= 70:
        status = "partially_compliant"
    else:
        status = "non_compliant"

    return FrameworkReportResponse(
        framework=framework.value,
        framework_name=req["name"],
        version=req["version"],
        overall_score=round(overall_score, 1),
        compliance_status=status,
        host_count=total_hosts,
        compliant_hosts=compliant_hosts,
        non_compliant_hosts=len(non_compliant_hosts_detail),
        total_cves=sum(h.cve_count for h in hosts),
        unpatched_critical=total_unpatched_critical,
        unpatched_high=total_unpatched_high,
        patch_deadline=f"{patch_window_days} days",
        requirements=req["critical_requirements"],
        non_compliant_hosts_detail=non_compliant_hosts_detail[:50],  # Limit detail
    )


@router.get("/reports/{framework}/export")
async def export_framework_report(
    framework: ComplianceFramework,
    format: str = Query("json", description="Export format: json, csv"),
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export a framework compliance report in the specified format."""
    # Generate the report data
    report = await generate_framework_report(framework, group_id, db, user)

    if format == "csv":
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["Hostname", "IP", "Compliance Score", "Non-compliance Reasons"]
        )

        for host_detail in report.non_compliant_hosts_detail:
            writer.writerow(
                [
                    host_detail["hostname"],
                    host_detail["ip"],
                    host_detail["compliance_score"],
                    "; ".join(host_detail["reasons"]),
                ]
            )

        return {
            "format": "csv",
            "data": output.getvalue(),
            "filename": f"compliance_{framework.value}_report.csv",
        }

    return {"format": "json", "data": report}


@router.get("/trends")
async def compliance_trends(
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get compliance trends over time (historical data based on snapshots)."""
    cutoff = _utcnow() - timedelta(days=days)

    # Get current stats
    current_score = await db.scalar(select(func.avg(Host.compliance_score))) or 0
    current_hosts = await db.scalar(select(func.count(Host.id))) or 0

    # Calculate trend from job history (approximation)
    job_trends = []
    for i in range(min(days, 30)):
        day_cutoff = _utcnow() - timedelta(days=i + 1)
        day_start = day_cutoff - timedelta(days=1)

        success_count = (
            await db.scalar(
                select(func.count(PatchJob.id)).where(
                    PatchJob.created_at >= day_start,
                    PatchJob.created_at < day_cutoff,
                    PatchJob.status == JobStatus.success,
                )
            )
            or 0
        )

        job_trends.append(
            {
                "date": day_cutoff.date().isoformat(),
                "patches_applied": success_count,
            }
        )

    return {
        "current_avg_score": round(float(current_score), 1),
        "total_hosts": current_hosts,
        "period_days": days,
        "trends": list(reversed(job_trends)),
    }


@router.get("/audit-summary")
async def compliance_audit_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get summary data for compliance audit purposes."""
    total_hosts = await db.scalar(select(func.count(Host.id))) or 0
    avg_score = await db.scalar(select(func.avg(Host.compliance_score))) or 0

    # Severity breakdown
    critical_hosts = await db.execute(
        select(Host)
        .join(HostCVE)
        .join(CVE)
        .where(HostCVE.status == "active", CVE.severity == Severity.critical)
    )
    critical_host_ids = {h.id for h in critical_hosts.scalars().all()}

    high_hosts = await db.execute(
        select(Host)
        .join(HostCVE)
        .join(CVE)
        .where(HostCVE.status == "active", CVE.severity == Severity.high)
    )
    high_host_ids = {h.id for h in high_hosts.scalars().all()}

    return {
        "total_hosts": total_hosts,
        "average_compliance_score": round(float(avg_score), 1),
        "hosts_with_critical_cves": len(critical_host_ids),
        "hosts_with_high_cves": len(high_host_ids),
        "fully_compliant_hosts": await db.scalar(
            select(func.count(Host.id)).where(Host.compliance_score >= 100)
        )
        or 0,
        "audit_timestamp": _utcnow().isoformat(),
    }
