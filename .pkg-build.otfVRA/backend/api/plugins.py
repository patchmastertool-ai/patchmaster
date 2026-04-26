import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta

def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.ops_queue import enqueue_operation
from api.cicd_secrets import decrypt_json_field, decrypt_text_field, encrypt_json_field, encrypt_text_field
from auth import require_role
from database import async_session, get_db
from models.db_models import (
    PluginDeliveryLog,
    PluginDeliveryStatus,
    PluginIntegration,
    PluginType,
    User,
    UserRole,
)

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


class PluginCreate(BaseModel):
    name: str
    plugin_type: str
    is_enabled: bool = True
    config: dict[str, Any] = {}
    secret: str = ""
    max_attempts: int = 3
    retry_backoff_seconds: list[int] = [5, 20, 60]


class PluginUpdate(BaseModel):
    name: str | None = None
    is_enabled: bool | None = None
    config: dict[str, Any] | None = None
    secret: str | None = None
    max_attempts: int | None = None
    retry_backoff_seconds: list[int] | None = None


class PluginDispatchRequest(BaseModel):
    event_type: str
    payload: dict[str, Any] = {}
    plugin_ids: list[int] | None = None


class PluginResponse(BaseModel):
    id: int
    name: str
    plugin_type: str
    is_enabled: bool
    config: dict[str, Any]
    has_config: bool = False
    has_secret: bool
    max_attempts: int
    retry_backoff_seconds: list[int]
    created_by: str
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class PluginDeliveryOut(BaseModel):
    id: int
    plugin_id: int
    event_type: str
    status: str
    response_status: int | None = None
    response_body: str = ""
    error: str = ""
    attempt_count: int
    max_attempts: int
    next_retry_at: datetime | None = None
    last_attempt_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


def _plugin_to_response(plugin: PluginIntegration) -> PluginResponse:
    config = decrypt_json_field(plugin.config)
    return PluginResponse(
        id=plugin.id,
        name=plugin.name,
        plugin_type=plugin.plugin_type.value if hasattr(plugin.plugin_type, "value") else str(plugin.plugin_type),
        is_enabled=bool(plugin.is_enabled),
        config={},
        has_config=bool(config),
        has_secret=bool(decrypt_text_field(plugin.secret)),
        max_attempts=int(plugin.max_attempts or 3),
        retry_backoff_seconds=list(plugin.retry_backoff_seconds or []),
        created_by=plugin.created_by or "",
        created_at=plugin.created_at,
        updated_at=plugin.updated_at,
    )


def _resolve_plugin_endpoint(plugin: PluginIntegration) -> str:
    config = decrypt_json_field(plugin.config)
    plugin_type = plugin.plugin_type.value if hasattr(plugin.plugin_type, "value") else str(plugin.plugin_type)
    if plugin_type == PluginType.webhook.value:
        return str(config.get("url", "")).strip()
    if plugin_type == PluginType.jira.value:
        return str(config.get("webhook_url", "")).strip() or str(config.get("url", "")).strip()
    if plugin_type == PluginType.servicenow.value:
        return str(config.get("webhook_url", "")).strip() or str(config.get("url", "")).strip()
    if plugin_type == PluginType.cmdb.value:
        return str(config.get("endpoint_url", "")).strip() or str(config.get("url", "")).strip()
    return str(config.get("url", "")).strip()


def _signature_headers(secret: str, body_text: str) -> dict[str, str]:
    ts = str(int(_utcnow().timestamp()))
    if not secret:
        return {"X-PM-Timestamp": ts}
    digest = hmac.new(secret.encode("utf-8"), f"{ts}.{body_text}".encode("utf-8"), hashlib.sha256).hexdigest()
    return {"X-PM-Timestamp": ts, "X-PM-Signature": f"sha256={digest}"}


