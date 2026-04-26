import os
import sys
import importlib.util
from pathlib import Path
import tempfile

module_path = (
    Path("tests/test_build_release_authority.py").resolve().parents[1]
    / "scripts"
    / "build_release.py"
)
print(f"Loading from: {module_path}")

spec = importlib.util.spec_from_file_location(
    "build_release_under_test", str(module_path)
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

print("Module loaded successfully")
print("Has ENV_TO_LICENSE_KEYS:", hasattr(module, "ENV_TO_LICENSE_KEYS"))
if hasattr(module, "ENV_TO_LICENSE_KEYS"):
    print("Keys:", list(module.ENV_TO_LICENSE_KEYS.keys()))

os.environ["PM_RELEASE_LICENSE_SIGN_KEY"] = "a" * 64
os.environ["PM_RELEASE_LICENSE_SIGN_PRIVATE_KEY"] = "b" * 43
os.environ["PM_RELEASE_LICENSE_VERIFY_PUBLIC_KEY"] = "c" * 43
os.environ["PM_RELEASE_LICENSE_DECRYPT_PRIVATE_KEY"] = "d" * 43
os.environ["PM_RELEASE_LICENSE_ENCRYPT_PUBLIC_KEY"] = "e" * 43

with tempfile.TemporaryDirectory() as tmpdir:
    tmppath = Path(tmpdir)
    project_root = tmppath / "project"
    dist_dir = project_root / "dist"
    private_dist_dir = dist_dir / "private"
    project_root.mkdir(parents=True)
    private_dist_dir.mkdir(parents=True)

    module.PROJECT_ROOT = str(project_root)
    module.DIST_DIR = str(dist_dir)
    module.PRIVATE_DIST_DIR = str(private_dist_dir)
    module.VENDOR_DIST_DIR = str(project_root / "vendor" / "dist")
    module.AUTHORITY_FILE_CANDIDATES = (
        str(project_root / ".license-authority.env"),
        str(project_root / "patchmaster-license-authority.env"),
    )

    module.ensure_release_authority_bundle()

    authority_text = (project_root / ".license-authority.env").read_text()
    print("Authority text:")
    print(authority_text)
