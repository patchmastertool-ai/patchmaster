import asyncio
from types import SimpleNamespace

from fastapi import BackgroundTasks, HTTPException

import api.bulk_patch as bulk_patch
import api.ring_rollout as ring_rollout
import api.maintenance as maintenance
import api.policies as policies


def test_apply_policy_on_host_returns_success(monkeypatch):
    class DummyResponse:
        status_code = 200

        def json(self):
            return {"applied": True}

    class DummyClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json=None, headers=None):
            assert url == "http://10.0.0.10:8080/policy/apply"
            assert json == {"policy": "packages:\n  hold: []"}
            assert headers == {"Authorization": "Bearer host-token"}
            return DummyResponse()

    monkeypatch.setattr(policies.httpx, "AsyncClient", lambda timeout=30.0: DummyClient())

    result = asyncio.run(
        policies.apply_policy_on_host(
            "10.0.0.10",
            "packages:\n  hold: []",
            SimpleNamespace(agent_token="host-token"),
        )
    )

    assert result["success"] is True
    assert result["result"]["applied"] is True


def test_apply_policy_to_hosts_returns_per_host_results(monkeypatch):
    policy = SimpleNamespace(id=8, yaml_content="packages:\n  hold: []")
    hosts = [
        SimpleNamespace(id=1, ip="10.0.0.11", agent_token="a"),
        SimpleNamespace(id=2, ip="10.0.0.12", agent_token="b"),
    ]

    class FakeScalarResult:
        def __init__(self, values):
            self._values = values

        def scalar_one_or_none(self):
            return self._values[0] if self._values else None

        def all(self):
            return self._values

    class FakeResult:
        def __init__(self, values):
            self._values = values

        def scalar_one_or_none(self):
            return self._values[0] if self._values else None

        def scalars(self):
            return FakeScalarResult(self._values)

    class FakeDB:
        def __init__(self):
            self.calls = 0

        async def execute(self, _stmt):
            self.calls += 1
            if self.calls == 1:
                return FakeResult([policy])
            return FakeResult(hosts)

    async def fake_apply(host_ip, policy_content, host=None):
        if host_ip.endswith(".11"):
            return {"host": host_ip, "success": True, "result": {"applied": True}}
        return {"host": host_ip, "success": False, "error": "timeout"}

    monkeypatch.setattr(policies, "apply_policy_on_host", fake_apply)

    result = asyncio.run(
        policies.apply_policy_to_hosts(
            8,
            [1, 2],
            BackgroundTasks(),
            FakeDB(),
            SimpleNamespace(username="alice"),
        )
    )

    assert result["status"] == "completed"
    assert result["host_count"] == 2
    assert result["succeeded"] == 1
    assert result["failed"] == 1


def test_apply_policy_to_hosts_dry_run_includes_guardrails():
    policy = SimpleNamespace(id=8, yaml_content="packages:\n  hold: []", active_revision_id=11)
    hosts = [
        SimpleNamespace(id=1, ip="10.0.0.11", agent_token="a"),
        SimpleNamespace(id=2, ip="10.0.0.12", agent_token="b"),
    ]

    class FakeScalarResult:
        def __init__(self, values):
            self._values = values

        def scalar_one_or_none(self):
            return self._values[0] if self._values else None

        def all(self):
            return self._values

    class FakeResult:
        def __init__(self, values):
            self._values = values

        def scalar_one_or_none(self):
            return self._values[0] if self._values else None

        def scalars(self):
            return FakeScalarResult(self._values)

    class FakeDB:
        def __init__(self):
            self.calls = 0

        async def execute(self, _stmt):
            self.calls += 1
            if self.calls == 1:
                return FakeResult([policy])
            return FakeResult(hosts)

    result = asyncio.run(
        policies.apply_policy_to_hosts(
            8,
            [1, 2],
            BackgroundTasks(),
            FakeDB(),
            SimpleNamespace(username="alice"),
            mode="dry_run",
            guardrails={"require_change_window": True},
        )
    )

    assert result["execution_mode"] == "dry_run"
    assert result["failed"] == 0
    assert result["results"][0]["result"]["would_apply"] is True
    assert result["results"][0]["result"]["guardrails"]["require_change_window"] is True


