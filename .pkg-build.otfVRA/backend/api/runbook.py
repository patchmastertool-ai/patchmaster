from __future__ import annotations

import asyncio
import csv
import io
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from fpdf import FPDF
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user, require_role
from database import async_session, get_db
from models.db_models import (
    Host,
    MirrorRepo,
    RunbookExecution,
    RunbookProfile,
    RunbookSchedule,
    User,
    UserRole,
)
from api.mirror_repos import _run_manual_sync_background

router = APIRouter(prefix="/api/runbook", tags=["runbook"])

LOCAL_REPO_DIR = Path(__file__).resolve().parent.parent / "static" / "packages"
AGENT_PORT = 8080
MASTER_API_BASE = os.getenv("PM_MASTER_API_BASE", "http://127.0.0.1:8000").rstrip("/")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ProfileIn(BaseModel):
    name: str
    channel: str = "linux"
    config: dict = Field(default_factory=dict)
    require_approval: bool = False
    approval_role: str = "operator"
    is_active: bool = True


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    config: Optional[dict] = None
    require_approval: Optional[bool] = None
    approval_role: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduleIn(BaseModel):
    profile_id: int
    name: str
    cron_expression: str = "0 2 * * *"
    timezone: str = "UTC"
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    cron_expression: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class RunbookOut(BaseModel):
    id: int
    profile_id: Optional[int] = None
    schedule_id: Optional[int] = None
    trigger_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    initiated_by: str
    summary: dict = {}
    logs: list = []
    model_config = ConfigDict(from_attributes=True)


async def _wait_for_host_job(host_ip: str, timeout_seconds: int = 900) -> dict:
    start = _utc_now().timestamp()
    async with httpx.AsyncClient(timeout=30) as client:
        while _utc_now().timestamp() - start < timeout_seconds:
            try:
                resp = await client.get(f"http://{host_ip}:{AGENT_PORT}/job/status")
                payload = resp.json() if resp.status_code == 200 else {}
            except Exception:
                payload = {}
            status = str(payload.get("status", "")).lower()
            if status in {"success", "failed"}:
                return payload
            await asyncio.sleep(3)
    return {"status": "failed", "error": "Timeout waiting for job"}


async def _run_profile_execution(profile_id: int, initiated_by: str, trigger_type: str = "manual", schedule_id: int | None = None) -> int:
    async with async_session() as db:
        profile = await db.get(RunbookProfile, profile_id)
        if not profile or not profile.is_active:
            return 0
        execution = RunbookExecution(
            profile_id=profile.id,
            schedule_id=schedule_id,
            trigger_type=trigger_type,
            status="running",
            initiated_by=initiated_by,
            summary={},
            logs=[],
        )
        db.add(execution)
        await db.flush()
        await db.refresh(execution)

        logs: list[str] = []
        def log(line: str):
            logs.append(f"{_utc_now().isoformat()} {line}")

        summary = {"channel": profile.channel, "failed_hosts": [], "rolled_back_hosts": []}
        cfg = profile.config or {}
        try:
            host_ids = [int(h) for h in (cfg.get("host_ids") or [])]
            files = [str(f).strip() for f in (cfg.get("files") or []) if str(f).strip()]
            ring_size = max(int(cfg.get("ring_size") or 2), 1)
            snapshot_mode = str(cfg.get("snapshot_mode") or "packages")
            rollback_on_failure = bool(cfg.get("rollback_on_failure", True))
            auto_intake = bool(cfg.get("auto_intake", True))
            repo_ids = [int(x) for x in (cfg.get("repo_ids") or [])]

            hosts = []
            if host_ids:
                hosts = (await db.execute(select(Host).where(Host.id.in_(host_ids)))).scalars().all()
            if not hosts:
                hosts = (
                    await db.execute(select(Host).where(Host.os.ilike("%windows%") if profile.channel == "windows" else ~Host.os.ilike("%windows%")))
                ).scalars().all()
            if not hosts:
                raise RuntimeError("No hosts selected for runbook profile")

            if auto_intake:
                if not repo_ids:
                    repo_ids = [r.id for r in (await db.execute(select(MirrorRepo).where(MirrorRepo.enabled == True, MirrorRepo.os_family == profile.channel))).scalars().all()]
                for rid in repo_ids:
                    log(f"Mirror sync {rid} started")
                    await _run_manual_sync_background(rid, trigger_type="runbook")
                    log(f"Mirror sync {rid} completed")

            if not files:
                all_local = [p.name for p in LOCAL_REPO_DIR.iterdir() if p.is_file()]
                files = all_local[: max(int(cfg.get("max_package_count") or 20), 1)]
            if not files:
                raise RuntimeError("No packages available in local repository")
            missing = [f for f in files if not (LOCAL_REPO_DIR / f).exists()]
            if missing:
                raise RuntimeError(f"Missing package files: {', '.join(missing)}")

            snapshot_names: dict[int, str] = {}
            async with httpx.AsyncClient(timeout=60) as client:
                for host in hosts:
                    pre = await client.post(f"{MASTER_API_BASE}/api/agent/by-host/{host.id}/snapshot/precheck", json={"mode": snapshot_mode})
                    pre_data = pre.json() if pre.status_code == 200 else {}
                    if pre.status_code != 200 or pre_data.get("ok") is False:
                        raise RuntimeError(f"Precheck failed for host {host.ip}: {pre_data.get('error') or pre.status_code}")
                    snap_name = f"runbook-{profile.channel}-{execution.id}-{host.id}"
                    sr = await client.post(
                        f"{MASTER_API_BASE}/api/agent/by-host/{host.id}/snapshot/create",
                        json={"name": snap_name, "mode": snapshot_mode},
                    )
                    sd = sr.json() if sr.status_code == 200 else {}
                    if sr.status_code != 200 or sd.get("success") is False:
                        raise RuntimeError(f"Snapshot failed for host {host.ip}: {sd.get('error') or sr.status_code}")
                    snapshot_names[host.id] = snap_name

                failed_hosts = []
                for i in range(0, len(hosts), ring_size):
                    ring = hosts[i : i + ring_size]
                    log(f"Ring {i // ring_size + 1} started")
                    for host in ring:
                        inst = await client.post(
                            f"{MASTER_API_BASE}/api/agent/{host.ip}/offline/install",
                            json={"files": files, "auto_snapshot": False, "auto_rollback": False},
                        )
                        id_payload = inst.json() if inst.status_code == 200 else {}
                        if inst.status_code != 200 or id_payload.get("status") != "started":
                            failed_hosts.append({"host_id": host.id, "ip": host.ip, "reason": "install_start_failed"})
                            continue
                        st = await _wait_for_host_job(host.ip, 900)
                        if str(st.get("status", "")).lower() != "success":
                            failed_hosts.append({"host_id": host.id, "ip": host.ip, "reason": st.get("error") or "install_failed"})
                    if failed_hosts:
                        break

                if failed_hosts:
                    summary["failed_hosts"] = failed_hosts
                    if rollback_on_failure:
                        for fh in failed_hosts:
                            host_id = int(fh["host_id"])
                            snap_name = snapshot_names.get(host_id)
                            if not snap_name:
                                continue
                            rb = await client.post(
                                f"{MASTER_API_BASE}/api/agent/by-host/{host_id}/snapshot/rollback",
                                json={"name": snap_name},
                            )
                            if rb.status_code == 200:
                                summary["rolled_back_hosts"].append(host_id)
                    raise RuntimeError("Runbook rollout failed")

            execution.status = "success"
            summary["hosts"] = [h.id for h in hosts]
            summary["files"] = files
            execution.summary = summary
            execution.logs = logs
            execution.completed_at = _utc_now()
            await db.commit()
            return execution.id
        except Exception as exc:
            execution.status = "failed"
            summary["error"] = str(exc)
            execution.summary = summary
            execution.logs = logs + [f"{_utc_now().isoformat()} ERROR {exc}"]
            execution.completed_at = _utc_now()
            await db.commit()
            return execution.id


