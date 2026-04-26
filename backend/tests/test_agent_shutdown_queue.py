import json
from pathlib import Path

import agent.agent as agent_module


def test_normalize_job_result_handles_process_tuple():
    result = agent_module._normalize_job_result((0, "ok"))
    assert result["success"] is True
    assert result["rc"] == 0
    assert result["output"] == "ok"


def test_shutdown_queue_keeps_failed_items(monkeypatch, tmp_path):
    queue_file = tmp_path / "shutdown-queue.json"
    monkeypatch.setattr(agent_module, "SHUTDOWN_QUEUE_FILE", str(queue_file))

    class FakePkgMgr:
        def install(self, packages):
            if "bad-package" in packages:
                return 1, "failed"
            return 0, "installed"

        def remove(self, packages):
            return 0, "removed"

    monkeypatch.setattr(agent_module, "pkg_mgr", FakePkgMgr())

    agent_module._enqueue_shutdown_packages("install", ["good-package"], requested_by="qa", reason="good")
    agent_module._enqueue_shutdown_packages("install", ["bad-package"], requested_by="qa", reason="bad")

    result = agent_module._execute_shutdown_queue()
    assert result["success"] is False
    assert len(result["executed"]) == 2
    assert len(result["failed"]) == 1
    persisted = json.loads(Path(queue_file).read_text(encoding="utf-8"))
    assert len(persisted) == 1
    assert persisted[0]["packages"] == ["bad-package"]
