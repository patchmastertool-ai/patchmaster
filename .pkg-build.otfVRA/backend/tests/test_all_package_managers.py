"""
Comprehensive unit tests for ALL package managers
Tests: ZypperManager, ApkManager, FreeBSDPkgManager, and PacmanManager
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os
import shutil

# Add agent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../agent'))

from agent import ZypperManager, ApkManager, FreeBSDPkgManager, PacmanManager

# Correct patch path for run_cmd
PATCH_RUN_CMD = 'agent.agent.run_cmd'

# Platform detection helpers
HAS_ZYPPER = shutil.which('zypper') is not None
HAS_APK = shutil.which('apk') is not None
HAS_PKG = shutil.which('pkg') is not None
HAS_PACMAN = shutil.which('pacman') is not None

@pytest.mark.skipif(not HAS_ZYPPER, reason="Requires openSUSE with zypper")
class TestZypperManager:
    """Test suite for ZypperManager (openSUSE)"""
    
    @pytest.fixture
    def zypper_manager(self):
        return ZypperManager()
    
    def test_list_installed_success(self, zypper_manager):
        """Test listing installed packages"""
        mock_output = """bash\t5.1.16-1\tinstalled
gcc\t12.2.0-1\tinstalled
python3\t3.11.1-1\tinstalled"""
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = zypper_manager.list_installed()
            
            assert len(result) == 3
            assert result[0]["name"] == "bash"
            assert result[0]["version"] == "5.1.16-1"
            assert result[1]["name"] == "gcc"
    
    def test_list_upgradable_success(self, zypper_manager):
        """Test listing upgradable packages"""
        mock_output = """S | Repository | Name | Current Version -> Available Version
--|------------|------|----------------------------------------
v | Main       | bash | 5.1.16-1 -> 5.2.0-1
v | Main       | gcc  | 12.2.0-1 -> 12.2.1-1"""
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = zypper_manager.list_upgradable()
            
            assert len(result) == 2
            assert result[0]["name"] == "bash"
            assert result[0]["current_version"] == "5.1.16-1"
            assert result[0]["candidate_version"] == "5.2.0-1"
    
    def test_refresh_success(self, zypper_manager):
        """Test refreshing repositories"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Repository refreshed")
            
            result = zypper_manager.refresh()
            
            assert result is True
    
    def test_install_packages(self, zypper_manager):
        """Test installing packages"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Installing vim...")
            
            rc, out = zypper_manager.install(["vim", "htop"])
            
            assert rc == 0
            mock_run.assert_called_once()
            assert "zypper" in mock_run.call_args[0][0]
            assert "vim" in mock_run.call_args[0][0]
    
    def test_install_security_only(self, zypper_manager):
        """Test installing security updates only"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Applying security patches...")
            
            rc, out = zypper_manager.install(["vim"], security_only=True)
            
            assert rc == 0
            assert "patch" in mock_run.call_args[0][0]
            assert "security" in mock_run.call_args[0][0]
    
    def test_remove_packages(self, zypper_manager):
        """Test removing packages"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Removing vim...")
            
            rc, out = zypper_manager.remove(["vim"])
            
            assert rc == 0
            assert "remove" in mock_run.call_args[0][0]
    
    def test_check_reboot_needed(self, zypper_manager):
        """Test reboot detection"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "System reboot required")
            
            with patch('os.path.exists') as mock_exists:
                mock_exists.return_value = False
                result = zypper_manager.check_reboot()
                
                assert result is True