async def run_due_runbook_schedules(db: AsyncSession):
    now = _utc_now()
    schedules = (
        await db.execute(
            select(RunbookSchedule).where(RunbookSchedule.is_active == True).order_by(RunbookSchedule.id.asc())
        )
    ).scalars().all()
    for sched in schedules:
        try:
            profile = await db.get(RunbookProfile, sched.profile_id)
            if not profile or not profile.is_active:
                continue
            if profile.require_approval and not sched.approved_by:
                continue
            if not sched.next_run_at:
                sched.next_run_at = croniter(sched.cron_expression, now).get_next(datetime)
                db.add(sched)
                await db.commit()
                continue
            if now < sched.next_run_at:
                continue
            sched.last_run_at = now
            sched.next_run_at = croniter(sched.cron_expression, now).get_next(datetime)
            db.add(sched)
            await db.commit()
            asyncio.create_task(_run_profile_execution(profile.id, initiated_by="scheduler", trigger_type="scheduled", schedule_id=sched.id))
        except Exception as _sched_err:
            import logging as _log
            _log.getLogger("patchmaster.runbook").warning("Runbook schedule %s failed: %s", sched.id, _sched_err)
            continue


@router.get("/profiles")
async def list_profiles(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(select(RunbookProfile).order_by(RunbookProfile.name.asc()))).scalars().all()
    return rows


@router.post("/profiles")
async def create_profile(body: ProfileIn, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin, UserRole.operator))):
    p = RunbookProfile(
        name=body.name.strip(),
        channel=(body.channel or "linux").strip().lower(),
        config=body.config or {},
        require_approval=body.require_approval,
        approval_role=(body.approval_role or "operator").strip().lower(),
        is_active=body.is_active,
        created_by=user.username,
        updated_by=user.username,
    )
    db.add(p)
    await db.flush()
    await db.commit()
    await db.refresh(p)
    return p


@router.put("/profiles/{profile_id}")
async def update_profile(profile_id: int, body: ProfileUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin, UserRole.operator))):
    p = await db.get(RunbookProfile, profile_id)
    if not p:
        raise HTTPException(404, "Profile not found")
    for field in ["name", "channel", "config", "require_approval", "approval_role", "is_active"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(p, field, val)
    p.updated_by = user.username
    await db.flush()
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin))):
    p = await db.get(RunbookProfile, profile_id)
    if not p:
        raise HTTPException(404, "Profile not found")
    await db.delete(p)
    await db.commit()
    return {"ok": True}


