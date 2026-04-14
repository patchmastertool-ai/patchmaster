"""RBAC — granular role-based access control with feature-level permissions.

Implements fine-grained permissions per feature (view/manage/execute).
Extends the base role system with feature-level permission overrides.
"""

from enum import Enum
from functools import wraps
from typing import Callable, Dict, List, Optional, Set

from fastapi import HTTPException, Request, status

from models.db_models import User, UserRole


class Permission(str, Enum):
    """Permission levels for features."""

    VIEW = "view"  # Read-only access
    MANAGE = "manage"  # Create/update/delete
    EXECUTE = "execute"  # Trigger actions/deployments


# Feature categories with their permissions
FEATURE_PERMISSIONS = {
    # Host management
    "hosts": [Permission.VIEW, Permission.MANAGE],
    "groups": [Permission.VIEW, Permission.MANAGE],
    "snapshots": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    # Patch operations
    "patches": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "jobs": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "schedules": [Permission.VIEW, Permission.MANAGE],
    # Security & compliance
    "compliance": [Permission.VIEW],
    "audit": [Permission.VIEW],
    "cve": [Permission.VIEW, Permission.MANAGE],
    # Reporting
    "reports": [Permission.VIEW, Permission.MANAGE],
    # System
    "users": [Permission.VIEW, Permission.MANAGE],
    "license": [Permission.VIEW, Permission.MANAGE],
    "settings": [Permission.VIEW, Permission.MANAGE],
    # DevOps
    "cicd": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "cicd_view": [Permission.VIEW],
    "cicd_manage": [Permission.MANAGE],
    "cicd_execute": [Permission.EXECUTE],
    "cicd_approve": [Permission.EXECUTE],
    "git": [Permission.VIEW, Permission.MANAGE],
    # Infrastructure
    "policies": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "backups": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "backup_db": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "backup_file": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "backup_vm": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "backup_live": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    # OS-specific
    "linux_patching": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "windows_patching": [Permission.VIEW, Permission.MANAGE, Permission.EXECUTE],
    "wsus": [Permission.VIEW, Permission.MANAGE],
    # Special features
    "monitoring": [Permission.VIEW],
    "testing": [Permission.VIEW, Permission.EXECUTE],
    "local_repo": [Permission.VIEW, Permission.MANAGE],
    "software": [Permission.VIEW, Permission.MANAGE],
    "plugins": [Permission.VIEW, Permission.MANAGE],
    "onboarding": [Permission.VIEW],
    # Dashboard
    "dashboard": [Permission.VIEW],
    "compare": [Permission.VIEW],
    "offline": [Permission.VIEW, Permission.MANAGE],
}


