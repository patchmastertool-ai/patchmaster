"""Role-based access control (RBAC) for PatchMaster Enterprise."""

from typing import Optional, Set, List, Callable, TYPE_CHECKING
from enum import Enum
from functools import wraps

from fastapi import Depends, HTTPException, status

# Conditional imports to avoid hard dependencies when testing standalone
try:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession
    from database import get_db
    from models.db_models import User, UserRole
except ImportError:
    User = None
    UserRole = None
    AsyncSession = None

# Define a simple fallback UserRole enum if models not available
if UserRole is None:

    class UserRole(Enum):
        VIEWER = "viewer"
        OPERATOR = "operator"
        ADMIN = "admin"
        SUPERADMIN = "superadmin"


# Define a simple fallback User class for testing
class User:
    def __init__(
        self,
        id: int = 0,
        username: str = "",
        role: UserRole = UserRole.VIEWER,
        is_active: bool = True,
    ):
        self.id = id
        self.username = username
        self.role = role
        self.is_active = is_active


# ── Role Hierarchy ──


class RoleLevel(Enum):
    """Role hierarchy levels - higher number = more permissions."""

    VIEWER = 0
    OPERATOR = 1
    ADMIN = 2
    SUPERADMIN = 3


# Map roles to their levels
ROLE_LEVELS = {
    UserRole.VIEWER: RoleLevel.VIEWER,
    UserRole.OPERATOR: RoleLevel.OPERATOR,
    UserRole.ADMIN: RoleLevel.ADMIN,
    UserRole.SUPERADMIN: RoleLevel.SUPERADMIN,
}

# Role permissions - each role inherits permissions from lower roles
ROLE_PERMISSIONS = {
    UserRole.VIEWER: {
        "read:hosts",
        "read:jobs",
        "read:reports",
        "read:events",
    },
    UserRole.OPERATOR: {
        "read:hosts",
        "read:jobs",
        "read:reports",
        "read:events",
        "execute:jobs",
        "read:agents",
        "manage:schedules",
    },
    UserRole.ADMIN: {
        "read:hosts",
        "read:jobs",
        "read:reports",
        "read:events",
        "execute:jobs",
        "read:agents",
        "manage:schedules",
        "manage:hosts",
        "manage:groups",
        "manage:users",
        "manage:policies",
        "manage:templates",
    },
    UserRole.SUPERADMIN: {
        "*",  # All permissions
    },
}


def get_role_level(role: UserRole) -> RoleLevel:
    """Get the level of a role."""
    return ROLE_LEVELS.get(role, RoleLevel.VIEWER)


def has_role(user: Optional[User], *roles: UserRole) -> bool:
    """Check if user has any of the specified roles."""
    if user is None:
        return False
    return user.role in roles


def check_permission(user: Optional[User], permission: str) -> bool:
    """Check if user has a specific permission."""
    if user is None:
        return False

    # Superadmin has all permissions
    if user.role == UserRole.SUPERADMIN:
        return True

    # Get user's permissions
    user_permissions = ROLE_PERMISSIONS.get(user.role, set())

    # Check for wildcard
    if "*" in user_permissions:
        return True

    return permission in user_permissions


def get_user_permissions(user: User) -> Set[str]:
    """Get all permissions for a user."""
    return ROLE_PERMISSIONS.get(user.role, set())


def get_role_permissions(role: UserRole) -> Set[str]:
    """Get all permissions for a role."""
    perms = ROLE_PERMISSIONS.get(role, set())
    if "*" in perms:
        return {"*"}
    return perms


# ── Permission Check Decorator ──


def require_permission(*permissions: str):
    """Decorator to require specific permissions for an endpoint."""

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get user from kwargs or dependencies
            user = kwargs.get("user")
            if user is None:
                # Try to get from dependency
                for v in kwargs.values():
                    if isinstance(v, User):
                        user = v
                        break

            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            # Check each required permission
            for perm in permissions:
                if not check_permission(user, perm):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission required: {perm}",
                    )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_role(*roles: UserRole):
    """Dependency factory - restrict endpoint to specific roles."""

    async def role_checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role.value}' not authorized. Required: {[r.value for r in roles]}",
            )
        return user

    return role_checker


