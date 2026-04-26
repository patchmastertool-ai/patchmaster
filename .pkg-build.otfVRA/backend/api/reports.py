import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, func, select
from database import async_session, get_db
from models.db_models import (
    Host,
    PatchJob,
    CVE,
    HostCVE,
    Policy,
    User,
    JobStatus,
    CICDPipeline,
    CICDBuild,
    CICDDeployment,
    CICDEnvironment,
    CICDVariable,
    CICDBuildArtifact,
    CICDBuildLog,
    GitRepository,
)
from license import get_license_info
import jwt
from jwt import InvalidTokenError
from auth import SECRET_KEY, ALGORITHM
import pandas as pd
from fpdf import FPDF
import tempfile
import logging
from datetime import datetime
import uuid

logger = logging.getLogger("patchmaster.reports")
from api.ops_queue import enqueue_operation

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/patch-summary.csv")
async def patch_summary_csv(
    authorization: str = Header(default=None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    cookie_name = os.getenv("AUTH_COOKIE_NAME", "pm_token")
    cookie_val = request.cookies.get(cookie_name) if request else None
    jwt_token = (bearer or cookie_val or "").strip()
    await _validate_token(db, jwt_token)

    info = get_license_info()
    if "reports" not in info.get("features", []):
        raise HTTPException(status_code=403, detail="Reports require a license with the 'reports' feature")

    hosts = (await db.execute(select(Host))).scalars().all()
    rows = []
    for h in hosts:
        groups = ",".join([g.name for g in (h.groups or [])]) if hasattr(h, "groups") else ""
        hardware = getattr(h, "hardware_inventory", {}) or {}
        rows.append({
            "hostname": h.hostname,
            "ip": h.ip,
            "site": getattr(h, "site", "") or "",
            "os": h.os,
            "cpu_model": hardware.get("cpu_model", ""),
            "cpu_cores": hardware.get("cpu_cores", ""),
            "memory_mb": hardware.get("memory_mb", ""),
            "disk_total_gb": hardware.get("disk_total_gb", ""),
            "boot_mode": hardware.get("boot_mode", ""),
            "uefi_present": hardware.get("uefi_present", ""),
            "secure_boot_enabled": hardware.get("secure_boot_enabled", ""),
            "compliance": h.compliance_score,
            "reboot_required": bool(getattr(h, "reboot_required", False)),
            "last_patched": h.last_patched.isoformat() if h.last_patched else None,
            "online": bool(getattr(h, "is_online", False)),
            "groups": groups,
        })

    df = pd.DataFrame(rows)
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    df.to_csv(path, index=False)
    return FileResponse(path, filename=f"patch_summary_{datetime.now().strftime('%Y%m%d')}.csv", media_type="text/csv")


class PDFReport(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'PatchMaster Enterprise Report', 0, 1, 'C')
        self.set_font('Arial', 'I', 10)
        self.cell(0, 10, f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')


def _safe_cell(pdf, w, h, txt, border=0, ln=0, align='', fill=False):
    """Write a cell, truncating text to avoid FPDF overflow."""
    try:
        pdf.cell(w, h, str(txt)[:60], border, ln, align, fill)
    except Exception:
        pdf.cell(w, h, '', border, ln, align, fill)


async def generate_hardening_report(db: AsyncSession, file_path: str):
    pdf = PDFReport()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    host_count = (await db.scalar(select(func.count(Host.id)))) or 0
    compliant_count = (await db.scalar(select(func.count(Host.id)).where(Host.compliance_score >= 90))) or 0
    pct = int(compliant_count / host_count * 100) if host_count else 0

    pdf.set_font("Arial", 'B', 14)
    _safe_cell(pdf, 0, 10, "1. Executive Summary", 0, 1)
    pdf.set_font("Arial", size=12)
    _safe_cell(pdf, 0, 10, f"Total Managed Hosts: {host_count}", 0, 1)
    _safe_cell(pdf, 0, 10, f"Compliant Systems: {compliant_count} ({pct}%)", 0, 1)
    pdf.ln(5)

    pdf.set_font("Arial", 'B', 14)
    _safe_cell(pdf, 0, 10, "2. Hardening Policy Status", 0, 1)
    pdf.set_font("Arial", size=10)

    pdf.set_fill_color(200, 220, 255)
    _safe_cell(pdf, 60, 10, "Hostname", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 10, "IP Address", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 10, "OS", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 10, "Score", 1, 1, 'C', True)

    hosts = (await db.execute(select(Host).order_by(Host.hostname))).scalars().all()
    for h in hosts:
        score = h.compliance_score or 0
        if score >= 90:
            pdf.set_text_color(0, 150, 0)
        else:
            pdf.set_text_color(200, 0, 0)
        _safe_cell(pdf, 60, 10, (h.hostname or '')[:30], 1)
        _safe_cell(pdf, 40, 10, h.ip or '', 1)
        _safe_cell(pdf, 40, 10, (h.os or 'Unknown')[:20], 1)
        _safe_cell(pdf, 40, 10, f"{score}%", 1, 1, 'C')
        pdf.set_text_color(0, 0, 0)

    pdf.ln(10)
    pdf.set_font("Arial", 'B', 14)
    _safe_cell(pdf, 0, 10, "3. Top Vulnerabilities (CVEs)", 0, 1)

    top_cves = (await db.execute(
        select(CVE.id, CVE.severity, func.count(HostCVE.host_id).label('count'))
        .join(HostCVE)
        .group_by(CVE.id, CVE.severity)
        .order_by(desc('count'))
        .limit(10)
    )).all()

    pdf.set_font("Arial", size=10)
    pdf.set_fill_color(200, 220, 255)
    _safe_cell(pdf, 50, 10, "CVE ID", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 10, "Severity", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 10, "Affected Hosts", 1, 1, 'C', True)

    for cve in top_cves:
        _safe_cell(pdf, 50, 10, cve.id or '', 1)
        _safe_cell(pdf, 40, 10, cve.severity or '', 1)
        _safe_cell(pdf, 40, 10, str(cve.count), 1, 1, 'C')

    pdf.output(file_path)


async def generate_compliance_report(db: AsyncSession, file_path: str):
    pdf = PDFReport()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    host_count = (await db.scalar(select(func.count(Host.id)))) or 0
    compliant_count = (await db.scalar(select(func.count(Host.id)).where(Host.compliance_score >= 90))) or 0
    avg_score = (await db.scalar(select(func.avg(Host.compliance_score)))) or 0
    total_jobs = (await db.scalar(select(func.count(PatchJob.id)))) or 0
    success_jobs = (await db.scalar(select(func.count(PatchJob.id)).where(PatchJob.status == JobStatus.success))) or 0
    pct = int(compliant_count / host_count * 100) if host_count else 0
    success_pct = int(success_jobs / total_jobs * 100) if total_jobs else 0

    pdf.set_font("Arial", 'B', 14)
    _safe_cell(pdf, 0, 10, "Compliance Executive Summary", 0, 1)
    pdf.set_font("Arial", size=12)
    _safe_cell(pdf, 0, 10, f"Report Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 0, 1)
    pdf.ln(5)

    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "Fleet Overview", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"  Total Hosts: {host_count}", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Compliant (>=90%): {compliant_count} ({pct}%)", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Average Compliance Score: {round(float(avg_score), 1)}%", 0, 1)
    pdf.ln(5)

    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "Patch Operations", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"  Total Patch Jobs: {total_jobs}", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Successful Jobs: {success_jobs} ({success_pct}%)", 0, 1)
    pdf.ln(5)

    # Non-compliant hosts
    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "Non-Compliant Hosts (Score < 90%)", 0, 1)
    pdf.set_font("Arial", size=10)
    pdf.set_fill_color(200, 220, 255)
    _safe_cell(pdf, 70, 10, "Hostname", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 10, "IP", 1, 0, 'C', True)
    _safe_cell(pdf, 30, 10, "Score", 1, 0, 'C', True)
    _safe_cell(pdf, 50, 10, "OS", 1, 1, 'C', True)

    non_compliant = (await db.execute(
        select(Host).where(Host.compliance_score < 90).order_by(Host.compliance_score)
    )).scalars().all()

    for h in non_compliant:
        score = h.compliance_score or 0
        pdf.set_text_color(200, 0, 0) if score < 50 else pdf.set_text_color(180, 100, 0)
        _safe_cell(pdf, 70, 10, (h.hostname or '')[:35], 1)
        _safe_cell(pdf, 40, 10, h.ip or '', 1)
        _safe_cell(pdf, 30, 10, f"{score}%", 1, 0, 'C')
        _safe_cell(pdf, 50, 10, (h.os or 'Unknown')[:25], 1, 1)
        pdf.set_text_color(0, 0, 0)

    pdf.output(file_path)


async def generate_full_system_report(db: AsyncSession, file_path: str):
    pdf = PDFReport()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Section 1: Fleet Summary
    host_count = (await db.scalar(select(func.count(Host.id)))) or 0
    online_count = (await db.scalar(select(func.count(Host.id)).where(Host.is_online == True))) or 0
    reboot_count = (await db.scalar(select(func.count(Host.id)).where(Host.reboot_required == True))) or 0
    compliant_count = (await db.scalar(select(func.count(Host.id)).where(Host.compliance_score >= 90))) or 0

    pdf.set_font("Arial", 'B', 14)
    _safe_cell(pdf, 0, 10, "Full System Audit Report", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 0, 1)
    pdf.ln(5)

    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "1. Fleet Summary", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"  Total Hosts: {host_count}  |  Online: {online_count}  |  Offline: {host_count - online_count}", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Reboot Required: {reboot_count}  |  Compliant (>=90%): {compliant_count}", 0, 1)
    pdf.ln(5)

    # Section 2: All Hosts
    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "2. Host Inventory", 0, 1)
    pdf.set_font("Arial", size=9)
    pdf.set_fill_color(200, 220, 255)
    _safe_cell(pdf, 55, 9, "Hostname", 1, 0, 'C', True)
    _safe_cell(pdf, 35, 9, "IP", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 9, "OS", 1, 0, 'C', True)
    _safe_cell(pdf, 20, 9, "Score", 1, 0, 'C', True)
    _safe_cell(pdf, 20, 9, "Online", 1, 0, 'C', True)
    _safe_cell(pdf, 20, 9, "Reboot", 1, 1, 'C', True)

    hosts = (await db.execute(select(Host).order_by(Host.hostname))).scalars().all()
    for h in hosts:
        score = h.compliance_score or 0
        online = getattr(h, 'is_online', False)
        reboot = getattr(h, 'reboot_required', False)
        _safe_cell(pdf, 55, 9, (h.hostname or '')[:28], 1)
        _safe_cell(pdf, 35, 9, h.ip or '', 1)
        _safe_cell(pdf, 40, 9, (h.os or 'Unknown')[:20], 1)
        _safe_cell(pdf, 20, 9, f"{score}%", 1, 0, 'C')
        _safe_cell(pdf, 20, 9, 'Yes' if online else 'No', 1, 0, 'C')
        _safe_cell(pdf, 20, 9, 'Yes' if reboot else 'No', 1, 1, 'C')

    pdf.ln(8)

    # Section 3: Recent Jobs
    pdf.add_page()
    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "3. Recent Patch Jobs (Last 50)", 0, 1)
    pdf.set_font("Arial", size=9)
    pdf.set_fill_color(200, 220, 255)
    _safe_cell(pdf, 55, 9, "Job ID", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 9, "Host", 1, 0, 'C', True)
    _safe_cell(pdf, 30, 9, "Status", 1, 0, 'C', True)
    _safe_cell(pdf, 65, 9, "Started At", 1, 1, 'C', True)

    from sqlalchemy.orm import selectinload
    jobs = (await db.execute(
        select(PatchJob).options(selectinload(PatchJob.host)).order_by(desc(PatchJob.created_at)).limit(50)
    )).scalars().all()

    for j in jobs:
        _safe_cell(pdf, 55, 9, str(j.id)[:28], 1)
        hostname = (j.host.hostname if j.host else str(j.host_id))[:20]
        _safe_cell(pdf, 40, 9, hostname, 1)
        _safe_cell(pdf, 30, 9, (j.status.value if hasattr(j.status, 'value') else str(j.status))[:15], 1, 0, 'C')
        ts = j.created_at.strftime('%Y-%m-%d %H:%M') if j.created_at else ''
        _safe_cell(pdf, 65, 9, ts, 1, 1)

    # Section 4: CVE Summary
    pdf.ln(8)
    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 10, "4. CVE Summary", 0, 1)
    pdf.set_font("Arial", size=11)
    for sev in ['critical', 'high', 'medium', 'low']:
        cnt = (await db.scalar(select(func.count(CVE.id)).where(CVE.severity == sev))) or 0
        _safe_cell(pdf, 0, 8, f"  {sev.title()}: {cnt}", 0, 1)

    pdf.output(file_path)


