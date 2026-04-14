"""CVE / Advisory mapping API — track vulnerabilities per host."""

from datetime import datetime
from typing import Optional
import os
import csv
import io
import re
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Header,
    status,
    Request,
    UploadFile,
    File,
)
import jwt
from jwt import InvalidTokenError
from pydantic import BaseModel
from sqlalchemy import select, func, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from auth import (
    get_current_user,
    get_current_user_optional,
    require_role,
    SECRET_KEY,
    ALGORITHM,
)
from models.db_models import CVE, HostCVE, Host, Severity, User, UserRole
import httpx
from datetime import timedelta
from threading import Lock

_nvd_request_timestamps: list[datetime] = []
_nvd_lock = Lock()


def _check_rate_limit(max_requests: int = 5, window_seconds: int = 30) -> bool:
    """Check if rate limit allows new request. Returns True if allowed."""
    global _nvd_request_timestamps
    now = _utcnow()
    cutoff = now - timedelta(seconds=window_seconds)

    with _nvd_lock:
        _nvd_request_timestamps = [ts for ts in _nvd_request_timestamps if ts > cutoff]

        if len(_nvd_request_timestamps) >= max_requests:
            return False

        _nvd_request_timestamps.append(now)
        return True


def _utcnow():
    """Timezone-aware UTC now as naive datetime for DB storage."""
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(tzinfo=None)


from openpyxl import load_workbook

router = APIRouter(prefix="/api/cve", tags=["cve"])
CVE_ID_PATTERN = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)


# --- Schemas ---
class CVECreate(BaseModel):
    cve_id: str
    description: Optional[str] = None
    severity: Severity = Severity.medium
    cvss_score: Optional[float] = None


class HostCVECreate(BaseModel):
    host_id: int
    cve_id: str


class CVESyncRequest(BaseModel):
    cis_username: Optional[str] = None
    cis_password: Optional[str] = None


def _severity_from_text(value: str) -> Severity:
    sev_str = (value or "").lower()
    if "critical" in sev_str:
        return Severity.critical
    if "high" in sev_str:
        return Severity.high
    if "low" in sev_str:
        return Severity.low
    return Severity.medium


