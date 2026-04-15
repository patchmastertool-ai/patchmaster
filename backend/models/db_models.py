"""SQLAlchemy ORM models â€” enterprise patch management."""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Enum,
    Table,
    JSON,
    UniqueConstraint,
    Index,
    func,
    text,
)
from sqlalchemy.orm import relationship
from database import Base


def _utcnow() -> datetime:
    """Timezone-naive UTC datetime for SQLAlchemy column defaults."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# â”€â”€ Enums â”€â”€


class UserRole(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"
    auditor = "auditor"


class JobStatus(str, enum.Enum):
    pending = "pending"
    scheduled = "scheduled"
    running = "running"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"
    rolled_back = "rolled_back"
    aborted = "aborted"


class PatchAction(str, enum.Enum):
    upgrade = "upgrade"
    install = "install"
    rollback = "rollback"
    snapshot = "snapshot"
    offline_install = "offline_install"
    server_patch = "server_patch"


class Severity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    negligible = "negligible"


# -- Association tables --

host_group_assoc = Table(
    "host_group_assoc",
    Base.metadata,
    Column("host_id", Integer, ForeignKey("hosts.id", ondelete="CASCADE")),
    Column("group_id", Integer, ForeignKey("host_groups.id", ondelete="CASCADE")),
)

host_tag_assoc = Table(
    "host_tag_assoc",
    Base.metadata,
    Column("host_id", Integer, ForeignKey("hosts.id", ondelete="CASCADE")),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE")),
)


# -- Users --


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), default="")
    role = Column(Enum(UserRole), default=UserRole.viewer, nullable=False)
    is_active = Column(Boolean, default=True)
    custom_permissions = Column(JSON, nullable=True)  # per-user feature overrides
    # Brute-force lockout tracking
    login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("UserNotification", back_populates="user")
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    """Server-side refresh token store for JWT rotation and revocation."""

    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash = Column(
        String(64), unique=True, nullable=False, index=True
    )  # SHA-256 hex
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(45), default="")  # IPv4 or IPv6
    user_agent = Column(String(512), default="")
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class PatchHistoryPreset(Base):
    __tablename__ = "patch_history_presets"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, index=True)
    scope_type = Column(
        String(20), default="user", nullable=False, index=True
    )  # user | role | global
    role = Column(String(20), nullable=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    filters = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


# -- Notifications --


class UserNotification(Base):
    __tablename__ = "user_notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )  # Null = System wide
    type = Column(String(50), nullable=False)  # update, job, alert
    title = Column(String(200), nullable=False)
    message = Column(Text, default="")
    link = Column(String(255), nullable=True)  # Frontend route or API link
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="notifications")


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    channel_type = Column(String(50), nullable=False)  # email, slack, webhook, telegram
    config = Column(JSON, default=dict)
    events = Column(JSON, default=list)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)


class AlertActionType(str, enum.Enum):
    acknowledge = "acknowledge"
    snooze = "snooze"
    unsnooze = "unsnooze"
    ticket_create = "ticket_create"
    notify = "notify"


class AlertTicketStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class AlertAction(Base):
    __tablename__ = "alert_actions"
    id = Column(Integer, primary_key=True)
    alert_key = Column(String(255), nullable=False, index=True)
    alert_name = Column(String(120), nullable=False, index=True)
    instance = Column(String(255), default="", index=True)
    severity = Column(String(20), default="warning")
    action_type = Column(Enum(AlertActionType), nullable=False)
    note = Column(Text, default="")
    snooze_until = Column(DateTime, nullable=True, index=True)
    ticket_id = Column(
        Integer,
        ForeignKey("alert_tickets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow, index=True)

    ticket = relationship("AlertTicket", back_populates="actions")


class AlertTicket(Base):
    __tablename__ = "alert_tickets"
    id = Column(Integer, primary_key=True)
    alert_key = Column(String(255), nullable=False, index=True)
    alert_name = Column(String(120), nullable=False, index=True)
    instance = Column(String(255), default="", index=True)
    severity = Column(String(20), default="warning")
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(Enum(AlertTicketStatus), default=AlertTicketStatus.open, index=True)
    external_ref = Column(String(120), default="")
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    actions = relationship("AlertAction", back_populates="ticket")


class Host(Base):
    __tablename__ = "hosts"
    id = Column(Integer, primary_key=True)
    hostname = Column(String(255), unique=True, nullable=False, index=True)
    ip = Column(String(45), nullable=False)
    site = Column(String(120), default="", index=True)
    hardware_inventory = Column(JSON, default=dict)
    agent_id = Column(String(100), default="", index=True)
    os = Column(String(100), default="")
    os_version = Column(String(50), default="")
    kernel = Column(String(100), default="")
    arch = Column(String(20), default="")
    agent_version = Column(String(20), default="")
    agent_token = Column(String(100), default="")
    is_online = Column(Boolean, default=False)
    last_heartbeat = Column(DateTime, nullable=True)
    last_patched = Column(DateTime, nullable=True)
    reboot_required = Column(Boolean, default=False)
    installed_count = Column(Integer, default=0)
    upgradable_count = Column(Integer, default=0)
    cve_count = Column(Integer, default=0)
    compliance_score = Column(Float, default=100.0)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    groups = relationship(
        "HostGroup", secondary=host_group_assoc, back_populates="hosts"
    )
    tags = relationship("Tag", secondary=host_tag_assoc, back_populates="hosts")
    patch_jobs = relationship("PatchJob", back_populates="host")
    snapshots_db = relationship("Snapshot", back_populates="host")
    host_cves = relationship("HostCVE", back_populates="host")

    __table_args__ = (
        Index("ix_hosts_ip", "ip"),
        Index("ix_hosts_is_online", "is_online"),
        Index("ix_hosts_last_heartbeat", "last_heartbeat"),
        # Partial unique index: agent_id must be unique among rows where it is non-empty.
        Index(
            "uq_hosts_agent_id_nonempty",
            "agent_id",
            unique=True,
            postgresql_where=text("agent_id IS NOT NULL AND agent_id != ''"),
        ),
        # Unique constraint on IP+hostname to prevent duplicate hosts
        UniqueConstraint("ip", "hostname", name="uq_hosts_ip_hostname"),
    )


# â”€â”€ Host Groups â”€â”€


class HostGroup(Base):
    __tablename__ = "host_groups"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    hosts = relationship("Host", secondary=host_group_assoc, back_populates="groups")
    schedules = relationship("PatchSchedule", back_populates="group")


# â”€â”€ Tags â”€â”€


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)

    hosts = relationship("Host", secondary=host_tag_assoc, back_populates="tags")


# â”€â”€ Patch Jobs â”€â”€


class PatchJob(Base):
    __tablename__ = "patch_jobs"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False
    )
    action = Column(Enum(PatchAction), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.pending)
    packages = Column(JSON, default=list)
    hold_packages = Column(JSON, default=list)
    dry_run = Column(Boolean, default=False)
    auto_snapshot = Column(Boolean, default=True)
    auto_rollback = Column(Boolean, default=True)
    result = Column(JSON, nullable=True)
    output = Column(Text, default="")
    initiated_by = Column(String(100), default="system")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    host = relationship("Host", back_populates="patch_jobs")

    __table_args__ = (Index("idx_jobs_created_status", "created_at", "status"),)


# â”€â”€ Snapshots â”€â”€


class Snapshot(Base):
    __tablename__ = "snapshots"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(200), nullable=False)
    packages_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)

    host = relationship("Host", back_populates="snapshots_db")

    __table_args__ = (UniqueConstraint("host_id", "name", name="uq_host_snapshot"),)


# â”€â”€ Patch Schedules â”€â”€


class PatchSchedule(Base):
    __tablename__ = "patch_schedules"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    group_id = Column(
        Integer, ForeignKey("host_groups.id", ondelete="SET NULL"), nullable=True
    )
    cron_expression = Column(String(100), nullable=False)  # e.g. "0 2 * * SAT"
    auto_snapshot = Column(Boolean, default=True)
    auto_rollback = Column(Boolean, default=True)
    auto_reboot = Column(Boolean, default=False)
    packages = Column(JSON, default=list)
    hold_packages = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    group = relationship("HostGroup", back_populates="schedules")


class RunbookProfile(Base):
    __tablename__ = "runbook_profiles"
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    channel = Column(String(20), default="linux")
    config = Column(JSON, default=dict)
    require_approval = Column(Boolean, default=False)
    approval_role = Column(String(30), default="operator")
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100), default="")
    updated_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class RunbookSchedule(Base):
    __tablename__ = "runbook_schedules"
    id = Column(Integer, primary_key=True)
    profile_id = Column(
        Integer,
        ForeignKey("runbook_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(150), nullable=False)
    cron_expression = Column(String(100), nullable=False, default="0 2 * * *")
    timezone = Column(String(50), default="UTC")
    is_active = Column(Boolean, default=True)
    approved_by = Column(String(100), default="")
    approved_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    profile = relationship("RunbookProfile", backref="schedules")


class RunbookExecution(Base):
    __tablename__ = "runbook_executions"
    id = Column(Integer, primary_key=True)
    profile_id = Column(
        Integer,
        ForeignKey("runbook_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    schedule_id = Column(
        Integer,
        ForeignKey("runbook_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    trigger_type = Column(String(30), default="manual")
    status = Column(String(30), default="pending", index=True)
    started_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)
    initiated_by = Column(String(100), default="")
    summary = Column(JSON, default=dict)
    logs = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    profile = relationship("RunbookProfile", backref="executions")
    schedule = relationship("RunbookSchedule", backref="executions")


# â”€â”€ CVEs â”€â”€


class CVE(Base):
    __tablename__ = "cves"
    id = Column(String(50), primary_key=True)
    description = Column(Text, default="")
    severity = Column(Enum(Severity), default=Severity.medium)
    cvss_score = Column(Float, default=0.0)
    published_date = Column(DateTime, nullable=True)
    cwe_id = Column(String(50), default="")
    references = Column(Text, default="")
    affected_products = Column(Text, default="")
    source = Column(String(50), default="manual")

    host_cves = relationship("HostCVE", back_populates="cve")


class HostCVE(Base):
    __tablename__ = "host_cves"
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), primary_key=True
    )
    cve_id = Column(
        String(50), ForeignKey("cves.id", ondelete="CASCADE"), primary_key=True
    )
    package_name = Column(String(100), nullable=True, default="")
    current_version = Column(String(50), nullable=True, default="")
    fixed_version = Column(String(50), nullable=True)
    status = Column(String(20), default="active")  # active, patched, ignored
    detected_at = Column(DateTime, default=_utcnow)

    host = relationship("Host", back_populates="host_cves")
    cve = relationship("CVE", back_populates="host_cves")


# â”€â”€ Audit Logs â”€â”€


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True)  # host, job, settings
    target_id = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="audit_logs")


# â”€â”€ Backups â”€â”€


class BackupType(str, enum.Enum):
    database = "database"
    file = "file"
    vm = "vm"
    live = "live"
    full_system = "full_system"


class BackupConfig(Base):
    __tablename__ = "backup_configs"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(100), nullable=False)
    backup_type = Column(Enum(BackupType), nullable=False)

    source_path = Column(String(255), nullable=True)
    db_type = Column(String(50), nullable=True)
    schedule = Column(String(50), nullable=True)
    retention_count = Column(Integer, default=5)
    compression_level = Column(Integer, default=6)
    encryption_key = Column(String(255), nullable=True)  # If set, backup is encrypted
    storage_path = Column(String(255), nullable=True)  # Remote path (s3://, scp://)
    storage_type = Column(String(50), default="local")  # local, s3, sftp, nfs, minio
    storage_config = Column(JSON, default=dict)  # provider-specific settings
    last_test_status = Column(String(50), default="")
    last_test_at = Column(DateTime, nullable=True)
    last_run_status = Column(String(50), default="")
    last_run_size = Column(Integer, default=0)
    last_run_duration = Column(Float, default=0.0)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)

    host = relationship("Host", backref="backup_configs")


class BackupLog(Base):
    __tablename__ = "backup_logs"
    id = Column(Integer, primary_key=True)
    config_id = Column(
        Integer, ForeignKey("backup_configs.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(Enum(JobStatus), default=JobStatus.pending)
    output = Column(Text, nullable=True)
    file_size_bytes = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    started_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    config = relationship("BackupConfig", backref="logs")

    __table_args__ = (
        Index("ix_backup_logs_config_id", "config_id"),
        Index("ix_backup_logs_started_at", "started_at"),
    )


class RestoreDrillRun(Base):
    __tablename__ = "restore_drill_runs"
    id = Column(Integer, primary_key=True)
    config_id = Column(
        Integer,
        ForeignKey("backup_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    backup_log_id = Column(
        Integer,
        ForeignKey("backup_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(Enum(JobStatus), default=JobStatus.pending, index=True)
    requested_by = Column(String(100), default="")
    target_path = Column(String(255), default="")
    target_rto_minutes = Column(Float, nullable=True)
    target_rpo_minutes = Column(Float, nullable=True)
    actual_rto_seconds = Column(Float, nullable=True)
    actual_rpo_minutes = Column(Float, nullable=True)
    within_sla = Column(Boolean, nullable=True, index=True)
    summary = Column(JSON, default=dict)
    queue_job_id = Column(String(64), default="", index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    config = relationship("BackupConfig", backref="restore_drills")
    host = relationship("Host", backref="restore_drills")
    backup_log = relationship("BackupLog")

    __table_args__ = (
        Index("ix_restore_drill_config_created", "config_id", "created_at"),
        Index("ix_restore_drill_status_created", "status", "created_at"),
    )


# â”€â”€ Policies (DevOps) â”€â”€


class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    yaml_content = Column(Text, nullable=False)  # The actual YAML
    active_revision_id = Column(Integer, nullable=True, index=True)
    latest_revision_number = Column(Integer, default=0)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    revisions = relationship(
        "PolicyRevision", back_populates="policy", cascade="all, delete-orphan"
    )
    executions = relationship(
        "PolicyExecution", back_populates="policy", cascade="all, delete-orphan"
    )


class PolicyRevision(Base):
    __tablename__ = "policy_revisions"
    id = Column(Integer, primary_key=True)
    policy_id = Column(
        Integer,
        ForeignKey("policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False, default="")
    description = Column(Text, default="")
    yaml_content = Column(Text, nullable=False)
    status = Column(
        String(24), default="draft", index=True
    )  # draft | active | archived
    change_summary = Column(Text, default="")
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow, index=True)

    policy = relationship("Policy", back_populates="revisions")
    executions = relationship("PolicyExecution", back_populates="revision")

    __table_args__ = (
        UniqueConstraint(
            "policy_id", "revision_number", name="uq_policy_revision_number"
        ),
    )


class PolicyExecution(Base):
    __tablename__ = "policy_executions"
    id = Column(Integer, primary_key=True)
    policy_id = Column(
        Integer,
        ForeignKey("policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_id = Column(
        Integer,
        ForeignKey("policy_revisions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    execution_mode = Column(
        String(24), default="apply", index=True
    )  # dry_run | apply | rollback
    status = Column(String(24), default="pending", index=True)
    requested_by = Column(String(100), default="")
    host_ids = Column(JSON, default=list)
    host_results = Column(JSON, default=list)
    guardrails = Column(JSON, default=dict)
    summary = Column(JSON, default=dict)
    queue_job_id = Column(String(64), default="", index=True)
    requested_at = Column(DateTime, default=_utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    policy = relationship("Policy", back_populates="executions")
    revision = relationship("PolicyRevision", back_populates="executions")


class AdminTaskTemplate(Base):
    __tablename__ = "admin_task_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(160), nullable=False, unique=True, index=True)
    task_key = Column(String(80), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    command_template = Column(Text, default="")
    default_timeout_seconds = Column(Integer, default=120)
    default_working_dir = Column(String(255), default="")
    allowed_roles = Column(JSON, default=list)
    is_enabled = Column(Boolean, default=True, index=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    executions = relationship("AdminTaskExecution", back_populates="template")


class AdminTaskExecution(Base):
    __tablename__ = "admin_task_executions"
    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("admin_task_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_key = Column(String(80), nullable=False, default="", index=True)
    execution_mode = Column(String(24), default="queued", index=True)
    status = Column(String(24), default="pending", index=True)
    requested_by = Column(String(100), default="")
    queue_job_id = Column(String(64), default="", index=True)
    parameters = Column(JSON, default=dict)
    result_summary = Column(JSON, default=dict)
    requested_at = Column(DateTime, default=_utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    template = relationship("AdminTaskTemplate", back_populates="executions")
    host = relationship("Host")


class RingRolloutStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    canceled = "canceled"


class RingRolloutPolicy(Base):
    __tablename__ = "ring_rollout_policies"
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    target_os_family = Column(String(30), default="linux", index=True)
    is_enabled = Column(Boolean, default=True, index=True)
    rings = Column(JSON, default=list)
    guardrails = Column(JSON, default=dict)
    rollout_config = Column(JSON, default=dict)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    runs = relationship(
        "RingRolloutRun", back_populates="policy", cascade="all, delete-orphan"
    )


class RingRolloutRun(Base):
    __tablename__ = "ring_rollout_runs"
    id = Column(Integer, primary_key=True)
    policy_id = Column(
        Integer,
        ForeignKey("ring_rollout_policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(RingRolloutStatus), default=RingRolloutStatus.pending, index=True
    )
    action = Column(Enum(PatchAction), default=PatchAction.upgrade)
    dry_run = Column(Boolean, default=False)
    requested_by = Column(String(100), default="")
    request_payload = Column(JSON, default=dict)
    summary = Column(JSON, default=dict)
    queue_job_id = Column(String(64), default="", index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    policy = relationship("RingRolloutPolicy", back_populates="runs")

    __table_args__ = (
        Index("ix_ring_rollout_runs_policy_created", "policy_id", "created_at"),
    )


class CICDPipeline(Base):
    __tablename__ = "cicd_pipelines"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, default="")
    tool = Column(String(50), nullable=False)
    server_url = Column(String(255), nullable=False, default="")
    auth_type = Column(String(50), default="token")
    auth_credentials = Column(JSON, default=dict)
    job_path = Column(String(255), default="")
    script_type = Column(String(50), default="groovy")
    script_content = Column(Text, default="")
    webhook_secret = Column(String(100), default="")
    trigger_events = Column(JSON, default=list)
    status = Column(String(20), default="active")
    last_triggered = Column(DateTime, nullable=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    builds = relationship(
        "CICDBuild", back_populates="pipeline", cascade="all, delete-orphan"
    )


class CICDBuild(Base):
    __tablename__ = "cicd_builds"
    id = Column(Integer, primary_key=True)
    pipeline_id = Column(
        Integer,
        ForeignKey("cicd_pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    build_number = Column(Integer, default=0)
    status = Column(String(20), default="pending")
    trigger_type = Column(String(50), default="manual")
    trigger_info = Column(JSON, default=dict)
    external_url = Column(String(500), default="")
    output = Column(Text, default="")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    pipeline = relationship("CICDPipeline", back_populates="builds")

    __table_args__ = (
        Index("ix_cicd_builds_pipeline_id_created_at", "pipeline_id", "created_at"),
    )


class CICDVariable(Base):
    __tablename__ = "cicd_variables"
    id = Column(Integer, primary_key=True)
    pipeline_id = Column(
        Integer,
        ForeignKey("cicd_pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key = Column(String(200), nullable=False)
    value = Column(Text, default="")
    is_secret = Column(Boolean, default=False)
    status = Column(String(30), default="active")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    pipeline = relationship("CICDPipeline", backref="variables")

    __table_args__ = (
        UniqueConstraint("pipeline_id", "key", name="uq_cicd_variables_pipeline_key"),
        Index("ix_cicd_variables_pipeline_id_key", "pipeline_id", "key"),
    )


class CICDEnvironment(Base):
    __tablename__ = "cicd_environments"
    id = Column(Integer, primary_key=True)
    pipeline_id = Column(
        Integer,
        ForeignKey("cicd_pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    webhook_url = Column(String(500), default="")
    requires_approval = Column(Boolean, default=False)
    approvers = Column(JSON, default=list)
    approval_quorum = Column(Integer, default=1)
    approval_sla_minutes = Column(Integer, default=60)
    escalation_after_minutes = Column(Integer, default=120)
    escalation_targets = Column(JSON, default=list)
    status = Column(String(30), default="active")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    pipeline = relationship("CICDPipeline", backref="environments")

    __table_args__ = (
        UniqueConstraint("pipeline_id", "name", name="uq_cicd_env_pipeline_name"),
        Index("ix_cicd_environments_pipeline_id_name", "pipeline_id", "name"),
    )


class CICDDeployment(Base):
    __tablename__ = "cicd_deployments"
    id = Column(Integer, primary_key=True)
    pipeline_id = Column(
        Integer,
        ForeignKey("cicd_pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    environment_id = Column(
        Integer,
        ForeignKey("cicd_environments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    build_id = Column(
        Integer,
        ForeignKey("cicd_builds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String(30), default="pending")
    triggered_by = Column(String(100), default="")
    notes = Column(Text, default="")
    external_url = Column(String(500), default="")
    storage_path = Column(String(500), default="")
    approved_by = Column(String(100), default="")
    approved_at = Column(DateTime, nullable=True)
    approval_due_at = Column(DateTime, nullable=True)
    escalated_at = Column(DateTime, nullable=True)
    escalation_status = Column(String(30), default="")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    pipeline = relationship("CICDPipeline", backref="deployments")
    environment = relationship("CICDEnvironment", backref="deployments")
    build = relationship("CICDBuild", backref="deployments")

    __table_args__ = (
        Index(
            "ix_cicd_deployments_pipeline_id_created_at", "pipeline_id", "created_at"
        ),
    )


class CICDDeploymentApproval(Base):
    __tablename__ = "cicd_deployment_approvals"
    id = Column(Integer, primary_key=True)
    deployment_id = Column(
        Integer,
        ForeignKey("cicd_deployments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approver = Column(String(100), nullable=False, index=True)
    decision = Column(String(20), nullable=False, index=True)
    note = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    deployment = relationship("CICDDeployment", backref="approvals")

    __table_args__ = (
        UniqueConstraint(
            "deployment_id",
            "approver",
            name="uq_cicd_deployment_approval_deployment_user",
        ),
        Index(
            "ix_cicd_deployment_approval_deployment_decision",
            "deployment_id",
            "decision",
        ),
    )


class CICDDeploymentApprovalEvent(Base):
    __tablename__ = "cicd_deployment_approval_events"
    id = Column(Integer, primary_key=True)
    deployment_id = Column(
        Integer,
        ForeignKey("cicd_deployments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(40), nullable=False, index=True)
    actor = Column(String(100), default="")
    note = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    deployment = relationship("CICDDeployment", backref="approval_events")

    __table_args__ = (
        Index(
            "ix_cicd_deployment_approval_events_deployment_created",
            "deployment_id",
            "created_at",
        ),
    )


class CICDNotificationDeliveryReceipt(Base):
    __tablename__ = "cicd_notification_delivery_receipts"
    id = Column(Integer, primary_key=True)
    deployment_id = Column(
        Integer,
        ForeignKey("cicd_deployments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(40), nullable=False, index=True)
    channel_type = Column(String(40), nullable=False, index=True)
    target = Column(String(255), nullable=False, index=True)
    status = Column(String(30), default="pending", index=True)
    attempt_count = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    last_error = Column(Text, default="")
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    deployment = relationship("CICDDeployment", backref="delivery_receipts")

    __table_args__ = (
        Index(
            "ix_cicd_delivery_receipt_deployment_event", "deployment_id", "event_type"
        ),
        Index("ix_cicd_delivery_receipt_status_next_retry", "status", "next_retry_at"),
        UniqueConstraint(
            "deployment_id",
            "event_type",
            "channel_type",
            "target",
            name="uq_cicd_delivery_receipt_key",
        ),
    )


class CICDBuildStageRun(Base):
    __tablename__ = "cicd_build_stage_runs"
    id = Column(Integer, primary_key=True)
    build_id = Column(
        Integer,
        ForeignKey("cicd_builds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage_name = Column(String(120), nullable=False, index=True)
    order_index = Column(Integer, default=0)
    status = Column(String(30), default="pending", index=True)
    duration_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    output = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    build = relationship("CICDBuild", backref="stage_runs")

    __table_args__ = (
        Index("ix_cicd_stage_runs_build_order", "build_id", "order_index"),
        UniqueConstraint(
            "build_id", "stage_name", name="uq_cicd_stage_runs_build_stage"
        ),
    )


class CICDBuildLog(Base):
    __tablename__ = "cicd_build_logs"
    id = Column(Integer, primary_key=True)
    build_id = Column(
        Integer,
        ForeignKey("cicd_builds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line = Column(Text, default="")
    storage_path = Column(String(500), default="")
    status = Column(String(30), default="info")
    created_at = Column(DateTime, default=_utcnow)

    build = relationship("CICDBuild", backref="logs")

    __table_args__ = (
        Index("ix_cicd_build_logs_build_id_created_at", "build_id", "created_at"),
    )


class CICDBuildArtifact(Base):
    __tablename__ = "cicd_build_artifacts"
    id = Column(Integer, primary_key=True)
    build_id = Column(
        Integer,
        ForeignKey("cicd_builds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    url = Column(String(500), default="")
    size_bytes = Column(Integer, default=0)
    storage_path = Column(String(500), default="")
    status = Column(String(30), default="stored")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)

    build = relationship("CICDBuild", backref="artifacts")

    __table_args__ = (
        Index("ix_cicd_build_artifacts_build_id_created_at", "build_id", "created_at"),
    )


class GitRepository(Base):
    __tablename__ = "git_repositories"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    server_url = Column(String(255), nullable=False, default="")
    repo_full_name = Column(String(255), nullable=False)
    default_branch = Column(String(100), default="main")
    auth_token = Column(String(255), default="")
    webhook_secret = Column(String(100), default="")
    webhook_id = Column(String(100), default="")
    is_active = Column(Boolean, default=True)
    last_synced = Column(DateTime, nullable=True)
    repo_meta = Column(JSON, default=dict)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint(
            "provider", "repo_full_name", name="uq_git_repo_provider_fullname"
        ),
        Index("ix_git_repositories_provider", "provider"),
    )


# ── PatchRepo (Built-in Git Server) ──


class PatchRepo(Base):
    """Local Git repository managed by PatchRepo server."""

    __tablename__ = "patch_repos"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    repo_path = Column(
        String(500), nullable=False, unique=True
    )  # Absolute path on disk
    default_branch = Column(String(100), default="main")
    # Access control
    is_public = Column(Boolean, default=False)
    allow_push = Column(Boolean, default=True)
    allow_read = Column(Boolean, default=True)
    # Metadata
    size_bytes = Column(Integer, default=0)
    commit_count = Column(Integer, default=0)
    branch_count = Column(Integer, default=1)
    repo_meta = Column(JSON, default=dict)
    # Tracking
    last_activity = Column(DateTime, nullable=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    pull_requests = relationship(
        "PullRequest", back_populates="repo", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_patch_repos_created_at", "created_at"),)


class PullRequestState(str, enum.Enum):
    open = "open"
    merged = "merged"
    closed = "closed"


class PullRequestReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    changes_requested = "changes_requested"
    commented = "commented"


class PullRequest(Base):
    """Pull Request for PatchRepo repositories."""

    __tablename__ = "pull_requests"
    id = Column(Integer, primary_key=True)
    repo_id = Column(
        Integer,
        ForeignKey("patch_repos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    number = Column(Integer, nullable=False)  # PR number within repo
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    state = Column(Enum(PullRequestState), default=PullRequestState.open, index=True)
    source_branch = Column(String(255), nullable=False)
    target_branch = Column(String(255), nullable=False)
    # Author
    author = Column(String(100), nullable=False)
    # Review tracking
    review_status = Column(
        Enum(PullRequestReviewStatus), default=PullRequestReviewStatus.pending
    )
    reviewer = Column(String(100), nullable=True)
    review_note = Column(Text, default="")
    reviewed_at = Column(DateTime, nullable=True)
    # Merge info
    merged_at = Column(DateTime, nullable=True)
    merged_by = Column(String(100), nullable=True)
    merge_commit_sha = Column(String(40), nullable=True)
    # Tracking
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    repo = relationship("PatchRepo", back_populates="pull_requests")

    __table_args__ = (
        UniqueConstraint("repo_id", "number", name="uq_pull_request_repo_number"),
        Index("ix_pull_requests_repo_state", "repo_id", "state"),
        Index("ix_pull_requests_author", "author"),
    )


# ── Patch SLA ──


class PatchSLA(Base):
    __tablename__ = "patch_slas"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    severity = Column(Enum(Severity), nullable=False)
    days_to_patch = Column(Integer, nullable=False, default=7)  # SLA window in days
    notify_before_days = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)


class SLAViolation(Base):
    __tablename__ = "sla_violations"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False
    )
    cve_id = Column(
        String(50), ForeignKey("cves.id", ondelete="CASCADE"), nullable=False
    )
    sla_id = Column(
        Integer, ForeignKey("patch_slas.id", ondelete="SET NULL"), nullable=True
    )
    detected_at = Column(DateTime, default=_utcnow)
    deadline = Column(DateTime, nullable=False)
    patched_at = Column(DateTime, nullable=True)
    is_violated = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)

    host = relationship("Host", backref="sla_violations")
    cve = relationship("CVE", backref="sla_violations")


# â”€â”€ CVE Remediation Workflow â”€â”€


class RemediationStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    accepted_risk = "accepted_risk"
    false_positive = "false_positive"


class CVERemediation(Base):
    __tablename__ = "cve_remediations"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False
    )
    cve_id = Column(
        String(50), ForeignKey("cves.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(Enum(RemediationStatus), default=RemediationStatus.open)
    assigned_to = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes = Column(Text, default="")
    due_date = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    host = relationship("Host", backref="remediations")
    cve = relationship("CVE", backref="remediations")
    assignee = relationship(
        "User", backref="assigned_remediations", foreign_keys=[assigned_to]
    )

    __table_args__ = (
        UniqueConstraint("host_id", "cve_id", name="uq_remediation_host_cve"),
        Index("ix_remediations_status", "status"),
    )


# â”€â”€ Maintenance Windows â”€â”€


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    # cron-style: day_of_week (0=Mon..6=Sun), start_hour, end_hour, timezone
    day_of_week = Column(JSON, default=list)  # e.g. [5, 6] = Sat+Sun
    start_hour = Column(Integer, default=2)  # 2 AM
    end_hour = Column(Integer, default=6)  # 6 AM
    timezone = Column(String(50), default="UTC")
    applies_to_groups = Column(JSON, default=list)  # list of group IDs
    applies_to_hosts = Column(JSON, default=list)  # list of host IDs
    is_active = Column(Boolean, default=True)
    block_outside = Column(Boolean, default=True)  # block patches outside window
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)


# â”€â”€ Pre/Post Patch Hooks â”€â”€


class HookTrigger(str, enum.Enum):
    pre_patch = "pre_patch"
    post_patch = "post_patch"
    pre_snapshot = "pre_snapshot"
    post_snapshot = "post_snapshot"
    on_failure = "on_failure"
    on_success = "on_success"


class PatchHook(Base):
    __tablename__ = "patch_hooks"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    trigger = Column(Enum(HookTrigger), nullable=False)
    script_type = Column(String(20), default="bash")  # bash | powershell | python
    script_content = Column(Text, nullable=False)
    timeout_seconds = Column(Integer, default=120)
    applies_to_groups = Column(JSON, default=list)
    applies_to_hosts = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    stop_on_failure = Column(Boolean, default=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)


class HookExecution(Base):
    __tablename__ = "hook_executions"
    id = Column(Integer, primary_key=True)
    hook_id = Column(
        Integer, ForeignKey("patch_hooks.id", ondelete="CASCADE"), nullable=False
    )
    job_id = Column(
        Integer, ForeignKey("patch_jobs.id", ondelete="CASCADE"), nullable=True
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False
    )
    trigger = Column(Enum(HookTrigger), nullable=False)
    status = Column(
        String(20), default="pending"
    )  # pending | success | failed | skipped
    output = Column(Text, default="")
    exit_code = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    hook = relationship("PatchHook", backref="executions")


# â”€â”€ Bulk Patch Jobs â”€â”€


class BulkPatchJob(Base):
    __tablename__ = "bulk_patch_jobs"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    host_ids = Column(JSON, default=list)
    packages = Column(JSON, default=list)
    action = Column(Enum(PatchAction), default=PatchAction.server_patch)
    dry_run = Column(Boolean, default=False)
    auto_snapshot = Column(Boolean, default=True)
    auto_rollback = Column(Boolean, default=True)
    status = Column(
        String(20), default="pending"
    )  # pending | running | jobs_created | failed
    total_hosts = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    job_ids = Column(JSON, default=list)  # list of PatchJob IDs created
    initiated_by = Column(String(100), default="system")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    # BUG-014 FIX: Globally unique bulk job names
    # Changed from (name, created_at) to just (name) to prevent duplicates
    __table_args__ = (
        UniqueConstraint("name", name="uq_bulk_patch_job_name"),
        Index("ix_bulk_patch_jobs_status", "status"),
        Index("ix_bulk_patch_jobs_created_at", "created_at"),
    )


# â”€â”€ Agent Updates â”€â”€


class AgentUpdateChannel(str, enum.Enum):
    stable = "stable"
    beta = "beta"


class AgentUpdatePolicy(Base):
    __tablename__ = "agent_update_policies"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, default="Default")
    channel = Column(Enum(AgentUpdateChannel), default=AgentUpdateChannel.stable)
    auto_update = Column(Boolean, default=False)
    target_version = Column(String(20), nullable=True)  # None = latest
    applies_to_groups = Column(JSON, default=list)
    applies_to_hosts = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)


# â”€â”€ Mirror Repositories â”€â”€


class MirrorRepoProvider(str, enum.Enum):
    microsoft = "microsoft"
    ubuntu = "ubuntu"
    redhat = "redhat"
    custom = "custom"


class MirrorSyncStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class MirrorRepo(Base):
    __tablename__ = "mirror_repos"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, unique=True)
    provider = Column(
        Enum(MirrorRepoProvider), default=MirrorRepoProvider.custom, nullable=False
    )
    os_family = Column(String(20), default="linux")  # linux | windows
    channel = Column(String(100), default="default")
    source_url = Column(String(500), default="")
    enabled = Column(Boolean, default=True)
    metadata_only = Column(Boolean, default=True)
    sync_interval_minutes = Column(Integer, default=360)
    retention_days = Column(Integer, default=30)
    keep_versions = Column(Integer, default=2)
    mirror_path = Column(String(500), default="")
    auth_config = Column(JSON, default=dict)
    extra_config = Column(JSON, default=dict)
    last_sync_at = Column(DateTime, nullable=True)
    next_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(Enum(MirrorSyncStatus), default=MirrorSyncStatus.pending)
    last_sync_summary = Column(JSON, default=dict)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    sync_runs = relationship(
        "MirrorSyncRun", back_populates="repo", cascade="all, delete-orphan"
    )
    package_index = relationship(
        "MirrorPackageIndex", back_populates="repo", cascade="all, delete-orphan"
    )
    sync_lease = relationship(
        "MirrorSyncLease",
        back_populates="repo",
        cascade="all, delete-orphan",
        uselist=False,
        passive_deletes=True,
    )

    __table_args__ = (
        Index("ix_mirror_repos_enabled_next_sync", "enabled", "next_sync_at"),
    )


class MirrorSyncRun(Base):
    __tablename__ = "mirror_sync_runs"
    id = Column(Integer, primary_key=True)
    repo_id = Column(
        Integer,
        ForeignKey("mirror_repos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trigger_type = Column(String(30), default="manual")  # manual | scheduler
    status = Column(Enum(MirrorSyncStatus), default=MirrorSyncStatus.pending)
    summary = Column(JSON, default=dict)
    error = Column(Text, default="")
    started_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    repo = relationship("MirrorRepo", back_populates="sync_runs")

    __table_args__ = (
        Index("ix_mirror_sync_runs_repo_started", "repo_id", "started_at"),
    )


class MirrorSyncLease(Base):
    __tablename__ = "mirror_sync_leases"
    id = Column(Integer, primary_key=True)
    repo_id = Column(
        Integer,
        ForeignKey("mirror_repos.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    holder_id = Column(String(100), nullable=False, default="")
    holder_node = Column(String(255), nullable=False, default="")
    heartbeat_at = Column(DateTime, default=_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    repo = relationship("MirrorRepo", back_populates="sync_lease")


class MirrorPackageIndex(Base):
    __tablename__ = "mirror_package_index"
    id = Column(Integer, primary_key=True)
    repo_id = Column(
        Integer,
        ForeignKey("mirror_repos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    package_name = Column(String(255), nullable=False)
    package_version = Column(String(255), nullable=False)
    os_family = Column(String(20), default="linux")
    channel = Column(String(100), default="default")
    architecture = Column(String(50), default="")
    source_url = Column(String(1000), default="")
    file_name = Column(String(255), default="")
    checksum = Column(String(255), default="")
    package_meta = Column("metadata", JSON, default=dict)
    discovered_at = Column(DateTime, default=_utcnow)
    last_seen_at = Column(DateTime, default=_utcnow)

    repo = relationship("MirrorRepo", back_populates="package_index")

    __table_args__ = (
        UniqueConstraint(
            "repo_id",
            "package_name",
            "package_version",
            "architecture",
            name="uq_mirror_pkg_repo_name_ver_arch",
        ),
        Index("ix_mirror_pkg_repo_name", "repo_id", "package_name"),
        Index("ix_mirror_pkg_last_seen", "last_seen_at"),
    )


class PluginType(str, enum.Enum):
    webhook = "webhook"
    jira = "jira"
    servicenow = "servicenow"
    cmdb = "cmdb"


class PluginDeliveryStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class PluginIntegration(Base):
    __tablename__ = "plugin_integrations"
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False, unique=True, index=True)
    plugin_type = Column(
        Enum(PluginType), nullable=False, default=PluginType.webhook, index=True
    )
    is_enabled = Column(Boolean, default=True, index=True)
    config = Column(JSON, default=dict)
    secret = Column(String(255), default="")
    max_attempts = Column(Integer, default=3)
    retry_backoff_seconds = Column(JSON, default=lambda: [5, 20, 60])
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    delivery_logs = relationship(
        "PluginDeliveryLog", back_populates="plugin", cascade="all, delete-orphan"
    )


class PluginDeliveryLog(Base):
    __tablename__ = "plugin_delivery_logs"
    id = Column(Integer, primary_key=True)
    plugin_id = Column(
        Integer,
        ForeignKey("plugin_integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(120), nullable=False, index=True)
    status = Column(
        Enum(PluginDeliveryStatus), default=PluginDeliveryStatus.pending, index=True
    )
    request_payload = Column(JSON, default=dict)
    request_headers = Column(JSON, default=dict)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, default="")
    error = Column(Text, default="")
    attempt_count = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True, index=True)
    last_attempt_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    plugin = relationship("PluginIntegration", back_populates="delivery_logs")

    __table_args__ = (
        Index("ix_plugin_delivery_plugin_created", "plugin_id", "created_at"),
        Index("ix_plugin_delivery_status_retry", "status", "next_retry_at"),
    )


# â”€â”€ Host Timeline â”€â”€


class HostTimelineEvent(Base):
    __tablename__ = "host_timeline"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type = Column(
        String(50), nullable=False
    )  # patch | snapshot | cve | reboot | agent_update | login
    title = Column(String(200), nullable=False)
    detail = Column(JSON, nullable=True)
    severity = Column(String(20), default="info")  # info | warning | danger | success
    ref_id = Column(String(50), nullable=True)  # job_id, cve_id, etc.
    created_at = Column(DateTime, default=_utcnow, index=True)

    host = relationship("Host", backref="timeline_events")

    __table_args__ = (Index("ix_host_timeline_host_created", "host_id", "created_at"),)


# â”€â”€ CI/CD Secret Manager â”€â”€


class CICDSecret(Base):
    """Encrypted secret store for CI/CD pipelines.

    Secrets are referenced in pipeline scripts as ${{ secrets.NAME }}.
    scope='global' means available to all pipelines; scope='pipeline' scopes to one.
    encrypted_value stores the Fernet-encrypted secret value.
    """

    __tablename__ = "cicd_secrets"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, default="")
    scope = Column(String(20), nullable=False, default="global")  # global | pipeline
    pipeline_id = Column(
        Integer,
        ForeignKey("cicd_pipelines.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    encrypted_value = Column(Text, nullable=False, default="")
    created_by = Column(String(100), nullable=False, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    pipeline = relationship("CICDPipeline", backref="secrets")

    __table_args__ = (
        UniqueConstraint("name", "pipeline_id", name="uq_cicd_secret_name_pipeline"),
        Index("ix_cicd_secrets_scope", "scope"),
    )


class SoftwareCatalogItem(Base):
    __tablename__ = "software_catalog_items"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, index=True)
    package_name = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    supported_platforms = Column(JSON, default=list)
    allowed_actions = Column(JSON, default=list)
    default_execution_mode = Column(String(20), default="immediate")
    is_enabled = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    requests = relationship("SoftwareKioskRequest", back_populates="catalog_item")


class SoftwareKioskRequest(Base):
    __tablename__ = "software_kiosk_requests"
    id = Column(Integer, primary_key=True)
    catalog_item_id = Column(
        Integer,
        ForeignKey("software_catalog_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requested_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    approved_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    requested_action = Column(String(20), nullable=False, default="install")
    execution_mode = Column(String(20), nullable=False, default="immediate")
    note = Column(Text, default="")
    status = Column(String(24), default="submitted", index=True)
    status_message = Column(Text, default="")
    fulfilled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    catalog_item = relationship("SoftwareCatalogItem", back_populates="requests")
    host = relationship("Host")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class ProvisioningTemplate(Base):
    __tablename__ = "provisioning_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(160), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    source_host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_snapshot_name = Column(String(200), nullable=False)
    snapshot_mode = Column(String(24), default="full_system")
    os_family = Column(String(40), default="", index=True)
    platform_label = Column(String(120), default="")
    site_scope = Column(String(120), default="", index=True)
    hardware_profile = Column(JSON, default=dict)
    labels = Column(JSON, default=list)
    archive_file_name = Column(String(255), nullable=False, default="")
    archive_checksum = Column(String(128), nullable=False, default="")
    archive_size_bytes = Column(Integer, default=0)
    is_enabled = Column(Boolean, default=True, index=True)
    created_by = Column(String(100), default="")
    last_verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    source_host = relationship("Host", foreign_keys=[source_host_id])
    runs = relationship(
        "ProvisioningRun", back_populates="template", cascade="all, delete-orphan"
    )


class ProvisioningRun(Base):
    __tablename__ = "provisioning_runs"
    id = Column(Integer, primary_key=True)
    template_id = Column(
        Integer,
        ForeignKey("provisioning_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    initiated_by = Column(String(100), default="")
    mode = Column(String(24), default="reimage")
    status = Column(String(24), default="pending", index=True)
    allow_cross_site = Column(Boolean, default=False)
    target_host_ids = Column(JSON, default=list)
    result_summary = Column(JSON, default=dict)
    queue_job_id = Column(String(64), default="", index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    template = relationship("ProvisioningTemplate", back_populates="runs")


class BootRelay(Base):
    __tablename__ = "boot_relays"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer,
        ForeignKey("hosts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    name = Column(String(160), nullable=False, unique=True, index=True)
    site_scope = Column(String(120), default="", index=True)
    install_root = Column(String(255), default="/var/lib/patchmaster/network-boot")
    public_base_url = Column(String(255), default="")
    notes = Column(Text, default="")
    is_enabled = Column(Boolean, default=True, index=True)
    status = Column(String(24), default="idle", index=True)
    applied_version = Column(String(64), default="")
    rendered_config_checksum = Column(String(128), default="")
    last_install_at = Column(DateTime, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    last_validation_at = Column(DateTime, nullable=True)
    last_validation_status = Column(String(24), default="", index=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    host = relationship("Host")
    networks = relationship("NetworkBootNetwork", back_populates="relay")
    runs = relationship(
        "BootRelayRun", back_populates="relay", cascade="all, delete-orphan"
    )
    sessions = relationship("BootSession", back_populates="relay")


class NetworkBootNetwork(Base):
    __tablename__ = "network_boot_networks"
    id = Column(Integer, primary_key=True)
    name = Column(String(160), nullable=False, unique=True, index=True)
    interface_name = Column(String(120), default="")
    vlan_id = Column(Integer, nullable=True)
    cidr = Column(String(64), default="")
    gateway = Column(String(64), default="")
    dns_servers = Column(JSON, default=list)
    dhcp_range_start = Column(String(64), default="")
    dhcp_range_end = Column(String(64), default="")
    next_server = Column(String(255), default="")
    controller_url = Column(String(255), default="")
    relay_id = Column(
        Integer,
        ForeignKey("boot_relays.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    artifact_version = Column(String(64), default="")
    rendered_config_checksum = Column(String(128), default="")
    last_rendered_at = Column(DateTime, nullable=True)
    last_validated_at = Column(DateTime, nullable=True)
    last_validation_status = Column(String(24), default="", index=True)
    boot_file_bios = Column(String(255), default="undionly.kpxe")
    boot_file_uefi = Column(String(255), default="ipxe.efi")
    is_enabled = Column(Boolean, default=True, index=True)
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    relay = relationship("BootRelay", back_populates="networks")
    profiles = relationship("NetworkBootProfile", back_populates="network")
    assignments = relationship("NetworkBootAssignment", back_populates="network")
    sessions = relationship("BootSession", back_populates="network")


class NetworkBootProfile(Base):
    __tablename__ = "network_boot_profiles"
    id = Column(Integer, primary_key=True)
    name = Column(String(160), nullable=False, unique=True, index=True)
    network_id = Column(
        Integer,
        ForeignKey("network_boot_networks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provisioning_template_id = Column(
        Integer,
        ForeignKey("provisioning_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    mirror_repo_id = Column(
        Integer,
        ForeignKey("mirror_repos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    os_family = Column(String(40), default="", index=True)
    os_version = Column(String(80), default="")
    architecture = Column(String(40), default="x86_64")
    firmware_mode = Column(String(24), default="uefi")
    install_mode = Column(String(40), default="ubuntu_autoinstall")
    kernel_url = Column(String(500), default="")
    initrd_url = Column(String(500), default="")
    rootfs_url = Column(String(500), default="")
    answer_template = Column(Text, default="")
    post_install_script = Column(Text, default="")
    is_enabled = Column(Boolean, default=True, index=True)
    release_label = Column(String(40), default="stable")
    created_by = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    network = relationship("NetworkBootNetwork", back_populates="profiles")
    provisioning_template = relationship("ProvisioningTemplate")
    mirror_repo = relationship("MirrorRepo")
    assignments = relationship("NetworkBootAssignment", back_populates="profile")
    sessions = relationship("BootSession", back_populates="profile")


class NetworkBootAssignment(Base):
    __tablename__ = "network_boot_assignments"
    id = Column(Integer, primary_key=True)
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    network_id = Column(
        Integer,
        ForeignKey("network_boot_networks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    profile_id = Column(
        Integer,
        ForeignKey("network_boot_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hostname = Column(String(255), default="", index=True)
    mac_address = Column(String(32), nullable=False, unique=True, index=True)
    reserved_ip = Column(String(64), default="")
    firmware_mode = Column(String(24), default="uefi")
    boot_once = Column(Boolean, default=True)
    is_enabled = Column(Boolean, default=True, index=True)
    site_scope = Column(String(120), default="", index=True)
    created_by = Column(String(100), default="")
    last_boot_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    host = relationship("Host")
    network = relationship("NetworkBootNetwork", back_populates="assignments")
    profile = relationship("NetworkBootProfile", back_populates="assignments")
    sessions = relationship("BootSession", back_populates="assignment")


class BootRelayRun(Base):
    __tablename__ = "boot_relay_runs"
    id = Column(Integer, primary_key=True)
    relay_id = Column(
        Integer,
        ForeignKey("boot_relays.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(24), nullable=False, index=True)  # install | sync | validate
    status = Column(String(24), default="pending", index=True)
    requested_by = Column(String(100), default="")
    queue_job_id = Column(String(64), default="", index=True)
    payload = Column(JSON, default=dict)
    result_summary = Column(JSON, default=dict)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    relay = relationship("BootRelay", back_populates="runs")


class BootSession(Base):
    __tablename__ = "boot_sessions"
    id = Column(Integer, primary_key=True)
    session_token = Column(String(64), nullable=False, unique=True, index=True)
    assignment_id = Column(
        Integer,
        ForeignKey("network_boot_assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    profile_id = Column(
        Integer,
        ForeignKey("network_boot_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    network_id = Column(
        Integer,
        ForeignKey("network_boot_networks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    relay_id = Column(
        Integer,
        ForeignKey("boot_relays.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    mac_address = Column(String(32), default="", index=True)
    hostname = Column(String(255), default="", index=True)
    controller_url = Column(String(255), default="")
    current_stage = Column(String(40), default="assignment_served", index=True)
    status = Column(String(24), default="active", index=True)
    provisioning_source = Column(String(80), default="")
    event_count = Column(Integer, default=0)
    result_summary = Column(JSON, default=dict)
    started_at = Column(DateTime, default=_utcnow, index=True)
    last_event_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    assignment = relationship("NetworkBootAssignment", back_populates="sessions")
    profile = relationship("NetworkBootProfile", back_populates="sessions")
    network = relationship("NetworkBootNetwork", back_populates="sessions")
    relay = relationship("BootRelay", back_populates="sessions")
    host = relationship("Host")
    events = relationship(
        "BootEvent", back_populates="session", cascade="all, delete-orphan"
    )


class BootEvent(Base):
    __tablename__ = "boot_events"
    id = Column(Integer, primary_key=True)
    session_id = Column(
        Integer,
        ForeignKey("boot_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(64), nullable=False, index=True)
    source = Column(String(40), default="", index=True)
    message = Column(Text, default="")
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow, index=True)

    session = relationship("BootSession", back_populates="events")


# â”€â”€ CI/CD Agent Targets (CD to specific hosts via agent) â”€â”€


class CICDAgentTarget(Base):
    """Maps a pipeline+environment to a specific agent host for CD execution."""

    __tablename__ = "cicd_agent_targets"
    id = Column(Integer, primary_key=True)
    pipeline_id = Column(
        Integer,
        ForeignKey("cicd_pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    environment_id = Column(
        Integer,
        ForeignKey("cicd_environments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label = Column(String(200), nullable=False, default="")
    run_as = Column(String(100), nullable=False, default="")  # sudo user on Linux
    working_dir = Column(String(500), nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String(100), nullable=False, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    pipeline = relationship("CICDPipeline", backref="agent_targets")
    environment = relationship("CICDEnvironment", backref="agent_targets")
    host = relationship("Host", backref="cicd_agent_targets")

    # pipeline_id and host_id already use index=True above; avoid defining
    # the same single-column indexes twice because create_all will try to
    # recreate them on fresh installs/upgrades.
    __table_args__ = ()


class CICDAgentRun(Base):
    """Execution record for a CD command dispatched to an agent host."""

    __tablename__ = "cicd_agent_runs"
    id = Column(Integer, primary_key=True)
    build_id = Column(
        Integer,
        ForeignKey("cicd_builds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id = Column(
        Integer,
        ForeignKey("cicd_agent_targets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    host_id = Column(
        Integer, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    host_ip = Column(String(60), nullable=False, default="")
    stage_name = Column(String(200), nullable=False, default="")
    command = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="pending", index=True)
    output = Column(Text, nullable=False, default="")
    exit_code = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    build = relationship("CICDBuild", backref="agent_runs")
    target = relationship("CICDAgentTarget", backref="runs")
    host = relationship("Host", backref="cicd_agent_runs")

    # build_id and status already use index=True above; avoid redefining the
    # same single-column indexes because create_all will attempt to recreate
    # them on installs/upgrades.
    __table_args__ = ()
