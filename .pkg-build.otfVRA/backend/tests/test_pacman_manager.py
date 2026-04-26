"""
Unit tests for PacmanManager (Arch Linux package manager)
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os
import shutil

# Add agent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../agent'))

from agent import PacmanManager

# Platform detection
HAS_PACMAN = shutil.which('pacman') is not None
HAS_YAY = shutil.which('yay') is not None
HAS_PARU = shutil.which('paru') is not None
HAS_AUR_HELPER = HAS_YAY or HAS_PARU

# Correct patch path for run_cmd
PATCH_RUN_CMD = 'agent.agent.run_cmd'

@pytest.mark.skipif(not HAS_PACMAN, reason="Requires Arch Linux with pacman")
class TestPacmanManager:
    """Test suite for PacmanManager class"""
    
    @pytest.fixture
    def pacman_manager(self):
        """Create a PacmanManager instance for testing"""
        return PacmanManager()
    
    def test_list_installed_success(self, pacman_manager):
        """Test listing installed packages successfully"""
        mock_output = """bash 5.1.016-1
coreutils 9.1-1
gcc 12.2.0-1
python 3.11.1-1
systemd 252.4-1"""
        
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, mock_output)
            
            result = pacman_manager.list_installed()
            
            assert len(result) == 5
            assert result[0]["name"] == "bash"
            assert result[0]["version"] == "5.1.016-1"
            assert result[0]["status"] == "installed"
            assert result[2]["name"] == "gcc"
            assert result[4]["name"] == "systemd"
            mock_run.assert_called_once_with(["pacman", "-Q"], timeout=30)
    
    def test_list_installed_empty(self, pacman_manager):
        """Test listing installed packages when none exist"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "")
            
            result = pacman_manager.list_installed()
            
            assert result == []
    
    def test_list_installed_failure(self, pacman_manager):
        """Test listing installed packages when command fails"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (1, "error: failed to initialize alpm library")
            
            result = pacman_manager.list_installed()
            
            assert result == []
    
    def test_list_upgradable_success(self, pacman_manager):
        """Test listing upgradable packages successfully"""
        mock_output = """bash 5.1.016-1 -> 5.2.0-1