def _safe_parse_dt(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", ""))
    except Exception:
        return None


def _extract_nvd_fields(cve_data: dict) -> dict:
    descs = cve_data.get("descriptions", [])
    description = descs[0].get("value", "") if descs else ""
    weaknesses = cve_data.get("weaknesses", [])
    cwe_id = ""
    if weaknesses:
        cwe_descs = weaknesses[0].get("description", [])
        cwe_id = cwe_descs[0].get("value", "") if cwe_descs else ""
    refs_list = [r.get("url", "") for r in cve_data.get("references", [])]
    references = "; ".join([r for r in refs_list if r])
    metrics = cve_data.get("metrics", {})
    cvss = None
    severity = Severity.medium
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        metric = metrics.get(key, [])
        if metric:
            cvss_data = metric[0].get("cvssData", {})
            cvss = cvss_data.get("baseScore")
            sev_raw = (
                metric[0].get("baseSeverity") or cvss_data.get("baseSeverity") or ""
            )
            severity = _severity_from_text(sev_raw)
            break
    affected = []
    for node in cve_data.get("configurations", []):
        for match in node.get("nodes", []):
            for cpe in match.get("cpeMatch", []):
                crit = cpe.get("criteria")
                if crit:
                    affected.append(crit)
    return {
        "description": description,
        "cvss_score": float(cvss) if cvss else 0.0,
        "severity": severity,
        "published_date": _safe_parse_dt(cve_data.get("published")),
        "cwe_id": cwe_id,
        "references": references,
        "affected_products": "; ".join(affected[:50]),
    }


# --- CVE CRUD ---
@router.get("/")
async def list_cves(
    severity: Optional[str] = None,
    search: Optional[str] = None,
    unpatched_only: bool = False,
    include_hosts_only: bool = False,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=500, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(CVE)
    if severity:
        try:
            sev_enum = Severity(severity)
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid severity")
        q = q.where(CVE.severity == sev_enum)
    if search:
        q = q.where(CVE.id.ilike(f"%{search}%") | CVE.description.ilike(f"%{search}%"))
    q = q.order_by(CVE.cvss_score.desc().nullslast(), CVE.id.asc())

    # Count total before pagination
    count_q = select(func.count()).select_from(q.subquery())
    total_raw = await db.scalar(count_q) or 0

    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    cves = result.scalars().all()

    data = []
    for c in cves:
        affected = (
            await db.scalar(
                select(func.count()).select_from(HostCVE).where(HostCVE.cve_id == c.id)
            )
            or 0
        )
        patched = (
            await db.scalar(
                select(func.count())
                .select_from(HostCVE)
                .where(HostCVE.cve_id == c.id, HostCVE.status == "patched")
            )
            or 0
        )
        if unpatched_only and affected == patched:
            continue
        if include_hosts_only and affected == 0:
            continue
        data.append(
            {
                "id": c.id,
                "cve_id": c.id,
                "description": c.description,
                "severity": c.severity.value,
                "cvss_score": c.cvss_score,
                "affected_hosts": affected,
                "patched_hosts": patched,
            }
        )
    return {
        "items": data,
        "total": total_raw,
        "page": page,
        "per_page": per_page,
        "pages": max(1, (total_raw + per_page - 1) // per_page),
    }


@router.get("/stats")
async def cve_stats(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    total = await db.scalar(select(func.count(CVE.id))) or 0
    by_severity = {}
    for sev in Severity:
        count = (
            await db.scalar(select(func.count(CVE.id)).where(CVE.severity == sev)) or 0
        )
        by_severity[sev.value] = count

    open_vulns = (
        await db.scalar(
            select(func.count()).select_from(HostCVE).where(HostCVE.status == "active")
        )
        or 0
    )
    patched_vulns = (
        await db.scalar(
            select(func.count()).select_from(HostCVE).where(HostCVE.status == "patched")
        )
        or 0
    )

    return {
        "total_cves": total,
        "by_severity": by_severity,
        "open_vulnerabilities": open_vulns,
        "patched_vulnerabilities": patched_vulns,
    }


@router.post("/", status_code=201)
async def create_cve(
    data: CVECreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    # Validate CVE ID format
    if not CVE_ID_PATTERN.match(data.cve_id):
        raise HTTPException(
            400, f"Invalid CVE ID format: '{data.cve_id}'. Expected CVE-YYYY-NNNNN."
        )
    existing = await db.get(CVE, data.cve_id)
    if existing:
        raise HTTPException(400, "CVE already exists")
    cve = CVE(
        id=data.cve_id,
        description=data.description or "",
        severity=data.severity,
        cvss_score=float(data.cvss_score) if data.cvss_score is not None else 0.0,
    )
    db.add(cve)
    await db.commit()
    await db.refresh(cve)
    return {"id": cve.id, "cve_id": cve.id}


@router.get("/export")
async def export_cve_report(
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
    request: Request = None,
    user: Optional[User] = Depends(get_current_user_optional),
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    # BUG-003 FIX: REMOVE query param authentication entirely
    # Accept token ONLY via Authorization header or secure cookie
    # Query params are logged in web server logs and browser history
    resolved_token = None
    if authorization and authorization.lower().startswith("bearer "):
        resolved_token = authorization.split(" ", 1)[1].strip()
    if not resolved_token and request:
        cookie_name = os.getenv("AUTH_COOKIE_NAME", "pm_token")
        resolved_token = request.cookies.get(cookie_name)

    if user:
        authed_user = user
    elif resolved_token:
        try:
            payload = jwt.decode(resolved_token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if not username:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
        except InvalidTokenError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
        result = await db.execute(
            select(User).where(func.lower(User.username) == username.lower())
        )
        authed_user = result.scalar_one_or_none()
        if not authed_user or not authed_user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    else:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated. Provide Authorization: Bearer <jwt> header.",
        )

    # Bug fix: enforce role — viewers must not be able to export sensitive CVE data
    if authed_user.role not in (UserRole.admin, UserRole.operator, UserRole.auditor):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Insufficient permissions to export CVE data."
        )

    result = await db.execute(
        select(HostCVE).options(selectinload(HostCVE.cve), selectinload(HostCVE.host))
    )
    mappings = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "CVE ID",
            "Severity",
            "CVSS",
            "Host",
            "IP",
            "Status",
            "Detected At",
            "Description",
        ]
    )

    for m in mappings:
        writer.writerow(
            [
                m.cve.id,
                m.cve.severity.value,
                m.cve.cvss_score,
                m.host.hostname,
                m.host.ip,
                "Patched" if m.status == "patched" else "Vulnerable",
                m.detected_at.isoformat() if m.detected_at else "",
                m.cve.description,
            ]
        )

    output.seek(0)
    # Task 7: Fix CSV encoding - add UTF-8 BOM for Excel compatibility
    return StreamingResponse(
        io.BytesIO(b"\xef\xbb\xbf" + output.getvalue().encode("utf-8")),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=cve_report_{datetime.now().strftime('%Y%m%d')}.csv"
        },
    )


@router.get("/{cve_id}")
async def get_cve(
    cve_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cve = await db.get(CVE, cve_id)
    if not cve:
        raise HTTPException(404, "CVE not found")
    result = await db.execute(
        select(HostCVE)
        .where(HostCVE.cve_id == cve_id)
        .options(selectinload(HostCVE.host))
    )
    host_cves = result.scalars().all()
    return {
        "id": cve.id,
        "cve_id": cve.id,
        "description": cve.description,
        "severity": cve.severity.value,
        "cvss_score": cve.cvss_score,
        "affected_hosts": [
            {
                "host_id": hc.host.id,
                "hostname": hc.host.hostname,
                "ip": hc.host.ip,
                "status": hc.status,
                "detected_at": hc.detected_at.isoformat() if hc.detected_at else None,
            }
            for hc in host_cves
        ],
    }


@router.delete("/{cve_id}", status_code=204)
async def delete_cve(
    cve_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    cve = await db.get(CVE, cve_id)
    if not cve:
        raise HTTPException(404, "CVE not found")
    await db.execute(delete(HostCVE).where(HostCVE.cve_id == cve_id))
    await db.delete(cve)
    await db.commit()


@router.post("/import", status_code=201)
async def import_cves(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    """Bulk import CVEs from CSV or XLSX.
    Required: cve_id.
    Optional: description, severity, cvss_score, host columns (host_id/host/hostname/ip)."""
    content = await file.read()
    records: list[dict] = []
    fn = (file.filename or "").lower()

    def normalize_row(row: dict) -> Optional[dict]:
        cid = (row.get("cve_id") or row.get("CVE ID") or row.get("cve") or "").strip()
        if not cid:
            return None
        severity_str = (row.get("severity") or row.get("Severity") or "medium").lower()
        sev_map = {
            "critical": Severity.critical,
            "high": Severity.high,
            "medium": Severity.medium,
            "low": Severity.low,
        }
        severity_val = sev_map.get(severity_str, Severity.medium)
        cvss_raw = row.get("cvss") or row.get("cvss_score") or row.get("CVSS") or ""
        try:
            cvss_score = float(cvss_raw) if str(cvss_raw).strip() else 0.0
        except ValueError:
            cvss_score = 0.0
        description = (row.get("description") or row.get("Description") or "").strip()
        host_tokens = []
        for key in (
            "host_id",
            "host_ids",
            "host",
            "hosts",
            "hostname",
            "ip",
            "host_ip",
        ):
            val = row.get(key) or row.get(key.title()) or row.get(key.upper())
            if val:
                host_tokens.append(str(val))
        host_refs = []
        if host_tokens:
            merged = ",".join(host_tokens).replace(";", ",")
            for token in [t.strip() for t in merged.split(",") if t.strip()]:
                if token.isdigit():
                    host_refs.append({"id": int(token)})
                else:
                    host_refs.append({"label": token})
        return {
            "cve_id": cid,
            "severity": severity_val,
            "cvss_score": cvss_score,
            "description": description,
            "host_refs": host_refs,
        }

    if fn.endswith(".xlsx") or fn.endswith(".xlsm"):
        wb = load_workbook(io.BytesIO(content), read_only=True)
        ws = wb.active
        rows = list(ws.rows)
        if not rows:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty spreadsheet")
        headers = [
            str(cell.value).strip() if cell.value is not None else ""
            for cell in rows[0]
        ]
        for r in rows[1:]:
            row = {
                headers[i]: (r[i].value if i < len(r) else None)
                for i in range(len(headers))
            }
            norm = normalize_row(row)
            if norm:
                records.append(norm)
    else:
        text = content.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            norm = normalize_row(row)
            if norm:
                records.append(norm)

    created = 0
    updated = 0
    host_links_created = 0
    invalid_cve_ids = []  # BUG-008 FIX: Track invalid CVE IDs
    for row in records:
        # BUG-008 FIX: Track and report invalid CVE IDs
        if not CVE_ID_PATTERN.match(row["cve_id"]):
            # Track invalid CVE IDs for reporting
            if "invalid_cve_ids" not in locals():
                invalid_cve_ids = []
            invalid_cve_ids.append(row["cve_id"])
            continue
        existing = await db.get(CVE, row["cve_id"])
        if existing:
            existing.description = row["description"] or existing.description
            existing.cvss_score = row["cvss_score"] or existing.cvss_score
            existing.severity = row["severity"]
            updated += 1
        else:
            cve = CVE(
                id=row["cve_id"],
                description=row["description"],
                severity=row["severity"],
                cvss_score=row["cvss_score"],
                source="import",
            )
            db.add(cve)
            created += 1
        # map to hosts if provided
        if row.get("host_refs"):
            ids = [r["id"] for r in row["host_refs"] if "id" in r]
            labels = [r["label"] for r in row["host_refs"] if "label" in r]
            conds = []
            if ids:
                conds.append(Host.id.in_(ids))
            if labels:
                conds.append(
                    or_(
                        func.lower(Host.hostname).in_([l.lower() for l in labels]),
                        func.lower(Host.ip).in_([l.lower() for l in labels]),
                    )
                )
            if conds:
                host_result = await db.execute(select(Host).where(or_(*conds)))
                hosts_found = host_result.scalars().all()
                for host in hosts_found:
                    hc = await db.get(HostCVE, (host.id, row["cve_id"]))
                    if not hc:
                        db.add(
                            HostCVE(
                                host_id=host.id, cve_id=row["cve_id"], status="active"
                            )
                        )
                        host.cve_count = (host.cve_count or 0) + 1
                        host_links_created += 1
    await db.commit()

    # BUG-008 FIX: Return detailed report including invalid CVE IDs
    response = {
        "created": created,
        "updated": updated,
        "processed": len(records),
        "host_links": host_links_created,
    }

    if invalid_cve_ids:
        response["invalid_cve_ids"] = invalid_cve_ids
        response["invalid_count"] = len(invalid_cve_ids)
        response["warning"] = (
            f"{len(invalid_cve_ids)} CVE ID(s) were rejected due to invalid format. Expected format: CVE-YYYY-NNNNN"
        )

    return response


@router.post("/map", status_code=201)
async def map_cve_to_host(
    data: HostCVECreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    host = await db.get(Host, data.host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    cve = await db.get(CVE, data.cve_id)
    if not cve:
        raise HTTPException(404, "CVE not found")
    existing = await db.get(HostCVE, (data.host_id, data.cve_id))
    if existing:
        raise HTTPException(400, "Mapping already exists")
    hc = HostCVE(host_id=data.host_id, cve_id=data.cve_id, status="active")
    db.add(hc)
    host.cve_count = (
        await db.scalar(
            select(func.count())
            .select_from(HostCVE)
            .where(HostCVE.host_id == host.id, HostCVE.status == "active")
        )
        or 0
    )
    await db.commit()
    return {"host_id": hc.host_id, "cve_id": hc.cve_id}


@router.post("/map/{host_id}/{cve_id}/mark-patched")
async def mark_patched(
    host_id: int,
    cve_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    hc = await db.get(HostCVE, (host_id, cve_id))
    if not hc:
        raise HTTPException(404, "Mapping not found")
    hc.status = "patched"
    host = await db.get(Host, hc.host_id)
    if host:
        host.cve_count = (
            await db.scalar(
                select(func.count())
                .select_from(HostCVE)
                .where(HostCVE.host_id == host.id, HostCVE.status == "active")
            )
            or 0
        )
    await db.commit()
    return {"status": "patched"}


@router.get("/host/{host_id}")
async def host_cves(
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all CVEs for a specific host."""
    host = await db.get(Host, host_id)
    if not host:
        raise HTTPException(404, "Host not found")
    result = await db.execute(
        select(HostCVE)
        .where(HostCVE.host_id == host_id)
        .options(selectinload(HostCVE.cve))
    )
    host_cves_list = result.scalars().all()
    return [
        {
            "host_id": hc.host_id,
            "cve_id": hc.cve.id,
            "description": hc.cve.description,
            "severity": hc.cve.severity.value,
            "cvss_score": hc.cve.cvss_score,
            "status": hc.status,
            "detected_at": hc.detected_at.isoformat() if hc.detected_at else None,
        }
        for hc in host_cves_list
    ]


@router.post("/filter-security")
async def filter_security_packages(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Filter packages to only those with security vulnerabilities.
    Used by agents on platforms without native security classification.

    Request body:
    {
        "host_id": "abc123",
        "packages": ["vim", "curl", "nginx"],
        "severity_threshold": "medium"  // optional: low, medium, high, critical
    }

    Response:
    {
        "security_packages": ["vim", "curl"],
        "cve_details": {...},
        "filtered_count": 2,
        "total_count": 3
    }
    """
    host_id = body.get("host_id")
    packages = body.get("packages", [])
    severity_threshold = body.get("severity_threshold", "low")

    if not host_id or not packages:
        raise HTTPException(400, "host_id and packages required")

    # Get host to determine OS
    host = await db.get(Host, host_id)
    if not host:
        raise HTTPException(404, "Host not found")

    # Map OS to family for CVE lookup
    os_family_map = {
        "debian": "debian",
        "ubuntu": "debian",
        "rhel": "rhel",
        "centos": "rhel",
        "rocky": "rhel",
        "alma": "rhel",
        "fedora": "rhel",
        "amazon": "rhel",
        "arch": "arch",
        "opensuse": "opensuse",
        "sles": "opensuse",
        "alpine": "alpine",
        "freebsd": "freebsd",
        "windows": "windows",
    }

    os_lower = (host.os or "").lower()
    os_family = None
    for key, family in os_family_map.items():
        if key in os_lower:
            os_family = family
            break

    if not os_family:
        os_family = "unknown"

    # Severity score thresholds
    severity_scores = {"low": 0.1, "medium": 4.0, "high": 7.0, "critical": 9.0}
    min_score = severity_scores.get(severity_threshold, 0.1)

    # Query CVE database for each package
    security_packages = []
    cve_details = {}

    for pkg in packages:
        # Query CVEs for this package on this OS family
        result = await db.execute(
            select(CVE)
            .where(
                or_(
                    CVE.affected_products.ilike(f"%{pkg}%"),
                    CVE.description.ilike(f"%{pkg}%"),
                ),
                CVE.cvss_score >= min_score,
            )
            .limit(10)
        )
        cves = result.scalars().all()

        if cves:
            security_packages.append(pkg)
            cve_details[pkg] = [
                {
                    "cve_id": cve.id,
                    "severity": cve.severity.value,
                    "score": cve.cvss_score,
                    "description": cve.description[:200] if cve.description else "",
                }
                for cve in cves
            ]

    return {
        "security_packages": security_packages,
        "cve_details": cve_details,
        "filtered_count": len(security_packages),
        "total_count": len(packages),
        "os_family": os_family,
        "severity_threshold": severity_threshold,
    }


@router.post("/sync", status_code=202)
async def sync_cves_from_nvd(
    source: str = Query("nvd", description="Feed source: nvd or cis"),
    days: int = Query(2, ge=1, le=30),
    start: Optional[str] = Query(None, description="ISO start date"),
    end: Optional[str] = Query(None, description="ISO end date"),
    url: Optional[str] = Query(None, description="Optional CIS advisory page URL"),
    payload: Optional[CVESyncRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.operator)),
):
    source_name = (source or "nvd").strip().lower()
    if source_name == "cis":
        cis_url = (url or "https://www.cisecurity.org/advisories").strip()
        cis_username = (payload.cis_username if payload else None) or os.environ.get(
            "CIS_USERNAME", ""
        )
        cis_password = (payload.cis_password if payload else None) or os.environ.get(
            "CIS_PASSWORD", ""
        )
        cis_username = cis_username.strip()
        cis_password = cis_password.strip()
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                auth = (
                    httpx.BasicAuth(cis_username, cis_password)
                    if cis_username and cis_password
                    else None
                )
                resp = await client.get(cis_url, auth=auth)
                if resp.status_code in (401, 403):
                    raise HTTPException(
                        status.HTTP_401_UNAUTHORIZED,
                        detail={
                            "error": "CIS credentials required for feed access.",
                            "code": "cis_credentials_required",
                        },
                    )
                resp.raise_for_status()
                text = resp.text or ""
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"CIS sync failed: {e}")

        found_ids = sorted(
            {match.group(0).upper() for match in CVE_ID_PATTERN.finditer(text)}
        )
        if not found_ids:
            lowered = text.lower()
            login_markers = ("sign in", "log in", "login", "password")
            if any(marker in lowered for marker in login_markers) and not (
                cis_username and cis_password
            ):
                raise HTTPException(
                    status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "error": "CIS feed appears protected. Credentials are required.",
                        "code": "cis_credentials_required",
                    },
                )
        created = 0
        updated = 0
        enriched = 0
        async with httpx.AsyncClient(timeout=30) as nvd_client:
            for cve_id in found_ids:
                nvd_fields = None
                try:
                    nvd_resp = await nvd_client.get(
                        "https://services.nvd.nist.gov/rest/json/cves/2.0",
                        params={"cveId": cve_id},
                    )
                    nvd_resp.raise_for_status()
                    vulnerabilities = (nvd_resp.json() or {}).get("vulnerabilities", [])
                    if vulnerabilities:
                        nvd_fields = _extract_nvd_fields(
                            vulnerabilities[0].get("cve", {}) or {}
                        )
                        enriched += 1
                except Exception:
                    nvd_fields = None

                base_description = f"Imported from CIS advisory feed: {cis_url}"
                if nvd_fields:
                    description = nvd_fields["description"] or base_description
                    severity = nvd_fields["severity"]
                    cvss_score = nvd_fields["cvss_score"]
                    published_date = nvd_fields["published_date"]
                    cwe_id = nvd_fields["cwe_id"]
                    references = nvd_fields["references"]
                    affected_products = nvd_fields["affected_products"]
                else:
                    description = base_description
                    severity = Severity.medium
                    cvss_score = 0.0
                    published_date = None
                    cwe_id = ""
                    references = ""
                    affected_products = ""

                refs = [item.strip() for item in references.split(";") if item.strip()]
                if cis_url not in refs:
                    refs.append(cis_url)
                merged_refs = "; ".join(refs[:20])

                existing = await db.get(CVE, cve_id)
                if existing:
                    existing.description = description or existing.description
                    existing.cvss_score = cvss_score or existing.cvss_score
                    existing.severity = severity
                    existing.published_date = published_date or existing.published_date
                    existing.cwe_id = cwe_id or existing.cwe_id
                    existing.references = merged_refs or existing.references
                    existing.affected_products = (
                        affected_products or existing.affected_products
                    )
                    existing.source = "cis"
                    updated += 1
                else:
                    db.add(
                        CVE(
                            id=cve_id,
                            description=description or base_description,
                            severity=severity,
                            cvss_score=cvss_score,
                            published_date=published_date,
                            cwe_id=cwe_id,
                            references=merged_refs,
                            affected_products=affected_products,
                            source="cis",
                        )
                    )
                    created += 1
        await db.commit()
        return {
            "source": "cis",
            "feed_url": cis_url,
            "created": created,
            "updated": updated,
            "fetched": len(found_ids),
            "enriched": enriched,
        }

    if source_name != "nvd":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Unsupported source. Use nvd or cis."
        )

    if not _check_rate_limit(max_requests=5, window_seconds=30):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded. Maximum 5 CVE sync requests per 30 seconds.",
                "code": "rate_limit_exceeded",
                "retry_after": 30,
            },
        )

    try:
        if start and end:
            start_date = datetime.fromisoformat(start)
            end_date = datetime.fromisoformat(end)
        else:
            end_date = _utcnow()
            start_date = end_date - timedelta(days=days)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date range")
    url = (
        "https://services.nvd.nist.gov/rest/json/cves/2.0"
        f"?resultsPerPage=200&pubStartDate={start_date.isoformat()}Z&pubEndDate={end_date.isoformat()}Z"
    )
    created = 0
    updated = 0
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json().get("vulnerabilities", [])
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"NVD sync failed: {e}")

    for item in data:
        cve_data = item.get("cve", {})
        cve_id = cve_data.get("id")
        if not cve_id:
            continue
        nvd_fields = _extract_nvd_fields(cve_data)
        description = nvd_fields["description"]
        cvss_score = nvd_fields["cvss_score"]
        severity = nvd_fields["severity"]
        published_date = nvd_fields["published_date"]
        cwe_id = nvd_fields["cwe_id"]
        references = nvd_fields["references"]
        affected_products = nvd_fields["affected_products"]

        existing = await db.get(CVE, cve_id)
        if existing:
            existing.description = description or existing.description
            existing.cvss_score = cvss_score or existing.cvss_score
            existing.severity = severity
            existing.published_date = published_date or existing.published_date
            existing.cwe_id = cwe_id
            existing.references = references
            existing.affected_products = affected_products
            existing.source = "nvd"
            updated += 1
        else:
            cve = CVE(
                id=cve_id,
                description=description or "",
                severity=severity,
                cvss_score=cvss_score,
                published_date=published_date,
                cwe_id=cwe_id,
                references=references,
                affected_products=affected_products,
                source="nvd",
            )
            db.add(cve)
            created += 1
    await db.commit()
    window_days = max(1, (end_date - start_date).days or 1)
    return {
        "source": "nvd",
        "created": created,
        "updated": updated,
        "start": start_date.isoformat(),
        "end": end_date.isoformat(),
        "window_days": window_days,
        "fetched": len(data),
    }
