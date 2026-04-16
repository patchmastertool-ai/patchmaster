#!/usr/bin/env python3
"""
PatchRepo HTTP API Server - Simple HTTP server (no Flask dependency)
"""

import http.server
import socketserver
import json
import os
import urllib.parse
from pathlib import Path

PORT = int(os.environ.get("PORT", "8090"))
REPO_BASE = Path("patchrepo-data")


class PatchRepoHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {format % args}")

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        # API Routes
        if path == "/api/repos":
            repos = []
            if REPO_BASE / "repos":
                for d in (REPO_BASE / "repos").iterdir():
                    if d.is_dir():
                        meta = d / ".patchrepo.json"
                        if meta.exists():
                            repos.append(json.loads(meta.read_text()))
            self.send_json([r.get("name") for r in repos])

        elif path == "/api/patches":
            patches = []
            pkg_dir = REPO_BASE / "patch-packages"
            if pkg_dir.exists():
                for f in pkg_dir.glob("*.index.json"):
                    data = json.loads(f.read_text())
                    for p in data.values():
                        patches.append(p.get("name") + " " + p.get("version"))
            self.send_json(patches)

        elif path == "/health":
            self.send_json({"status": "ok", "service": "PatchRepo"})

        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode() if length else "{}"

        try:
            data = json.loads(body)
        except (json.JSONDecodeError, ValueError):
            data = {}

        if path == "/api/repos":
            # Create repo
            repo_id = data.get("name", "test").lower().replace(" ", "-")
            import uuid

            repo_id = repo_id[:8] + uuid.uuid4().hex[:4]

            repo_dir = REPO_BASE / "repos" / repo_id
            repo_dir.mkdir(parents=True, exist_ok=True)

            meta = {
                "id": repo_id,
                "name": data.get("name", "New Repo"),
                "description": data.get("description", ""),
                "visibility": data.get("visibility", "private"),
                "created_at": __import__("datetime").datetime.now().isoformat(),
            }
            (repo_dir / ".patchrepo.json").write_text(json.dumps(meta))

            # Create branches
            branches = {"main": {"name": "main", "repo_id": repo_id, "commit_id": ""}}
            (repo_dir / "branches.json").write_text(json.dumps(branches))

            self.send_json({"created": repo_id}, 201)

        elif path == "/api/patches":
            # Upload patch
            import uuid

            patch_id = uuid.uuid4().hex[:12]
            self.send_json({"uploaded": patch_id}, 201)

        else:
            self.send_json({"error": "Not found"}, 404)


class ReuseAddrTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


print(f"=== PatchRepo HTTP API on port {PORT} ===")
with ReuseAddrTCPServer(("0.0.0.0", PORT), PatchRepoHandler) as httpd:
    httpd.serve_forever()