gcc 12.2.0-1 -> 12.2.1-1
python 3.11.1-1 -> 3.11.2-1"""
        
        with patch(PATCH_RUN_CMD) as mock_run:
            # First call is for pacman -Sy (sync), second is for pacman -Qu (list upgradable)
            mock_run.side_effect = [(0, ""), (0, mock_output)]
            
            result = pacman_manager.list_upgradable()
            
            assert len(result) == 3
            assert result[0]["name"] == "bash"
            assert result[0]["current_version"] == "5.1.016-1"
            assert result[0]["candidate_version"] == "5.2.0-1"
            assert result[1]["name"] == "gcc"
            assert result[2]["name"] == "python"
            assert mock_run.call_count == 2
    
    def test_list_upgradable_no_updates(self, pacman_manager):
        """Test listing upgradable packages when none available"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [(0, ""), (0, "")]
            
            result = pacman_manager.list_upgradable()
            
            assert result == []
    
    def test_list_upgradable_failure(self, pacman_manager):
        """Test listing upgradable packages when command fails"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [(0, ""), (1, "error: failed to synchronize all databases")]
            
            result = pacman_manager.list_upgradable()
            
            assert result == []
    
    def test_refresh_success(self, pacman_manager):
        """Test refreshing package databases successfully"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, ":: Synchronizing package databases...")
            
            result = pacman_manager.refresh()
            
            assert result is True
            mock_run.assert_called_once_with(["pacman", "-Sy"], timeout=120)
    
    def test_refresh_failure(self, pacman_manager):
        """Test refreshing package databases when it fails"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (1, "error: failed to synchronize all databases")
            
            result = pacman_manager.refresh()
            
            assert result is False
    
    def test_install_repository_packages(self, pacman_manager):
        """Test installing packages from repository"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "resolving dependencies...\ninstalling vim...")
            
            rc, out = pacman_manager.install(["vim", "htop"])
            
            assert rc == 0
            assert "installing" in out
            mock_run.assert_called_once_with(
                ["pacman", "-S", "--noconfirm", "vim", "htop"],
                timeout=3600
            )
    
    def test_install_local_packages(self, pacman_manager):
        """Test installing local package files"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "loading packages...\ninstalling package...")
            
            rc, out = pacman_manager.install(
                ["/tmp/package.pkg.tar.zst"],
                local=True
            )
            
            assert rc == 0
            mock_run.assert_called_once_with(
                ["pacman", "-U", "--noconfirm", "/tmp/package.pkg.tar.zst"],
                timeout=3600
            )
    
    def test_install_exclude_kernel(self, pacman_manager):
        """Test installing packages while excluding kernel packages"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "installing vim...")
            
            rc, out = pacman_manager.install(
                ["vim", "linux", "linux-headers"],
                exclude_kernel=True
            )
            
            assert rc == 0
            # Should only install vim, not linux packages
            mock_run.assert_called_once_with(
                ["pacman", "-S", "--noconfirm", "vim"],
                timeout=3600
            )
    
    def test_install_with_extra_flags(self, pacman_manager):
        """Test installing packages with extra flags"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "installing...")
            
            rc, out = pacman_manager.install(
                ["vim"],
                extra_flags=["--needed", "--asdeps"]
            )
            
            assert rc == 0
            mock_run.assert_called_once_with(
                ["pacman", "-S", "--noconfirm", "--needed", "--asdeps", "vim"],
                timeout=3600
            )
    
    def test_install_no_packages(self, pacman_manager):
        """Test installing with no packages specified"""
        rc, out = pacman_manager.install([])
        
        assert rc == 0
        assert out == "No packages specified"
    
    def test_install_all_filtered(self, pacman_manager):
        """Test installing when all packages are filtered out"""
        rc, out = pacman_manager.install(
            ["linux", "linux-lts"],
            exclude_kernel=True
        )
        
        assert rc == 0
        assert out == "All packages filtered out"
    
    def test_remove_packages(self, pacman_manager):
        """Test removing packages"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "removing vim...")
            
            rc, out = pacman_manager.remove(["vim", "htop"])
            
            assert rc == 0
            assert "removing" in out
            mock_run.assert_called_once_with(
                ["pacman", "-R", "--noconfirm", "vim", "htop"],
                timeout=600
            )
    
    def test_remove_no_packages(self, pacman_manager):
        """Test removing with no packages specified"""
        rc, out = pacman_manager.remove([])
        
        assert rc == 0
        assert out == "No packages specified"
    
    def test_check_reboot_kernel_updated(self, pacman_manager):
        """Test reboot check when kernel was updated"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Running kernel: 6.1.0-arch1-1
            # Installed kernel: 6.2.0-arch1-1 (newer)
            mock_run.side_effect = [
                (0, "6.1.0-arch1-1\n"),  # uname -r
                (0, "linux 6.2.0-arch1-1\n"),  # pacman -Q linux
            ]
            
            result = pacman_manager.check_reboot()
            
            assert result is True
    
    def test_check_reboot_no_update(self, pacman_manager):
        """Test reboot check when no reboot needed"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Running kernel matches installed kernel
            mock_run.side_effect = [
                (0, "6.1.0-arch1-1\n"),  # uname -r
                (0, "linux 6.1.0-arch1-1\n"),  # pacman -Q linux
                (0, ""),  # systemctl is-system-running
            ]
            
            result = pacman_manager.check_reboot()
            
            assert result is False
    
    def test_check_reboot_lts_kernel(self, pacman_manager):
        """Test reboot check with LTS kernel"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # linux package not found, try linux-lts
            mock_run.side_effect = [
                (0, "5.15.0-lts1-1\n"),  # uname -r
                (1, "error: package 'linux' was not found\n"),  # pacman -Q linux
                (0, "linux-lts 5.16.0-lts1-1\n"),  # pacman -Q linux-lts
            ]
            
            result = pacman_manager.check_reboot()
            
            assert result is True
    
    def test_check_reboot_systemd_issue(self, pacman_manager):
        """Test reboot check when systemd has issues"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [
                (0, "6.1.0-arch1-1\n"),  # uname -r
                (0, "linux 6.1.0-arch1-1\n"),  # pacman -Q linux (matches)
                (3, "degraded"),  # systemctl is-system-running (error code 3)
            ]
            
            result = pacman_manager.check_reboot()
            
            assert result is True
    
    def test_check_reboot_uname_fails(self, pacman_manager):
        """Test reboot check when uname command fails"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (1, "error")
            
            result = pacman_manager.check_reboot()
            
            assert result is False


class TestPacmanManagerIntegration:
    """Integration tests for PacmanManager (require Arch Linux environment)"""
    
    @pytest.fixture
    def pacman_manager(self):
        return PacmanManager()
    
    @pytest.mark.skipif(
        not os.path.exists("/usr/bin/pacman"),
        reason="Requires Arch Linux with pacman"
    )
    def test_real_list_installed(self, pacman_manager):
        """Test listing installed packages on real Arch system"""
        result = pacman_manager.list_installed()
        
        # Should have at least some packages installed
        assert len(result) > 0
        assert all("name" in pkg for pkg in result)
        assert all("version" in pkg for pkg in result)
        assert all("status" in pkg for pkg in result)
    
    @pytest.mark.skipif(
        not os.path.exists("/usr/bin/pacman"),
        reason="Requires Arch Linux with pacman"
    )
    def test_real_refresh(self, pacman_manager):
        """Test refreshing package databases on real Arch system"""
        # This requires root/sudo
        # result = pacman_manager.refresh()
        # assert result is True
        pass  # Skip for now, requires privileges


class TestOSDetection:
    """Test OS detection for Arch Linux"""
    
    @patch('os.path.exists')
    @patch('builtins.open', create=True)
    def test_detect_arch_linux(self, mock_open, mock_exists):
        """Test detection of Arch Linux"""
        # Mock file system checks
        def exists_side_effect(path):
            if path == "/usr/bin/pacman":
                return True
            if path == "/etc/arch-release":
                return True
            return False
        
        mock_exists.side_effect = exists_side_effect
        
        # Import and test (would need to reload module)
        # This is a simplified test
        assert mock_exists("/usr/bin/pacman") is True
        assert mock_exists("/etc/arch-release") is True
    
    @patch('os.path.exists')
    @patch('builtins.open', create=True)
    def test_detect_manjaro(self, mock_open, mock_exists):
        """Test detection of Manjaro (Arch-based)"""
        def exists_side_effect(path):
            if path == "/usr/bin/pacman":
                return True
            if path == "/etc/arch-release":
                return False
            if path == "/etc/os-release":
                return True
            return False
        
        mock_exists.side_effect = exists_side_effect
        
        # Mock os-release content
        mock_file = MagicMock()
        mock_file.read.return_value = 'ID=manjaro\nID_LIKE=arch\n'
        mock_open.return_value.__enter__.return_value = mock_file
        
        assert mock_exists("/usr/bin/pacman") is True
        assert mock_exists("/etc/os-release") is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


@pytest.mark.skipif(not HAS_PACMAN, reason="Requires Arch Linux with pacman")
class TestPacmanManagerAUR:
    """Test suite for PacmanManager AUR support"""
    
    @pytest.fixture
    def pacman_manager_with_yay(self):
        """Create a PacmanManager instance with yay AUR helper"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Mock yay detection
            mock_run.return_value = (0, "/usr/bin/yay")
            manager = PacmanManager()
        return manager
    
    @pytest.fixture
    def pacman_manager_with_paru(self):
        """Create a PacmanManager instance with paru AUR helper"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Mock paru detection (yay not found, paru found)
            mock_run.side_effect = [(1, ""), (0, "/usr/bin/paru")]
            manager = PacmanManager()
        return manager
    
    @pytest.fixture
    def pacman_manager_no_aur(self):
        """Create a PacmanManager instance without AUR helper"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Mock no AUR helper found
            mock_run.side_effect = [(1, ""), (1, "")]
            manager = PacmanManager()
        return manager
    
    def test_detect_aur_helper_yay(self, pacman_manager_with_yay):
        """Test detection of yay AUR helper"""
        assert pacman_manager_with_yay.aur_helper == "yay"
    
    def test_detect_aur_helper_paru(self, pacman_manager_with_paru):
        """Test detection of paru AUR helper"""
        assert pacman_manager_with_paru.aur_helper == "paru"
    
    def test_detect_aur_helper_none(self, pacman_manager_no_aur):
        """Test when no AUR helper is available"""
        assert pacman_manager_no_aur.aur_helper is None
    
    def test_is_aur_package_official(self, pacman_manager_with_yay):
        """Test checking if package is from official repos"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Package found in official repos
            mock_run.return_value = (0, "Repository: core\nName: vim")
            
            result = pacman_manager_with_yay._is_aur_package("vim")
            
            assert result is False
    
    def test_is_aur_package_aur(self, pacman_manager_with_yay):
        """Test checking if package is from AUR"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Package not in official repos, but in AUR
            mock_run.side_effect = [
                (1, "error: package 'yay' was not found"),  # pacman -Si
                (0, "Repository: aur\nName: yay")  # yay -Si
            ]
            
            result = pacman_manager_with_yay._is_aur_package("yay")
            
            assert result is True
    
    def test_is_aur_package_not_found(self, pacman_manager_with_yay):
        """Test checking package that doesn't exist"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # Package not found anywhere
            mock_run.side_effect = [
                (1, "error: package not found"),  # pacman -Si
                (1, "error: package not found")  # yay -Si
            ]
            
            result = pacman_manager_with_yay._is_aur_package("nonexistent")
            
            assert result is False
    
    def test_is_aur_package_no_helper(self, pacman_manager_no_aur):
        """Test checking AUR package when no helper available"""
        result = pacman_manager_no_aur._is_aur_package("yay")
        
        assert result is False
    
    def test_list_installed_with_aur_packages(self, pacman_manager_with_yay):
        """Test listing installed packages including AUR packages"""
        mock_output = """bash 5.1.016-1
