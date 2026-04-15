#!/usr/bin/env python3
"""HP-UX package manager using swinstall/swmgr."""

import os
import re
import subprocess
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("patch-agent.hpux")


class HPUXManager:
    """Package manager for HP-UX using SD-UX (Software Distributor)."""

    def __init__(self):
        """Initialize the HP-UX package manager."""
        self.swinstall_cmd = self._find_command("swinstall")
        self.swlist_cmd = self._find_command("swlist")
        self.swremove_cmd = self._find_command("swremove")
        self.swagentctl_cmd = self._find_command("swagentctl")

    def _find_command(self, cmd_name: str) -> str:
        """Find a command path."""
        for path in [f"/usr/sbin/{cmd_name}", f"/opt/sbin/{cmd_name}"]:
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

    def is_hpux(self) -> bool:
        """Check if this is an HP-UX system."""
        try:
            with open("/etc/hp-ux-release", "r") as f:
                content = f.read().lower()
                if "hp-ux" in content or "hpux" in content:
                    return True
        except:
            pass

        # Check kernel via uname
        rc, out = self._run_cmd(["uname", "-s"], timeout=5)
        if rc == 0:
            system = out.strip().lower()
            return "hp-ux" in system or "hpux" in system

        # Check for HP-UX specific files
        hpux_indicators = [
            "/usr/sbin/swagentd",
            "/usr/sbin/swagentctl",
            "/usr/sbin/swinstall",
            "/usr/sbin/swlist",
        ]
        for path in hpux_indicators:
            if os.path.exists(path):
                return True

        return False

    def list_installed(self) -> List[Dict[str, str]]:
        """List all installed packages/bundles.

        Returns:
            List of dicts with 'name', 'version', and 'status' keys.
        """
        # List all installed products/bundles
        rc, out = self._run_cmd(
            [self.swlist_cmd, "-l", "product", "-d", "-a", "revision", "-a", "title"],
            timeout=120,
        )
        if rc != 0:
            logger.warning("Failed to list installed products: %s", out)
            # Fallback to simple listing
            rc, out = self._run_cmd([self.swlist_cmd], timeout=60)
            if rc != 0:
                return []

        packages = []
        current_product = None

        for line in out.strip().splitlines():
            line = line.strip()
            if not line:
                continue

            # Parse swlist output format
            # Format: bundle@version  title
            if "@" in line and not line.startswith(" ") and ":" not in line:
                parts = line.split()
                if len(parts) >= 1:
                    product = parts[0]
                    if "@" in product:
                        name = product.split("@")[0]
                        version = product.split("@")[1] if "@" in product else ""
                    else:
                        name = product
                        version = ""

                    # Get title from remaining parts
                    title_parts = parts[1:] if len(parts) > 1 else []
                    title = " ".join(title_parts)

                    packages.append(
                        {
                            "name": name,
                            "version": version,
                            "status": "installed",
                            "title": title,
                        }
                    )

        return packages

    def list_upgradable(self) -> List[Dict[str, str]]:
        """List packages/bundles with available updates.

        Returns:
            List of dicts with 'name', 'current_version', and 'available_version'.
        """
        # Refresh software depot
        self.refresh()

        # Check for updates
        rc, out = self._run_cmd(
            [self.swlist_cmd, "-x", "update_available=true", "-l", "product"],
            timeout=120,
        )

        if rc != 0:
            logger.warning("Failed to list upgradable products: %s", out)
            return []

        packages = []
        for line in out.strip().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "update" not in line.lower():
                continue

            # Parse update available output
            parts = line.split()
            if len(parts) >= 2:
                product = parts[0]
                if "@" in product:
                    name = product.split("@")[0]
                    current = product.split("@")[1] if "@" in product else ""
                else:
                    name = product
                    current = ""

                # Available version might be in subsequent lines
                available = self._get_available_version(name)

                packages.append(
                    {
                        "name": name,
                        "current_version": current,
                        "available_version": available,
                    }
                )

        return packages

    def _get_available_version(self, product: str) -> str:
        """Get available version for a product."""
        rc, out = self._run_cmd(
            [self.swlist_cmd, "-l", "product", "-a", "revision", product], timeout=30
        )
        if rc == 0:
            for line in out.splitlines():
                if "@" in line:
                    return line.split("@")[1].strip() if "@" in line else ""
        return "unknown"

    def refresh(self) -> Tuple[int, str]:
        """Refresh the software depot catalog.

        Returns:
            Tuple of (return_code, message).
        """
        logger.info("Refreshing HP-UX software catalog...")

        # Try to scan depots
        rc1, out1 = self._run_cmd([self.swagentctl_cmd, "-r"], timeout=120)

        if rc1 != 0:
            # Try alternative refresh method
            rc2, out2 = self._run_cmd(
                [self.swlist_cmd, "-s", ""],  # Scan default depots
                timeout=120,
            )
            if rc2 != 0:
                logger.warning("Failed to refresh software catalog: %s", out2)
                return rc2, out2
            return rc2, out2

        return rc1, out1

    def install(
        self,
        packages: List[str],
        local: bool = False,
        security_only: bool = False,
        exclude_kernel: bool = False,
        extra_flags: Optional[List[str]] = None,
    ) -> Tuple[int, str]:
        """Install packages/bundles.

        Args:
            packages: List of package/bundle names to install.
            local: If True, install from local depot.
            security_only: If True, install only security patches.
            exclude_kernel: If True, exclude kernel patches.
            extra_flags: Additional flags to pass to swinstall.

        Returns:
            Tuple of (return_code, output).
        """
        if not packages:
            return 0, "No packages specified"

        # Filter kernel patches if requested
        if exclude_kernel:
            packages = [p for p in packages if not self._is_kernel_patch(p)]

        if not packages:
            return 0, "All packages filtered out"

        results = []
        for pkg in packages:
            # Build swinstall command
            cmd = [
                self.swinstall_cmd,
                "-v",  # Verbose
                "-x",
                "autoreboot=false",
                "-x",
                "verbose=0",
            ]

            if extra_flags:
                cmd.extend(extra_flags)

            if local:
                cmd.extend(["-s", "/"])  # Local depot

            cmd.append(pkg)

            rc, out = self._run_cmd(cmd, timeout=3600)
            results.append((rc, out))

            if rc != 0:
                logger.warning("Failed to install %s: %s", pkg, out)

        # Return first failure or last success
        for rc, out in results:
            if rc != 0:
                return rc, out

        return results[-1] if results else (0, "Success")

    def _is_kernel_patch(self, patch_name: str) -> bool:
        """Check if a patch is a kernel patch."""
        kernel_patterns = [
            "kernel",
            "unix",
            "core",
            "VM",
            "proc",
            "sched",
        ]
        patch_lower = patch_name.lower()
        return any(pattern.lower() in patch_lower for pattern in kernel_patterns)

    def remove(self, packages: List[str]) -> Tuple[int, str]:
        """Remove (uninstall) packages/bundles.

        Args:
            packages: List of package/bundle names to remove.

        Returns:
            Tuple of (return_code, output).
        """
        if not packages:
            return 0, "No packages specified"

        results = []
        for pkg in packages:
            cmd = [
                self.swremove_cmd,
                "-v",  # Verbose
                "-x",
                "autoreboot=false",
            ]
            cmd.append(pkg)

            rc, out = self._run_cmd(cmd, timeout=1800)
            results.append((rc, out))

            if rc != 0:
                logger.warning("Failed to remove %s: %s", pkg, out)

        for rc, out in results:
            if rc != 0:
                return rc, out

        return results[-1] if results else (0, "Success")

    def check_reboot(self) -> bool:
        """Check if a system reboot is required.

        Returns:
            True if reboot is required, False otherwise.
        """
        # Check for reboot indicator files
        reboot_files = [
            "/var/adm/reboot needed",
            "/tmp/reboot-required",
        ]

        for f in reboot_files:
            if os.path.exists(f):
                return True

        # Check with swagentctl
        rc, out = self._run_cmd([self.swagentctl_cmd, "-l"], timeout=30)
        if rc == 0 and "reboot" in out.lower():
            return True

        # Check for patch install that requires reboot
        # HP-UX patches often require reboot after kernel patches
        reboot_indicators = ["/var/adm/sw/save/PATCH/REBOOT_REQUIRED"]

        for f in reboot_indicators:
            if os.path.exists(f):
                return True

        return False

    def list_patches(self, product: Optional[str] = None) -> List[Dict[str, str]]:
        """List patches for a product.

        Args:
            product: Optional product name to filter patches.

        Returns:
            List of patches with name, version, and description.
        """
        cmd = [self.swlist_cmd, "-l", "patch"]
        if product:
            cmd.extend(["-p", product])

        rc, out = self._run_cmd(cmd, timeout=120)
        if rc != 0:
            logger.warning("Failed to list patches: %s", out)
            return []

        patches = []
        for line in out.strip().splitlines():
            line = line.strip()
            if not line or "@" not in line:
                continue

            parts = line.split()
            if len(parts) >= 1:
                patch_id = parts[0]
                if "@" in patch_id:
                    name = patch_id.split("@")[0]
                    version = patch_id.split("@")[1]
                else:
                    name = patch_id
                    version = ""

                patches.append({"name": name, "version": version, "type": "patch"})

        return patches

    def version(self) -> str:
        """Get HP-UX version information.

        Returns:
            HP-UX version string.
        """
        rc, out = self._run_cmd(["uname", "-a"], timeout=10)
        if rc == 0:
            return out.strip()
        return "unknown"

    def get_current_version(self, product: str) -> str:
        """Get current version of a product.

        Args:
            product: Product name.

        Returns:
            Current version string.
        """
        rc, out = self._run_cmd(
            [self.swlist_cmd, "-l", "product", "-a", "revision", product],
            timeout=30,
        )
        if rc == 0:
            for line in out.splitlines():
                if "@" in line:
                    parts = line.split("@")
                    if len(parts) >= 2:
                        return parts[1].strip()
        return "unknown"

    def parse_version(self, version_string: str) -> Tuple[str, str, str]:
        """Parse version string into components.

        Args:
            version_string: Version string (e.g., "B.11.31").

        Returns:
            Tuple of (major, minor, patch).
        """
        parts = version_string.split(".")
        major = parts[0] if len(parts) > 0 else ""
        minor = parts[1] if len(parts) > 1 else ""
        patch = parts[2] if len(parts) > 2 else ""
        return major, minor, patch

    def get_update_info(self, product: str) -> Dict[str, str]:
        """Get detailed update information for a product.

        Args:
            product: Product name.

        Returns:
            Dict with update information.
        """
        info = {
            "name": product,
            "current_version": "",
            "available_version": "",
            "publisher": "",
            "update_available": False,
        }

        # Get current version
        info["current_version"] = self.get_current_version(product)

        # Get available version
        rc, out = self._run_cmd(
            [self.swlist_cmd, "-x", "update_available=true", "-l", "product", product],
            timeout=60,
        )

        if rc == 0:
            for line in out.splitlines():
                if product in line and "update" in line.lower():
                    # Try to extract available version
                    parts = line.split()
                    if len(parts) >= 2:
                        info["available_version"] = parts[-1]

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
        if not packages:
            return True, [], "No packages specified"

        os.makedirs(output_dir, exist_ok=True)

        downloaded = []
        errors = []

        proxies = self.get_proxies()

        for pkg in packages:
            try:
                # HP-UX uses depot files - try to copy from configured depots
                # First check if package exists in any depot
                rc, out = self._run_cmd(
                    [self.swlist_cmd, "-l", "product", "-s", pkg], timeout=60
                )

                if rc != 0:
                    # Try to find package in default depots
                    rc, out = self._run_cmd([self.swlist_cmd, "-s", "*"], timeout=60)

                # For HP-UX, we may need to use swcopy or fetch from depot
                # This is a simplified implementation
                logger.info(f"Attempting to stage package {pkg} for download")
                errors.append(f"HP-UX download requires depot configuration for {pkg}")
            except Exception as e:
                errors.append(f"Error downloading {pkg}: {e}")

        if errors:
            return False, downloaded, "; ".join(errors)
        return True, downloaded, "Success"


# Standalone detection function
def get_hpux_manager() -> Optional[HPUXManager]:
    """Get a HPUXManager if this is an HP-UX system.

    Returns:
        HPUXManager instance if on HP-UX, None otherwise.
    """
    manager = HPUXManager()
    if manager.is_hpux():
        return manager
    return None


# Module-level check
if __name__ == "__main__":
    manager = HPUXManager()
    if manager.is_hpux():
        print(f"HP-UX detected")
        installed = manager.list_installed()
        print(f"Found {len(installed)} installed products")
    else:
        print("Not an HP-UX system")
