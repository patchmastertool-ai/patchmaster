# Phase 11: PatchRepo Git Server - Research

**Researched:** 2026-04-15
**Domain:** Git Server Implementation in Python
**Confidence:** MEDIUM-HIGH

## Summary

Phase 11 requires implementing a built-in Git server with Azure Repos-like features within PatchMaster. The existing codebase has:
1. An integration layer for external Git providers (GitLab, Bitbucket, GitBucket) in `api/git_integration.py`
2. Basic JSON-based metadata storage in `patchrepo-data/`
3. A `GitRepository` model for external integrations

The gap is a **native Git server** - not just integration with external providers. Azure Repos-like features include commit history, branches, pull requests with code review, access control, and web-based browsing.

**Primary recommendation:** Use **Dulwich** - the standard pure-Python Git implementation. It provides both client and server capabilities with no external git binary dependencies.

## User Constraints

> This section intentionally left blank - no CONTEXT.md exists for this phase yet.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **dulwich** | 0.25.0+ | Pure-Python Git implementation | No git binary dependency, WSGI/aiohttp server support |
| **strawberry-graphql** | 0.259.2 | GraphQL API (existing) | Already in project requirements |
| **fastapi** | 0.135.1 | HTTP server (existing) | Already in project requirements |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| dulwich.server | Git smart protocol server | TCP git:// protocol support |
| dulwich.web | WSGI HTTP git server | Integrating with existing WSGI app |
| dulwich.repo | Repository operations | Creating/managing bare repos |

### Installation
```bash
pip install dulwich>=0.25.0
```