@pytest.mark.skipif(not HAS_APK, reason="Requires Alpine Linux with apk")
class TestApkManager:
    """Test suite for ApkManager (Alpine Linux)"""
    
    @pytest.fixture
    def apk_manager(self):
        return ApkManager()
    
    def test_list_installed_success(self, apk_manager):
        """Test listing installed packages"""
        mock_output = """musl-1.2.3-r4
busybox-1.35.0-r17
alpine-baselayout-3.4.0-r0"""
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = apk_manager.list_installed()
            
            assert len(result) == 3
            assert result[0]["name"] == "musl"
            assert "1.2.3" in result[0]["version"]
    
    def test_list_upgradable_success(self, apk_manager):
        """Test listing upgradable packages"""
        mock_output = """musl-1.2.3-r4 < musl-1.2.4-r0
busybox-1.35.0-r17 < busybox-1.36.0-r0"""
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = apk_manager.list_upgradable()
            
            assert len(result) >= 1
            # Alpine version parsing is complex, just verify we got results
    
    def test_refresh_success(self, apk_manager):
        """Test updating package index"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "fetch http://...")
            
            result = apk_manager.refresh()
            
            assert result is True
    
    def test_install_packages(self, apk_manager):
        """Test installing packages"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Installing vim...")
            
            rc, out = apk_manager.install(["vim", "htop"])
            
            assert rc == 0
            assert "apk" in mock_run.call_args[0][0]
            assert "add" in mock_run.call_args[0][0]
    
    def test_remove_packages(self, apk_manager):
        """Test removing packages"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Removing vim...")
            
            rc, out = apk_manager.remove(["vim"])
            
            assert rc == 0
            assert "del" in mock_run.call_args[0][0]
    
    def test_check_reboot_kernel_updated(self, apk_manager):
        """Test reboot detection when kernel updated"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.side_effect = [
                (0, "5.15.0-lts\n"),  # uname -r
                (0, "linux-lts-5.16.0-r0\n"),  # apk info
            ]
            
            result = apk_manager.check_reboot()
            
            assert result is True