async def generate_devops_report(db: AsyncSession, file_path: str):
    pdf = PDFReport()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    pipeline_total = (await db.scalar(select(func.count(CICDPipeline.id)))) or 0
    pipeline_active = (await db.scalar(select(func.count(CICDPipeline.id)).where(CICDPipeline.status == "active"))) or 0
    build_total = (await db.scalar(select(func.count(CICDBuild.id)))) or 0
    build_success = (await db.scalar(select(func.count(CICDBuild.id)).where(CICDBuild.status == "success"))) or 0
    build_failed = (await db.scalar(select(func.count(CICDBuild.id)).where(CICDBuild.status == "failed"))) or 0
    deploy_total = (await db.scalar(select(func.count(CICDDeployment.id)))) or 0
    git_repo_total = (await db.scalar(select(func.count(GitRepository.id)))) or 0
    env_total = (await db.scalar(select(func.count(CICDEnvironment.id)))) or 0
    var_total = (await db.scalar(select(func.count(CICDVariable.id)))) or 0
    artifact_total = (await db.scalar(select(func.count(CICDBuildArtifact.id)))) or 0
    log_total = (await db.scalar(select(func.count(CICDBuildLog.id)))) or 0

    success_pct = int(build_success / build_total * 100) if build_total else 0
    failure_pct = int(build_failed / build_total * 100) if build_total else 0

    pdf.set_font("Arial", 'B', 14)
    _safe_cell(pdf, 0, 10, "DevOps Delivery and Platform Report", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 0, 1)
    pdf.ln(4)

    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 9, "1. Platform Capability Coverage", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"  Pipelines configured: {pipeline_total} (active: {pipeline_active})", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Git repositories integrated: {git_repo_total}", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Environments defined: {env_total} | Variables defined: {var_total}", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Build artifacts tracked: {artifact_total} | Build log lines tracked: {log_total}", 0, 1)
    pdf.ln(4)

    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 9, "2. Delivery Performance", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, f"  Total builds: {build_total}", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Successful builds: {build_success} ({success_pct}%)", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Failed builds: {build_failed} ({failure_pct}%)", 0, 1)
    _safe_cell(pdf, 0, 8, f"  Total deployments: {deploy_total}", 0, 1)
    pdf.ln(4)

    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 9, "3. Pipeline Inventory", 0, 1)
    pdf.set_font("Arial", size=9)
    pdf.set_fill_color(200, 220, 255)
    _safe_cell(pdf, 65, 8, "Pipeline", 1, 0, 'C', True)
    _safe_cell(pdf, 25, 8, "Tool", 1, 0, 'C', True)
    _safe_cell(pdf, 30, 8, "Status", 1, 0, 'C', True)
    _safe_cell(pdf, 30, 8, "Builds", 1, 0, 'C', True)
    _safe_cell(pdf, 40, 8, "Last Triggered", 1, 1, 'C', True)

    pipelines = (await db.execute(select(CICDPipeline).order_by(CICDPipeline.name.asc()).limit(100))).scalars().all()
    for pipeline in pipelines:
        build_count = (await db.scalar(select(func.count(CICDBuild.id)).where(CICDBuild.pipeline_id == pipeline.id))) or 0
        last = pipeline.last_triggered.strftime('%Y-%m-%d %H:%M') if pipeline.last_triggered else "Never"
        _safe_cell(pdf, 65, 8, (pipeline.name or "")[:32], 1)
        _safe_cell(pdf, 25, 8, (pipeline.tool or "")[:12], 1, 0, 'C')
        _safe_cell(pdf, 30, 8, (pipeline.status or "")[:12], 1, 0, 'C')
        _safe_cell(pdf, 30, 8, str(build_count), 1, 0, 'C')
        _safe_cell(pdf, 40, 8, last, 1, 1, 'C')

    pdf.ln(4)
    pdf.set_font("Arial", 'B', 12)
    _safe_cell(pdf, 0, 9, "4. Standalone and Integration Readiness", 0, 1)
    pdf.set_font("Arial", size=11)
    _safe_cell(pdf, 0, 8, "  Standalone mode: native pipelines, build history, deployments, artifacts, logs, templates.", 0, 1)
    _safe_cell(pdf, 0, 8, "  Integration mode: external systems such as Jenkins/GitLab/custom webhooks remain supported.", 0, 1)

    pdf.output(file_path)


