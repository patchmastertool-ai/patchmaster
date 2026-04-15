#!/usr/bin/env python3
"""Solaris package manager using IPS (Image Packaging System)."""

import os
import re
import subprocess
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("patch-agent.solaris")


class SolarisManager:
    """Package manager for Oracle Solaris using IPS (Image Packaging System)."""

    def __init__(self):
        """Initialize the Solaris package manager."""
        self.pkg_cmd = self._find_pkg_command()

    def _find_pkg_command(self) -> str:
        """Find the pkg command path."""
        for path in ["/usr/bin/pkg", "/usr/pkg/bin/pkg", "/opt/pkg/bin/pkg"]:
            if os.path.exists(path):
                return path
        return "pkg"  # Assume in PATH

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

    def is_solaris(self) -> bool:
        """Check if this is a Solaris system."""
        # Check kernel name
        try:
            with open("/etc/release", "r") as f:
                content = f.read().lower()
                if "solaris" in content or "opensolaris" in content:
                    return True
        except:
            pass

        # Check kernel via uname
        rc, out = self._run_cmd(["uname", "-s"], timeout=5)
        if rc == 0:
            system = out.strip().lower()
            return "sunos" in system or "solaris" in system

        return False

    def list_installed(self) -> List[Dict[str, str]]:
        """List all installed packages.

        Returns:
            List of dicts with 'name', 'version', and 'status' keys.
        """
        rc, out = self._run_cmd([self.pkg_cmd, "list", "-H", "-i"], timeout=60)
        if rc != 0:
            logger.warning("Failed to list installed packages: %s", out)
            return []

        packages = []
        for line in out.strip().splitlines():
            if not line.strip():
                continue

            # Format: pkg FMRI state
            # Example: pkg://solaris/system/library@11.4.2.5.0,5.11-11.4.2.0.0.33.0:20210429T135825Z installed
            parts = line.split()
            if len(parts) >= 2:
                fmri = parts[0]
                state = parts[1] if len(parts) > 1 else "unknown"

                # Extract package name from FMRI
                # Format: pkg://publisher/name@version:timestamp
                name = self._extract_pkg_name(fmri)
                version = self._extract_pkg_version(fmri)

                packages.append({"name": name, "version": version, "status": state})

        return packages

    def _extract_pkg_name(self, fmri: str) -> str:
        """Extract package name from FMRI."""
        # Remove pkg:// prefix
        if "://" in fmri:
            fmri = fmri.split("://", 1)[1]

        # Remove version info (@...:)
        if "@" in fmri:
            fmri = fmri.split("@")[0]

        # Remove publisher prefix if present
        if "/" in fmri:
            name = fmri.split("/")[-1]
        else:
            name = fmri

        return name.strip()

    def _extract_pkg_version(self, fmri: str) -> str:
        """Extract version from FMRI."""
        # Format: name@version,timestamp
        if "@" not in fmri:
            return ""

        version_part = fmri.split("@", 1)[1]

        # Remove timestamp after colon
        if ":" in version_part:
            version_part = version_part.split(":")[0]

        # Remove branch info after comma
        if "," in version_part:
            version_part = version_part.split(",")[0]

        return version_part.strip()

    def list_upgradable(self) -> List[Dict[str, str]]:
        """List packages with available updates.

        Returns:
            List of dicts with 'name', 'current_version', and 'available_version'.
        """
        # First, refresh the package catalog
        self.refresh()

        rc, out = self._run_cmd([self.pkg_cmd, "list", "-H", "-u"], timeout=60)
        if rc != 0:
            logger.warning("Failed to list upgradable packages: %s", out)
            return []

        packages = []
        for line in out.strip().splitlines():
            if not line.strip():
                continue

            # Format similar to installed, but for upgradable packages
            parts = line.split()
            if len(parts) >= 2:
                fmri = parts[0]
                name = self._extract_pkg_name(fmri)
                version = self._extract_pkg_version(fmri)

                # Try to get more info about the update
                available = self._get_available_version(name)

                packages.append(
                    {
                        "name": name,
                        "current_version": version,
                        "available_version": available,
                    }
                )

        return packages

    def _get_available_version(self, pkg_name: str) -> str:
        """Get the available version for a package."""
        # Query for update info
        rc, out = self._run_cmd([self.pkg_cmd, "info", "-r", pkg_name], timeout=30)
        if rc == 0:
            # Parse version from info output
            for line in out.splitlines():
                if "Version" in line:
                    return (
                        line.split(":", 1)[1].strip()
                        if ":" in line
                        else line.split("=")[1].strip()
                    )
        return "unknown"

    def refresh(self) -> Tuple[int, str]:
        """Refresh the package repository catalog.

        Returns:
            Tuple of (return_code, message).
        """
        logger.info("Refreshing Solaris package catalog...")
        rc, out = self._run_cmd([self.pkg_cmd, "refresh", "--full"], timeout=300)
        if rc == 0:
            logger.info("Package catalog refreshed successfully")
        else:
            logger.warning("Failed to refresh package catalog: %s", out)
        return rc, out

    def install(
        self,
        packages: List[str],
        local: bool = False,
        security_only: bool = False,
        exclude_kernel: bool = False,
        extra_flags: Optional[List[str]] = None,
    ) -> Tuple[int, str]:
        """Install packages.

        Args:
            packages: List of package names to install.
            local: If True, install from local package files.
            security_only: If True, install only security updates.
            exclude_kernel: If True, exclude kernel packages.
            extra_flags: Additional flags to pass to pkg install.

        Returns:
            Tuple of (return_code, output).
        """
        if not packages:
            return 0, "No packages specified"

        # Filter kernel packages if requested
        if exclude_kernel:
            packages = [p for p in packages if not self._is_kernel_pkg(p)]

        if not packages:
            return 0, "All packages filtered out"

        cmd = [self.pkg_cmd, "install", "-nv"]  # Start with -nv to preview
        if extra_flags:
            cmd.extend(extra_flags)
        cmd.extend(packages)

        # First, do a dry run
        rc, out = self._run_cmd(cmd, timeout=120)
        if rc != 0:
            return rc, out

        logger.info("Install preview: %s", out)

        # Actually install
        cmd[cmd.index("-nv")] = ""  # Remove -nv flag, leave empty string
        cmd = [c for c in cmd if c != ""]  # Remove empty strings
        rc, out = self._run_cmd(cmd, timeout=3600)

        return rc, out

    def _is_kernel_pkg(self, pkg_name: str) -> bool:
        """Check if a package is a kernel package."""
        kernel_patterns = [
            "kernel",
            "unix",
            "platform",
            "boot",
            "drvd",
            "kvm",
        ]
        pkg_lower = pkg_name.lower()
        return any(pattern in pkg_lower for pattern in kernel_patterns)

    def remove(self, packages: List[str]) -> Tuple[int, str]:
        """Remove (uninstall) packages.

        Args:
            packages: List of package names to remove.

        Returns:
            Tuple of (return_code, output).
        """
        if not packages:
            return 0, "No packages specified"

        cmd = [self.pkg_cmd, "uninstall", "-nv"]  # Preview first
        cmd.extend(packages)

        rc, out = self._run_cmd(cmd, timeout=120)
        if rc != 0:
            return rc, out

        # Actually remove
        cmd = [self.pkg_cmd, "uninstall"]
        cmd.extend(packages)
        rc, out = self._run_cmd(cmd, timeout=1800)

        return rc, out

    def check_reboot(self) -> bool:
        """Check if a system reboot is required.

        Returns:
            True if reboot is required, False otherwise.
        """
        # Check for pending reboot indicator
        reboot_files = [
            "/var/run/reboot-needed",
            "/tmp/reboot-required",
        ]

        for f in reboot_files:
            if os.path.exists(f):
                return True

        # Check if kernel was updated
        rc, running_kernel = self._run_cmd(["uname", "-v"], timeout=5)
        if rc != 0:
            return False

        # Check installed kernel version
        rc, out = self._run_cmd(
            [self.pkg_cmd, "list", "-H", "kernel/system"], timeout=30
        )
        if rc == 0:
            # Parse if kernel version differs
            for line in out.splitlines():
                if "kernel/system" in line:
                    # More sophisticated check could be added here
                    pass

        return False

    def get_update_info(self, package: str) -> Dict[str, str]:
        """Get detailed update information for a package.

        Args:
            package: Package name.

        Returns:
            Dict with update information.
        """
        info = {
            "name": package,
            "current_version": "",
            "available_version": "",
            "publisher": "",
            "update_available": False,
        }

        rc, out = self._run_cmd([self.pkg_cmd, "info", "-r", package], timeout=30)
        if rc == 0:
            for line in out.splitlines():
                line = line.strip()
                if line.startswith("Publisher:"):
                    info["publisher"] = line.split(":", 1)[1].strip()
                elif line.startswith("Version:"):
                    info["available_version"] = line.split(":", 1)[1].strip()

        # Get installed version
        rc, out = self._run_cmd([self.pkg_cmd, "list", "-H", package], timeout=30)
        if rc == 0:
            for line in out.splitlines():
                if package in line:
                    version = self._extract_pkg_version(line)
                    info["current_version"] = version
                    break

        info["update_available"] = info["current_version"] != info[
            "available_version"
        ] and bool(info["available_version"])

        return info

    def _filter_security_packages(self, packages):
        """
        Query backend to filter packages to only those with CVEs.

        Args:
            packages: List of package dicts with 'name' key or list of strings

        Returns:
            List of package names that have security vulnerabilities
        """
        try:
            import requests
            import logging

            # Get controller URL and token from environment
            controller_url = os.getenv("CONTROLLER_URL", "http://localhost:3000")
            token = os.getenv("AGENT_TOKEN", "")

            # Get host ID from local cache
            host_id = self._get_host_id()
            if not host_id:
                logging.warning("No host_id found, cannot filter security packages")
                return [
                    p if isinstance(p, str) else p.get("name", "") for p in packages
                ]

            # Extract package names
            pkg_names = []
            for p in packages:
                if isinstance(p, str):
                    pkg_names.append(p)
                elif isinstance(p, dict):
                    pkg_names.append(p.get("name", ""))

            pkg_names = [n for n in pkg_names if n]

            if not pkg_names:
                return []

            # Query backend CVE filter API
            response = requests.post(
                f"{controller_url}/api/cve/filter-security",
                json={
                    "host_id": host_id,
                    "packages": pkg_names,
                    "severity_threshold": "medium",
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                security_pkgs = data.get("security_packages", [])
                logging.info(
                    f"CVE filter: {len(security_pkgs)}/{len(pkg_names)} packages have security issues"
                )
                return security_pkgs
            else:
                logging.warning(
                    f"CVE filter failed with status {response.status_code}, installing all packages"
                )
                return pkg_names

        except Exception as e:
            logging.warning(f"CVE filter error: {e}, installing all packages")
            return [p if isinstance(p, str) else p.get("name", "") for p in packages]

    def _get_host_id(self):
        """Get host ID from local cache or registration"""
        try:
            for path in [
                "/var/lib/patch-agent/host_id",
                "/etc/patch-agent/host_id",
                "host_id",
            ]:
                if os.path.exists(path):
                    with open(path, "r") as f:
                        return f.read().strip()
        except Exception:
            pass
        return None

    def get_proxies(self):
        """Get proxy settings from environment.

        Returns:
            Dict with proxy settings.
        """
        proxies = {}
        for key in ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"]:
            value = os.getenv(key) or os.getenv(key.lower())
            if value:
                proxies[key.lower()] = value
        return proxies

    def download_packages(self, packages, output_dir):
        """Download packages for offline installation.

        Args:
            packages: List of package names to download.
            output_dir: Directory to save downloaded packages.

        Returns:
            Tuple of (success, downloaded_files, error_message).
        """
        import urllib.parse

        if not packages:
            return True, [], "No packages specified"

        os.makedirs(output_dir, exist_ok=True)

        downloaded = []
        errors = []

        # Get publisher info for constructing download URLs
        proxies = self.get_proxies()

        for pkg in packages:
            try:
                # Use pkg download command
                cmd = [self.pkg_cmd, "download", "-d", output_dir, pkg]
                rc, out = self._run_cmd(cmd, timeout=600)

                if rc == 0:
                    # Find downloaded file
                    for f in os.listdir(output_dir):
                        if pkg in f:
                            downloaded.append(os.path.join(output_dir, f))
                else:
                    errors.append(f"Failed to download {pkg}: {out}")
            except Exception as e:
                errors.append(f"Error downloading {pkg}: {e}")

        if errors:
            return False, downloaded, "; ".join(errors)
        return True, downloaded, "Success"


# Standalone detection function
def get_solaris_manager() -> Optional[SolarisManager]:
    """Get a SolarisManager if this is a Solaris system.

    Returns:
        SolarisManager instance if on Solaris, None otherwise.
    """
    manager = SolarisManager()
    if manager.is_solaris():
        return manager
    return None


# Module-level check
if __name__ == "__main__":
    manager = SolarisManager()
    if manager.is_solaris():
        print(f"Solaris detected, using pkg command: {manager.pkg_cmd}")
        installed = manager.list_installed()
        print(f"Found {len(installed)} installed packages")
    else:
        print("Not a Solaris system")