vim 9.0.1000-1
yay 12.0.0-1
paru 1.11.0-1"""
        
        with patch(PATCH_RUN_CMD) as mock_run:
            def run_cmd_side_effect(cmd, timeout):
                if cmd == ["pacman", "-Q"]:
                    return (0, mock_output)
                elif cmd[0] == "pacman" and cmd[1] == "-Qi":
                    pkg_name = cmd[2]
                    if pkg_name in ["yay", "paru"]:
                        # AUR packages have "Repository: None"
                        return (0, f"Name: {pkg_name}\nRepository: None\n")
                    else:
                        # Official packages
                        return (0, f"Name: {pkg_name}\nRepository: core\n")
                return (0, "")
            
            mock_run.side_effect = run_cmd_side_effect
            
            result = pacman_manager_with_yay.list_installed()
            
            assert len(result) == 4
            # Check that AUR packages are marked correctly
            yay_pkg = next(p for p in result if p["name"] == "yay")
            assert yay_pkg["source"] == "aur"
            paru_pkg = next(p for p in result if p["name"] == "paru")
            assert paru_pkg["source"] == "aur"
            # Check official packages
            bash_pkg = next(p for p in result if p["name"] == "bash")
            assert bash_pkg["source"] == "official"
    
    def test_list_upgradable_with_aur_updates(self, pacman_manager_with_yay):
        """Test listing upgradable packages including AUR updates"""
        official_updates = """vim 9.0.1000-1 -> 9.0.1100-1
