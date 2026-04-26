#!/bin/bash
# PatchRepo - Built-in Git Server Startup
# Supports both patch hosting and full Git operations

PORT=${PORT:-8090}
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
REPO_DIR=${REPO_DIR:-./patchrepo-data}

echo "=== PatchRepo - Built-in Git Server ==="
echo "Port: $PORT"
echo "Controller: $CONTROLLER_URL"
echo "Data Dir: $REPO_DIR"
echo ""

python3 agent/patchrepo.py &
PID=$!

echo "PatchRepo started (PID: $PID)"
echo ""

# Wait for startup
sleep 2

echo "=== Available Endpoints ==="
echo "Repositories:"
echo "  GET/POST   /api/repos                    - List/create repos"
echo "  GET/DELETE  /api/repos/<id>              - Get/delete repo"
echo ""
echo "Commits:"
echo "  GET/POST   /api/repos/<id>/commits      - List/create commits"
echo ""
echo "Branches:"
echo "  GET/POST   /api/repos/<id>/branches     - List/create branches"
echo "  DELETE     /api/repos/<id>/branches/<name> - Delete branch"
echo ""
echo "Pull Requests:"
echo "  GET/POST   /api/repos/<id>/pulls        - List/create PRs"
echo "  POST       /api/repos/<id>/pulls/<pr>/merge - Merge PR"
echo ""
echo "Patch Packages:"
echo "  GET/POST   /api/patches                - List/upload patches"
echo "  GET        /api/patches/<id>            - Get patch info"
echo ""
echo "CI/CD Webhooks:"
echo "  POST       /api/repos/<id>/webhook/push  - Triggered on push"
echo ""

wait $PID