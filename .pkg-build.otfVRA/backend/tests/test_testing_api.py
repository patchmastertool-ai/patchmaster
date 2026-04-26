from types import SimpleNamespace
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure we import backend.main, not agent.main
sys.path.insert(0, str(Path(__file__).parent.parent))
import auth
import main as backend_app
import api.testing as testing_api


@pytest.fixture(autouse=True)
def setup_app(monkeypatch):
    async def no_init_db():
        return None

    async def no_backup_scheduler_loop():
        return None

    monkeypatch.setattr(backend_app, "init_db", no_init_db)
    monkeypatch.setattr(backend_app, "backup_scheduler_loop", no_backup_scheduler_loop)
    monkeypatch.setattr(backend_app.monitoring_manager, "enforce_license", lambda features: {})
    monkeypatch.setattr(
        backend_app,
        "get_license_info",
        lambda force_refresh=False: {
            "valid": True,
            "activated": True,
            "expired": False,
            "features": ["testing"],
            "tier": "enterprise",
            "tier_label": "Enterprise",
            "max_hosts": 0,
        },
    )
    fake_user = lambda: SimpleNamespace(username="tester", role="admin", custom_permissions={"testing": True})
    monkeypatch.setattr(auth, "get_current_user", fake_user)
    monkeypatch.setattr(testing_api, "get_current_user", fake_user)
    backend_app.app.dependency_overrides[testing_api._require_testing_access] = fake_user

    testing_api._RUNS.clear()
    testing_api._ACTIVE_RUN_ID = None
    yield
    backend_app.app.dependency_overrides.clear()
    testing_api._RUNS.clear()
    testing_api._ACTIVE_RUN_ID = None


def test_testing_overview_lists_targets(monkeypatch):
    monkeypatch.setenv("TESTING_EXTERNAL_FRONTEND_URL", "https://example.com")
    monkeypatch.setenv("TESTING_EXTERNAL_BACKEND_URL", "https://api.example.com")
    with TestClient(backend_app.app) as client:
        response = client.get("/api/testing/overview")
    assert response.status_code == 200
    payload = response.json()
    keys = {item["key"] for item in payload["targets"]}
    assert {"backend", "frontend", "frontend-e2e", "quality"} <= keys


def test_start_testing_run_queues_and_blocks_parallel(monkeypatch):
    monkeypatch.setenv("TESTING_EXTERNAL_FRONTEND_URL", "https://example.com")
    monkeypatch.setenv("TESTING_EXTERNAL_BACKEND_URL", "https://api.example.com")

    class DummyThread:
        def __init__(self, target=None, args=None, daemon=None):
            self.target = target
            self.args = args or ()

        def start(self):
            return None

    monkeypatch.setattr(testing_api.threading, "Thread", DummyThread)

    with TestClient(backend_app.app) as client:
        started = client.post("/api/testing/run", json={"target": "backend"})
        assert started.status_code == 200
        body = started.json()
        assert body["status"] == "queued"
        assert body["target"] == "backend"
        testing_api._RUNS[body["run_id"]]["status"] = "running"
        blocked = client.post("/api/testing/run", json={"target": "frontend"})
        assert blocked.status_code == 409


def test_testing_config_roundtrip():
    with TestClient(backend_app.app) as client:
        payload = {
            "external_frontend_url": "https://status.example.com",
            "external_frontend_paths": "/,/health",
            "external_backend_url": "https://api.example.com",
            "external_backend_health_path": "/healthz",
            "external_timeout_seconds": "15",
        }
        updated = client.put("/api/testing/config", json=payload)
        assert updated.status_code == 200
        updated_cfg = updated.json()["config"]
        assert updated_cfg["external_frontend_url"] == "https://status.example.com"
        assert updated_cfg["external_backend_url"] == "https://api.example.com"
        fetched = client.get("/api/testing/config")
        assert fetched.status_code == 200
        fetched_cfg = fetched.json()["config"]
        assert fetched_cfg["external_backend_health_path"] == "/healthz"
        assert fetched_cfg["external_timeout_seconds"] == "15"


def test_testing_config_persists_to_file(monkeypatch, tmp_path):
    config_path = tmp_path / "testing-config.json"
    monkeypatch.setattr(testing_api, "TESTING_CONFIG_PATH", config_path)
    testing_api._RUNTIME_CONFIG.clear()
    for env_key in testing_api._CONFIG_ENV_KEYS.values():
        monkeypatch.delenv(env_key, raising=False)
    testing_api._apply_testing_config(
        testing_api.TestingConfigRequest(
            external_frontend_url="https://frontend.persist.example",
            external_backend_url="https://backend.persist.example",
            external_timeout_seconds="12",
        )
    )
    assert config_path.is_file()
    saved = json.loads(config_path.read_text(encoding="utf-8"))
    assert saved["TESTING_EXTERNAL_FRONTEND_URL"] == "https://frontend.persist.example"
    assert saved["TESTING_EXTERNAL_BACKEND_URL"] == "https://backend.persist.example"
    testing_api._RUNTIME_CONFIG.clear()
    for env_key in testing_api._CONFIG_ENV_KEYS.values():
        monkeypatch.delenv(env_key, raising=False)
    testing_api._load_persisted_runtime_config()
    assert testing_api._RUNTIME_CONFIG["TESTING_EXTERNAL_FRONTEND_URL"] == "https://frontend.persist.example"
    assert testing_api._RUNTIME_CONFIG["TESTING_EXTERNAL_BACKEND_URL"] == "https://backend.persist.example"
