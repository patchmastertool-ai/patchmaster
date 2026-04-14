"""PatchMaster Agent setup.py - Windows-compatible installer."""

import os
import sys
from pathlib import Path
import setuptools

# Use pathlib for cross-platform path handling
_current_dir = Path(__file__).parent.resolve()
_requirements_file = _current_dir / "requirements.txt"

with open(_requirements_file, "r") as f:
    requirements = f.read().splitlines()

# Windows-specific configuration
_is_windows = sys.platform.startswith("win")

setuptools.setup(
    name="patchmaster-agent",
    version="2.0.0",
    author="YVGROUP",
    author_email="support@yvgroup.com",
    description="PatchMaster Enterprise Agent",
    packages=setuptools.find_packages(),
    py_modules=["agent"],
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "patchmaster-agent=agent:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
        "Operating System :: Microsoft :: Windows",
        "Operating System :: POSIX :: Linux",
    ],
    python_requires=">=3.8",
    # Windows-specific options
    options={
        "bdist_wininst": {
            "install_script": "agent/install-script.py",
        },
    }
    if _is_windows
    else {},
)
