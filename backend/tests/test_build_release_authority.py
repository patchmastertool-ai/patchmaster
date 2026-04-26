import importlib.util
from pathlib import Path


def load_build_release_module():
    module_path = Path(__file__).resolve().parents[2] / "scripts" / "build_release.py"
    spec = importlib.util.spec_from_file_location("build_release_under_test", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def configure_release_paths(module, tmp_path):
    project_root = tmp_path / "project"
    dist_dir = project_root / "dist"
    private_dist_dir = dist_dir / "private"
    vendor_dist_dir = project_root / "vendor" / "dist"
    project_root.mkdir()
    private_dist_dir.mkdir(parents=True)
    vendor_dist_dir.mkdir(parents=True)

    module.PROJECT_ROOT = str(project_root)
    module.DIST_DIR = str(dist_dir)
    module.PRIVATE_DIST_DIR = str(private_dist_dir)
    module.VENDOR_DIST_DIR = str(vendor_dist_dir)
    module.AUTHORITY_FILE_CANDIDATES = (
        str(project_root / ".license-authority.env"),
        str(project_root / "patchmaster-license-authority.env"),
    )

    return project_root, dist_dir, private_dist_dir, vendor_dist_dir


def test_release_authority_bundle_prefers_explicit_env(monkeypatch, tmp_path):
    module = load_build_release_module()
    project_root, _dist_dir, private_dist_dir, _vendor_dist_dir = configure_release_paths(module, tmp_path)
    explicit_key = "a" * 64
    explicit_private = "b" * 43
    explicit_public = "c" * 43
    explicit_decrypt = "d" * 43
    explicit_encrypt = "e" * 43
    monkeypatch.setenv("PM_RELEASE_LICENSE_SIGN_KEY", explicit_key)
    monkeypatch.setenv("PM_RELEASE_LICENSE_SIGN_PRIVATE_KEY", explicit_private)
    monkeypatch.setenv("PM_RELEASE_LICENSE_VERIFY_PUBLIC_KEY", explicit_public)
    monkeypatch.setenv("PM_RELEASE_LICENSE_DECRYPT_PRIVATE_KEY", explicit_decrypt)
    monkeypatch.setenv("PM_RELEASE_LICENSE_ENCRYPT_PUBLIC_KEY", explicit_encrypt)

    module.ensure_release_authority_bundle()

    authority_text = (project_root / ".license-authority.env").read_text(encoding="utf-8")
    assert f"LICENSE_SIGN_KEY={explicit_key}\n" in authority_text
    assert f"LICENSE_SIGN_PRIVATE_KEY={explicit_private}\n" in authority_text
    assert f"LICENSE_VERIFY_PUBLIC_KEY={explicit_public}\n" in authority_text
    assert f"LICENSE_DECRYPT_PRIVATE_KEY={explicit_decrypt}\n" in authority_text
    assert f"LICENSE_ENCRYPT_PUBLIC_KEY={explicit_encrypt}\n" in authority_text
    assert (private_dist_dir / "patchmaster-license-authority.env").read_text(encoding="utf-8") == authority_text
    assert (private_dist_dir / f"patchmaster-license-authority-{module.VERSION}.env").read_text(encoding="utf-8") == authority_text
    public_text = (private_dist_dir / "patchmaster-license-public.env").read_text(encoding="utf-8")
    assert f"LICENSE_VERIFY_PUBLIC_KEY={explicit_public}\n" in public_text
    assert f"LICENSE_DECRYPT_PRIVATE_KEY={explicit_decrypt}\n" in public_text
    assert f"LICENSE_ENCRYPT_PUBLIC_KEY={explicit_encrypt}\n" in public_text
    assert "LICENSE_SIGN_PRIVATE_KEY" not in public_text


def test_release_authority_bundle_falls_back_to_project_env(monkeypatch, tmp_path):
    module = load_build_release_module()
    project_root, _dist_dir, private_dist_dir, _vendor_dist_dir = configure_release_paths(module, tmp_path)
    monkeypatch.delenv("PM_RELEASE_LICENSE_SIGN_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_SIGN_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_VERIFY_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_DECRYPT_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_ENCRYPT_PUBLIC_KEY", raising=False)
    fallback_key = "b" * 64
    (project_root / ".env").write_text(f"LICENSE_SIGN_KEY={fallback_key}\n", encoding="utf-8")

    module.ensure_release_authority_bundle()

    authority_text = (project_root / ".license-authority.env").read_text(encoding="utf-8")
    assert f"LICENSE_SIGN_KEY={fallback_key}\n" in authority_text
    assert "LICENSE_SIGN_PRIVATE_KEY=" in authority_text
    assert "LICENSE_VERIFY_PUBLIC_KEY=" in authority_text
    assert "LICENSE_DECRYPT_PRIVATE_KEY=" in authority_text
    assert "LICENSE_ENCRYPT_PUBLIC_KEY=" in authority_text
    assert (private_dist_dir / "patchmaster-license-authority.env").read_text(encoding="utf-8") == authority_text
    public_text = (private_dist_dir / "patchmaster-license-public.env").read_text(encoding="utf-8")
    assert "LICENSE_VERIFY_PUBLIC_KEY=" in public_text
    assert "LICENSE_DECRYPT_PRIVATE_KEY=" in public_text
    assert "LICENSE_ENCRYPT_PUBLIC_KEY=" in public_text
    assert "LICENSE_SIGN_PRIVATE_KEY" not in public_text


def test_release_authority_bundle_reuses_existing_authority_file(monkeypatch, tmp_path):
    module = load_build_release_module()
    project_root, _dist_dir, private_dist_dir, _vendor_dist_dir = configure_release_paths(module, tmp_path)
    monkeypatch.delenv("PM_RELEASE_LICENSE_SIGN_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_SIGN_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_VERIFY_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_DECRYPT_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("PM_RELEASE_LICENSE_ENCRYPT_PUBLIC_KEY", raising=False)
    authority_key = "c" * 64
    fallback_key = "d" * 64
    (project_root / ".license-authority.env").write_text(
        f"LICENSE_SIGN_KEY={authority_key}\nLICENSE_SIGN_PRIVATE_KEY={'e' * 43}\nLICENSE_VERIFY_PUBLIC_KEY={'f' * 43}\nLICENSE_DECRYPT_PRIVATE_KEY={'g' * 43}\nLICENSE_ENCRYPT_PUBLIC_KEY={'h' * 43}\n",
        encoding="utf-8",
    )
    (project_root / ".env").write_text(f"LICENSE_SIGN_KEY={fallback_key}\n", encoding="utf-8")

    module.ensure_release_authority_bundle()

    authority_text = (project_root / ".license-authority.env").read_text(encoding="utf-8")
    assert f"LICENSE_SIGN_KEY={authority_key}\n" in authority_text
    assert f"LICENSE_SIGN_PRIVATE_KEY={'e' * 43}\n" in authority_text
    assert f"LICENSE_VERIFY_PUBLIC_KEY={'f' * 43}\n" in authority_text
    assert f"LICENSE_DECRYPT_PRIVATE_KEY={'g' * 43}\n" in authority_text
    assert f"LICENSE_ENCRYPT_PUBLIC_KEY={'h' * 43}\n" in authority_text
    assert (private_dist_dir / "patchmaster-license-authority.env").read_text(encoding="utf-8") == authority_text
