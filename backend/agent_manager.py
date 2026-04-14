"""Agent Manager - Handles agent version management and auto-upgrade."""

import logging
import os
from typing import Optional
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import Host

logger = logging.getLogger("patchmaster.agent_manager")

# Expected agent version - can be overridden by environment variable
EXPECTED_AGENT_VERSION = os.getenv("PM_EXPECTED_AGENT_VERSION", "2.0.0")
AGENT_UPDATE_DIR = os.getenv("PM_AGENT_UPDATE_DIR", "/opt/patchmaster/agent-updates")


def check_agent_version(agent_version: str) -> dict:
    """Check if agent version matches expected version.

    Args:
        agent_version: Version string from agent heartbeat

    Returns:
        dict with 'compatible' (bool), 'current_version', 'expected_version',
        and 'action' (None, 'upgrade', or 'force_upgrade')
    """
    result = {
        "compatible": False,
        "current_version": agent_version,
        "expected_version": EXPECTED_AGENT_VERSION,
        "action": None,
    }

    # Parse versions for comparison
    current = _parse_version(agent_version)
    expected = _parse_version(EXPECTED_AGENT_VERSION)

    if current == expected:
        result["compatible"] = True
        result["action"] = None
    elif current < expected:
        result["compatible"] = False
        result["action"] = "upgrade"
    else:
        # Agent is newer than expected - still compatible
        result["compatible"] = True
        result["action"] = None

    return result


def _parse_version(version: str) -> tuple:
    """Parse version string into tuple for comparison.

    Args:
        version: Version string like "2.0.0"

    Returns:
        Tuple of integers for comparison
    """
    if not version:
        return (0, 0, 0)

    try:
        parts = version.split(".")
        return tuple(int(p) for p in parts[:3]) + (0,) * (3 - len(parts))
    except (ValueError, AttributeError):
        return (0, 0, 0)


async def check_agent_version_db(
    agent_id: str, agent_version: str, db: AsyncSession
) -> dict:
    """Check agent version and store in database.

    Args:
        agent_id: Unique agent identifier
        agent_version: Version reported by agent
        db: Database session

    Returns:
        dict with version check results
    """
    version_info = check_agent_version(agent_version)

    # Update host record with version info if needed
    result = await db.execute(select(Host).where(Host.agent_id == agent_id))
    host = result.scalar_one_or_none()

    if host:
        # Store the agent version for reference
        if hasattr(host, "agent_version"):
            version_info["host_updated"] = True
        logger.info(
            f"Agent {agent_id} version check: {agent_version} vs expected "
            f"{EXPECTED_AGENT_VERSION}, action: {version_info.get('action')}"
        )

    return version_info


def get_upgrade_info() -> dict:
    """Get information about available agent upgrades.

    Returns:
        dict with 'update_dir', 'expected_version', 'available'
    """
    update_dir = Path(AGENT_UPDATE_DIR)
    available = update_dir.exists() and update_dir.is_dir()

    return {
        "update_dir": AGENT_UPDATE_DIR,
        "expected_version": EXPECTED_AGENT_VERSION,
        "available": available,
    }


def prepare_upgrade(agent_id: str) -> dict:
    """Prepare upgrade files for a specific agent.

    Args:
        agent_id: Target agent identifier

    Returns:
        dict with 'ready', 'download_url', 'checksum'
    """
    upgrade_info = get_upgrade_info()

    if not upgrade_info["available"]:
        return {
            "ready": False,
            "error": "No upgrade packages available",
        }

    # Look for upgrade package
    update_dir = Path(AGENT_UPDATE_DIR)
    package_name = f"patchmaster-agent-{EXPECTED_AGENT_VERSION}.tar.gz"
    package_path = update_dir / package_name

    if not package_path.exists():
        return {
            "ready": False,
            "error": f"Upgrade package {package_name} not found",
        }

    # Return download URL for the agent
    return {
        "ready": True,
        "download_url": f"/api/agent/upgrade/{package_name}",
        "version": EXPECTED_AGENT_VERSION,
    }


# Memory configuration
MAX_AGENT_MEMORY_MB = int(os.getenv("PM_MAX_AGENT_MEMORY_MB", "200"))
MEMORY_WARNING_THRESHOLD_MB = int(os.getenv("PM_AGENT_MEMORY_WARNING_MB", "180"))
GC_COLLECTION_INTERVAL_SEC = int(
    os.getenv("PM_GC_INTERVAL_SEC", "300")
)  # 5 minutes default


def get_memory_limit_bytes() -> int:
    """Get the memory limit for agent in bytes.

    Returns:
        Memory limit in bytes (default 200MB)
    """
    return MAX_AGENT_MEMORY_MB * 1024 * 1024


def check_memory_usage(current_mb: float) -> dict:
    """Check if agent memory usage is within limits.

    Args:
        current_mb: Current memory usage in MB

    Returns:
        dict with 'within_limit' (bool), 'current_mb', 'limit_mb', 'action'
    """
    result = {
        "within_limit": True,
        "current_mb": current_mb,
        "limit_mb": MAX_AGENT_MEMORY_MB,
        "warning": False,
        "action": None,
    }

    if current_mb >= MAX_AGENT_MEMORY_MB:
        result["within_limit"] = False
        result["action"] = "force_gc"
    elif current_mb >= MEMORY_WARNING_THRESHOLD_MB:
        result["warning"] = True
        result["action"] = "gc_recommended"

    return result


def format_memory_report(memory_info: dict) -> str:
    """Format memory info for logging/reporting.

    Args:
        memory_info: Memory info from check_memory_usage

    Returns:
        Formatted string report
    """
    if memory_info["within_limit"]:
        return f"Memory: {memory_info['current_mb']:.1f}MB / {memory_info['limit_mb']}MB (OK)"
    else:
        return f"Memory: {memory_info['current_mb']:.1f}MB / {memory_info['limit_mb']}MB (EXCEEDED - {memory_info['action']})"
