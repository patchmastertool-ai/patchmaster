from pathlib import Path
from types import SimpleNamespace

import api.provisioning as provisioning


def test_normalize_labels_dedupes_and_trims():
    assert provisioning._normalize_labels([" golden ", "branch", "golden", "", "branch"]) == ["golden", "branch"]


def test_deduce_os_family_handles_windows_and_linux():
    assert provisioning._deduce_os_family("Windows 11") == "windows"
    assert provisioning._deduce_os_family("Ubuntu 24.04") == "linux"
    assert provisioning._deduce_os_family("") == "unknown"


def test_write_archive_file_and_template_public(monkeypatch, tmp_path):
    monkeypatch.setenv("PM_PROVISIONING_IMAGE_DIR", str(tmp_path))
    file_name, size, checksum = provisioning._write_archive_file(b"golden-image", "Branch Windows Golden")
    path = tmp_path / file_name
    assert path.is_file()
    assert size == len(b"golden-image")
    assert checksum

    template = SimpleNamespace(
        id=4,
        name="Branch Windows Golden",
        description="Branch baseline",
        source_snapshot_name="branch-win-apr",
        snapshot_mode="full_system",
        os_family="windows",
        platform_label="Windows 11 24H2",
        site_scope="London-Branch",
        hardware_profile={"cpu_model": "Intel"},
        labels=["golden", "branch"],
        archive_file_name=file_name,
        archive_checksum=checksum,
        archive_size_bytes=size,
        is_enabled=True,
        created_by="alice",
        last_verified_at=None,
        created_at=None,
        updated_at=None,
        source_host=SimpleNamespace(id=9, hostname="source-win-01", ip="10.0.0.50", os="Windows 11", site="London-Branch"),
    )

    data = provisioning._template_public(template)
    assert data["archive_present"] is True
    assert data["archive_size_bytes"] == size
    assert data["source_host"]["hostname"] == "source-win-01"


def test_run_public_includes_summary_and_template():
    run = SimpleNamespace(
        id=12,
        mode="reimage",
        status="partial_success",
        allow_cross_site=False,
        target_host_ids=[2, 3],
        result_summary={"total_targets": 2, "success_count": 1, "failed_count": 1},
        queue_job_id="job-123",
        initiated_by="operator",
        started_at=None,
        completed_at=None,
        created_at=None,
        updated_at=None,
        template=SimpleNamespace(id=3, name="Ubuntu Branch Golden", os_family="linux", site_scope="Singapore-DC"),
    )

    data = provisioning._run_public(run)
    assert data["status"] == "partial_success"
    assert data["template"]["name"] == "Ubuntu Branch Golden"
    assert data["result_summary"]["failed_count"] == 1
