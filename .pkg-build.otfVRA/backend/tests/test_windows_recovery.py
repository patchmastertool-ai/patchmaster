import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace


_AGENT_PATH = Path(__file__).resolve().parents[2] / "agent" / "agent.py"
_SPEC = importlib.util.spec_from_file_location("patchmaster_agent_module", _AGENT_PATH)
agent = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(agent)


def test_parse_wbadmin_versions_extracts_identifiers():
    output = """
    Backup time: 04/03/2026 07:15
    Version identifier: 04/03/2026-07:15
    Backup time: 04/02/2026 06:00
    Version identifier: 04/02/2026-06:00
    """
    assert agent._parse_wbadmin_versions(output) == ["04/03/2026-07:15", "04/02/2026-06:00"]


def test_backup_full_system_windows_writes_manifest(monkeypatch, tmp_path):
    calls = []
    version_sets = [
        ["04/02/2026-06:00"],
        ["04/03/2026-07:15", "04/02/2026-06:00"],
    ]

    def fake_run_cmd(command, timeout=0, cwd=None):
        calls.append(command)
        return 0, "Backup completed"

    monkeypatch.setattr(agent, "IS_WINDOWS", True)
    monkeypatch.setattr(agent, "_resolve_windows_backup_target", lambda: "E:")
    monkeypatch.setattr(agent, "_detect_wbadmin_versions", lambda target: version_sets.pop(0))
    monkeypatch.setattr(agent, "run_cmd", fake_run_cmd)

    output_file = tmp_path / "backup_full_system.json"
    result_path = agent.backup_full_system(str(output_file))
    manifest = json.loads(output_file.read_text())

    assert result_path == str(output_file)
    assert any(command[:3] == ["wbadmin", "start", "backup"] for command in calls)
    assert manifest["backup_target"] == "E:"
    assert manifest["version_identifier"] == "04/03/2026-07:15"


def test_restore_windows_backup_manifest_uses_manifest_target_and_version(monkeypatch, tmp_path):
    calls = []

    def fake_run_cmd(command, timeout=0, cwd=None):
        calls.append(command)
        return 0, "Restore scheduled"

    manifest_path = tmp_path / "full_system_windows.json"
    manifest_path.write_text(
        json.dumps(
            {
                "kind": "windows_wbadmin_backup",
                "backup_target": "F:",
                "version_identifier": "04/03/2026-07:15",
            }
        )
    )

    monkeypatch.setattr(agent, "run_cmd", fake_run_cmd)

    result = agent._restore_windows_backup_manifest(str(manifest_path))

    assert result["success"] is True
    assert calls[0][:3] == ["wbadmin", "start", "sysrecovery"]
    assert "-backuptarget:F:" in calls[0]
    assert "-version:04/03/2026-07:15" in calls[0]


def test_rollback_snapshot_reconciles_windows_packages(monkeypatch, tmp_path):
    snapshot_dir = tmp_path / "snap-one"
    snapshot_dir.mkdir()
    (snapshot_dir / "meta.json").write_text(json.dumps({"mode": "packages"}))
    (snapshot_dir / "packages.json").write_text(
        json.dumps([{"id": "Git.Git", "name": "Git", "version": "2.45.1"}])
    )

    installs = []
    monkeypatch.setattr(agent, "IS_WINDOWS", True)
    monkeypatch.setattr(agent, "SNAPSHOT_DIR", str(tmp_path))
    monkeypatch.setattr(agent, "pkg_mgr", SimpleNamespace(refresh=lambda: (0, ""), list_installed=lambda: []))
    monkeypatch.setattr(agent, "_windows_install_snapshot_package", lambda pkg: installs.append(pkg) or (0, "ok"))
    monkeypatch.setattr(agent, "_windows_remove_snapshot_package", lambda pkg: (0, "ok"))
    monkeypatch.setattr(agent, "record_job", lambda payload: None)

    result = agent._rollback_snapshot("snap-one")

    assert result["success"] is True
    assert installs and installs[0]["id"] == "Git.Git"