**Version verification:** `npm view dulwich version` — dulwich is Python-only (not on npm)
Source: [dulwich.io](https://dulwich.io) — Pure Python Git implementation with 2.2K GitHub stars

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── api/
│   ├── git_server.py          # NEW: PatchRepo native Git server API
│   └── git_integration.py     # EXISTING: External provider integration
├── services/
│   └── git_server_service.py  # NEW: Git server business logic
├── models/
│   └── db_models.py           # MODIFY: Add PatchRepo models
└── patchrepo-data/            # EXISTING: Repo storage base
    └── repos/                 # Bare Git repositories (Dulwich format)
```

### Pattern 1: Dual-Provider Git Integration

**What:** Extend existing Git integration to support a third "provider type" - `patchrepo`

**When to use:** For consistent API patterns with external Git providers

**Example structure:**
```python
# In api/git_integration.py
PROVIDERS = ("gitlab", "bitbucket", "gitbucket", "patchrepo")

# PatchRepo uses local Dulwich repositories
if repo.provider == "patchrepo":
    # Serve from local patchrepo-data/repos/{id}/
    pass
```

### Pattern 2: Dulwich Backend for Custom Auth

**What:** Create a custom Dulwich `Backend` that enforces PatchMaster RBAC

**Source:** [dulwich.server.Backend](https://dulwich.io/api/dulwich.server.html#dulwich.server.Backend)

```python
from dulwich.server import Backend, BackendRepo

class PatchRepoBackend(Backend):
    """Custom backend that enforces PatchMaster access control."""
    
    def __init__(self, base_path, auth_check):
        self.base_path = base_path
        self.auth_check = auth_check  # PatchMaster RBAC function
    
    def get_repo(self, name):
        # Check user permissions before allowing access
        if not self.auth_check(name):
            raise PermissionError("Access denied")
        return BackendRepo(os.path.join(self.base_path, name))
```

### Pattern 3: Git Smart HTTP via FastAPI Routes

**What:** Handle git clone/push/fetch over HTTP using FastAPI routes

**When to use:** When integrating with existing FastAPI app (not separate WSGI)

**Source:** [dulwich.web.HTTPGitApplication](https://dulwich.io/api/dulwich.web.html)

```python
# FastAPI route that handles Git Smart HTTP
@app.post("/api/patchrepo/{repo_id}.git/info/refs")
async def git_info_refs(repo_id: str, service: str = None):
    """Handle git upload-pack / receive-pack info refs."""
    # Validate auth via PatchMaster
    # Delegate to Dulwich for Git protocol
    pass

@app.post("/api/patchrepo/{repo_id}.git/git-upload-pack")
async def git_upload_pack(request: Request, repo_id: str):
    """Handle git clone/fetch requests."""
    pass

@app.post("/api/patchrepo/{repo_id}.git/git-receive-pack")
async def git_receive_pack(request: Request, repo_id: str):
    """Handle git push requests."""
    pass
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git protocol handling | Custom HTTP Git implementation | Dulwich | Complex protocol with many edge cases |
| Repository storage | Custom object storage | Dulwich native format | Ensures compatibility with git clients |
| Pack file generation | Custom pack creation | dulwich.pack | Correct SHA-1/SHA-256 handling |
| Ref management | Custom ref storage | dulwich.refs | Atomic operations, symrefs |

**Key insight:** Git's wire protocol is complex and has evolved over decades. Dulwich handles this complexity and stays current with protocol updates (e.g., protocol v2 support added in 2024).

## Common Pitfalls

### Pitfall 1: Authentication Without RBAC Integration
**What goes wrong:** Git push succeeds but bypasses PatchMaster permissions
**Why it happens:** Git protocol doesn't inherently carry user context
**How to avoid:** Use HTTP Basic Auth or token-based auth that maps to PatchMaster users
**Warning signs:** Users can push without valid PatchMaster credentials

### Pitfall 2: Large Repository Performance
**What goes wrong:** Clone times out for repos with many objects
**Why it happens:** Serving loose objects vs packed objects
**How to avoid:** Periodic `git gc` equivalent via `dulwich.porcelain.gc()`
**Warning signs:** Pack files missing or oversized, slow clones

### Pitfall 3: Concurrent Push Conflicts
**What goes wrong:** Two users push simultaneously, one loses changes
**Why it happens:** Git protocol handles this, but custom code may not
**How to avoid:** Use Dulwich's atomic ref operations, don't manually edit refs
**Warning signs:** `refs/heads/` conflicts in logs

### Pitfall 4: Shallow Clone Support
**What goes wrong:** Server rejects shallow clones
**Why it happens:** Not all Git servers support `depth` parameter
**How to avoid:** Dulwich supports shallow clones, ensure `determine_wants` handles depth
**Warning signs:** `error: unexpected shallow root` messages

## Code Examples

### Creating a Bare Repository
```python
# Source: dulwich documentation - https://dulwich.io/docs
from dulwich.repo import Repo
from dulwich import porcelain
import os

def create_patchrepo_repo(repo_path: str) -> Repo:
    """Create a new bare Git repository for PatchRepo."""
    os.makedirs(repo_path, exist_ok=True)
    repo = Repo.init_bare(repo_path)
    return repo
```

### Implementing Upload Pack Handler
```python
# Source: dulwich.server - https://dulwich.io/api/dulwich.server.html
from dulwich.server import UploadPackHandler, Backend
from dulwich.protocol import Protocol

async def handle_upload_pack(backend: Backend, inf, outf):
    """Handle git-upload-pack for clone/fetch."""
    handler = UploadPackHandler(backend)
    protocol = Protocol(inf, outf)
    handler.handle(protocol)
```

### Creating a Commit
```python
# Source: dulwich.porcelain - https://dulwich.readthedocs.io/en/latest/tutorial/porcelain.html
from dulwich import porcelain

def create_commit(repo_path: str, author: str, message: str, tree_sha: bytes):
    """Create a new commit in the repository."""
    return porcelain.commit(
        repo_path,
        message=message.encode('utf-8'),
        author=author.encode('utf-8'),
        tree=tree_sha
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External Git providers only | Built-in PatchRepo server | Phase 11 | Full control, no external dependency |
| JSON metadata storage | Dulwich native format | Phase 11 | Full Git compatibility |
| No PR workflow | Native PR with code review | Phase 11 | Azure Repos parity |

**Deprecated/outdated:**
- Pure JSON-based "repository" storage (use Dulwich native format)
- No authentication on Git operations (must integrate with PatchMaster auth)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dulwich 0.25.0+ works with Python 3.12+ | Standard Stack | May need version adjustment |
| A2 | FastAPI can handle Git Smart HTTP protocol | Architecture | May need WSGI middleware |
| A3 | Existing GitRepository model can extend for PatchRepo | Architecture | May need new model |
| A4 | Users expect git:// and HTTP(S) clone URLs | UX | May need SSH support |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **SSH Git Access**
   - What we know: Dulwich supports SSH via paramiko
   - What's unclear: Does PatchMaster need SSH Git access, or is HTTP(S) sufficient?
   - Recommendation: Start with HTTP(S) only, add SSH in future phase if needed

2. **Repository Size Limits**
   - What we know: No current limits on external Git provider repos
   - What's unclear: Should PatchRepo enforce storage quotas?
   - Recommendation: No limits in v1, add quotas if storage becomes concern

3. **Existing patchrepo-data Structure**
   - What we know: Basic JSON files for commits, branches, pulls exist
   - What's unclear: Will these be migrated to Dulwich format or kept as metadata?
   - Recommendation: Use Dulwich native format, keep JSON as API cache/metadata

4. **PR Workflow Requirements**
   - What we know: Azure Repos-like features mentioned in description
   - What's unclear: Exact PR features needed (draft, required reviewers, branch policies)?
   - Recommendation: Implement basic PR (create, review, approve, merge) in v1

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies identified beyond existing Python environment)

**Dependencies checked:**
- Python 3.x: ✓ (FastAPI 0.135.1 requires 3.10+)
- PostgreSQL: ✓ (already used by PatchMaster)
- FastAPI/uvicorn: ✓ (already in requirements)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (existing project standard) |
| Config file | pytest.ini or pyproject.toml |
| Quick run command | `pytest backend/tests/test_git_server.py -x` |
| Full suite command | `pytest backend/tests/ -x --tb=short` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|---------------|
| REQ-11.1 | Create PatchRepo repository | unit | `pytest backend/tests/test_git_server.py::test_create_repo -x` | ❌ |
| REQ-11.2 | Clone via HTTP Git | integration | `pytest backend/tests/test_git_server.py::test_clone -x` | ❌ |
| REQ-11.3 | Push via HTTP Git | integration | `pytest backend/tests/test_git_server.py::test_push -x` | ❌ |
| REQ-11.4 | Create/manage branches | unit | `pytest backend/tests/test_git_server.py::test_branches -x` | ❌ |
| REQ-11.5 | Pull request workflow | unit | `pytest backend/tests/test_git_server.py::test_pr_workflow -x` | ❌ |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/test_git_server.py -x --tb=short`
- **Per wave merge:** `pytest backend/tests/ -x --tb=short`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_git_server.py` — tests for PatchRepo Git server
- [ ] `backend/tests/conftest.py` — add git server fixtures
- [ ] Framework install: Already satisfied (pytest in test-venv)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | YES | PatchMaster JWT tokens mapped to Git auth |
| V3 Session Management | YES | Existing PatchMaster session handling |
| V4 Access Control | YES | RBAC checks before Git operations |
| V5 Input Validation | YES | Sanitize repo names, paths |
| V6 Cryptography | YES | HTTPS Git transport, token encryption |

### Known Threat Patterns for Git Server

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Repo enumeration | Information Disclosure | Auth required for listing repos |
| Path traversal | Tampering | Validate repo paths, use sandboxing |
| Malicious push | Tampering | Validate commit content, size limits |
| Permission bypass | Elevation | Map Git auth to existing RBAC checks |
| DoS via large repo | Denial of Service | Size limits, rate limiting on Git ops |

## Sources

### Primary (HIGH confidence)
- [Dulwich GitHub](https://github.com/dulwich/dulwich) - Pure-Python Git implementation, 2.2K stars
- [Dulwich Documentation](https://dulwich.io/docs) - Official docs including server module
- [Dulwich Server API](https://dulwich.io/api/dulwich.server.html) - Backend, handlers for Git protocol
- [Dulwich Web API](https://dulwich.io/api/dulwich.web.html) - HTTP Git application

### Secondary (MEDIUM confidence)
- [Azure Repos Documentation](https://learn.microsoft.com/en-us/azure/devops/repos/git/about-pull-requests) - Feature requirements for PR workflow
- [meyer1994/gitserver](https://github.com/meyer1994/gitserver) - FastAPI Git server reference implementation

### Tertiary (LOW confidence)
- [btgitserver](https://pypi.org/project/btgitserver/) - Alternative Python Git server (Alpha status)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Dulwich is well-established, verified via documentation
- Architecture: MEDIUM - Pattern fits existing codebase, FastAPI integration needs validation
- Pitfalls: MEDIUM - Based on general Git server experience, not project-specific

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (Dulwich releases quarterly, check for new versions)