# Role-based default permissions (feature -> highest permission level)
ROLE_DEFAULTS: Dict[str, Dict[str, Permission]] = {
    "admin": {
        # Admin has full access to everything
        "hosts": Permission.MANAGE,
        "groups": Permission.MANAGE,
        "snapshots": Permission.EXECUTE,
        "patches": Permission.EXECUTE,
        "jobs": Permission.EXECUTE,
        "schedules": Permission.MANAGE,
        "compliance": Permission.VIEW,
        "audit": Permission.VIEW,
        "cve": Permission.MANAGE,
        "reports": Permission.MANAGE,
        "users": Permission.MANAGE,
        "license": Permission.MANAGE,
        "settings": Permission.MANAGE,
        "cicd": Permission.EXECUTE,
        "cicd_view": Permission.VIEW,
        "cicd_manage": Permission.MANAGE,
        "cicd_execute": Permission.EXECUTE,
        "cicd_approve": Permission.EXECUTE,
        "git": Permission.MANAGE,
        "policies": Permission.EXECUTE,
        "backups": Permission.EXECUTE,
        "backup_db": Permission.EXECUTE,
        "backup_file": Permission.EXECUTE,
        "backup_vm": Permission.EXECUTE,
        "backup_live": Permission.EXECUTE,
        "linux_patching": Permission.EXECUTE,
        "windows_patching": Permission.EXECUTE,
        "wsus": Permission.MANAGE,
        "monitoring": Permission.VIEW,
        "testing": Permission.EXECUTE,
        "local_repo": Permission.MANAGE,
        "software": Permission.MANAGE,
        "plugins": Permission.MANAGE,
        "onboarding": Permission.VIEW,
        "dashboard": Permission.VIEW,
        "compare": Permission.VIEW,
        "offline": Permission.MANAGE,
    },
    "operator": {
        # Operator can manage most things but not users/settings/audit
        "hosts": Permission.MANAGE,
        "groups": Permission.MANAGE,
        "snapshots": Permission.EXECUTE,
        "patches": Permission.EXECUTE,
        "jobs": Permission.EXECUTE,
        "schedules": Permission.MANAGE,
        "compliance": Permission.VIEW,
        "audit": Permission.VIEW,  # Can view but not manage
        "cve": Permission.MANAGE,
        "reports": Permission.VIEW,
        "users": Permission.VIEW,  # Can view users but not manage
        "license": Permission.VIEW,  # Read-only
        "settings": Permission.VIEW,  # Read-only
        "cicd": Permission.EXECUTE,
        "cicd_view": Permission.VIEW,
        "cicd_manage": Permission.MANAGE,
        "cicd_execute": Permission.EXECUTE,
        "cicd_approve": Permission.VIEW,  # Cannot approve
        "git": Permission.VIEW,
        "policies": Permission.EXECUTE,
        "backups": Permission.EXECUTE,
        "backup_db": Permission.EXECUTE,
        "backup_file": Permission.EXECUTE,
        "backup_vm": Permission.EXECUTE,
        "backup_live": Permission.EXECUTE,
        "linux_patching": Permission.EXECUTE,
        "windows_patching": Permission.EXECUTE,
        "wsus": Permission.VIEW,
        "monitoring": Permission.VIEW,
        "testing": Permission.EXECUTE,
        "local_repo": Permission.MANAGE,
        "software": Permission.MANAGE,
        "plugins": Permission.MANAGE,
        "onboarding": Permission.VIEW,
        "dashboard": Permission.VIEW,
        "compare": Permission.VIEW,
        "offline": Permission.MANAGE,
    },
    "viewer": {
        # Viewer has read-only access to most things
        "hosts": Permission.VIEW,
        "groups": Permission.VIEW,
        "snapshots": Permission.VIEW,
        "patches": Permission.VIEW,
        "jobs": Permission.VIEW,
        "schedules": Permission.VIEW,
        "compliance": Permission.VIEW,
        "audit": Permission.VIEW,
        "cve": Permission.VIEW,
        "reports": Permission.VIEW,
        "users": Permission.VIEW,
        "license": Permission.VIEW,
        "settings": Permission.VIEW,
        "cicd": Permission.VIEW,
        "cicd_view": Permission.VIEW,
        "cicd_manage": Permission.VIEW,
        "cicd_execute": Permission.VIEW,
        "cicd_approve": Permission.VIEW,
        "git": Permission.VIEW,
        "policies": Permission.VIEW,
        "backups": Permission.VIEW,
        "backup_db": Permission.VIEW,
        "backup_file": Permission.VIEW,
        "backup_vm": Permission.VIEW,
        "backup_live": Permission.VIEW,
        "linux_patching": Permission.VIEW,
        "windows_patching": Permission.VIEW,
        "wsus": Permission.VIEW,
        "monitoring": Permission.VIEW,
        "testing": Permission.VIEW,
        "local_repo": Permission.VIEW,
        "software": Permission.VIEW,
        "plugins": Permission.VIEW,
        "onboarding": Permission.VIEW,
        "dashboard": Permission.VIEW,
        "compare": Permission.VIEW,
        "offline": Permission.VIEW,
    },
    "auditor": {
        # Auditor has read-only access with emphasis on security/compliance
        "hosts": Permission.VIEW,
        "groups": Permission.VIEW,
        "snapshots": Permission.VIEW,
        "patches": Permission.VIEW,
        "jobs": Permission.VIEW,
        "schedules": Permission.VIEW,
        "compliance": Permission.VIEW,
        "audit": Permission.VIEW,
        "cve": Permission.VIEW,
        "reports": Permission.VIEW,
        "users": Permission.VIEW,
        "license": Permission.VIEW,
        "settings": Permission.VIEW,
        "cicd": Permission.VIEW,
        "cicd_view": Permission.VIEW,
        "cicd_manage": Permission.VIEW,
        "cicd_execute": Permission.VIEW,
        "cicd_approve": Permission.VIEW,
        "git": Permission.VIEW,
        "policies": Permission.VIEW,
        "backups": Permission.VIEW,
        "backup_db": Permission.VIEW,
        "backup_file": Permission.VIEW,
        "backup_vm": Permission.VIEW,
        "backup_live": Permission.VIEW,
        "linux_patching": Permission.VIEW,
        "windows_patching": Permission.VIEW,
        "wsus": Permission.VIEW,
        "monitoring": Permission.VIEW,
        "testing": Permission.VIEW,
        "local_repo": Permission.VIEW,
        "software": Permission.VIEW,
        "plugins": Permission.VIEW,
        "onboarding": Permission.VIEW,
        "dashboard": Permission.VIEW,
        "compare": Permission.VIEW,
        "offline": Permission.VIEW,
    },
}


