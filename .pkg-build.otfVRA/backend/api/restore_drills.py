from datetime import datetime

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Optional
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.ops_queue import enqueue_operation
from auth import require_role
from database import async_session, get_db
from models.db_models import (
    AuditLog,
    BackupConfig,
    BackupLog,
    Host,
    JobStatus,
    RestoreDrillRun,
    User,
    UserRole,
)

router = APIRouter(prefix="/api/restore-drills", tags=["restore-drills"])

AGENT_PORT = 8080
_GLOBAL_AGENT_API_TOKEN = os.environ.get("AGENT_API_TOKEN", "").strip()

def _agent_auth_headers(host=None) -> dict:
    token = (getattr(host, "agent_token", None) or "").strip() if host else ""
    if not token:
        token = _GLOBAL_AGENT_API_TOKEN
    return {"Authorization": f"Bearer {token}"} if token else {}


class RestoreDrillRequest(BaseModel):
    config_id: int
    backup_log_id: Optional[int] = None
    target_path: Optional[str] = None
    target_rto_minutes: Optional[float] = None
    target_rpo_minutes: Optional[float] = None


class RestoreDrillRunOut(BaseModel):
    id: int
    config_id: int
    host_id: int
    backup_log_id: Optional[int] = None
    status: str
    requested_by: str
    target_path: str
    target_rto_minutes: Optional[float] = None
    target_rpo_minutes: Optional[float] = None
    actual_rto_seconds: Optional[float] = None
    actual_rpo_minutes: Optional[float] = None
    within_sla: Optional[bool] = None
    summary: dict
    queue_job_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


