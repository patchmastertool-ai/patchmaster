from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

import api.notifications as notifications


class _FakeResult:
    def __init__(self, notes):
        self._notes = notes

    def scalars(self):
        return self

    def all(self):
        return list(self._notes)


class _FakeSession:
    def __init__(self, notes):
        self._notes = notes

    async def execute(self, _stmt):
        return _FakeResult(self._notes)


class _FakeSessionFactory:
    def __init__(self, notes):
        self._notes = notes

    def __call__(self):
        notes = self._notes

        class _Ctx:
            async def __aenter__(self_inner):
                return _FakeSession(notes)

            async def __aexit__(self_inner, exc_type, exc, tb):
                return False

        return _Ctx()


class _FakeHub:
    def __init__(self, active_user_ids):
        self._active_user_ids = list(active_user_ids)
        self.sent = []

    async def active_user_ids(self):
        return list(self._active_user_ids)

    async def send_snapshot(self, user_id, payload):
        self.sent.append((user_id, payload))


@pytest.mark.anyio
async def test_notification_snapshot_payload_counts_unread():
    note = SimpleNamespace(
        id=1,
        type="job_failed",
        title="Job failed",
        message="A rollout failed",
        link="/jobs/1",
        is_read=False,
        created_at=datetime.now(timezone.utc),
    )
    db = _FakeSession([note])

    payload = await notifications._notification_snapshot_payload(db, 7)

    assert payload["type"] == "snapshot"
    assert payload["unread_count"] == 1
    assert payload["items"][0]["title"] == "Job failed"


@pytest.mark.anyio
async def test_broadcast_notification_updates_pushes_per_user_snapshot(monkeypatch):
    note = SimpleNamespace(
        id=3,
        type="job_success",
        title="Job completed",
        message="Rollout finished",
        link="/jobs/3",
        is_read=True,
        created_at=datetime.now(timezone.utc),
    )
    fake_hub = _FakeHub([11])

    monkeypatch.setattr(notifications, "async_session", _FakeSessionFactory([note]))
    monkeypatch.setattr(notifications, "notification_hub", fake_hub)

    await notifications._broadcast_notification_updates()

    assert len(fake_hub.sent) == 1
    user_id, payload = fake_hub.sent[0]
    assert user_id == 11
    assert payload["type"] == "snapshot"
    assert payload["items"][0]["title"] == "Job completed"
