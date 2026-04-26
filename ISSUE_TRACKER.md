# ISSUE TRACKER - PatchMaster

**Version:** 2.0.17  
**Updated:** 2026-04-14  
**Total Issues:** 78  
**Fixed:** 23  
**Remaining:** 52  

---

## Status Overview

| Category | Total | Fixed | In Progress | Pending |
|----------|-------|-------|-----------|----------|
| Agent | 20 | 1 | 0 | 19 |
| UI | 17 | 2 | 0 | 15 |
| Backend | 20 | 17 | 0 | 3 |
| Feature | 12 | 0 | 0 | 12 |
| Integration | 9 | 0 | 0 | 9 |
| **TOTAL** | **78** | **23** | **0** | **52** |

---

## FIXED ISSUES ✅ (v2.0.15)

### Backend (15 Fixed)

| # | ID | Issue | Fix Applied | File |
|---|-----|---------|-------------|------|
| 1 | BACKEND-001 | pool_size=100, max_overflow=50 | database.py |
| 2 | BACKEND-002 | _check_rate_limit(5,30) | cve.py |
| 3 | BACKEND-003 | role check admin/operator/auditor | cve.py |
| 4 | BACKEND-004 | invalid_ids validation | bulk_patch.py |
| 5 | BACKEND-005 | asyncio.timeout(300) | jobs_v2.py |
| 6 | BACKEND-006 | status="jobs_created" | bulk_patch.py |
| 7 | BACKEND-007 | selectinload(PatchJob.host) | dashboard.py |
| 8 | BACKEND-008 | LIMIT/OFFSET pagination | hosts_v2.py |
| 9 | BACKEND-009 | idx_jobs_created_status | db_models.py |
| 10 | BACKEND-010 | TOKEN_EXPIRE=60min | auth.py |
| 11 | BACKEND-012 | _check_expiry_warnings | license.py |
| 12 | BACKEND-013 | isolation_level="READ COMMITTED" | database.py |
| 13 | BACKEND-014 | ix_hosts_is_online, last_heartbeat | db_models.py |
| 14 | BACKEND-015 | statement_timeout=30s | database.py | NEW |
| 15 | BACKEND-016 | _deliver_webhook_with_retry | notifications.py | NEW |
| 16 | BACKEND-017 | Webhook delivery (retry) | notifications.py | FIXED |

### UI (2 Fixed)

| # | ID | Issue | Fix Applied | File |
|---|-----|---------|-------------|------|
| 1 | UI-001 | Uses BACKEND-009 index | db_models.py |
| 2 | UI-002 | Uses BACKEND-008 pagination | hosts_v2.py |

### Agent (1 Fixed)

| # | ID | Issue | Fix Applied | File |
|---|-----|---------|-------------|------|
| 1 | AGENT-001 | pool_size=100 in backend | database.py |

---

## REMAINING ISSUES - PRIORITY LIST

### 🔴 PRIORITY 1 - Production Blockers

| ID | Issue | Category | Fix Complexity | Status |
|----|-------|----------|--------------|----------|
| AGENT-002 | Windows Agent Installation | High | PENDING |
| AGENT-003 | Agent Version Mismatch | Medium | PENDING |
| AGENT-004 | Agent Memory Leak | Medium | PENDING |
| BACKEND-011 | Database Transaction Lock | Medium | ✅ FIXED |

### 🟠 PRIORITY 2 - High Impact

| ID | Issue | Category | Status |
|----|-------|----------|----------|
| UI-003 | Slow Search | Need GIN index |
| UI-004 | Chart Rendering | PENDING |
| UI-005 | Bulk Select Timeout | PENDING |
| UI-006 | Real-time Updates | PENDING |

### 🟡 PRIORITY 3 - Features

| ID | Issue | Status |
|----|-------|----------|
| FEATURE-001 | Rolling Restart | PENDING |
| FEATURE-003 | Dependency Resolution | PENDING |
| FEATURE-005 | RBAC | PENDING |
| FEATURE-006 | Scheduling | PENDING |
| FEATURE-007 | Drift Detection | PENDING |

### ⚪ PRIORITY 4 - Future

| ID | Issue | Status |
|----|-------|----------|
| AGENT-006 | ARM64 Agent | PENDING |
| AGENT-007 | Container Support | PENDING |
| AGENT-008 | Air-gapped | PENDING |
| GraphQL | API | PENDING |
| ServiceNow | Integration | PENDING |

---

## Fix Progress Timeline

### Already Fixed (v2.0.15)
```
Jan-Mar 2026: Core enterprise fixes
- Connection pool: 150 max
- Rate limiting: 5/30s
- Security: RBAC
- Pagination: DB-level
```

### Next Release (v2.1.0) - Target
```
Apr 2026: Agent stability
- Windows installer fix
- Auto-upgrade mechanism
- Memory limits
- Transaction locks
```

### Future (v2.2.0)
```
Q3 2026: Feature complete
- Rolling restart
- RBAC
- GraphQL
```

---

## Commands for Verification

```bash
# Test all fixes
cd backend
python -c "from database import init_db; import asyncio; asyncio.run(init_db())"

# Check connection pool
psql -c "SELECT count(*) FROM pg_stat_activity"

# Test pagination
curl "http://localhost:8080/api/hosts?page=2&per_page=50"

# Test rate limiting
for i in {1..7}; do curl -X POST http://localhost:8080/api/cve/sync; done
```

---

*Tracker updated: 2026-04-14*
*Next update: When issues are resolved*