async def _deliver_with_retries(delivery_log_id: int) -> dict[str, Any]:
    async with async_session() as db:
        delivery = await db.get(PluginDeliveryLog, delivery_log_id)
        if not delivery:
            return {"status": "missing_delivery_log", "delivery_log_id": delivery_log_id}
        plugin = await db.get(PluginIntegration, delivery.plugin_id)
        if not plugin:
            delivery.status = PluginDeliveryStatus.failed
            delivery.error = "Plugin not found"
            delivery.updated_at = _utcnow()
            await db.commit()
            return {"status": "missing_plugin", "delivery_log_id": delivery_log_id}
        endpoint = _resolve_plugin_endpoint(plugin)
        if not endpoint:
            delivery.status = PluginDeliveryStatus.failed
            delivery.error = "Plugin endpoint URL is not configured"
            delivery.updated_at = _utcnow()
            await db.commit()
            return {"status": "missing_endpoint", "delivery_log_id": delivery_log_id}

        payload = delivery.request_payload or {}
        body_text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        headers = {"Content-Type": "application/json", **_signature_headers(decrypt_text_field(plugin.secret), body_text)}
        delivery.request_headers = headers
        delivery.max_attempts = int(plugin.max_attempts or 3)
        delivery.status = PluginDeliveryStatus.running
        await db.commit()

        max_attempts = max(1, int(delivery.max_attempts or 3))
        backoffs = list(plugin.retry_backoff_seconds or [5, 20, 60])

        for attempt in range(1, max_attempts + 1):
            delivery.attempt_count = attempt
            delivery.last_attempt_at = _utcnow()
            await db.commit()
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(endpoint, content=body_text, headers=headers)
                delivery.response_status = int(response.status_code)
                delivery.response_body = (response.text or "")[:2000]
                if 200 <= response.status_code < 300:
                    delivery.status = PluginDeliveryStatus.success
                    delivery.error = ""
                    delivery.next_retry_at = None
                    delivery.updated_at = _utcnow()
                    await db.commit()
                    return {"status": "success", "delivery_log_id": delivery_log_id}
                delivery.error = f"HTTP {response.status_code}"
            except Exception as exc:
                delivery.error = str(exc)

            if attempt < max_attempts:
                wait_seconds = int(backoffs[attempt - 1]) if attempt - 1 < len(backoffs) else int(backoffs[-1] if backoffs else 5)
                wait_seconds = max(wait_seconds, 1)
                delivery.next_retry_at = _utcnow() + timedelta(seconds=wait_seconds)
                delivery.updated_at = _utcnow()
                await db.commit()
                await asyncio.sleep(wait_seconds)

        delivery.status = PluginDeliveryStatus.failed
        delivery.next_retry_at = None
        delivery.updated_at = _utcnow()
        await db.commit()
        return {"status": "failed", "delivery_log_id": delivery_log_id}


async def _enqueue_plugin_delivery(
    plugin: PluginIntegration,
    event_type: str,
    payload: dict[str, Any],
    requested_by: str,
    request_id: str | None,
    trace_token: str | None,
    db: AsyncSession,
) -> dict[str, Any]:
    delivery = PluginDeliveryLog(
        plugin_id=plugin.id,
        event_type=event_type,
        status=PluginDeliveryStatus.pending,
        request_payload=payload,
        max_attempts=max(1, int(plugin.max_attempts or 3)),
    )
    db.add(delivery)
    await db.flush()
    delivery_id = delivery.id

    async def _runner():
        return await _deliver_with_retries(delivery_id)

    queue_job = await enqueue_operation(
        op_type="plugin.dispatch",
        payload={"plugin_id": plugin.id, "delivery_log_id": delivery_id, "event_type": event_type},
        runner=_runner,
        requested_by=requested_by,
        request_id=request_id,
        trace_token=trace_token,
    )
    return {"delivery_log_id": delivery_id, "queue_job": queue_job}


@router.get("/", response_model=list[PluginResponse])
async def list_plugins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    rows = (await db.execute(select(PluginIntegration).order_by(PluginIntegration.name.asc()))).scalars().all()
    return [_plugin_to_response(row) for row in rows]


