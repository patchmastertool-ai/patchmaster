"""PatchMaster Agent Package"""
__version__ = "2.0.0"

# Import package managers for test access
from agent.agent import (
    BasePackageManager,
    AptManager,
    DnfManager,
    WinManager,
    PacmanManager,
    ZypperManager,
    ApkManager,
    FreeBSDPkgManager,
    get_pkg_manager,
    run_cmd
)

__all__ = [
    'BasePackageManager',
    'AptManager',
    'DnfManager',
    'WinManager',
    'PacmanManager',
    'ZypperManager',
    'ApkManager',
    'FreeBSDPkgManager',
    'get_pkg_manager',
    'run_cmd',
    '__version__'
]