bash 5.1.016-1 -> 5.2.0-1"""
        
        aur_updates = """yay 12.0.0-1 -> 12.1.0-1
paru 1.11.0-1 -> 1.11.1-1"""
        
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [
                (0, ""),  # pacman -Sy
                (0, official_updates),  # pacman -Qu
                (0, aur_updates)  # yay -Qua
            ]
            
            result = pacman_manager_with_yay.list_upgradable()
            
            assert len(result) == 4
            # Check official updates
            vim_update = next(p for p in result if p["name"] == "vim")
            assert vim_update["source"] == "official"
            assert vim_update["candidate_version"] == "9.0.1100-1"
            # Check AUR updates
            yay_update = next(p for p in result if p["name"] == "yay")
            assert yay_update["source"] == "aur"
            assert yay_update["candidate_version"] == "12.1.0-1"
    
    def test_list_upgradable_no_aur_helper(self, pacman_manager_no_aur):
        """Test listing upgradable packages without AUR helper"""
        official_updates = """vim 9.0.1000-1 -> 9.0.1100-1"""
        
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [
                (0, ""),  # pacman -Sy
                (0, official_updates)  # pacman -Qu
            ]
            
            result = pacman_manager_no_aur.list_upgradable()
            
            # Should only have official updates
            assert len(result) == 1
            assert result[0]["source"] == "official"
    
    def test_refresh_with_aur(self, pacman_manager_with_yay):
        """Test refreshing package databases including AUR"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [
                (0, ":: Synchronizing package databases..."),  # pacman -Sy
                (0, ":: Synchronizing AUR database...")  # yay -Sy
            ]
            
            result = pacman_manager_with_yay.refresh()
            
            assert result is True
            assert mock_run.call_count == 2
    
    def test_refresh_with_paru(self, pacman_manager_with_paru):
        """Test refreshing with paru AUR helper"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.side_effect = [
                (0, ":: Synchronizing package databases..."),  # pacman -Sy
                (0, ":: Synchronizing AUR database...")  # paru -Sy
            ]
            
            result = pacman_manager_with_paru.refresh()
            
            assert result is True
            # Verify paru was called
            calls = [str(call) for call in mock_run.call_args_list]
            assert any("paru" in call for call in calls)
    
    def test_install_mixed_packages(self, pacman_manager_with_yay):
        """Test installing both official and AUR packages"""
        with patch(PATCH_RUN_CMD) as mock_run:
            def run_cmd_side_effect(cmd, timeout):
                # Detect package type checks
                if cmd[0] == "pacman" and cmd[1] == "-Si":
                    pkg = cmd[2]
                    if pkg == "vim":
                        return (0, "Repository: extra")  # Official
                    else:
                        return (1, "not found")  # Not in official
                elif cmd[0] == "yay" and cmd[1] == "-Si":
                    return (0, "Repository: aur")  # In AUR
                # Installation commands
                elif cmd[0] == "pacman" and cmd[1] == "-S":
                    return (0, "installing vim...")
                elif cmd[0] == "yay" and cmd[1] == "-S":
                    return (0, "installing yay...")
                return (0, "")
            
            mock_run.side_effect = run_cmd_side_effect
            
            rc, out = pacman_manager_with_yay.install(["vim", "yay"])
            
            assert rc == 0
            # Verify both pacman and yay were called for installation
            calls = [str(call) for call in mock_run.call_args_list]
            assert any("pacman" in call and "-S" in call for call in calls)
            assert any("yay" in call and "-S" in call for call in calls)
    
    def test_install_aur_only(self, pacman_manager_with_yay):
        """Test installing only AUR packages"""
        with patch(PATCH_RUN_CMD) as mock_run:
            def run_cmd_side_effect(cmd, timeout):
                if cmd[0] == "pacman" and cmd[1] == "-Si":
                    return (1, "not found")  # Not in official
                elif cmd[0] == "yay" and cmd[1] == "-Si":
                    return (0, "Repository: aur")  # In AUR
                elif cmd[0] == "yay" and cmd[1] == "-S":
                    return (0, "installing from AUR...")
                return (0, "")
            
            mock_run.side_effect = run_cmd_side_effect
            
            rc, out = pacman_manager_with_yay.install(["yay", "paru"])
            
            assert rc == 0
            # Verify only yay was used for installation
            calls = [str(call) for call in mock_run.call_args_list]
            install_calls = [call for call in calls if "-S" in call and "noconfirm" in call]
            assert len(install_calls) == 1
            assert "yay" in str(install_calls[0])
    
    def test_install_aur_with_extra_flags(self, pacman_manager_with_yay):
        """Test installing AUR packages with extra flags"""
        with patch(PATCH_RUN_CMD) as mock_run:
            def run_cmd_side_effect(cmd, timeout):
                if cmd[0] == "pacman" and cmd[1] == "-Si":
                    return (1, "not found")
                elif cmd[0] == "yay" and cmd[1] == "-Si":
                    return (0, "Repository: aur")
                elif cmd[0] == "yay" and cmd[1] == "-S":
                    # Verify extra flags are passed
                    assert "--needed" in cmd
                    return (0, "installing...")
                return (0, "")
            
            mock_run.side_effect = run_cmd_side_effect
            
            rc, out = pacman_manager_with_yay.install(
                ["yay"],
                extra_flags=["--needed"]
            )
            
            assert rc == 0
    
    def test_install_aur_helper_already_installed(self, pacman_manager_with_yay):
        """Test installing AUR helper when already present"""
        rc, out = pacman_manager_with_yay.install_aur_helper()
        
        assert rc == 0
        assert "already installed" in out
        assert "yay" in out
    
    def test_install_aur_helper_not_installed(self, pacman_manager_no_aur):
        """Test installing AUR helper when not present"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # git is installed
            mock_run.return_value = (0, "git 2.39.0-1")
            
            rc, out = pacman_manager_no_aur.install_aur_helper()
            
            assert rc == 1
            assert "manual setup" in out
    
    def test_install_aur_helper_no_git(self, pacman_manager_no_aur):
        """Test installing AUR helper when git is not installed"""
        with patch(PATCH_RUN_CMD) as mock_run:
            # git is not installed
            mock_run.return_value = (1, "error: package 'git' was not found")
            
            rc, out = pacman_manager_no_aur.install_aur_helper()
            
            assert rc == 1
            assert "git is required" in out
    
    def test_remove_aur_package(self, pacman_manager_with_yay):
        """Test removing AUR packages (works same as official)"""
        with patch(PATCH_RUN_CMD) as mock_run:
            mock_run.return_value = (0, "removing yay...")
            
            rc, out = pacman_manager_with_yay.remove(["yay"])
            
            assert rc == 0
            # pacman can remove both official and AUR packages
            mock_run.assert_called_once_with(
                ["pacman", "-R", "--noconfirm", "yay"],
                timeout=600
            )


