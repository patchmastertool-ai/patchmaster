#!/usr/bin/env python3
"""AIX package manager using installp/NIM."""

import os
import re
import subprocess
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("patch-agent.aix")


class AIXManager:
    """Package manager for IBM AIX using installp/NIM."""

    def __init__(self):
        """Initialize the AIX package manager."""
        self.lslpp_cmd = self._find_command("lslpp")
        self.installp_cmd = self._find_command("installp")
        self.emgr_cmd = self._find_command("emgr")
        self.nimclient_cmd = self._find_command("nimclient")
        self.instfix_cmd = self._find_command("instfix")

    def _find_command(self, cmd_name: str) -> str:
        """Find a command path."""
        for path in [f"/usr/bin/{cmd_name}", f"/usr/sbin/{cmd_name}"]:
            if os.path.exists(path):
                return path
        return cmd_name  # Assume in PATH

    def _run_cmd(self, cmd: List[str], timeout: int = 300) -> Tuple[int, str]:
        """Run a command and return (returncode, stdout)."""
        logger.info("CMD: %s", " ".join(str(c) for c in cmd))
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=timeout,
            )
            return proc.returncode, proc.stdout
        except subprocess.TimeoutExpired:
            return -1, "Command timed out"
        except Exception as e:
            return -1, str(e)

    def is_aix(self) -> bool:
        """Check if this is an AIX system."""
        try:
            with open("/etc/AIX", "r"):
                return True
        except:
            pass

        # Check kernel via uname
        rc, out = self._run_cmd(["uname", "-s"], timeout=5)
        if rc == 0:
            system = out.strip().lower()
            return system == "aix"

        # Check for AIX-specific files
        aix_indicators = [
            "/usr/bin/nimclient",
            "/usr/sbin/nim",
            "/usr/sbin/installp",
        ]
        for path in aix_indicators:
            if os.path.exists(path):
                return True

        return False

    def list_installed(self) -> List[Dict[str, str]]:
        """List all installed software (lslpp).

        Returns:
            List of dicts with 'name', 'version', and 'status' keys.
        """
        # lslpp -L -qc all  gives colon-separated output
        rc, out = self._run_cmd([self.lslpp_cmd, "-L", "-qc", "all"], timeout=120)
        if rc != 0:
            # Fallback to human-readable format
            rc, out = self._run_cmd([self.lslpp_cmd, "-L"], timeout=120)
            if rc != 0:
                return []

        packages = []
        for line in out.strip().splitlines():
            if not line.strip():
                continue

            # Parse based on format
            if ":" in line:
                # QC format: fileset:level:state:description:fixes
                parts = line.split(":")
                if len(parts) >= 2:
                    # fileset includes both the fileset name and version
                    fileset = parts[0]
                    state = parts[2] if len(parts) > 2 else "unknown"

                    # Split fileset into name and version
                    # Format: bundle.fileset
                    if "." in fileset:
                        name_parts = fileset.rsplit(".", 1)
                        name = name_parts[0]
                        version = name_parts[1] if len(name_parts) > 1 else ""
                    else:
                        name = fileset
                        version = ""

                    packages.append(
                        {
                            "name": name,
                            "version": version,
                            "state": state,
                            "status": "installed",
                        }
                    )
            else:
                # Human-readable format
                parts = line.split()
                if len(parts) >= 2:
                    packages.append(
                        {
                            "name": parts[0],
                            "version": parts[1] if len(parts) > 1 else "",
                            "status": "installed",
                        }
                    )

        return packages

    def list_upgradable(self) -> List[Dict[str, str]]:
        """List software with available updates.

        Returns:
            List of dicts with 'name', 'current_version', and 'available_version'.
        """
        # Refresh package catalog
        self.refresh()

        updates = []

        # Method 1: Check with instfix for fixes
        rc, out = self._run_cmd([self.instfix_cmd, "-d"], timeout=120)

        # Method 2: Check for updates via emgr
        rc2, out2 = self._run_cmd([self.emgr_cmd, "-l"], timeout=120)

        if rc2 == 0 and out2.strip():
            for line in out2.strip().splitlines():
                line = line.strip()
                if not line or line.startswith("ID") or line.startswith("-"):
                    continue

                parts = line.split()
                if len(parts) >= 3:
                    # Format: efix_id  pkg_name  version  ...
                    updates.append(
                        {
                            "name": parts[1],
                            "current_version": parts[2] if len(parts) > 2 else "",
                            "available_version": "update",
                            "efix_id": parts[0] if len(parts) > 0 else "",
                        }
                    )

        # Method 3: Check for installp updates via lslpp
        rc3, out3 = self._run_cmd([self.lslpp_cmd, "-h", "-a"], timeout=120)

        if rc3 == 0:
            for line in out3.strip().splitlines():
                if "UPDATE" in line.upper() or "PTF" in line.upper():
                    parts = line.split(":")
                    if len(parts) >= 2:
                        name = parts[0].split()[0] if parts else ""
                        updates.append(
                            {
                                "name": name,
                                "current_version": "",
                                "available_version": "update available",
                            }
                        )

        return updates

    def refresh(self) -> Tuple[int, str]:
        """Refresh the AIX software catalog.

        Returns:
            Tuple of (return_code, message).
        """
        logger.info("Refreshing AIX software catalog...")

        # Try nimclient to sync with NIM server
        if os.path.exists(self.nimclient_cmd.replace("/usr/bin/", "/usr/sbin/")):
            rc, out = self._run_cmd([self.nimclient_cmd, "-o", "sync"], timeout=300)
            if rc == 0:
                logger.info("NIM client sync completed")
                return rc, out

        # Fallback: refresh installp database
        rc, out = self._run_cmd(
            [self.installp_cmd, "-L"],  # List to refresh index
            timeout=120,
        )

        if rc != 0:
            logger.warning("Failed to refresh software catalog: %s", out)
        else:
            logger.info("Software catalog refreshed")

        return rc, out

    def install(
        self,
        packages: List[str],
        local: bool = False,
        security_only: bool = False,
        exclude_kernel: bool = False,
        extra_flags: Optional[List[str]] = None,
    ) -> Tuple[int, str]:
        """Install software packages/bundles.

        Args:
            packages: List of package/fileset names to install.
            local: If True, install from local media.
            security_only: If True, install only security fixes.
            exclude_kernel: If True, exclude kernel filesets.
            extra_flags: Additional flags to pass to installp.

        Returns:
            Tuple of (return_code, output).
        """
        if not packages:
            return 0, "No packages specified"

        # Filter kernel filesets if requested
        if exclude_kernel:
            packages = [p for p in packages if not self._is_kernel_fileset(p)]

        if not packages:
            return 0, "All packages filtered out"

        # Build installp command
        cmd = [
            self.installp_cmd,
            "-a",  # Accept license
            "-Y",  # Yes to all
            "-V",
            "0",  # Verbosity level
        ]

        if extra_flags:
            cmd.extend(extra_flags)

        cmd.extend(["-d", "."])  # Media device (current directory if local)
        cmd.extend(packages)

        rc, out = self._run_cmd(cmd, timeout=3600)

        return rc, out

    def _is_kernel_fileset(self, fileset: str) -> bool:
        """Check if a fileset is a kernel fileset."""
        kernel_patterns = [
            "bos",
            "kernel",
            "unix",
            "perf",
            "rsct",
        ]
        fileset_lower = fileset.lower()
        return any(pattern in fileset_lower for pattern in kernel_patterns)

    def install_efix(self, efix_file: str) -> Tuple[int, str]:
        """Install an efix (electronic fix) package.

        Args:
            efix_file: Path to the efix package file.

        Returns:
            Tuple of (return_code, output).
        """
        cmd = [self.emgr_cmd, "-e", efix_file, "-L"]
        rc, out = self._run_cmd(cmd, timeout=1800)
        return rc, out

    def remove(self, packages: List[str]) -> Tuple[int, str]:
        """Remove (deinstall) software packages.

        Args:
            packages: List of package/fileset names to remove.

        Returns:
            Tuple of (return_code, output).
        """
        if not packages:
            return 0, "No packages specified"

        cmd = [
            self.installp_cmd,
            "-u",  # Uninstall
            "-Y",  # Yes to all
        ]
        cmd.extend(packages)

        rc, out = self._run_cmd(cmd, timeout=1800)
        return rc, out

    def remove_efix(self, efix_id: str) -> Tuple[int, str]:
        """Remove an efix package.

        Args:
            efix_id: The efix ID to remove.

        Returns:
            Tuple of (return_code, output).
        """
        cmd = [self.emgr_cmd, "-r", "-L", efix_id]
        rc, out = self._run_cmd(cmd, timeout=600)
        return rc, out

    def check_reboot(self) -> bool:
        """Check if a system reboot is required.

        Returns:
            True if reboot is required, False otherwise.
        """
        # Check for reboot indicator
        reboot_files = [
            "/tmp/reboot.required",
            "/etc/nim.reboot",
        ]

        for f in reboot_files:
            if os.path.exists(f):
                return True

        # Check if bosboot needs to be run
        rc, out = self._run_cmd(["lslpp", "-l", "bos.rte.boot"], timeout=30)
        if rc == 0 and "bos.rte.boot" in out:
            # More sophisticated check could be added
            pass

        # Check pending mlint (maintenance level interim fix)
        rc, out = self._run_cmd([self.emgr_cmd, "-l", "-c"], timeout=60)
        if rc == 0:
            # Check if there are committed fixes that require reboot
            # Typically after mlpkgs are installed
            reboot_patterns = [
                "reboot required",
                "system restart required",
                "bosboot required",
            ]
            for pattern in reboot_patterns:
                if pattern in out.lower():
                    return True

        return False

    def list_efixes(self) -> List[Dict[str, str]]:
        """List installed efixes.

        Returns:
            List of efixes with id, package, and version.
        """
        rc, out = self._run_cmd([self.emgr_cmd, "-l"], timeout=60)
        if rc != 0:
            logger.warning("Failed to list efixes: %s", out)
            return []

        efixes = []
        current = {}

        for line in out.strip().splitlines():
            line = line.strip()
            if not line or line.startswith("ID") or line.startswith("-"):
                continue

            parts = line.split()
            if len(parts) >= 4:
                efix_id = parts[0]
                pkg_name = parts[1]
                version = parts[2]
                state = parts[3] if len(parts) > 3 else ""

                efixes.append(
                    {
                        "id": efix_id,
                        "name": pkg_name,
                        "version": version,
                        "state": state,
                        "type": "efix",
                    }
                )

        return efixes

    def get_system_info(self) -> Dict[str, str]:
        """Get AIX system information.

        Returns:
            Dict with AIX version, TL (technology level), and SP (service pack).
        """
        info = {
            "os": "AIX",
            "version": "",
            "technology_level": "",
            "service_pack": "",
        }

        rc, out = self._run_cmd(["oslevel", "-s"], timeout=30)
        if rc == 0:
            # Format: AIX_version-TL_SP
            # Example: 7200-04-02-1945
            info["version"] = out.strip()

            parts = out.strip().split("-")
            if len(parts) >= 2:
                info["technology_level"] = parts[1]
            if len(parts) >= 3:
                info["service_pack"] = parts[2]

        rc2, out2 = self._run_cmd(["oslevel", "-r"], timeout=30)
        if rc2 == 0:
            info["recommended_ml"] = out2.strip()

        return info


# Standalone detection function
def get_aix_manager() -> Optional[AIXManager]:
    """Get an AIXManager if this is an AIX system.

    Returns:
        AIXManager instance if on AIX, None otherwise.
    """
    manager = AIXManager()
    if manager.is_aix():
        return manager
    return None


# Module-level check
if __name__ == "__main__":
    manager = AIXManager()
    if manager.is_aix():
        print(f"AIX detected")
        sys_info = manager.get_system_info()
        print(f"Version: {sys_info.get('version', 'unknown')}")
        installed = manager.list_installed()
        print(f"Found {len(installed)} installed filesets")
    else:
        print("Not an AIX system")