@router.post("/", response_model=PluginResponse)
async def create_plugin(
    body: PluginCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    try:
        plugin_type = PluginType(body.plugin_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plugin type")
    exists = (await db.execute(select(PluginIntegration).where(PluginIntegration.name == body.name.strip()))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="Plugin name already exists")
    plugin = PluginIntegration(
        name=body.name.strip(),
        plugin_type=plugin_type,
        is_enabled=bool(body.is_enabled),
        config=encrypt_json_field(body.config),
        secret=encrypt_text_field(body.secret),
        max_attempts=max(1, int(body.max_attempts or 3)),
        retry_backoff_seconds=[max(1, int(v)) for v in (body.retry_backoff_seconds or [5, 20, 60])],
        created_by=getattr(current_user, "username", "system"),
    )
    db.add(plugin)
    await db.commit()
    await db.refresh(plugin)
    return _plugin_to_response(plugin)


@router.put("/{plugin_id}", response_model=PluginResponse)
async def update_plugin(
    plugin_id: int,
    body: PluginUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    plugin = await db.get(PluginIntegration, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Plugin name cannot be empty")
        conflict = (await db.execute(select(PluginIntegration).where(PluginIntegration.name == name, PluginIntegration.id != plugin_id))).scalar_one_or_none()
        if conflict:
            raise HTTPException(status_code=409, detail="Plugin name already exists")
        plugin.name = name
    if body.is_enabled is not None:
        plugin.is_enabled = bool(body.is_enabled)
    if body.config is not None:
        plugin.config = encrypt_json_field(body.config)
    if body.secret is not None:
        plugin.secret = encrypt_text_field(body.secret)
    if body.max_attempts is not None:
        plugin.max_attempts = max(1, int(body.max_attempts))
    if body.retry_backoff_seconds is not None:
        plugin.retry_backoff_seconds = [max(1, int(v)) for v in body.retry_backoff_seconds]
    plugin.updated_at = _utcnow()
    db.add(plugin)
    await db.commit()
    await db.refresh(plugin)
    return _plugin_to_response(plugin)


@router.delete("/{plugin_id}")
async def delete_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    plugin = await db.get(PluginIntegration, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    await db.delete(plugin)
    await db.commit()
    return {"status": "ok", "message": "Plugin deleted"}


@router.get("/{plugin_id}/deliveries", response_model=list[PluginDeliveryOut])
async def list_plugin_deliveries(
    plugin_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator, UserRole.auditor)),
):
    plugin = await db.get(PluginIntegration, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    rows = (
        await db.execute(
            select(PluginDeliveryLog)
            .where(PluginDeliveryLog.plugin_id == plugin_id)
            .order_by(desc(PluginDeliveryLog.created_at))
            .limit(limit)
        )
    ).scalars().all()
    return rows


@router.post("/dispatch")
async def dispatch_event(
    body: PluginDispatchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    event_type = body.event_type.strip().lower()
    if not event_type:
        raise HTTPException(status_code=400, detail="event_type is required")
    query = select(PluginIntegration).where(PluginIntegration.is_enabled == True)
    if body.plugin_ids:
        query = query.where(PluginIntegration.id.in_(body.plugin_ids))
    plugins = (await db.execute(query.order_by(PluginIntegration.id.asc()))).scalars().all()
    if not plugins:
        return {"status": "ok", "queued": 0, "items": []}

    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    items = []
    for plugin in plugins:
        result = await _enqueue_plugin_delivery(
            plugin=plugin,
            event_type=event_type,
            payload=body.payload or {},
            requested_by=getattr(current_user, "username", "system"),
            request_id=request_id or None,
            trace_token=trace_token or None,
            db=db,
        )
        items.append({"plugin_id": plugin.id, **result})
    await db.commit()
    return {"status": "accepted", "queued": len(items), "items": items}


@router.post("/{plugin_id}/test")
async def test_plugin_delivery(
    plugin_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    plugin = await db.get(PluginIntegration, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    payload = {
        "event": "plugin_test",
        "plugin_id": plugin.id,
        "plugin_name": plugin.name,
        "timestamp": _utcnow().isoformat() + "Z",
    }
    result = await _enqueue_plugin_delivery(
        plugin=plugin,
        event_type="plugin_test",
        payload=payload,
        requested_by=getattr(current_user, "username", "system"),
        request_id=request_id or None,
        trace_token=trace_token or None,
        db=db,
    )
    await db.commit()
    return {"status": "accepted", **result}


@router.post("/{plugin_id}/deliveries/{delivery_id}/replay")
async def replay_plugin_delivery(
    plugin_id: int,
    delivery_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    plugin = await db.get(PluginIntegration, plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    original = await db.get(PluginDeliveryLog, delivery_id)
    if not original or original.plugin_id != plugin_id:
        raise HTTPException(status_code=404, detail="Delivery log not found")
    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    result = await _enqueue_plugin_delivery(
        plugin=plugin,
        event_type=original.event_type,
        payload=original.request_payload or {},
        requested_by=getattr(current_user, "username", "system"),
        request_id=request_id or None,
        trace_token=trace_token or None,
        db=db,
    )
    await db.commit()
    return {"status": "accepted", **result}
