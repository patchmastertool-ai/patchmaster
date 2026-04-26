import asyncio

import bootstrap_users
from models.db_models import UserRole


class FakeSession:
    def __init__(self, user_count=0):
        self.user_count = user_count
        self.added = []
        self.committed = False

    async def scalar(self, _query):
        return self.user_count

    def add(self, user):
        self.added.append(user)

    async def commit(self):
        self.committed = True


class FakeSessionFactory:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_bootstrap_users_creates_admin_and_smoke(monkeypatch):
    session = FakeSession(user_count=0)
    monkeypatch.setattr(bootstrap_users, "async_session", lambda: FakeSessionFactory(session))
    monkeypatch.setenv("PM_ADMIN_USER", "admin")
    monkeypatch.setenv("PM_ADMIN_PASSWORD", "PmA!7abcd123")
    monkeypatch.setenv("PM_SMOKE_USER", "qa-smoke")
    monkeypatch.setenv("PM_SMOKE_PASSWORD", "PmS!7abcd123")

    result = asyncio.run(bootstrap_users.ensure_bootstrap_users())

    assert result["created"] == ["admin", "qa-smoke"]
    assert session.committed is True
    assert [user.username for user in session.added] == ["admin", "qa-smoke"]
    assert session.added[0].role == UserRole.admin
    assert session.added[1].role == UserRole.operator


def test_bootstrap_users_skips_when_users_exist(monkeypatch):
    session = FakeSession(user_count=2)
    monkeypatch.setattr(bootstrap_users, "async_session", lambda: FakeSessionFactory(session))
    monkeypatch.setenv("PM_ADMIN_USER", "admin")
    monkeypatch.setenv("PM_ADMIN_PASSWORD", "PmA!7abcd123")

    result = asyncio.run(bootstrap_users.ensure_bootstrap_users())

    assert result["reason"] == "users_exist"
    assert session.added == []
    assert session.committed is False


def test_bootstrap_users_requires_admin_credentials(monkeypatch):
    session = FakeSession(user_count=0)
    monkeypatch.setattr(bootstrap_users, "async_session", lambda: FakeSessionFactory(session))
    monkeypatch.delenv("PM_ADMIN_USER", raising=False)
    monkeypatch.delenv("PM_ADMIN_PASSWORD", raising=False)

    result = asyncio.run(bootstrap_users.ensure_bootstrap_users())

    assert result["reason"] == "missing_admin_credentials"
    assert session.added == []