def _run_out(run: RestoreDrillRun) -> RestoreDrillRunOut:
    return RestoreDrillRunOut(
        id=run.id,
        config_id=run.config_id,
        host_id=run.host_id,
        backup_log_id=run.backup_log_id,
        status=run.status.value if hasattr(run.status, "value") else str(run.status),
        requested_by=run.requested_by or "",
        target_path=run.target_path or "",
        target_rto_minutes=run.target_rto_minutes,
        target_rpo_minutes=run.target_rpo_minutes,
        actual_rto_seconds=run.actual_rto_seconds,
        actual_rpo_minutes=run.actual_rpo_minutes,
        within_sla=run.within_sla,
        summary=run.summary or {},
        queue_job_id=run.queue_job_id or "",
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


async def _select_backup_log(session: AsyncSession, config_id: int, backup_log_id: Optional[int]) -> BackupLog:
    if backup_log_id:
        row = (
            await session.execute(
                select(BackupLog).where(BackupLog.id == backup_log_id, BackupLog.config_id == config_id)
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Backup log not found")
        if row.status != JobStatus.success:
            raise HTTPException(status_code=409, detail="Selected backup has not completed successfully")
        return row
    latest = (
        await session.execute(
            select(BackupLog)
            .where(BackupLog.config_id == config_id, BackupLog.status == JobStatus.success)
            .order_by(desc(BackupLog.started_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not latest:
        raise HTTPException(status_code=404, detail="No successful backup log available for restore drill")
    return latest


async def _run_restore_drill(drill_id: int) -> dict:
    async with async_session() as session:
        run = await session.get(RestoreDrillRun, drill_id)
        if not run:
            return {"status": "missing_run", "drill_id": drill_id}
        config = await session.get(BackupConfig, run.config_id)
        host = await session.get(Host, run.host_id)
        log_obj = await session.get(BackupLog, run.backup_log_id) if run.backup_log_id else None
        if not config or not host or not log_obj:
            run.status = JobStatus.failed
            run.summary = {"error": "Missing config/host/backup log"}
            run.completed_at = _utcnow()
            await session.commit()
            return {"status": "failed", "drill_id": drill_id, "reason": "missing_config_host_or_backup"}

        run.status = JobStatus.running
        run.started_at = _utcnow()
        await session.commit()

        payload = {
            "config_id": config.id,
            "log_id": log_obj.id,
            "storage_type": getattr(config, "storage_type", "local"),
            "storage_config": getattr(config, "storage_config", {}) or {},
            "storage_path": config.storage_path,
            "source_path": (str(log_obj.output or "").strip() or config.storage_path),
            "target_path": run.target_path or config.source_path,
        }
        started = _utcnow()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"http://{host.ip}:{AGENT_PORT}/backup/restore",
                    json=payload,
                    headers=_agent_auth_headers(host),
                )
            if response.status_code >= 400:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            completed = _utcnow()
            rto_seconds = max((completed - started).total_seconds(), 0.0)
            detected = log_obj.completed_at or log_obj.started_at or _utcnow()
            rpo_minutes = max((started - detected).total_seconds() / 60.0, 0.0)
            within_sla = True
            if run.target_rto_minutes is not None and rto_seconds > run.target_rto_minutes * 60.0:
                within_sla = False
            if run.target_rpo_minutes is not None and rpo_minutes > run.target_rpo_minutes:
                within_sla = False
            run.actual_rto_seconds = rto_seconds
            run.actual_rpo_minutes = rpo_minutes
            run.within_sla = within_sla
            run.status = JobStatus.success
            run.completed_at = completed
            run.summary = {
                "response_status": response.status_code,
                "response_body": (response.text or "")[:2000],
                "within_sla": within_sla,
            }
            await session.commit()
            return {"status": "success", "drill_id": drill_id, "within_sla": within_sla}
        except Exception as exc:
            run.status = JobStatus.failed
            run.completed_at = _utcnow()
            run.summary = {"error": str(exc)}
            await session.commit()
            return {"status": "failed", "drill_id": drill_id, "error": str(exc)}


@router.post("/run")
async def launch_restore_drill(
    body: RestoreDrillRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    config = (await db.execute(select(BackupConfig).where(BackupConfig.id == body.config_id))).scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Backup config not found")
    host = (await db.execute(select(Host).where(Host.id == config.host_id))).scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    log_obj = await _select_backup_log(db, config.id, body.backup_log_id)

    drill = RestoreDrillRun(
        config_id=config.id,
        host_id=host.id,
        backup_log_id=log_obj.id,
        status=JobStatus.pending,
        requested_by=getattr(current_user, "username", "system"),
        target_path=body.target_path or config.source_path or "",
        target_rto_minutes=body.target_rto_minutes,
        target_rpo_minutes=body.target_rpo_minutes,
        summary={},
    )
    db.add(drill)
    await db.flush()

    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    drill_id = drill.id

    async def _runner():
        return await _run_restore_drill(drill_id)

    queue_job = await enqueue_operation(
        op_type="restore_drill.run",
        payload={"drill_id": drill_id, "config_id": config.id, "host_id": host.id},
        runner=_runner,
        requested_by=getattr(current_user, "username", "system"),
        request_id=request_id or None,
        trace_token=trace_token or None,
    )
    drill.queue_job_id = str(queue_job.get("id", ""))
    db.add(drill)
    db.add(
        AuditLog(
            user_id=getattr(current_user, "id", None),
            action="restore_drill.launched",
            target_type="restore_drill_run",
            target_id=str(drill.id),
            details={
                "config_id": config.id,
                "host_id": host.id,
                "backup_log_id": log_obj.id,
                "queue_job_id": drill.queue_job_id,
            },
        )
    )
    await db.commit()
    await db.refresh(drill)
    return {"status": "accepted", "run": _run_out(drill), "job": queue_job}

@router.get("/runs", response_model=list[RestoreDrillRunOut])
async def list_restore_drills(
    config_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator, UserRole.auditor)),
):
    stmt = select(RestoreDrillRun).order_by(desc(RestoreDrillRun.created_at)).limit(limit)
    if config_id:
        stmt = stmt.where(RestoreDrillRun.config_id == config_id)
    rows = (await db.execute(stmt)).scalars().all()
    return [_run_out(row) for row in rows]


@router.get("/insights")
async def restore_drill_insights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator, UserRole.auditor)),
):
    runs = (await db.execute(select(RestoreDrillRun))).scalars().all()
    total = len(runs)
    successful = sum(1 for r in runs if r.status == JobStatus.success)
    failed = sum(1 for r in runs if r.status == JobStatus.failed)
    pending = sum(1 for r in runs if r.status in {JobStatus.pending, JobStatus.running})
    sla_ok = sum(1 for r in runs if r.within_sla is True)
    sla_breach = sum(1 for r in runs if r.within_sla is False)
    avg_rto = (
        (sum(float(r.actual_rto_seconds or 0.0) for r in runs if r.actual_rto_seconds is not None) /
         max(sum(1 for r in runs if r.actual_rto_seconds is not None), 1))
        if runs else 0.0
    )
    avg_rpo = (
        (sum(float(r.actual_rpo_minutes or 0.0) for r in runs if r.actual_rpo_minutes is not None) /
         max(sum(1 for r in runs if r.actual_rpo_minutes is not None), 1))
        if runs else 0.0
    )
    latest = (
        await db.execute(
            select(RestoreDrillRun).order_by(desc(RestoreDrillRun.created_at)).limit(20)
        )
    ).scalars().all()
    return {
        "total_runs": total,
        "successful_runs": successful,
        "failed_runs": failed,
        "in_progress_runs": pending,
        "sla_ok": sla_ok,
        "sla_breach": sla_breach,
        "avg_rto_seconds": round(avg_rto, 2),
        "avg_rpo_minutes": round(avg_rpo, 2),
        "latest_runs": [_run_out(r).model_dump() for r in latest],
    }


@router.get("/configs")
async def list_backup_configs_for_drills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator, UserRole.auditor)),
):
    rows = (
        await db.execute(
            select(
                BackupConfig.id,
                BackupConfig.name,
                BackupConfig.host_id,
                Host.hostname,
                Host.ip,
                BackupConfig.backup_type,
                BackupConfig.last_run_at,
            )
            .join(Host, Host.id == BackupConfig.host_id)
            .order_by(BackupConfig.name.asc())
        )
    ).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "host_id": row.host_id,
            "hostname": row.hostname,
            "ip": row.ip,
            "backup_type": row.backup_type.value if hasattr(row.backup_type, "value") else str(row.backup_type),
            "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
        }
        for row in rows
    ]
