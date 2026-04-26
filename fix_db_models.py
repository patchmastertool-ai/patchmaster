"""Fix db_models.py by surgically replacing the corrupted section."""
import sys

path = r'c:\Users\test\Desktop\pat-1\backend\models\db_models.py'
content = open(path, 'r', encoding='utf-8').read()

# Find the corruption: between end of JobStatus enum and NotificationChannel
# The file currently has orphaned UserNotification body between them
bad_start_marker = '    aborted = "aborted"'
good_resume_marker = 'class NotificationChannel(Base):'

bad_pos = content.find(bad_start_marker)
good_pos = content.find(good_resume_marker)

if bad_pos == -1:
    print("ERROR: bad_start_marker not found")
    sys.exit(1)
if good_pos == -1:
    print("ERROR: good_resume_marker not found")
    sys.exit(1)

# Everything from bad_pos+len(marker) to good_pos gets replaced
print(f"Corruption range: [{bad_pos}:{good_pos}]")
print("Replacing with correct models...")

insertion = '''    aborted = "aborted"


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
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    """Server-side refresh token store for JWT rotation and revocation."""
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)  # SHA-256 hex
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(45), default="")   # IPv4 or IPv6
    user_agent = Column(String(512), default="")
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class PatchHistoryPreset(Base):
    __tablename__ = "patch_history_presets"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, index=True)
    scope_type = Column(String(20), default="user", nullable=False, index=True)  # user | role | global
    role = Column(String(20), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    filters = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


# -- Notifications --

class UserNotification(Base):
    __tablename__ = "user_notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Null = System wide
    type = Column(String(50), nullable=False)  # update, job, alert
    title = Column(String(200), nullable=False)
    message = Column(Text, default="")
    link = Column(String(255), nullable=True)  # Frontend route or API link
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="notifications")


'''

# Cut from bad_pos to good_pos, inject insertion, then resume from good_pos
new_content = content[:bad_pos] + insertion + content[good_pos:]
open(path, 'w', encoding='utf-8').write(new_content)
print("SUCCESS: db_models.py patched.")

# Verify
check = open(path, 'r', encoding='utf-8').read()
checks = [
    'class PatchAction',
    'class Severity',
    'class User(Base)',
    'login_attempts',
    'locked_until',
    'class RefreshToken',
    'class PatchHistoryPreset',
    'host_group_assoc',
    'host_tag_assoc',
]
for c in checks:
    status = "OK" if c in check else "MISSING"
    print(f"  {status}: {c}")
