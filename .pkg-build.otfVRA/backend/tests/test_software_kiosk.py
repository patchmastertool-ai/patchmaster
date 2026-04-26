from types import SimpleNamespace

import api.software_kiosk as software_kiosk


def test_normalize_actions_dedupes_and_defaults():
    assert software_kiosk._normalize_actions(["install", "remove", "install", "bogus"]) == ["install", "remove"]
    assert software_kiosk._normalize_actions([]) == ["install"]


def test_normalize_execution_mode_defaults_to_immediate():
    assert software_kiosk._normalize_execution_mode("shutdown") == "shutdown"
    assert software_kiosk._normalize_execution_mode("invalid") == "immediate"


def test_request_public_serializes_related_objects():
    req = SimpleNamespace(
        id=7,
        status="submitted",
        status_message="Awaiting approval",
        requested_action="install",
        execution_mode="shutdown",
        note="Need browser",
        created_at=None,
        updated_at=None,
        fulfilled_at=None,
        catalog_item=SimpleNamespace(
            id=2,
            name="Google Chrome",
            package_name="google.chrome",
            description="Browser",
            supported_platforms=["windows"],
            allowed_actions=["install"],
            default_execution_mode="shutdown",
            is_enabled=True,
            created_at=None,
            updated_at=None,
        ),
        host=SimpleNamespace(id=12, hostname="branch-win-01", ip="10.0.0.25", os="Windows 11", site="London"),
        requested_by=SimpleNamespace(id=3, username="alice", role=SimpleNamespace(value="viewer")),
        approved_by=None,
    )

    data = software_kiosk._request_public(req)
    assert data["catalog_item"]["package_name"] == "google.chrome"
    assert data["host"]["hostname"] == "branch-win-01"
    assert data["requested_by"]["username"] == "alice"
    assert data["execution_mode"] == "shutdown"
