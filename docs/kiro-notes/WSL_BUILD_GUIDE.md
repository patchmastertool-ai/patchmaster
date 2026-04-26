# WSL Multi-Distribution Build Guide

## Your Available WSL Distributions

You have an excellent collection of WSL distributions that cover all major Linux package managers:

### RPM-Based (For RPM/DEB Building)
- ✅ **AlmaLinux-9** - Recommended for RPM builds (modern, stable)
- ✅ **AlmaLinux-10** - Latest AlmaLinux
- ✅ **Fedora Linux 42/43** - Latest Fedora
- ✅ **Oracle Linux 7.9/8.10/9.5** - Enterprise Linux
- ✅ **openSUSE-Leap-15.6/16.0** - Stable openSUSE
- ✅ **openSUSE-Tumbleweed** - Rolling release
- ✅ **SUSE Linux Enterprise** - Enterprise SUSE

### DEB-Based (For DEB Building)
- ✅ **Ubuntu 20.04/22.04/24.04** - Multiple Ubuntu versions
- ✅ **Debian** - Pure Debian

### Arch-Based (For Pacman/AUR Testing)
- ✅ **Arch Linux** - For testing Pacman and AUR support

### Other
- ✅ **Kali Linux** - Debian-based security distro

## Building Real RPM Packages

### Option 1: Use AlmaLinux 9 (Recommended)

AlmaLinux 9 is the best choice - it's modern, stable, and has all the tools needed.

```bash
# Switch to AlmaLinux 9
wsl -d AlmaLinux-9

# Install build tools
sudo dnf install -y rpm-build python3 python3-pip ruby rubygems gcc make

# Install FPM (optional, script has rpmbuild fallback)
sudo gem install fpm

# Navigate to your project
cd /mnt/c/Users/test/Desktop/pat-1

# Run the build
cd scripts
python3 build_release.py
```

### Option 2: Use Fedora 43 (Latest)

Fedora has the newest packages and tools.

```bash
# Switch to Fedora
wsl -d FedoraLinux-43

# Install build tools
sudo dnf install -y rpm-build python3 python3-pip ruby rubygems gcc make

# Install FPM (optional)
sudo gem install fpm

# Navigate and build
cd /mnt/c/Users/test/Desktop/pat-1/scripts
python3 build_release.py
```

### Option 3: Use openSUSE (For Zypper Testing)

```bash
# Switch to openSUSE
wsl -d openSUSE-Leap-15.6

# Install build tools
sudo zypper install -y rpm-build python3 python3-pip ruby ruby-devel gcc make

# Install FPM (optional)
sudo gem install fpm

# Navigate and build
cd /mnt/c/Users/test/Desktop/pat-1/scripts
python3 build_release.py
```

## Building DEB Packages

### Use Ubuntu 24.04 (Recommended)

```bash
# Switch to Ubuntu
wsl -d Ubuntu-24.04

# Install build tools
sudo apt-get update
sudo apt-get install -y dpkg-dev python3 python3-pip ruby ruby-dev build-essential

# Install FPM (optional)
sudo gem install fpm

# Navigate and build
cd /mnt/c/Users/test/Desktop/pat-1/scripts
python3 build_release.py
```

## Testing on Arch Linux

### Test Pacman and AUR Support

```bash
# Switch to Arch Linux
wsl -d archlinux

# Update system
sudo pacman -Syu

# Install yay (AUR helper)
sudo pacman -S --needed git base-devel
cd /tmp
git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si

# Navigate to project
cd /mnt/c/Users/test/Desktop/pat-1

# Run Pacman/AUR tests
cd backend/tests
python3 -m pytest test_pacman_manager.py -v
```

## Complete Build Workflow

### Step 1: Build on AlmaLinux 9 (RPM)

```bash
wsl -d AlmaLinux-9
cd /mnt/c/Users/test/Desktop/pat-1/scripts
python3 build_release.py
```

This will create:
- ✅ Real RPM package (using rpmbuild or FPM)
- ✅ Real DEB package (if dpkg-deb available)
- ✅ Windows agent ZIP
- ✅ Complete product package

### Step 2: Test on Different Distributions

```bash
# Test on Arch Linux
wsl -d archlinux
cd /mnt/c/Users/test/Desktop/pat-1
python3 scripts/run_tests.py

# Test on openSUSE
wsl -d openSUSE-Leap-15.6
cd /mnt/c/Users/test/Desktop/pat-1
python3 scripts/run_tests.py

# Test on Ubuntu
wsl -d Ubuntu-24.04
cd /mnt/c/Users/test/Desktop/pat-1
python3 scripts/run_tests.py
```

## Quick Setup Script

Create a setup script for each distro:

```bash
# Save as setup-build-env.sh
#!/bin/bash

# Detect distro
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
else
    echo "Cannot detect distribution"
    exit 1
fi

case $DISTRO in
    almalinux|rocky|rhel|fedora|ol)
        echo "Setting up RPM-based distro..."
        sudo dnf install -y rpm-build python3 python3-pip ruby rubygems gcc make
        sudo gem install fpm
        ;;
    ubuntu|debian)
        echo "Setting up DEB-based distro..."
        sudo apt-get update
        sudo apt-get install -y dpkg-dev python3 python3-pip ruby ruby-dev build-essential
        sudo gem install fpm
        ;;
    opensuse*|sles)
        echo "Setting up SUSE distro..."
        sudo zypper install -y rpm-build python3 python3-pip ruby ruby-devel gcc make
        sudo gem install fpm
        ;;
    arch)
        echo "Setting up Arch Linux..."
        sudo pacman -Syu --noconfirm
        sudo pacman -S --needed --noconfirm base-devel python python-pip ruby
        sudo gem install fpm
        ;;
    *)
        echo "Unknown distribution: $DISTRO"
        exit 1
        ;;
esac

echo "Build environment ready!"
```

## Recommended Build Strategy

### For Production Builds:

1. **RPM Packages**: Build on AlmaLinux-9
   ```bash
   wsl -d AlmaLinux-9
   cd /mnt/c/Users/test/Desktop/pat-1/scripts
   python3 build_release.py
   ```

2. **DEB Packages**: Build on Ubuntu-24.04
   ```bash
   wsl -d Ubuntu-24.04
   cd /mnt/c/Users/test/Desktop/pat-1/scripts
   python3 build_release.py
   ```

3. **Arch Packages**: Build on archlinux
   ```bash
   wsl -d archlinux
   cd /mnt/c/Users/test/Desktop/pat-1/agent
   bash build-arch.sh
   ```

### For Testing:

Run tests on each platform to verify compatibility:
- Arch Linux: Pacman/AUR tests
- openSUSE: Zypper tests
- Ubuntu: APT tests
- AlmaLinux: DNF/RPM tests

## Current Build Status

With your WSL setup, you can now:
- ✅ Build real RPM packages (not mocks)
- ✅ Build real DEB packages (not mocks)
- ✅ Build Arch packages
- ✅ Test on all supported platforms
- ✅ Create production-ready releases

## Next Steps

1. Choose AlmaLinux-9 for your next build
2. Install build tools (see commands above)
3. Run the build - it will create real packages
4. Test on different distributions

Your WSL setup is perfect for multi-platform development!
