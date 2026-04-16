#!/usr/bin/env python3
"""
PatchRepo - Built-in Git Server for PatchMaster
Features:
- Git repository hosting (like Azure Repos)
- Patch package hosting and distribution
- Commit history, branches, tags
- Pull requests
- CI/CD webhook triggers
"""

import os
import re
import uuid
import hashlib
import json
import time
import shutil
import tempfile
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict

REPO_DIR = "repos"
PATCH_REPO_DIR = "patch-packages"
METADATA_FILE = ".patchrepo.json"


@dataclass
class Repository:
    id: str
    name: str
    description: str = ""
    visibility: str = "private"  # private, public, internal
    default_branch: str = "main"
    created_at: str = ""
    updated_at: str = ""
    owner: str = ""
    collaborators: List[str] = field(default_factory=list)
    forked_from: Optional[str] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class Commit:
    id: str
    repo_id: str
    branch: str
    message: str
    author: str
    email: str
    timestamp: str = ""
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0
    parent_id: Optional[str] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class Branch:
    name: str
    repo_id: str
    commit_id: str
    protected: bool = False
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class PullRequest:
    id: str
    repo_id: str
    title: str
    description: str = ""
    source_branch: str = ""
    target_branch: str = ""
    author: str = ""
    status: str = "open"  # open, merged, closed, draft
    created_at: str = ""
    updated_at: str = ""
    reviewers: List[str] = field(default_factory=list)
    comments: List[dict] = field(default_factory=list)
    merges_into: Optional[str] = None
    merged_by: Optional[str] = None
    merged_at: Optional[str] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class PatchPackage:
    id: str
    repo_id: str
    name: str
    version: str
    platform: str
    filename: str
    size: int = 0
    checksum: str = ""
    uploaded_by: str = ""
    uploaded_at: str = ""
    metadata: dict = field(default_factory=dict)
    download_count: int = 0

    def to_dict(self):
        return asdict(self)