def require_min_role_level(min_level: RoleLevel):
    """Dependency factory - require minimum role level."""

    async def level_checker(user: User = Depends(get_current_user)):
        user_level = get_role_level(user.role)
        if user_level.value < min_level.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role level {min_level.name} or higher required. Current: {user_role.name}",
            )
        return user

    return level_checker


# ── Role Assignment API ──


async def assign_role(
    user_id: int, new_role: UserRole, db: AsyncSession, admin_user: User
) -> bool:
    """Assign a role to a user. Only admins can assign roles."""
    # Check if admin has permission
    if (
        not check_permission(admin_user, "manage:users")
        and admin_user.role != UserRole.SUPERADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to assign roles",
        )

    # Get target user
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if admin can assign the role
    admin_level = get_role_level(admin_user.role)
    target_level = get_role_level(new_role)

    if target_level.value > admin_level.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign role with higher level than your own",
        )

    # Assign role
    target_user.role = new_role
    await db.commit()

    return True


async def get_user_role(user_id: int, db: AsyncSession) -> Optional[UserRole]:
    """Get a user's role."""
    user = await db.get(User, user_id)
    if not user:
        return None
    return user.role


# ── Permission Inheritance Helpers ──


def inherit_permissions(base_role: UserRole) -> Set[str]:
    """Get all permissions a role inherits (its own + all lower roles)."""
    base_level = get_role_level(base_role).value

    all_perms = set()
    for role, level in ROLE_LEVELS.items():
        if level.value <= base_level:
            all_perms.update(ROLE_PERMISSIONS.get(role, set()))

    # Remove wildcard from result (it's just a marker)
    all_perms.discard("*")

    return all_perms


# ── FastAPI Dependency Import ──


async def get_current_user(
    token: str = Depends(
        lambda: None
    ),  # Placeholder - actual implementation in auth.py
    db: Optional[AsyncSession] = Depends(lambda: None),
) -> Optional[User]:
    """Placeholder for get_current_user - actual implementation imports from auth.py."""
    # This is a placeholder to avoid circular imports
    # In practice, use: from auth import get_current_user
    raise NotImplementedError("Use get_current_user from auth.py")


# ── Permission Models for API ──


class PermissionInfo:
    """Information about a permission."""

    def __init__(self, name: str, description: str = "", category: str = ""):
        self.name = name
        self.description = description
        self.category = category


# Define all available permissions
ALL_PERMISSIONS = [
    PermissionInfo("read:hosts", "View hosts and their status", "hosts"),
    PermissionInfo("read:jobs", "View patch jobs", "jobs"),
    PermissionInfo("read:reports", "View reports and dashboards", "reports"),
    PermissionInfo("read:events", "View system events", "events"),
    PermissionInfo("execute:jobs", "Create and execute patch jobs", "jobs"),
    PermissionInfo("read:agents", "View agent information", "agents"),
    PermissionInfo("manage:schedules", "Manage patch schedules", "schedules"),
    PermissionInfo("manage:hosts", "Manage hosts (edit, delete)", "hosts"),
    PermissionInfo("manage:groups", "Manage host groups", "groups"),
    PermissionInfo("manage:users", "Manage users and roles", "users"),
    PermissionInfo("manage:policies", "Manage patch policies", "policies"),
    PermissionInfo("manage:templates", "Manage job templates", "templates"),
]


def list_all_permissions() -> List[dict]:
    """List all available permissions."""
    return [
        {"name": p.name, "description": p.description, "category": p.category}
        for p in ALL_PERMISSIONS
    ]


def get_role_permissions_api(role: UserRole) -> dict:
    """Get role permissions for API response."""
    perms = inherit_permissions(role)
    return {
        "role": role.value,
        "permissions": sorted(list(perms)),
    }