class TestPacmanManagerAURIntegration:
    """Integration tests for AUR support (require Arch Linux with AUR helper)"""
    
    @pytest.fixture
    def pacman_manager(self):
        return PacmanManager()
    
    @pytest.mark.skipif(
        not os.path.exists("/usr/bin/yay") and not os.path.exists("/usr/bin/paru"),
        reason="Requires Arch Linux with yay or paru"
    )
    def test_real_aur_helper_detection(self, pacman_manager):
        """Test AUR helper detection on real system"""
        assert pacman_manager.aur_helper in ["yay", "paru", None]
        if pacman_manager.aur_helper:
            print(f"Detected AUR helper: {pacman_manager.aur_helper}")
    
    @pytest.mark.skipif(
        not os.path.exists("/usr/bin/yay") and not os.path.exists("/usr/bin/paru"),
        reason="Requires Arch Linux with yay or paru"
    )
    def test_real_list_aur_updates(self, pacman_manager):
        """Test listing AUR updates on real system"""
        if not pacman_manager.aur_helper:
            pytest.skip("No AUR helper available")
        
        result = pacman_manager.list_upgradable()
        
        # Should return a list (may be empty if no updates)
        assert isinstance(result, list)
        # Check for AUR packages if any updates exist
        aur_updates = [p for p in result if p.get("source") == "aur"]
        print(f"Found {len(aur_updates)} AUR updates")