class PatchRepo:
    """Built-in Git server for PatchMaster."""

    def __init__(self, base_dir: str = "patchrepo-data"):
        self.base_dir = base_dir
        self.repos_dir = os.path.join(base_dir, REPO_DIR)
        self.packages_dir = os.path.join(base_dir, PATCH_REPO_DIR)
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.base_dir, self.repos_dir, self.packages_dir]:
            os.makedirs(d, exist_ok=True)

    def _load_metadata(self, path: str) -> dict:
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
        return {}

    def _save_metadata(self, path: str, data: dict):
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    # ========== REPOSITORY OPERATIONS ==========

    def create_repo(
        self,
        name: str,
        description: str = "",
        visibility: str = "private",
        owner: str = "admin",
    ) -> Repository:
        """Create a new repository."""
        repo_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()

        repo = Repository(
            id=repo_id,
            name=name,
            description=description,
            visibility=visibility,
            owner=owner,
            created_at=now,
            updated_at=now,
        )

        repo_path = os.path.join(self.repos_dir, repo_id)
        os.makedirs(repo_path)

        # Initialize with metadata
        metadata_file = os.path.join(repo_path, METADATA_FILE)
        self._save_metadata(metadata_file, repo.to_dict())

        # Create default branch
        self._save_metadata(
            os.path.join(repo_path, "main.json"),
            {"name": "main", "repo_id": repo_id, "commit_id": "", "protected": True},
        )

        # Create commits log
        self._save_metadata(os.path.join(repo_path, "commits.json"), [])

        # Create branches
        self._save_metadata(
            os.path.join(repo_path, "branches.json"),
            {
                "main": {
                    "name": "main",
                    "repo_id": repo_id,
                    "commit_id": "",
                    "protected": True,
                }
            },
        )

        # Create PRs
        self._save_metadata(os.path.join(repo_path, "pulls.json"), [])

        return repo

    def list_repos(self, visibility: str = None, owner: str = None) -> List[Repository]:
        """List repositories."""
        repos = []
        for repo_id in os.listdir(self.repos_dir):
            repo_path = os.path.join(self.repos_dir, repo_id)
            if os.path.isdir(repo_path):
                meta = self._load_metadata(os.path.join(repo_path, METADATA_FILE))
                if meta:
                    if visibility and meta.get("visibility") != visibility:
                        continue
                    if owner and meta.get("owner") != owner:
                        continue
                    repos.append(Repository(**meta))
        return repos

    def get_repo(self, repo_id: str) -> Optional[Repository]:
        """Get repository by ID."""
        repo_path = os.path.join(self.repos_dir, repo_id)
        if os.path.exists(repo_path):
            meta = self._load_metadata(os.path.join(repo_path, METADATA_FILE))
            return Repository(**meta) if meta else None
        return None

    def delete_repo(self, repo_id: str) -> bool:
        """Delete a repository."""
        repo_path = os.path.join(self.repos_dir, repo_id)
        if os.path.exists(repo_path):
            shutil.rmtree(repo_path)
            return True
        return False

    # ========== COMMIT OPERATIONS ==========

    def commit(
        self,
        repo_id: str,
        branch: str,
        message: str,
        author: str,
        email: str,
        files: dict = None,
    ) -> Commit:
        """Create a commit."""
        repo = self.get_repo(repo_id)
        if not repo:
            raise ValueError(f"Repository {repo_id} not found")

        commit_id = hashlib.sha256(
            f"{repo_id}{message}{time.time()}".encode()
        ).hexdigest()[:12]
        now = datetime.now().isoformat()

        commit = Commit(
            id=commit_id,
            repo_id=repo_id,
            branch=branch,
            message=message,
            author=author,
            email=email,
            timestamp=now,
            files_changed=len(files) if files else 0,
        )

        repo_path = os.path.join(self.repos_dir, repo_id)
        commits_file = os.path.join(repo_path, "commits.json")
        commits = self._load_metadata(commits_file)
        commits.insert(0, commit.to_dict())
        if len(commits) > 1000:  # Keep last 1000
            commits = commits[:1000]
        self._save_metadata(commits_file, commits)

        # Update branch to this commit
        branches_file = os.path.join(repo_path, "branches.json")
        branches = self._load_metadata(branches_file)
        branches[branch] = {"name": branch, "repo_id": repo_id, "commit_id": commit_id}
        self._save_metadata(branches_file, branches)

        return commit

    def get_commits(
        self, repo_id: str, branch: str = None, limit: int = 50
    ) -> List[Commit]:
        """Get commit history."""
        repo = self.get_repo(repo_id)
        if not repo:
            return []

        repo_path = os.path.join(self.repos_dir, repo_id)
        commits_file = os.path.join(repo_path, "commits.json")
        commits = self._load_metadata(commits_file)

        result = []
        for c in commits:
            if branch and c.get("branch") != branch:
                continue
            result.append(Commit(**c))
            if len(result) >= limit:
                break
        return result

    # ========== BRANCH OPERATIONS ==========

    def create_branch(
        self, repo_id: str, name: str, from_branch: str = "main"
    ) -> Branch:
        """Create a new branch."""
        repo = self.get_repo(repo_id)
        if not repo:
            raise ValueError(f"Repository {repo_id} not found")

        repo_path = os.path.join(self.repos_dir, repo_id)
        branches_file = os.path.join(repo_path, "branches.json")
        branches = self._load_metadata(branches_file)

        if name in branches:
            raise ValueError(f"Branch {name} already exists")

        # Get commit ID from source branch
        source = branches.get(from_branch, {})

        branch = Branch(
            name=name,
            repo_id=repo_id,
            commit_id=source.get("commit_id", ""),
            created_at=datetime.now().isoformat(),
        )

        branches[name] = branch.to_dict()
        self._save_metadata(branches_file, branches)

        return branch

    def list_branches(self, repo_id: str) -> List[Branch]:
        """List branches."""
        repo_path = os.path.join(self.repos_dir, repo_id)
        branches_file = os.path.join(repo_path, "branches.json")
        branches = self._load_metadata(branches_file)
        return [Branch(**b) for b in branches.values()]

    def delete_branch(self, repo_id: str, name: str) -> bool:
        """Delete a branch (not main, not protected)."""
        if name == "main":
            return False

        repo_path = os.path.join(self.repos_dir, repo_id)
        branches_file = os.path.join(repo_path, "branches.json")
        branches = self._load_metadata(branches_file)

        if name in branches and not branches[name].get("protected"):
            del branches[name]
            self._save_metadata(branches_file, branches)
            return True
        return False

    # ========== PULL REQUEST OPERATIONS ==========

    def create_pr(
        self,
        repo_id: str,
        title: str,
        source_branch: str,
        target_branch: str,
        author: str,
        description: str = "",
    ) -> PullRequest:
        """Create a pull request."""
        pr_id = f"PR-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now().isoformat()

        pr = PullRequest(
            id=pr_id,
            repo_id=repo_id,
            title=title,
            description=description,
            source_branch=source_branch,
            target_branch=target_branch,
            author=author,
            created_at=now,
            updated_at=now,
        )

        repo_path = os.path.join(self.repos_dir, repo_id)
        pulls_file = os.path.join(repo_path, "pulls.json")
        pulls = self._load_metadata(pulls_file)
        pulls.append(pr.to_dict())
        self._save_metadata(pulls_file, pulls)

        return pr

    def list_prs(self, repo_id: str, status: str = None) -> List[PullRequest]:
        """List pull requests."""
        repo_path = os.path.join(self.repos_dir, repo_id)
        pulls_file = os.path.join(repo_path, "pulls.json")
        pulls = self._load_metadata(pulls_file)

        result = []
        for p in pulls:
            if status and p.get("status") != status:
                continue
            result.append(PullRequest(**p))
        return result

    def merge_pr(self, repo_id: str, pr_id: str, merged_by: str) -> bool:
        """Merge a pull request."""
        repo_path = os.path.join(self.repos_dir, repo_id)
        pulls_file = os.path.join(repo_path, "pulls.json")
        pulls = self._load_metadata(pulls_file)

        for p in pulls:
            if p.get("id") == pr_id:
                p["status"] = "merged"
                p["merged_by"] = merged_by
                p["merged_at"] = datetime.now().isoformat()
                self._save_metadata(pulls_file, pulls)
                return True
        return False

    # ========== PATCH PACKAGE OPERATIONS ==========

    def upload_patch(
        self,
        repo_id: str,
        name: str,
        version: str,
        platform: str,
        filename: str,
        uploaded_by: str,
        metadata: dict = None,
    ) -> PatchPackage:
        """Upload a patch package."""
        pkg_id = str(uuid.uuid4())[:12]
        now = datetime.now().isoformat()

        patch = PatchPackage(
            id=pkg_id,
            repo_id=repo_id,
            name=name,
            version=version,
            platform=platform,
            filename=filename,
            uploaded_by=uploaded_by,
            uploaded_at=now,
            metadata=metadata or {},
        )

        repo_pkg_dir = os.path.join(self.packages_dir, repo_id)
        os.makedirs(repo_pkg_dir, exist_ok=True)

        pkg_file = os.path.join(repo_pkg_dir, f"{pkg_id}.json")
        self._save_metadata(pkg_file, patch.to_dict())

        # Add to repo index
        index_file = os.path.join(self.packages_dir, f"{repo_id}.index.json")
        index = self._load_metadata(index_file)
        index[pkg_id] = patch.to_dict()
        self._save_metadata(index_file, index)

        return patch

    def list_patches(
        self, repo_id: str = None, platform: str = None
    ) -> List[PatchPackage]:
        """List patch packages."""
        patches = []

        if repo_id:
            index_file = os.path.join(self.packages_dir, f"{repo_id}.index.json")
            if os.path.exists(index_file):
                data = self._load_metadata(index_file)
                patches = [PatchPackage(**p) for p in data.values()]
        else:
            for f in os.listdir(self.packages_dir):
                if f.endswith(".index.json"):
                    data = self._load_metadata(os.path.join(self.packages_dir, f))
                    patches.extend([PatchPackage(**p) for p in data.values()])

        if platform:
            patches = [p for p in patches if p.platform == platform]

        return patches

    def get_patch(self, patch_id: str) -> Optional[PatchPackage]:
        """Get patch package by ID."""
        for f in os.listdir(self.packages_dir):
            if f.endswith(".index.json"):
                data = self._load_metadata(os.path.join(self.packages_dir, f))
                if patch_id in data:
                    return PatchPackage(**data[patch_id])
        return None

    # ========== WEBHOOK TRIGGERS ==========

    def trigger_webhook(self, repo_id: str, event: str, data: dict) -> List[dict]:
        """Trigger webhooks for repository events."""
        repo = self.get_repo(repo_id)
        if not repo:
            return []

        # Return webhook config for CI/CD integration
        return [
            {
                "event": f"push",
                "url": f"/api/repos/{repo_id}/webhook/push",
                "payload": data,
            },
            {
                "event": f"pr opened",
                "url": f"/api/repos/{repo_id}/webhook/pull_request",
                "payload": data,
            },
        ]


