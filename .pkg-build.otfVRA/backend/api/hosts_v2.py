"""Hosts API — CRUD with PostgreSQL, groups, tags."""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from database import get_db
from auth import get_current_user, require_role
from models.db_models import Host, HostGroup, Tag, UserRole, User, host_group_assoc, host_tag_assoc
from prometheus_targets import sync_prometheus_agent_targets

logger = logging.getLogger("patchmaster.hosts")

router = APIRouter(prefix="/api/hosts", tags=["hosts"])


# ── Schemas ──

class HostOut(BaseModel):
    id: int
    hostname: str
    ip: str
    site: str = ""
    hardware_inventory: dict = Field(default_factory=dict)
    os: str
    os_version: str
    kernel: str
    arch: str
    agent_version: str
    is_online: bool
    last_heartbeat: Optional[datetime] = None
    last_patched: Optional[datetime] = None
    reboot_required: bool
    installed_count: int
    upgradable_count: int
    cve_count: int
    compliance_score: float
    groups: List[str] = []
    tags: List[str] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class HostCreate(BaseModel):
    hostname: str
    ip: str
    site: str = ""
    os: str = ""
    os_version: str = ""
    groups: List[str] = []
    tags: List[str] = []

class HostUpdate(BaseModel):
    hostname: Optional[str] = None
    ip: Optional[str] = None
    site: Optional[str] = None
    os: Optional[str] = None
    os_version: Optional[str] = None
    groups: Optional[List[str]] = None
    tags: Optional[List[str]] = None


# ── Helpers ──

async def _get_or_create_groups(db: AsyncSession, names: List[str]) -> List[HostGroup]:
    groups = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        result = await db.execute(select(HostGroup).where(HostGroup.name == name))
        grp = result.scalar_one_or_none()
        if not grp:
            grp = HostGroup(name=name)
            db.add(grp)
            await db.flush()
        groups.append(grp)
    return groups


async def _get_or_create_tags(db: AsyncSession, names: List[str]) -> List[Tag]:
    tags = []
    for name in names:
        name = name.strip().lower()
        if not name:
            continue
        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


def _host_to_out(host: Host) -> dict:
    return {
        **{c.name: getattr(host, c.name) for c in host.__table__.columns},
        "groups": [g.name for g in host.groups],
        "tags": [t.name for t in host.tags],
    }


def _normalize_hostname(name: str) -> str:
    n = (name or "").strip().lower()
    for suffix in ("-windows", "-linux", "-agent"):
        if n.endswith(suffix):
            n = n[: -len(suffix)]
    return n


def _dedupe_hosts_for_inventory(hosts: list[Host]) -> list[Host]:
    picked: dict[tuple[str, str], Host] = {}
    for h in hosts:
        key = ((h.ip or "").strip(), _normalize_hostname(h.hostname or ""))
        existing = picked.get(key)
        if not existing:
            picked[key] = h
            continue
        h_ts = h.updated_at or h.last_heartbeat or h.created_at or datetime.min
        e_ts = existing.updated_at or existing.last_heartbeat or existing.created_at or datetime.min
        # Bug #6 fix: prefer online over offline first; when both have same online
        # state use strict > (not >=) so the existing record wins on equal timestamps,
        # avoiding a spurious swap that could keep the older duplicate.
        if h.is_online and not existing.is_online:
            picked[key] = h
        elif not h.is_online and existing.is_online:
            pass  # keep existing (online)
        elif h_ts > e_ts:
            picked[key] = h
    out = list(picked.values())
    out.sort(key=lambda x: (x.hostname or "").lower())
    return out


# ── Endpoints ──

