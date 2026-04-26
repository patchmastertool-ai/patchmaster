#!/usr/bin/env python3
"""
Comprehensive Wheel Analysis and Verification
Analyzes agent code to identify ALL dependencies and verifies wheels for all platforms
"""

import os
import sys
from pathlib import Path

# Platform Python versions
PLATFORMS = {
    "almalinux": {"python": "3.9", "cp": "cp39", "abi": "manylinux"},
    "ubuntu": {"python": "3.10", "cp": "cp310", "abi": "manylinux"},
    "opensuse": {"python": "3.11", "cp": "cp311", "abi": "manylinux"},
    "debian": {"python": "3.11", "cp": "cp311", "abi": "manylinux"},
    "alpine": {"python": "3.12", "cp": "cp312", "abi": "musllinux"},
    "arch": {"python": "3.14", "cp": "cp314", "abi": "manylinux"},
}

# Core dependencies from requirements.txt
REQUIREMENTS = {
    "Flask": ">=2.0",
    "prometheus_client": ">=0.14",
    "psutil": ">=5.8",
    "requests": ">=2.28",
    "PyYAML": ">=6.0",
}

# Transitive dependencies (discovered from imports in agent.py and main.py)
TRANSITIVE_DEPS = {
    # Flask dependencies
    "werkzeug": "Flask",
    "jinja2": "Flask",
    "itsdangerous": "Flask",
    "click": "Flask",
    "blinker": "Flask",
    
    # Jinja2 dependencies
    "MarkupSafe": "jinja2",
    
    # requests dependencies
    "urllib3": "requests",
    "certifi": "requests",
    "charset-normalizer": "requests",
    "idna": "requests",
}

# All dependencies (combined)
ALL_DEPS = list(REQUIREMENTS.keys()) + list(TRANSITIVE_DEPS.keys())

def normalize_name(name):
    """Normalize package name (PyPI uses different conventions)"""
    return name.lower().replace("-", "_").replace(".", "_")

def check_wheels_for_platform(platform_name, platform_info, wheels_dir):
    """Check if all required wheels exist for a platform"""
    python_tag = platform_info["cp"]
    abi_tag = platform_info["abi"]
    
    print(f"\n{'='*80}")
    print(f"Platform: {platform_name.upper()} (Python {platform_info['python']}, {python_tag}, {abi_tag})")
    print(f"{'='*80}")
    
    missing = []
    found = []
    
    for dep in ALL_DEPS:
        norm_name = normalize_name(dep)
        
        # Check for platform-specific wheel
        patterns = [
            f"{norm_name}-*-{python_tag}-{python_tag}-{abi_tag}*.whl",  # cp39-cp39-manylinux
            f"{norm_name}-*-{python_tag}-abi3-{abi_tag}*.whl",  # cp39-abi3-manylinux
            f"{norm_name}-*-cp3*-abi3-{abi_tag}*.whl",  # cp36-abi3-manylinux (psutil)
            f"{norm_name}-*-py3-none-any.whl",  # pure Python
            f"{norm_name}-*-py2.py3-none-any.whl",  # Python 2/3 compatible
        ]
        
        wheel_found = False
        for pattern in patterns:
            matches = list(Path(wheels_dir).glob(pattern))
            if matches:
                wheel_found = True
                found.append(f"✅ {dep:25s} -> {matches[0].name}")
                break
        
        if not wheel_found:
            missing.append(f"❌ {dep:25s} -> NO WHEEL FOUND")
    
    # Print results
    if found:
        print("\nFound wheels:")
        for item in found:
            print(f"  {item}")
    
    if missing:
        print("\n⚠️  MISSING WHEELS:")
        for item in missing:
            print(f"  {item}")
        return False
    else:
        print(f"\n✅ All {len(found)} dependencies have wheels for {platform_name}")
        return True

def main():
    wheels_dir = Path(__file__).parent.parent / "vendor" / "wheels"
    
    if not wheels_dir.exists():
        print(f"❌ Wheels directory not found: {wheels_dir}")
        return 1
    
    print("="*80)
    print("COMPREHENSIVE WHEEL ANALYSIS")
    print("="*80)
    print(f"\nWheels directory: {wheels_dir}")
    print(f"Total wheels: {len(list(wheels_dir.glob('*.whl')))}")
    
    print(f"\n{'='*80}")
    print("DEPENDENCIES ANALYSIS")
    print(f"{'='*80}")
    print(f"\nCore dependencies (from requirements.txt): {len(REQUIREMENTS)}")
    for dep, version in REQUIREMENTS.items():
        print(f"  - {dep}{version}")
    
    print(f"\nTransitive dependencies: {len(TRANSITIVE_DEPS)}")
    for dep, parent in TRANSITIVE_DEPS.items():
        print(f"  - {dep} (from {parent})")
    
    print(f"\nTotal dependencies to check: {len(ALL_DEPS)}")
    
    # Check each platform
    all_ok = True
    for platform_name, platform_info in PLATFORMS.items():
        ok = check_wheels_for_platform(platform_name, platform_info, wheels_dir)
        if not ok:
            all_ok = False
    
    print(f"\n{'='*80}")
    if all_ok:
        print("✅ SUCCESS: All platforms have all required wheels")
        print("="*80)
        return 0
    else:
        print("❌ FAILURE: Some platforms are missing wheels")
        print("="*80)
        print("\nTO FIX:")
        print("1. Download missing wheels using pip download")
        print("2. Ensure correct Python version and platform tags")
        print("3. For Alpine: use musllinux wheels, not manylinux")
        print("4. For abi3 wheels: they work across multiple Python versions")
        return 1

if __name__ == "__main__":
    sys.exit(main())