@router.get("/schedules")
async def list_runbook_schedules(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return (await db.execute(select(RunbookSchedule).order_by(RunbookSchedule.id.desc()))).scalars().all()


@router.post("/schedules")
async def create_runbook_schedule(body: ScheduleIn, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin, UserRole.operator))):
    profile = await db.get(RunbookProfile, body.profile_id)
    if not profile:
        raise HTTPException(404, "Profile not found")
    sched = RunbookSchedule(
        profile_id=body.profile_id,
        name=body.name.strip(),
        cron_expression=body.cron_expression.strip(),
        timezone=body.timezone,
        is_active=body.is_active,
        created_by=user.username,
    )
    db.add(sched)
    await db.flush()
    await db.commit()
    await db.refresh(sched)
    return sched


@router.put("/schedules/{schedule_id}")
async def update_runbook_schedule(schedule_id: int, body: ScheduleUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin, UserRole.operator))):
    sched = await db.get(RunbookSchedule, schedule_id)
    if not sched:
        raise HTTPException(404, "Schedule not found")
    for field in ["name", "cron_expression", "timezone", "is_active"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(sched, field, val)
    sched.approved_by = ""
    sched.approved_at = None
    await db.flush()
    await db.commit()
    await db.refresh(sched)
    return sched


@router.post("/schedules/{schedule_id}/approve")
async def approve_schedule(schedule_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin, UserRole.operator))):
    sched = await db.get(RunbookSchedule, schedule_id)
    if not sched:
        raise HTTPException(404, "Schedule not found")
    sched.approved_by = user.username
    sched.approved_at = _utc_now()
    await db.flush()
    await db.commit()
    await db.refresh(sched)
    return sched


@router.post("/execute/{profile_id}")
async def execute_profile(profile_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_role(UserRole.admin, UserRole.operator))):
    profile = await db.get(RunbookProfile, profile_id)
    if not profile:
        raise HTTPException(404, "Profile not found")
    asyncio.create_task(_run_profile_execution(profile_id, initiated_by=user.username, trigger_type="manual"))
    return {"status": "accepted"}


@router.get("/executions", response_model=list[RunbookOut])
async def list_executions(limit: int = 100, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        await db.execute(select(RunbookExecution).order_by(desc(RunbookExecution.id)).limit(max(1, min(int(limit), 500))))
    ).scalars().all()
    return rows


@router.get("/executions/{execution_id}", response_model=RunbookOut)
async def get_execution(execution_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.get(RunbookExecution, execution_id)
    if not row:
        raise HTTPException(404, "Execution not found")
    return row


@router.get("/executions/{execution_id}/audit.csv")
async def export_execution_audit_csv(execution_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    run = await db.get(RunbookExecution, execution_id)
    if not run:
        raise HTTPException(404, "Execution not found")
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["execution_id", "status", "started_at", "completed_at", "trigger_type", "initiated_by"])
    writer.writerow([run.id, run.status, run.started_at.isoformat() if run.started_at else "", run.completed_at.isoformat() if run.completed_at else "", run.trigger_type, run.initiated_by])
    writer.writerow([])
    writer.writerow(["summary_key", "summary_value"])
    for k, v in (run.summary or {}).items():
        writer.writerow([k, str(v)])
    writer.writerow([])
    writer.writerow(["log_line"])
    for line in (run.logs or []):
        writer.writerow([line])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="runbook_execution_{run.id}_audit.csv"'},
    )


@router.get("/executions/{execution_id}/audit.pdf")
async def export_execution_audit_pdf(execution_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    run = await db.get(RunbookExecution, execution_id)
    if not run:
        raise HTTPException(404, "Execution not found")
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 8, f"Runbook Execution Audit #{run.id}", ln=1)
    pdf.set_font("Arial", size=10)
    pdf.cell(0, 7, f"Status: {run.status} | Trigger: {run.trigger_type} | By: {run.initiated_by}", ln=1)
    if run.started_at:
        pdf.cell(0, 7, f"Started: {run.started_at.isoformat()}", ln=1)
    if run.completed_at:
        pdf.cell(0, 7, f"Completed: {run.completed_at.isoformat()}", ln=1)
    pdf.ln(2)
    pdf.set_font("Arial", "B", 11)
    pdf.cell(0, 7, "Summary", ln=1)
    pdf.set_font("Arial", size=9)
    for k, v in (run.summary or {}).items():
        pdf.multi_cell(0, 6, f"{k}: {v}")
    pdf.ln(2)
    pdf.set_font("Arial", "B", 11)
    pdf.cell(0, 7, "Logs", ln=1)
    pdf.set_font("Arial", size=8)
    for line in (run.logs or [])[:600]:
        pdf.multi_cell(0, 5, line)
    data = pdf.output(dest="S").encode("latin-1")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="runbook_execution_{run.id}_audit.pdf"'},
    )