@router.get("/")
async def list_hosts(
    search: str = "",
    group: str = "",
    tag: str = "",
    site: str = "",
    online_only: bool = False,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    per_page: int = Query(50, ge=1, le=500, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Host).options(selectinload(Host.groups), selectinload(Host.tags))
    if search:
        q = q.where(
            or_(
                Host.hostname.ilike(f"%{search}%"),
                Host.ip.ilike(f"%{search}%"),
                Host.site.ilike(f"%{search}%"),
            )
        )
    if online_only:
        q = q.where(Host.is_online == True)
    if site:
        q = q.where(Host.site == site)
    if group:
        q = q.join(host_group_assoc).join(HostGroup).where(HostGroup.name == group)
    if tag:
        q = q.join(host_tag_assoc).join(Tag).where(Tag.name == tag)
    q = q.order_by(Host.hostname)
    result = await db.execute(q)
    hosts = result.scalars().unique().all()
    hosts = _dedupe_hosts_for_inventory(hosts)
    total = len(hosts)
    offset = (page - 1) * per_page
    page_items = hosts[offset : offset + per_page]
    return {
        "items": [_host_to_out(h) for h in page_items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, (total + per_page - 1) // per_page),
    }


@router.post("/dedupe-same-ip-hostname")
async def dedupe_same_ip_hostname(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(Host).options(selectinload(Host.groups), selectinload(Host.tags)).order_by(Host.id.asc()))
    hosts = result.scalars().all()
    buckets: dict[tuple[str, str], list[Host]] = {}
    for h in hosts:
        buckets.setdefault(((h.ip or "").strip(), _normalize_hostname(h.hostname or "")), []).append(h)
    removed = 0
    merged = 0
    for _, rows in buckets.items():
        if len(rows) <= 1:
            continue
        rows.sort(
            key=lambda x: (
                not x.is_online,
                x.updated_at or x.last_heartbeat or x.created_at or datetime.min,
            ),
            reverse=True,
        )
        survivor = rows[0]
        for dup in rows[1:]:
            for g in dup.groups:
                if g not in survivor.groups:
                    survivor.groups.append(g)
            for t in dup.tags:
                if t not in survivor.tags:
                    survivor.tags.append(t)
            merged += 1
            await db.delete(dup)
            removed += 1
    await db.flush()
    try:
        await sync_prometheus_agent_targets(db)
    except Exception as _prom_err:
        logger.warning("Prometheus target sync failed: %s", _prom_err)
    await db.commit()
    return {"ok": True, "removed": removed, "merged_rows": merged}


@router.get("/{host_id}", response_model=HostOut)
async def get_host(host_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Host).options(selectinload(Host.groups), selectinload(Host.tags)).where(Host.id == host_id)
    )
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(404, "Host not found")
    return _host_to_out(host)


@router.post("/", response_model=HostOut)
async def add_host(
    body: HostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    existing = await db.execute(select(Host).where(Host.hostname == body.hostname))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Host with this hostname already exists")
    host = Host(hostname=body.hostname, ip=body.ip, site=body.site.strip(), os=body.os, os_version=body.os_version)
    if body.groups:
        host.groups = await _get_or_create_groups(db, body.groups)
    if body.tags:
        host.tags = await _get_or_create_tags(db, body.tags)
    db.add(host)
    await db.flush()
    try:
        await sync_prometheus_agent_targets(db)
    except Exception as _prom_err:
        logger.warning("Prometheus target sync failed: %s", _prom_err)
    await db.commit()
    await db.refresh(host, ["groups", "tags"])
    return _host_to_out(host)


@router.put("/{host_id}", response_model=HostOut)
async def update_host(
    host_id: int,
    body: HostUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    result = await db.execute(
        select(Host).options(selectinload(Host.groups), selectinload(Host.tags)).where(Host.id == host_id)
    )
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(404, "Host not found")
    if body.hostname is not None:
        host.hostname = body.hostname
    if body.ip is not None:
        host.ip = body.ip
    if body.site is not None:
        host.site = body.site.strip()
    if body.os is not None:
        host.os = body.os
    if body.os_version is not None:
        host.os_version = body.os_version
    if body.groups is not None:
        host.groups = await _get_or_create_groups(db, body.groups)
    if body.tags is not None:
        host.tags = await _get_or_create_tags(db, body.tags)
    await db.flush()
    try:
        await sync_prometheus_agent_targets(db)
    except Exception as _prom_err:
        logger.warning("Prometheus target sync failed: %s", _prom_err)
    await db.commit()
    await db.refresh(host, ["groups", "tags"])
    return _host_to_out(host)


@router.delete("/{host_id}")
async def delete_host(
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(404, "Host not found")
    await db.delete(host)
    await db.flush()
    try:
        await sync_prometheus_agent_targets(db)
    except Exception as _prom_err:
        logger.warning("Prometheus target sync failed: %s", _prom_err)
    await db.commit()
    return {"ok": True}


# ── Stats ──
@router.get("/stats/summary")
async def host_stats(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    total = await db.scalar(select(func.count(Host.id)))
    online = await db.scalar(select(func.count(Host.id)).where(Host.is_online == True))
    reboot = await db.scalar(select(func.count(Host.id)).where(Host.reboot_required == True))
    avg_compliance = await db.scalar(select(func.avg(Host.compliance_score))) or 0
    total_cves = await db.scalar(select(func.sum(Host.cve_count))) or 0
    total_upgradable = await db.scalar(select(func.sum(Host.upgradable_count))) or 0
    return {
        "total": total,
        "online": online,
        "offline": total - online,
        "reboot_required": reboot,
        "avg_compliance": round(avg_compliance, 1),
        "total_cves": total_cves,
        "total_upgradable": total_upgradable,
    }


# ── Bulk Actions ──

class BulkActionRequest(BaseModel):
    host_ids: List[int]
    action: str  # delete | set_group | set_tag | remove_tag | set_site
    value: Optional[str] = None


@router.post("/bulk")
async def bulk_action(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    """Perform bulk operations on multiple hosts."""
    if not body.host_ids:
        return {"ok": True, "affected": 0}

    result = await db.execute(
        select(Host).options(selectinload(Host.groups), selectinload(Host.tags))
        .where(Host.id.in_(body.host_ids))
    )
    hosts = result.scalars().all()
    affected = len(hosts)

    if body.action == "delete":
        if user.role.value != "admin":
            from fastapi import HTTPException
            raise HTTPException(403, "Only admins can bulk delete hosts")
        for h in hosts:
            await db.delete(h)

    elif body.action == "set_group" and body.value:
        grp_result = await db.execute(select(HostGroup).where(HostGroup.name == body.value))
        grp = grp_result.scalar_one_or_none()
        if not grp:
            grp = HostGroup(name=body.value)
            db.add(grp)
            await db.flush()
        for h in hosts:
            if grp not in h.groups:
                h.groups.append(grp)

    elif body.action == "set_tag" and body.value:
        tags = await _get_or_create_tags(db, [body.value])
        tag = tags[0] if tags else None
        if tag:
            for h in hosts:
                if tag not in h.tags:
                    h.tags.append(tag)

    elif body.action == "remove_tag" and body.value:
        tag_result = await db.execute(select(Tag).where(Tag.name == body.value.strip().lower()))
        tag = tag_result.scalar_one_or_none()
        if tag:
            for h in hosts:
                if tag in h.tags:
                    h.tags.remove(tag)

    elif body.action == "set_site" and body.value is not None:
        normalized_site = body.value.strip()[:120]
        for h in hosts:
            h.site = normalized_site

    await db.flush()
    try:
        await sync_prometheus_agent_targets(db)
    except Exception as _prom_err:
        logger.warning("Prometheus target sync failed: %s", _prom_err)
    await db.commit()
    return {"ok": True, "affected": affected, "action": body.action}


# ── Host Notes ──

class HostNoteRequest(BaseModel):
    note: str


@router.get("/{host_id}/detail")
async def host_detail(
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Extended host detail including recent jobs and CVEs."""
    from models.db_models import PatchJob, HostCVE, CVE
    from sqlalchemy import desc
    from sqlalchemy.orm import selectinload as sload

    result = await db.execute(
        select(Host).options(selectinload(Host.groups), selectinload(Host.tags)).where(Host.id == host_id)
    )
    host = result.scalar_one_or_none()
    if not host:
        from fastapi import HTTPException
        raise HTTPException(404, "Host not found")

    # Recent jobs
    jobs_result = await db.execute(
        select(PatchJob).where(PatchJob.host_id == host_id).order_by(desc(PatchJob.created_at)).limit(10)
    )
    recent_jobs = [
        {"id": j.id, "action": j.action.value, "status": j.status.value, "created_at": j.created_at.isoformat()}
        for j in jobs_result.scalars().all()
    ]

    # Active CVEs
    cves_result = await db.execute(
        select(HostCVE).options(sload(HostCVE.cve))
        .where(HostCVE.host_id == host_id, HostCVE.status == "active")
        .limit(20)
    )
    active_cves = [
        {"cve_id": hc.cve_id, "severity": hc.cve.severity.value, "cvss_score": hc.cve.cvss_score, "description": hc.cve.description[:120]}
        for hc in cves_result.scalars().all()
    ]

    base = _host_to_out(host)
    base["recent_jobs"] = recent_jobs
    base["active_cves"] = active_cves
    return base
