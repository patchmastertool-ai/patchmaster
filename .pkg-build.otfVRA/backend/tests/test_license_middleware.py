import asyncio
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure we import backend.main, not agent.main
sys.path.insert(0, str(Path(__file__).parent.parent))
import main as backend_app


@pytest.fixture(autouse=True)
def disable_background_and_db(monkeypatch):
    # Keep tests fast and deterministic: avoid DB auto-create and background schedulers.
    async def no_init_db():
        return None

    async def no_backup_scheduler_loop():
        return None

    monkeypatch.setattr(backend_app, "init_db", no_init_db)
    monkeypatch.setattr(backend_app, "backup_scheduler_loop", no_backup_scheduler_loop)
    monkeypatch.setattr(backend_app.monitoring_manager, "enforce_license", lambda features: {})


def test_health_is_exempt_when_license_missing(monkeypatch):
    # LicenseMiddleware should not block /api/health.
    monkeypatch.setattr(
        backend_app, "get_license_info", lambda force_refresh=False: {"activated": False, "expired": False}
    )

    client = TestClient(backend_app.app)
    resp = client.get("/api/health")
    assert resp.status_code == 200


def test_boot_publication_path_is_exempt_when_license_missing(monkeypatch):
    monkeypatch.setattr(
        backend_app, "get_license_info", lambda force_refresh=False: {"activated": False, "expired": False}
    )

    client = TestClient(backend_app.app)
    resp = client.get("/boot/network-boot/unknown")
    assert resp.status_code == 404


def test_cve_blocked_when_license_not_activated(monkeypatch):
    # /api/cve/* requires `cve` feature, and middleware should block when not activated.
    monkeypatch.setattr(
        backend_app, "get_license_info", lambda force_refresh=False: {"activated": False, "expired": False}
    )

    client = TestClient(backend_app.app)
    resp = client.get("/api/cve/")
    assert resp.status_code == 403


def test_cve_blocked_when_feature_missing(monkeypatch):
    # Activated, but no `cve` feature => must be blocked by middleware.
    monkeypatch.setattr(
        backend_app,
        "get_license_info",
        lambda force_refresh=False: {
            "valid": True,
            "activated": True,
            "expired": False,
            "features": ["hosts", "dashboard", "groups"],
            "tier": "enterprise",
            "tier_label": "Enterprise (Advance)",
            "max_hosts": 0,
        },
    )

    client = TestClient(backend_app.app)
    resp = client.get("/api/cve/")
    assert resp.status_code == 403
    assert resp.json().get("license_status") == "tier_restricted"


def test_cve_blocked_when_license_invalid(monkeypatch):
    monkeypatch.setattr(
        backend_app,
        "get_license_info",
        lambda force_refresh=False: {
            "valid": False,
            "activated": True,
            "expired": False,
            "error": "Invalid license key format",
        },
    )

    client = TestClient(backend_app.app)
    resp = client.get("/api/cve/")
    assert resp.status_code == 403
    assert resp.json().get("license_status") == "invalid"