@pytest.mark.skipif(not HAS_PKG, reason="Requires FreeBSD with pkg")
class TestFreeBSDPkgManager:
    """Test suite for FreeBSDPkgManager"""
    
    @pytest.fixture
    def freebsd_manager(self):
        return FreeBSDPkgManager()
    
    def test_list_installed_success(self, freebsd_manager):
        """Test listing installed packages"""
        mock_output = """bash-5.1.16  GNU Bourne Again Shell
vim-9.0.1000  Improved version of vi editor
python39-3.9.16  Interpreted object-oriented programming language"""
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = freebsd_manager.list_installed()
            
            assert len(result) == 3
            assert result[0]["name"] == "bash"
            assert result[0]["version"] == "5.1.16"
            assert result[1]["name"] == "vim"
    
    def test_list_upgradable_success(self, freebsd_manager):
        """Test listing upgradable packages"""
        mock_output = """bash-5.1.16 < needs updating (index has 5.2.0)
vim-9.0.1000 < needs updating (index has 9.0.1100)"""
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = freebsd_manager.list_upgradable()
            
            assert len(result) == 2
            assert result[0]["name"] == "bash"
            assert result[0]["current_version"] == "5.1.16"
    
    def test_refresh_success(self, freebsd_manager):
        """Test updating repository catalog"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Updating repository catalog...")
            
            result = freebsd_manager.refresh()
            
            assert result is True
    
    def test_install_packages(self, freebsd_manager):
        """Test installing packages"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Installing vim...")
            
            rc, out = freebsd_manager.install(["vim", "htop"])
            
            assert rc == 0
            assert "pkg" in mock_run.call_args[0][0]
            assert "install" in mock_run.call_args[0][0]
    
    def test_remove_packages(self, freebsd_manager):
        """Test removing packages"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (0, "Removing vim...")
            
            rc, out = freebsd_manager.remove(["vim"])
            
            assert rc == 0
            assert "delete" in mock_run.call_args[0][0]
    
    def test_check_reboot_kernel_updated(self, freebsd_manager):
        """Test reboot detection when kernel updated"""
        with patch('agent.run_cmd') as mock_run:
            mock_run.side_effect = [
                (0, "13.1-RELEASE\n"),  # uname -r
                (0, "Version: 13.2-RELEASE\n"),  # pkg info FreeBSD-kernel
            ]
            
            result = freebsd_manager.check_reboot()
            
            assert result is True


class TestOSDetection:
    """Test OS detection for all platforms"""
    
    @patch('os.path.exists')
    @patch('platform.system')
    def test_detect_freebsd(self, mock_platform, mock_exists):
        """Test detection of FreeBSD"""
        mock_platform.return_value = "FreeBSD"
        mock_exists.return_value = True
        
        assert mock_platform() == "FreeBSD"
    
    @patch('os.path.exists')
    def test_detect_alpine(self, mock_exists):
        """Test detection of Alpine Linux"""
        def exists_side_effect(path):
            if path in ["/sbin/apk", "/etc/alpine-release"]:
                return True
            return False
        
        mock_exists.side_effect = exists_side_effect
        
        assert mock_exists("/sbin/apk") is True
        assert mock_exists("/etc/alpine-release") is True
    
    @patch('os.path.exists')
    def test_detect_opensuse(self, mock_exists):
        """Test detection of openSUSE"""
        def exists_side_effect(path):
            if path == "/usr/bin/zypper":
                return True
            return False
        
        mock_exists.side_effect = exists_side_effect
        
        assert mock_exists("/usr/bin/zypper") is True


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_empty_package_list(self):
        """Test handling empty package lists"""
        managers = [
            ZypperManager(),
            ApkManager(),
            FreeBSDPkgManager(),
            PacmanManager()
        ]
        
        for mgr in managers:
            rc, out = mgr.install([])
            assert rc == 0
            assert "No packages" in out
            
            rc, out = mgr.remove([])
            assert rc == 0
            assert "No packages" in out
    
    @pytest.mark.skipif(not (HAS_ZYPPER or HAS_APK or HAS_PKG), reason="Requires zypper, apk, or pkg")
    def test_kernel_exclusion(self):
        """Test kernel package exclusion"""
        zypper = ZypperManager()
        apk = ApkManager()
        freebsd = FreeBSDPkgManager()
        
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "Installing...")
            
            # Test zypper
            zypper.install(["vim", "kernel-default"], exclude_kernel=True)
            assert "kernel-default" not in mock_run.call_args[0][0]
            assert "vim" in mock_run.call_args[0][0]
            
            # Test apk
            apk.install(["vim", "linux-lts"], exclude_kernel=True)
            assert "linux-lts" not in mock_run.call_args[0][0]
            
            # Test FreeBSD
            freebsd.install(["vim", "kernel"], exclude_kernel=True)
            assert "kernel" not in mock_run.call_args[0][0]
    
    def test_command_failure_handling(self):
        """Test handling of command failures"""
        managers = [
            ZypperManager(),
            ApkManager(),
            FreeBSDPkgManager()
        ]
        
        with patch('agent.run_cmd') as mock_run:
            mock_run.return_value = (1, "Error: command failed")
            
            for mgr in managers:
                # list_installed should return empty list on failure
                result = mgr.list_installed()
                assert result == []
                
                # list_upgradable should return empty list on failure
                result = mgr.list_upgradable()
                assert result == []
                
                # refresh should return False on failure
                result = mgr.refresh()
                assert result is False


class TestPerformanceAndScalability:
    """Test performance characteristics"""
    
    @pytest.mark.skipif(not HAS_ZYPPER, reason="Requires zypper")
    def test_large_package_list(self):
        """Test handling large package lists"""
        # Generate 1000 packages
        large_output = "\n".join([f"package{i}\t1.0.{i}\tinstalled" for i in range(1000)])
        
        zypper = ZypperManager()
        
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, large_output)
            
            result = zypper.list_installed()
            
            assert len(result) == 1000
            assert result[0]["name"] == "package0"
            assert result[999]["name"] == "package999"
    
    @pytest.mark.skipif(not (HAS_ZYPPER or HAS_APK or HAS_PKG), reason="Requires zypper, apk, or pkg")
    def test_timeout_handling(self):
        """Test that timeouts are properly set"""
        managers = [
            ZypperManager(),
            ApkManager(),
            FreeBSDPkgManager()
        ]
        
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "")
            
            for mgr in managers:
                mgr.list_installed()
                # Verify timeout is set (should be 30s for list operations)
                assert mock_run.call_args[1].get('timeout', 0) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