# Standalone Flask API
def create_app(repo: PatchRepo = None):
    """Create Flask API for PatchRepo."""
    from flask import Flask, request, jsonify, send_file

    app = Flask(__name__)
    repo = repo or PatchRepo()

    # === REPOSITORY ENDPOINTS ===

    @app.route("/api/repos", methods=["GET"])
    def list_repos():
        visibility = request.args.get("visibility")
        owner = request.args.get("owner")
        return jsonify([r.to_dict() for r in repo.list_repos(visibility, owner)])

    @app.route("/api/repos", methods=["POST"])
    def create_repo():
        data = request.json
        r = repo.create_repo(
            name=data["name"],
            description=data.get("description", ""),
            visibility=data.get("visibility", "private"),
            owner=data.get("owner", "admin"),
        )
        return jsonify(r.to_dict()), 201

    @app.route("/api/repos/<repo_id>", methods=["GET"])
    def get_repo(repo_id):
        r = repo.get_repo(repo_id)
        return jsonify(r.to_dict()) if r else ("Not found", 404)

    @app.route("/api/repos/<repo_id>", methods=["DELETE"])
    def delete_repo(repo_id):
        return jsonify({"deleted": repo.delete_repo(repo_id)})

    # === COMMIT ENDPOINTS ===

    @app.route("/api/repos/<repo_id>/commits", methods=["GET"])
    def get_commits(repo_id):
        branch = request.args.get("branch")
        limit = int(request.args.get("limit", 50))
        return jsonify([c.to_dict() for c in repo.get_commits(repo_id, branch, limit)])

    @app.route("/api/repos/<repo_id>/commits", methods=["POST"])
    def create_commit(repo_id):
        data = request.json
        c = repo.commit(
            repo_id=repo_id,
            branch=data["branch"],
            message=data["message"],
            author=data["author"],
            email=data.get("email", ""),
            files=data.get("files"),
        )
        return jsonify(c.to_dict()), 201

    # === BRANCH ENDPOINTS ===

    @app.route("/api/repos/<repo_id>/branches", methods=["GET"])
    def list_branches(repo_id):
        return jsonify([b.to_dict() for b in repo.list_branches(repo_id)])

    @app.route("/api/repos/<repo_id>/branches", methods=["POST"])
    def create_branch(repo_id):
        data = request.json
        b = repo.create_branch(repo_id, data["name"], data.get("from", "main"))
        return jsonify(b.to_dict()), 201

    @app.route("/api/repos/<repo_id>/branches/<name>", methods=["DELETE"])
    def delete_branch(repo_id, name):
        return jsonify({"deleted": repo.delete_branch(repo_id, name)})

    # === PULL REQUEST ENDPOINTS ===

    @app.route("/api/repos/<repo_id>/pulls", methods=["GET"])
    def list_pulls(repo_id):
        status = request.args.get("status")
        return jsonify([p.to_dict() for p in repo.list_prs(repo_id, status)])

    @app.route("/api/repos/<repo_id>/pulls", methods=["POST"])
    def create_pull(repo_id):
        data = request.json
        p = repo.create_pr(
            repo_id=repo_id,
            title=data["title"],
            source_branch=data["source_branch"],
            target_branch=data.get("target_branch", "main"),
            author=data["author"],
            description=data.get("description", ""),
        )
        return jsonify(p.to_dict()), 201

    @app.route("/api/repos/<repo_id>/pulls/<pr_id>/merge", methods=["POST"])
    def merge_pull(repo_id, pr_id):
        data = request.json
        return jsonify(
            {"merged": repo.merge_pr(repo_id, pr_id, data.get("merged_by", "admin"))}
        )

    # === PATCH PACKAGE ENDPOINTS ===

    @app.route("/api/patches", methods=["GET"])
    def list_patches():
        repo_id = request.args.get("repo_id")
        platform = request.args.get("platform")
        return jsonify([p.to_dict() for p in repo.list_patches(repo_id, platform)])

    @app.route("/api/patches", methods=["POST"])
    def upload_patch():
        data = request.json
        p = repo.upload_patch(
            repo_id=data["repo_id"],
            name=data["name"],
            version=data["version"],
            platform=data["platform"],
            filename=data["filename"],
            uploaded_by=data["uploaded_by"],
            metadata=data.get("metadata"),
        )
        return jsonify(p.to_dict()), 201

    @app.route("/api/patches/<patch_id>", methods=["GET"])
    def get_patch(patch_id):
        p = repo.get_patch(patch_id)
        return jsonify(p.to_dict()) if p else ("Not found", 404)

    return app


if __name__ == "__main__":
    # Test the patch repo
    repo = PatchRepo()

    # Create a test repository
    r = repo.create_repo("patch-agent-main", "Main patch agent repository", "internal")
    print(f"Created repo: {r.name} ({r.id})")

    # Create a commit
    c = repo.commit(r.id, "main", "Initial commit", "admin", "admin@patchmaster.local")
    print(f"Created commit: {c.id}")

    # Create a branch
    b = repo.create_branch(r.id, "develop", "main")
    print(f"Created branch: {b.name}")

    # Upload a patch
    p = repo.upload_patch(
        r.id, "patch-agent", "2.0.0", "linux", "agent-latest.rpm", "admin"
    )
    print(f"Uploaded patch: {p.name} {p.version}")

    # List all
    print(f"\nRepos: {len(repo.list_repos())}")
    print(f"Branches: {len(repo.list_branches(r.id))}")
    print(f"Patches: {len(repo.list_patches())}")

    # Start API server
    print("\n=== Starting PatchRepo API on port 8090 ===")
    app = create_app(repo)
    app.run(host="0.0.0.0", port=8090, debug=False)
