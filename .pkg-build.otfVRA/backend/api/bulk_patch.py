"""Bulk Patch Jobs — patch multiple hosts simultaneously."""
from datetime import datetime

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from auth import get_current_user, require_role
from api.ops_queue import enqueue_operation
from models.db_models import (
    BulkPatchJob, PatchJob, PatchAction, JobStatus, Host, User, UserRole
)

router = APIRouter(prefix="/api/bulk-patch", tags=["bulk-patch"])


class BulkPatchCreate(BaseModel):
    name: str
    host_ids: List[int]
    packages: List[str] = []
    action: PatchAction = PatchAction.server_patch
    dry_run: bool = False
    auto_snapshot: bool = True
    auto_rollback: bool = True


async def _run_bulk(bulk_id: int):
    """Background task: create individual PatchJob per host."""
    async with async_session() as db:
        bulk = await db.get(BulkPatchJob, bulk_id)
        if not bulk:
            return
        bulk.status = "running"
        bulk.started_at = _utcnow()
        await db.commit()

        job_ids = []
        success = 0
        failed = 0

        # Bug #10 fix: validate host IDs and track failures before committing
        for host_id in bulk.host_ids:
            host = await db.get(Host, host_id)
            if not host:
                failed += 1
                continue
            job = PatchJob(
                host_id=host_id,
                action=bulk.action,
                packages=bulk.packages,
                dry_run=bulk.dry_run,
                auto_snapshot=bulk.auto_snapshot,
                auto_rollback=bulk.auto_rollback,
                initiated_by=f"bulk:{bulk.id}",
                status=JobStatus.pending,
            )
            db.add(job)
            try:
                await db.flush()
                job_ids.append(job.id)
                success += 1
            except Exception:
                # Bug #18 fix: if flush fails for a job, count it as failed and continue
                await db.rollback()
                failed += 1

        # Bug #1 fix: status is "jobs_created" not "completed" — individual jobs are still pending.
        # The bulk record reflects job-creation outcome, not patch execution outcome.
        bulk.job_ids = job_ids
        bulk.success_count = success
        bulk.failed_count = failed
        bulk.total_hosts = len(bulk.host_ids)
        bulk.status = "jobs_created" if success > 0 else "failed"
        bulk.completed_at = _utcnow()
        await db.commit()


@router.get("/")
async def list_bulk_jobs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BulkPatchJob).order_by(desc(BulkPatchJob.created_at)).limit(limit)
    )
    return result.scalars().all()


@router.post("/")
async def create_bulk_job(
    body: BulkPatchCreate,
    request: Request,
    wait: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    if not body.host_ids:
        raise HTTPException(400, "No hosts specified")

    # Bug #10 fix: validate all host IDs exist before creating the bulk job
    existing = await db.execute(select(Host.id).where(Host.id.in_(body.host_ids)))
    found_ids = {row[0] for row in existing.all()}
    invalid_ids = [hid for hid in body.host_ids if hid not in found_ids]
    if invalid_ids:
        raise HTTPException(400, f"Unknown host IDs: {invalid_ids}")
    bulk = BulkPatchJob(
        name=body.name,
        host_ids=body.host_ids,
        packages=body.packages,
        action=body.action,
        dry_run=body.dry_run,
        auto_snapshot=body.auto_snapshot,
        auto_rollback=body.auto_rollback,
        total_hosts=len(body.host_ids),
        initiated_by=user.username,
    )
    db.add(bulk)
    await db.commit()
    await db.refresh(bulk)
    if wait:
        await _run_bulk(bulk.id)
        await db.refresh(bulk)
        return bulk
    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    async def _runner():
        await _run_bulk(bulk.id)
        return {"bulk_id": bulk.id, "name": bulk.name}
    queue_job = await enqueue_operation(
        op_type="bulk_patch.run",
        payload={"bulk_id": bulk.id, "host_count": len(body.host_ids)},
        runner=_runner,
        requested_by=getattr(user, "username", "system"),
        request_id=request_id or None,
        trace_token=trace_token or None,
    )
    return {"status": "accepted", "bulk": bulk, "job": queue_job}


@router.get("/{bulk_id}")
async def get_bulk_job(
    bulk_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bulk = await db.get(BulkPatchJob, bulk_id)
    if not bulk:
        raise HTTPException(404, "Bulk job not found")
    # Enrich with per-host job statuses
    jobs_info = []
    for jid in (bulk.job_ids or []):
        job = await db.get(PatchJob, jid)
        if job:
            host = await db.get(Host, job.host_id)
            jobs_info.append({
                "job_id": jid,
                "host_id": job.host_id,
                "hostname": host.hostname if host else "—",
                "status": job.status.value,
            })
    return {
        "id": bulk.id,
        "name": bulk.name,
        "status": bulk.status,
        "total_hosts": bulk.total_hosts,
        "success_count": bulk.success_count,
        "failed_count": bulk.failed_count,
        "action": bulk.action.value,
        "dry_run": bulk.dry_run,
        "initiated_by": bulk.initiated_by,
        "created_at": bulk.created_at.isoformat(),
        "started_at": bulk.started_at.isoformat() if bulk.started_at else None,
        "completed_at": bulk.completed_at.isoformat() if bulk.completed_at else None,
        "jobs": jobs_info,
    }
