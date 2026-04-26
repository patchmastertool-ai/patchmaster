import asyncio
from pathlib import Path
import pytest

# Try to import agent.main - skip tests if dependencies are missing
try:
    import agent.main as agent_main
    AGENT_MAIN_AVAILABLE = True
except ImportError:
    AGENT_MAIN_AVAILABLE = False
    agent_main = None

import api.hosts_v2 as hosts_v2
import api.register_v2 as register_v2
import api.reports as reports
from models.db_models import Host


@pytest.mark.skipif(not AGENT_MAIN_AVAILABLE, reason="agent.main dependencies not available")
def test_agent_inventory_includes_site_from_env(monkeypatch):
    monkeypatch.setenv("PATCHMASTER_SITE", "Singapore-DC")
    monkeypatch.setattr(agent_main, "_stable_agent_id", lambda: "agent-1")
    monkeypatch.setattr(agent_main, "get_os_info", lambda: ("Ubuntu", "24.04"))
    monkeypatch.setattr(agent_main, "get_real_ip", lambda: "10.10.10.5")
    monkeypatch.setattr(agent_main.socket, "gethostname", lambda: "ubuntu-dc-01")
    monkeypatch.setattr(agent_main.platform, "release", lambda: "6.8.0")
    monkeypatch.setattr(agent_main.platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(agent_main.platform, "processor", lambda: "Intel Xeon")
    monkeypatch.setattr(agent_main.platform, "node", lambda: "ubuntu-dc-01")

    class FakeVM:
        total = 34359738368

    class FakeDisk:
        total = 536870912000

    monkeypatch.setattr(agent_main.psutil, "cpu_count", lambda logical=True: 16)
    monkeypatch.setattr(agent_main.psutil, "virtual_memory", lambda: FakeVM())
    monkeypatch.setattr(agent_main.psutil, "disk_usage", lambda _path: FakeDisk())
    monkeypatch.setattr(agent_main, "_firmware_inventory", lambda: {
        "boot_mode": "uefi",
        "uefi_present": True,
        "secure_boot_enabled": True,
    })

    data = agent_main.get_inventory()
    assert data["site"] == "Singapore-DC"
    assert data["hostname"] == "ubuntu-dc-01"
    assert data["hardware_inventory"]["cpu_model"] == "Intel Xeon"
    assert data["hardware_inventory"]["cpu_cores"] == 16
    assert data["hardware_inventory"]["memory_mb"] == 32768
    assert data["hardware_inventory"]["boot_mode"] == "uefi"
    assert data["hardware_inventory"]["secure_boot_enabled"] is True


def test_register_agent_persists_site(monkeypatch):
    created = {}

    class FakeDB:
        async def execute(self, _stmt):
            return None

        def add(self, obj):
            created["host"] = obj

        async def flush(self):
            host = created.get("host")
            if host is not None:
                host.id = 44

        async def commit(self):
            return None

    class FakeRequest:
        client = type("Client", (), {"host": "10.20.30.40"})()

    async def fake_schema(_db):
        return None

    async def fake_find_by_agent_id(_db, _agent_id):
        return None

    async def fake_find_legacy(_db, _hostname, _ip, incoming_agent_id=None):
        return None

    async def fake_allocate_hostname(_db, hostname, _os_name):
        return hostname

    async def fake_group(_db, _host, _os_name):
        return None

    async def fake_sync(_db):
        return []

    monkeypatch.setattr(register_v2, "_ensure_host_schema", fake_schema)
    monkeypatch.setattr(register_v2, "_find_host_by_agent_id", fake_find_by_agent_id)
    monkeypatch.setattr(register_v2, "_find_legacy_host", fake_find_legacy)
    monkeypatch.setattr(register_v2, "_allocate_hostname", fake_allocate_hostname)
    monkeypatch.setattr(register_v2, "_ensure_os_family_group", fake_group)
    monkeypatch.setattr(register_v2, "sync_prometheus_agent_targets", fake_sync)
    monkeypatch.setattr(register_v2, "_schedule_mirror_automation_for_host", lambda *_args, **_kwargs: None)

    req = register_v2.RegisterRequest(
        agent_id="agent-22",
        hostname="windows-branch-01",
        os="Windows 11",
        os_version="24H2",
        kernel="10.0.26100",
        arch="x86_64",
        ip="10.20.30.40",
        site="London-Branch",
        hardware_inventory={"cpu_model": "Intel Core i7", "cpu_cores": 8, "memory_mb": 16384, "disk_total_gb": 512},
        agent_version="2.0.0",
    )
    resp = asyncio.run(register_v2.register_agent(req, FakeRequest(), FakeDB()))

    assert "agent_token" in resp
    assert created["host"].site == "London-Branch"
    assert created["host"].hardware_inventory["cpu_model"] == "Intel Core i7"


def test_heartbeat_updates_existing_site(monkeypatch):
    class FakeHost:
        def __init__(self):
            self.id = 7
            self.hostname = "ubuntu-dc-01"
            self.ip = "10.30.40.50"
            self.site = ""
            self.os = "Ubuntu"
            self.os_version = "24.04"
            self.kernel = "6.8.0"
            self.arch = "x86_64"
            self.agent_version = "2.0.0"
            self.agent_id = "agent-7"
            self.agent_token = "token-7"
            self.is_online = False
            self.last_heartbeat = None

    class FakeRequest:
        client = type("Client", (), {"host": "10.30.40.50"})()

        async def json(self):
            return {
                "agent_id": "agent-7",
                "agent_token": "token-7",
                "hostname": "ubuntu-dc-01",
                "os": "Ubuntu",
                "os_version": "24.04",
                "kernel": "6.8.0",
                "arch": "x86_64",
                "ip": "10.30.40.50",
                "site": "Singapore-DC",
                "hardware_inventory": {"cpu_model": "AMD EPYC", "cpu_cores": 32, "memory_mb": 65536, "disk_total_gb": 1024},
                "agent_version": "2.0.1",
            }

    class FakeDB:
        async def flush(self):
            return None

        async def commit(self):
            return None

    async def fake_schema(_db):
        return None

    host = FakeHost()

    async def fake_find_by_agent_id(_db, _agent_id):
        return host

    async def fake_find_legacy(_db, _hostname, _ip, incoming_agent_id=None):
        return None

    async def fake_group(_db, _host, _os_name):
        return None

    async def fake_sync(_db):
        return []

    monkeypatch.setattr(register_v2, "_ensure_host_schema", fake_schema)
    monkeypatch.setattr(register_v2, "_find_host_by_agent_id", fake_find_by_agent_id)
    monkeypatch.setattr(register_v2, "_find_legacy_host", fake_find_legacy)
    monkeypatch.setattr(register_v2, "_ensure_os_family_group", fake_group)
    monkeypatch.setattr(register_v2, "sync_prometheus_agent_targets", fake_sync)
    monkeypatch.setattr(register_v2, "_schedule_mirror_automation_for_host", lambda *_args, **_kwargs: None)

    resp = asyncio.run(register_v2.heartbeat(FakeRequest(), FakeDB()))

    assert resp == {"status": "ok"}
    assert host.site == "Singapore-DC"
    assert host.agent_version == "2.0.1"
    assert host.hardware_inventory["cpu_model"] == "AMD EPYC"


def test_host_out_includes_site():
    host = Host(hostname="rhel-hq-01", ip="10.1.1.15", site="Mumbai-HQ", os="Rocky Linux", hardware_inventory={"cpu_model": "Xeon Gold"})
    host.groups = []
    host.tags = []

    data = hosts_v2._host_to_out(host)
    assert data["site"] == "Mumbai-HQ"
    assert data["hardware_inventory"]["cpu_model"] == "Xeon Gold"


def test_bulk_action_sets_site(monkeypatch):
    host = Host(id=1, hostname="branch-01", ip="10.0.0.10", site="")
    host.groups = []
    host.tags = []

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
            return FakeResult([host])

        async def flush(self):
            return None

        async def commit(self):
            return None

    async def fake_sync(_db):
        return []

    monkeypatch.setattr(hosts_v2, "sync_prometheus_agent_targets", fake_sync)
    user = type("User", (), {"role": type("Role", (), {"value": "admin"})()})()
    body = hosts_v2.BulkActionRequest(host_ids=[1], action="set_site", value="London-Branch")

    resp = asyncio.run(hosts_v2.bulk_action(body, FakeDB(), user))

    assert resp["ok"] is True
    assert host.site == "London-Branch"


def test_patch_summary_csv_includes_site(monkeypatch, tmp_path):
    class FakeHost:
        hostname = "branch-01"
        ip = "10.0.0.10"
        site = "London-Branch"
        hardware_inventory = {"cpu_model": "Intel Core i5", "memory_mb": 8192, "disk_total_gb": 256}
        os = "Windows"
        compliance_score = 93
        reboot_required = False
        last_patched = None
        is_online = True
        groups = []

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
            return FakeResult([FakeHost()])

    class FakeRequest:
        cookies = {}

    async def fake_validate(_db, _token):
        return None

    monkeypatch.setattr(reports, "_validate_token", fake_validate)
    monkeypatch.setattr(reports, "get_license_info", lambda: {"features": ["reports"]})

    response = asyncio.run(reports.patch_summary_csv("Bearer test", FakeRequest(), FakeDB()))
    csv_path = Path(response.path)
    content = csv_path.read_text(encoding="utf-8")
    assert "site" in content.splitlines()[0]
    assert "cpu_model" in content.splitlines()[0]
    assert "London-Branch" in content
    assert "Intel Core i5" in content
