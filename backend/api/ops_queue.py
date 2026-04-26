import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import require_role
from models.db_models import User, UserRole

router = APIRouter(prefix="/api/ops-queue", tags=["ops-queue"])

_OPS_QUEUE: asyncio.Queue[str] = asyncio.Queue()
_OPS_WORKERS: list[asyncio.Task] = []
_OPS_JOBS: dict[str, dict[str, Any]] = {}
_OPS_RUNNERS: dict[str, Callable[[], Awaitable[Any]]] = {}
_OPS_LOCK = asyncio.Lock()
_MAX_OPS_RECORDS = 1000


class OpsQueueJobOut(BaseModel):
    id: str
    op_type: str
    status: str
    requested_by: str
    payload: dict[str, Any]
    request_id: str | None = None
    trace_token: str | None = None
    requested_at: str
    started_at: str | None = None
    finished_at: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _job_public(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": job["id"],
        "op_type": job["op_type"],
        "status": job["status"],
        "requested_by": job["requested_by"],
        "payload": job["payload"],
        "request_id": job.get("request_id"),
        "trace_token": job.get("trace_token"),
        "requested_at": job["requested_at"],
        "started_at": job.get("started_at"),
        "finished_at": job.get("finished_at"),
        "result": job.get("result"),
        "error": job.get("error"),
    }


def _trim_jobs() -> None:
    if len(_OPS_JOBS) <= _MAX_OPS_RECORDS:
        return
    sorted_jobs = sorted(_OPS_JOBS.values(), key=lambda j: j.get("requested_at", ""))
    for stale in sorted_jobs[: max(0, len(_OPS_JOBS) - _MAX_OPS_RECORDS)]:
        _OPS_JOBS.pop(stale["id"], None)
        _OPS_RUNNERS.pop(stale["id"], None)


async def _ops_worker_loop(worker_name: str):
    while True:
        job_id = await _OPS_QUEUE.get()
        try:
            async with _OPS_LOCK:
                job = _OPS_JOBS.get(job_id)
                if not job or job.get("status") != "pending":
                    continue
                runner = _OPS_RUNNERS.get(job_id)
                if not runner:
                    job["status"] = "failed"
                    job["error"] = "Missing runner for queued job"
                    job["finished_at"] = _utc_now_iso()
                    continue
                job["status"] = "running"
                job["started_at"] = _utc_now_iso()
            try:
                result = await runner()
                async with _OPS_LOCK:
                    job = _OPS_JOBS.get(job_id)
                    if job:
                        job["status"] = "success"
                        job["result"] = result if isinstance(result, dict) else {"result": result}
                        job["finished_at"] = _utc_now_iso()
                        job["worker"] = worker_name
            except Exception as exc:
                async with _OPS_LOCK:
                    job = _OPS_JOBS.get(job_id)
                    if job:
                        job["status"] = "failed"
                        job["error"] = str(exc)
                        job["finished_at"] = _utc_now_iso()
                        job["worker"] = worker_name
            finally:
                async with _OPS_LOCK:
                    _OPS_RUNNERS.pop(job_id, None)
        finally:
            _OPS_QUEUE.task_done()


def ensure_ops_queue_started(worker_count: int = 2) -> None:
    active = [w for w in _OPS_WORKERS if not w.done()]
    if len(active) >= worker_count:
        return
    _OPS_WORKERS.clear()
    for idx in range(worker_count):
        _OPS_WORKERS.append(asyncio.create_task(_ops_worker_loop(f"ops-worker-{idx+1}")))


async def enqueue_operation(
    op_type: str,
    payload: dict[str, Any],
    runner: Callable[[], Awaitable[Any]],
    requested_by: str = "system",
    request_id: str | None = None,
    trace_token: str | None = None,
) -> dict[str, Any]:
    ensure_ops_queue_started()
    job_id = uuid.uuid4().hex
    record = {
        "id": job_id,
        "op_type": op_type,
        "status": "pending",
        "requested_by": requested_by,
        "payload": payload,
        "request_id": request_id,
        "trace_token": trace_token,
        "requested_at": _utc_now_iso(),
        "started_at": None,
        "finished_at": None,
        "result": None,
        "error": None,
    }
    async with _OPS_LOCK:
        _OPS_JOBS[job_id] = record
        _OPS_RUNNERS[job_id] = runner
        _trim_jobs()
    await _OPS_QUEUE.put(job_id)
    return _job_public(record)


@router.get("/jobs", response_model=list[OpsQueueJobOut])
async def list_ops_queue_jobs(
    limit: int = Query(100, ge=1, le=1000),
    status: str | None = Query(None),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator, UserRole.auditor)),
):
    async with _OPS_LOCK:
        rows = list(_OPS_JOBS.values())
    rows = sorted(rows, key=lambda j: j.get("requested_at", ""), reverse=True)
    if status:
        wanted = status.strip().lower()
        rows = [r for r in rows if str(r.get("status", "")).lower() == wanted]
    return [_job_public(r) for r in rows[:limit]]


@router.get("/jobs/{job_id}", response_model=OpsQueueJobOut)
async def get_ops_queue_job(
    job_id: str,
    user: User = Depends(require_role(UserRole.admin, UserRole.operator, UserRole.auditor)),
):
    async with _OPS_LOCK:
        job = _OPS_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Ops queue job not found")
    return _job_public(job)


@router.post("/jobs/{job_id}/cancel")
async def cancel_ops_queue_job(
    job_id: str,
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    async with _OPS_LOCK:
        job = _OPS_JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Ops queue job not found")
        if job["status"] != "pending":
            raise HTTPException(status_code=409, detail="Only pending jobs can be canceled")
        job["status"] = "canceled"
        job["finished_at"] = _utc_now_iso()
        _OPS_RUNNERS.pop(job_id, None)
    return {"status": "ok", "job": _job_public(job)}