def get_permission_level(perm: Permission) -> int:
    """Get numeric level for permission comparison."""
    levels = {Permission.VIEW: 1, Permission.MANAGE: 2, Permission.EXECUTE: 3}
    return levels.get(perm, 0)


def has_permission(
    user: User,
    feature: str,
    required: Permission,
    custom_perms: Optional[Dict[str, Permission]] = None,
) -> bool:
    """
    Check if user has the required permission for a feature.

    Args:
        user: The user to check
        feature: The feature name (e.g., 'hosts', 'patches')
        required: The required permission level
        custom_perms: Optional custom permission overrides from user.custom_permissions

    Returns:
        True if user has the required permission, False otherwise
    """
    role_name = user.role.value if hasattr(user.role, "value") else str(user.role)

    # Get base role permissions
    role_perms = ROLE_DEFAULTS.get(role_name, ROLE_DEFAULTS.get("viewer", {}))
    user_perm = role_perms.get(feature, Permission.VIEW)

    # Apply custom permission overrides if present
    if custom_perms and feature in custom_perms:
        custom_val = custom_perms[feature]
        # Custom can only increase permission, never decrease for admin
        if role_name == "admin":
            user_perm = (
                Permission.MANAGE
                if (user_perm == Permission.VIEW or custom_val == Permission.MANAGE)
                else user_perm
            )
        else:
            user_perm = custom_val

    # Check if user's permission meets or exceeds required
    return get_permission_level(user_perm) >= get_permission_level(required)


def check_permission(
    user: User,
    feature: str,
    required: Permission,
) -> None:
    """
    Check permission and raise HTTPException if denied.

    Args:
        user: The user to check
        feature: The feature name
        required: The required permission level

    Raises:
        HTTPException 403 if permission denied
    """
    if not has_permission(user, feature, required):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {feature}.{required.value} required",
        )


def require_permission(feature: str, required: Permission = Permission.VIEW):
    """
    Decorator to require a specific permission for an endpoint.

    Usage:
        @router.get("/hosts")
        @require_permission("hosts", Permission.VIEW)
        async def list_hosts(...):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Try to get user from kwargs or request
            user = kwargs.get("user") or kwargs.get("current_user")
            request = kwargs.get("request")

            if user is None and request is not None:
                # Try to get from request state
                user = getattr(request.state, "user", None)

            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            check_permission(user, feature, required)
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_user_permissions(user: User) -> Dict[str, Permission]:
    """
    Get all permissions for a user based on their role and custom overrides.

    Args:
        user: The user to get permissions for

    Returns:
        Dictionary mapping feature names to permission levels
    """
    role_name = user.role.value if hasattr(user.role, "value") else str(user.role)
    base_perms = ROLE_DEFAULTS.get(role_name, ROLE_DEFAULTS.get("viewer", {}))

    # Apply custom permissions
    result = dict(base_perms)
    if user.custom_permissions:
        for feature, custom_val in user.custom_permissions.items():
            if isinstance(custom_val, str):
                try:
                    custom_val = Permission(custom_val)
                except ValueError:
                    continue
            elif isinstance(custom_val, bool):
                # Convert boolean to permission
                custom_val = Permission.MANAGE if custom_val else Permission.VIEW

            if role_name == "admin":
                # Admin: custom can only upgrade
                current = result.get(feature, Permission.VIEW)
                if get_permission_level(custom_val) > get_permission_level(current):
                    result[feature] = custom_val
            else:
                result[feature] = custom_val

    return result


def get_feature_permissions(feature: str) -> List[Permission]:
    """Get available permission levels for a feature."""
    return FEATURE_PERMISSIONS.get(feature, [Permission.VIEW])


def list_all_features() -> List[str]:
    """List all available features."""
    return list(FEATURE_PERMISSIONS.keys())


def list_all_roles() -> List[str]:
    """List all available roles."""
    return list(ROLE_DEFAULTS.keys())


def get_role_permissions(role: str) -> Dict[str, Permission]:
    """Get all permissions for a role."""
    return ROLE_DEFAULTS.get(role, {})


def merge_permissions(
    base: Dict[str, Permission],
    override: Dict[str, Permission],
    mode: str = "max",
) -> Dict[str, Permission]:
    """
    Merge two permission dictionaries.

    Args:
        base: Base permissions
        override: Override permissions
        mode: 'max' (take higher), 'override' (use override only if present)

    Returns:
        Merged permission dictionary
    """
    result = dict(base)
    for feature, perm in override.items():
        if mode == "override" or feature not in result:
            result[feature] = perm
        else:
            # Take the higher permission
            result[feature] = (
                perm
                if get_permission_level(perm) > get_permission_level(result[feature])
                else result[feature]
            )
    return result