async def _validate_token(db: AsyncSession, raw_token: str):
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(User).where(func.lower(User.username) == username.lower())
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def _report_path_for_job(job_id: str, report_type: str) -> str:
    report_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports", "generated")
    os.makedirs(report_dir, exist_ok=True)
    return os.path.join(report_dir, f"{report_type}_{job_id}.pdf")


async def _queueable_generate_report(report_type: str, output_path: str) -> dict:
    async with async_session() as session:
        if report_type == "hardening":
            await generate_hardening_report(session, output_path)
        elif report_type == "compliance":
            await generate_compliance_report(session, output_path)
        elif report_type == "full_system":
            await generate_full_system_report(session, output_path)
        elif report_type == "devops":
            await generate_devops_report(session, output_path)
        else:
            raise HTTPException(status_code=400, detail="Invalid report type. Use: hardening, compliance, full_system, devops")
    return {"report_type": report_type, "output_path": output_path}


@router.post("/generate/{report_type}")
async def queue_report_generation(
    report_type: str,
    authorization: str = Header(default=None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    cookie_name = os.getenv("AUTH_COOKIE_NAME", "pm_token")
    cookie_val = request.cookies.get(cookie_name) if request else None
    jwt_token = (bearer or cookie_val or "").strip()
    user = await _validate_token(db, jwt_token)
    info = get_license_info()
    if "reports" not in info.get("features", []):
        raise HTTPException(status_code=403, detail="Reports require a license with the 'reports' feature")
    if report_type not in ["hardening", "compliance", "full_system", "devops"]:
        raise HTTPException(status_code=400, detail="Invalid report type. Use: hardening, compliance, full_system, devops")
    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    job_id = uuid.uuid4().hex
    output_path = _report_path_for_job(job_id, report_type)
    async def _runner():
        return await _queueable_generate_report(report_type, output_path)
    queue_job = await enqueue_operation(
        op_type="reports.generate",
        payload={"report_type": report_type, "output_path": output_path},
        runner=_runner,
        requested_by=getattr(user, "username", "unknown"),
        request_id=request_id or None,
        trace_token=trace_token or None,
    )
    return {"status": "accepted", "job": queue_job, "download_path": f"/api/reports/generated/{os.path.basename(output_path)}"}


@router.get("/generated/{file_name}")
async def download_generated_report(
    file_name: str,
    authorization: str = Header(default=None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    cookie_name = os.getenv("AUTH_COOKIE_NAME", "pm_token")
    cookie_val = request.cookies.get(cookie_name) if request else None
    jwt_token = (bearer or cookie_val or "").strip()
    await _validate_token(db, jwt_token)
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports", "generated", file_name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Generated report not found")
    return FileResponse(path, filename=file_name, media_type="application/pdf")


@router.get("/download/{report_type}")
async def download_report(
    report_type: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(default=None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    cookie_name = os.getenv("AUTH_COOKIE_NAME", "pm_token")
    cookie_val = request.cookies.get(cookie_name) if request else None
    jwt_token = (bearer or cookie_val or "").strip()
    await _validate_token(db, jwt_token)

    info = get_license_info()
    if "reports" not in info.get("features", []):
        raise HTTPException(status_code=403, detail="Reports require a license with the 'reports' feature")

    if report_type not in ["hardening", "compliance", "full_system", "devops"]:
        raise HTTPException(status_code=400, detail="Invalid report type. Use: hardening, compliance, full_system, devops")

    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)

    try:
        if report_type == "hardening":
            await generate_hardening_report(db, path)
        elif report_type == "compliance":
            await generate_compliance_report(db, path)
        elif report_type == "full_system":
            await generate_full_system_report(db, path)
        elif report_type == "devops":
            await generate_devops_report(db, path)

        # Schedule temp file cleanup after response is sent
        background_tasks.add_task(os.unlink, path)

        return FileResponse(
            path,
            filename=f"PatchMaster_{report_type.replace('_', ' ').title().replace(' ', '_')}_Report_{datetime.now().strftime('%Y%m%d')}.pdf",
            media_type='application/pdf',
        )
    except Exception as e:
        # Clean up temp file on error
        try:
            os.unlink(path)
        except Exception:
            pass
        logger.error(f"Report generation failed for type '{report_type}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