def test_policy_public_prefers_active_revision_and_latest_execution():
    active_revision = SimpleNamespace(id=2, policy_id=7, revision_number=2, name="Secure Base", description="active", yaml_content="active: true", status="active", change_summary="Activate", created_by="ops", created_at=None)
    draft_revision = SimpleNamespace(id=3, policy_id=7, revision_number=3, name="Secure Base", description="draft", yaml_content="draft: true", status="draft", change_summary="Draft", created_by="ops", created_at=None)
    execution = SimpleNamespace(id=5, policy_id=7, revision_id=2, execution_mode="apply", status="completed", requested_by="ops", host_ids=[1], host_results=[], guardrails={}, summary={"host_count": 1}, queue_job_id="", requested_at=policies._utcnow(), completed_at=None)
    policy = SimpleNamespace(
        id=7,
        name="Secure Base",
        description="Policy",
        yaml_content="fallback: true",
        created_by="ops",
        created_at=None,
        updated_at=None,
        active_revision_id=2,
        latest_revision_number=3,
        revisions=[active_revision, draft_revision],
        executions=[execution],
    )

    data = policies._policy_public(policy)

    assert data["active_revision"]["id"] == 2
    assert data["latest_revision"]["id"] == 3
    assert data["yaml_content"] == "active: true"
    assert data["last_execution"]["execution_mode"] == "apply"


def test_render_command_template_requires_values_and_substitutes():
    rendered = policies._render_command_template("curl {{bundle_url}}", {"bundle_url": "http://relay/bundle.tar.gz"})
    assert rendered == "curl http://relay/bundle.tar.gz"

    try:
        policies._render_command_template("curl {{bundle_url}}", {})
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400


def test_check_current_window_returns_active_match(monkeypatch):
    fixed_now = SimpleNamespace(weekday=lambda: 0, hour=3)

    class FakeWindow:
        id = 3
        name = "Tuesday Night"
        description = "core patch window"
        day_of_week = [0, 2]
        start_hour = 2
        end_hour = 6
        timezone = "UTC"
        applies_to_groups = []
        applies_to_hosts = []
        is_active = True
        block_outside = True
        created_by = "ops"
        created_at = SimpleNamespace(isoformat=lambda: "2026-04-03T00:00:00")

    class FakeScalarResult:
        def __init__(self, values):
            self._values = values

        def all(self):
            return self._values

    class FakeResult:
        def __init__(self, values):
            self._values = values

        def scalars(self):
            return FakeScalarResult(self._values)

    class FakeDB:
        async def execute(self, _stmt):
            return FakeResult([FakeWindow()])

    monkeypatch.setattr(maintenance, "_utcnow", lambda: fixed_now)

    result = asyncio.run(maintenance.check_current_window(FakeDB(), SimpleNamespace(username="ops")))

    assert result["in_window"] is True
    assert result["active_windows"][0]["name"] == "Tuesday Night"
    assert result["active_windows"][0]["day_names"] == ["Mon", "Wed"]


def test_create_bulk_job_rejects_unknown_host_ids():
    class FakeResult:
        def all(self):
            return [(1,), (2,)]

    class FakeDB:
        async def execute(self, _stmt):
            return FakeResult()

    body = bulk_patch.BulkPatchCreate(name="core-linux-patch", host_ids=[1, 2, 99], packages=["openssl"])

    try:
        asyncio.run(
            bulk_patch.create_bulk_job(
                body,
                SimpleNamespace(state=SimpleNamespace(request_id="r1", trace_token="t1")),
                False,
                FakeDB(),
                SimpleNamespace(username="alice"),
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "99" in str(exc.detail)


def test_ring_rollout_health_gate_blocks_offline_and_low_compliance():
    host = SimpleNamespace(is_online=False, compliance_score=42.0, cve_count=5)

    allowed, reasons = ring_rollout._health_gate_for_host(
        host,
        {"health": {"require_online": True, "min_compliance_score": 90, "max_cve_count": 2}},
    )

    assert allowed is False
    assert reasons == ["host_offline", "compliance_below_90.0", "cve_above_2"]


def test_ring_rollout_parse_action_rejects_unknown_values():
    try:
        ring_rollout._parse_action("explode")
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Unsupported rollout action"
