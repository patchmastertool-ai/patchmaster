# Design Document: Enterprise Scale Fixes

## Overview

This design addresses 10 critical production issues (P0/P1) that prevent PatchMaster from scaling beyond 5,000 hosts. The fixes enable deployment to 100,000 hosts through database optimization, security hardening, resource management, and data validation.

**Affected Components:**
- Database connection pooling (backend/database.py)
- Host list pagination (backend/api/hosts_v2.py)
- CVE export permissions (backend/api/cve.py)
- Dashboard query optimization (backend/api/dashboard.py)
- Bulk patch validation (backend/api/bulk_patch.py)
- WebSocket resource management (backend/api/jobs_v2.py)

---

## Bug Condition Specifications

### BC-1: Database Connection Pool Exhaustion

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type SystemLoad
  OUTPUT: boolean
  
  // Bug occurs when concurrent requests exceed pool capacity
  RETURN (input.concurrent_requests > 30) AND (input.total_hosts > 5000)
END FUNCTION
```

**Concrete Failing Cases:**
- 100,000 agents polling every 60 seconds = 1,666 req/s
- Current pool: 30 connections
- Result: Pool exhaustion, 503 errors, indefinite hangs

---

### BC-2: Host List Memory Overflow

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type HostListRequest
  OUTPUT: boolean
  
  // Bug occurs when fetching large host lists without database pagination
  RETURN (input.total_hosts >= 10000) AND (input.uses_database_pagination = false)
END FUNCTION
```

**Concrete Failing Cases:**
- GET /api/hosts with 100,000 hosts
- Current: Loads all 200MB into memory
- Result: OOM crash

---

### BC-3: Missing Composite Database Indexes

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type DatabaseQuery
  OUTPUT: boolean
  
  // Bug occurs when querying by multiple columns without composite index
  RETURN (input.filters_by_created_at = true) AND 
         (input.filters_by_status = true) AND 
         (input.has_composite_index = false)
END FUNCTION
```

**Concrete Failing Cases:**
- Dashboard velocity chart queries by (created_at, status)
- Current: Full table scan on 100K+ records
- Result: Query timeout, dashboard load >25s

---

### BC-4: CVE Export Permission Bypass

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type ExportRequest
  OUTPUT: boolean
  
  // Bug occurs when viewer role can export sensitive data
  RETURN (input.user_role = "viewer") AND (input.endpoint = "/api/cve/export")
END FUNCTION
```

**Concrete Failing Cases:**
- User with role="viewer" calls GET /api/cve/export
- Current: Export succeeds, sensitive data leaked
- Result: Security vulnerability, unauthorized data access

---

### BC-5: Bulk Patch Invalid Hosts

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type BulkPatchRequest
  OUTPUT: boolean
  
  // Bug occurs when bulk patch accepts non-existent host IDs
  RETURN EXISTS(host_id IN input.host_ids WHERE NOT EXISTS(Host WHERE id = host_id))
END FUNCTION
```

**Concrete Failing Cases:**
- POST /api/bulk-patch with host_ids=[1, 2, 999999]
- Current: Bulk job created, fails silently on host 999999
- Result: Incorrect success counts, misleading status

---

### BC-6: CVE Sync Rate Limit

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type CVESyncRequest
  OUTPUT: boolean
  
  // Bug occurs when sync makes unlimited API requests
  RETURN (input.requests_per_minute > 5) AND (input.has_rate_limiter = false)
END FUNCTION
```

**Concrete Failing Cases:**
- Multiple /api/cve/sync calls in rapid succession
- Current: Unlimited requests to NVD API
- Result: IP banned, CVE sync fails for all users

---

### BC-7: WebSocket Memory Leak

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type WebSocketConnection
  OUTPUT: boolean
  
  // Bug occurs when WebSocket never closes after job completion
  RETURN (input.job_status IN ["success", "failed", "rolled_back"]) AND 
         (input.connection_open = true) AND 
         (input.has_timeout = false)
END FUNCTION
```

**Concrete Failing Cases:**
- 1000 clients monitor jobs, jobs complete, clients don't close
- Current: 1000 WebSocket connections remain open indefinitely
- Result: Memory exhaustion, system instability

---

### BC-8: Bulk Patch Status Incorrect

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type BulkPatchJob
  OUTPUT: boolean
  
  // Bug occurs when bulk job marked "completed" instead of "jobs_created"
  RETURN (input.individual_jobs_created = true) AND 
         (input.status = "completed") AND 
         (input.individual_jobs_pending = true)
END FUNCTION
```

**Concrete Failing Cases:**
- Bulk patch creates 100 individual jobs
- Current: Bulk job status = "completed" immediately
- Result: Misleading status, users think all patches applied

---

### BC-9: Dashboard N+1 Query

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type DashboardRequest
  OUTPUT: boolean
  
  // Bug occurs when recent jobs load without eager loading hosts
  RETURN (input.loads_recent_jobs = true) AND (input.uses_selectinload = false)
END FUNCTION
```

**Concrete Failing Cases:**
- Dashboard loads 5 recent jobs
- Current: 1 query for jobs + 5 queries for host details
- Result: 6 total queries, increased database load

---

### BC-10: Dashboard Velocity Performance

**Bug Condition:**
```pascal
FUNCTION isBugCondition(input)
  INPUT: input of type VelocityChartQuery
  OUTPUT: boolean
  
  // Bug occurs when velocity queries lack composite index
  RETURN (input.queries_by_date_and_status = true) AND 
         (input.has_composite_index = false)
END FUNCTION
```

**Concrete Failing Cases:**
- Dashboard velocity chart loads 7-day history
- Current: 7 separate queries without composite index
- Result: Full table scans, slow dashboard load

---

## Expected Behavior Properties

### EB-1: Connection Pool Capacity

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type ConnectionPoolResult
  OUTPUT: boolean
  
  RETURN (result.pool_size >= 150) AND
         (result.max_overflow >= 50) AND
         (result.connection_acquired = true) AND
         (result.response_time < 10_seconds) AND
         (result.status_code != 503)
END FUNCTION
```

**Implementation Details:**
- Set pool_size=150, max_overflow=50 in database.py
- Add pool_timeout=10 for fail-fast behavior
- Maintain pool_pre_ping=True for connection health

---

### EB-2: Host List Pagination

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type HostListResult
  OUTPUT: boolean
  
  RETURN (result.memory_usage < 10MB) AND
         (result.uses_limit_offset = true) AND
         (result.loads_only_page_records = true) AND
         (result.total_count_uses_count_query = true)
END FUNCTION
```

**Implementation Details:**
- Use SQLAlchemy .limit() and .offset() for database pagination
- Separate COUNT(*) query for total count
- Default per_page=50, max per_page=500

---

### EB-3: Composite Index Usage

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type QueryResult
  OUTPUT: boolean
  
  RETURN (result.uses_index_scan = true) AND
         (result.avoids_full_table_scan = true) AND
         (result.query_time < 100ms)
END FUNCTION
```

**Implementation Details:**
- Add composite index: CREATE INDEX idx_jobs_created_status ON patch_jobs(created_at, status)
- PostgreSQL will use index for queries filtering by both columns

---

### EB-4: CVE Export Permission

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type ExportResult
  OUTPUT: boolean
  
  RETURN (result.status_code = 403) AND
         (result.error_message = "Insufficient permissions to export CVE data") AND
         (result.allowed_roles = ["admin", "operator", "auditor"])
END FUNCTION
```

**Implementation Details:**
- Add role check: if current_user.role not in ["admin", "operator", "auditor"]: raise HTTPException(403)
- Maintain existing Authorization header authentication

---

### EB-5: Bulk Patch Validation

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type BulkPatchResult
  OUTPUT: boolean
  
  RETURN (result.status_code = 400) AND
         (result.error_message CONTAINS "Unknown host IDs") AND
         (result.invalid_ids = [list of invalid IDs]) AND
         (result.bulk_job_not_created = true)
END FUNCTION
```

**Implementation Details:**
- Query database for all provided host IDs
- Compare with input list to find invalid IDs
- Return 400 error before creating bulk job

---

### EB-6: CVE Sync Rate Limiting

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type CVESyncResult
  OUTPUT: boolean
  
  RETURN (result.requests_per_30_seconds <= 5) AND
         (result.uses_exponential_backoff = true) AND
         (result.respects_retry_after = true) AND
         (result.backoff_delays = [1s, 2s, 4s, 8s])
END FUNCTION
```

**Implementation Details:**
- Track last 5 request timestamps in memory
- If 5 requests in last 30 seconds, wait before next request
- On 429 response, implement exponential backoff: 1s, 2s, 4s, 8s
- Respect Retry-After header if present

---

### EB-7: WebSocket Timeout

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type WebSocketResult
  OUTPUT: boolean
  
  RETURN (result.connection_closed = true) AND
         (result.close_time <= 5_minutes) AND
         (result.closes_on_terminal_state = true) AND
         (result.resources_freed = true)
END FUNCTION
```

**Implementation Details:**
- Set 5-minute inactivity timeout on WebSocket connection
- Close connection after sending terminal state (success/failed/rolled_back)
- Use asyncio.wait_for() with timeout for receive operations

---

### EB-8: Bulk Patch Status

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type BulkPatchStatus
  OUTPUT: boolean
  
  RETURN (result.status = "jobs_created") AND
         (result.status != "completed") AND
         (result.individual_jobs_tracked = true)
END FUNCTION
```

**Implementation Details:**
- Set bulk_job.status = "jobs_created" after creating individual jobs
- Do NOT set status to "completed"
- Bulk job tracks job creation, not execution

---

### EB-9: Dashboard Query Optimization

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type DashboardResult
  OUTPUT: boolean
  
  RETURN (result.query_count = 1) AND
         (result.uses_eager_loading = true) AND
         (result.avoids_n_plus_one = true) AND
         (result.uses_selectinload = true)
END FUNCTION
```

**Implementation Details:**
- Use .options(selectinload(PatchJob.host)) when querying recent jobs
- SQLAlchemy will fetch jobs and hosts in single query
- Avoid accessing job.host.hostname in loop without eager loading

---

### EB-10: Velocity Query Performance

**Expected Behavior:**
```pascal
FUNCTION expectedBehavior(result)
  INPUT: result of type VelocityChartResult
  OUTPUT: boolean
  
  RETURN (result.uses_composite_index = true) AND
         (result.query_time < 100ms) AND
         (result.avoids_full_scan = true)
END FUNCTION
```

**Implementation Details:**
- Use composite index idx_jobs_created_status
- Query filters by created_at >= start_date AND status = 'success'
- PostgreSQL will use index for efficient filtering

---

## Preservation Requirements

### Database Operations
**Requirement 3.1:** Connection pool health checks (pool_pre_ping) MUST remain enabled  
**Requirement 3.2:** Connection recycling (pool_recycle=3600) MUST remain configured  
**Requirement 3.3:** Async SQLAlchemy sessions MUST continue to be used  
**Requirement 3.4:** Transaction rollback on failure MUST continue to work

### Host List Functionality
**Requirement 3.5:** Host list filtering by search/group/tag/site MUST continue to work  
**Requirement 3.6:** Host deduplication by IP/hostname MUST continue to function  
**Requirement 3.7:** Host list sorting by hostname MUST remain functional  
**Requirement 3.8:** Host list response format MUST remain unchanged

### CVE Export Functionality
**Requirement 3.9:** Authorized users (admin/operator/auditor) MUST still be able to export CVE data  
**Requirement 3.10:** CVE export CSV format MUST remain unchanged  
**Requirement 3.11:** CVE export Authorization header authentication MUST continue to work  
**Requirement 3.12:** CVE export host mappings MUST continue to include host details

### Dashboard Functionality
**Requirement 3.13:** Dashboard summary calculations (risk score, host counts, CVE stats) MUST remain accurate  
**Requirement 3.14:** Dashboard velocity chart 7-day history MUST continue to display correctly  
**Requirement 3.15:** Dashboard recent jobs list MUST continue to show last 5 jobs  
**Requirement 3.16:** Dashboard response format MUST remain unchanged

### Bulk Patch Functionality
**Requirement 3.17:** Valid bulk patch requests MUST continue to create individual PatchJob records  
**Requirement 3.18:** Bulk patch success_count and failed_count tracking MUST continue to work  
**Requirement 3.19:** Bulk patch job_ids array MUST continue to be stored  
**Requirement 3.20:** Bulk patch response format MUST remain unchanged

### WebSocket Functionality
**Requirement 3.21:** WebSocket job status updates every 2 seconds MUST continue for running jobs  
**Requirement 3.22:** WebSocket status change broadcasts MUST continue to work  
**Requirement 3.23:** WebSocket _job_to_out() serialization MUST remain unchanged  
**Requirement 3.24:** WebSocket connection for running jobs MUST remain open

### CVE Sync Functionality
**Requirement 3.25:** CVE sync NVD API fetching MUST continue to work  
**Requirement 3.26:** CVE sync metadata enrichment MUST continue to function  
**Requirement 3.27:** CVE sync CVE ID format validation MUST continue to work  
**Requirement 3.28:** CVE sync created/updated counts MUST continue to be returned

---

## Implementation Strategy

### Phase 1: Database Optimization (P0)
1. Increase connection pool size (BC-1)
2. Add database pagination to host list (BC-2)
3. Create composite indexes (BC-3)

### Phase 2: Security & Validation (P1)
4. Add CVE export permission check (BC-4)
5. Add bulk patch host validation (BC-5)
6. Implement CVE sync rate limiting (BC-6)

### Phase 3: Resource Management (P1)
7. Add WebSocket timeout and auto-close (BC-7)
8. Fix bulk patch status (BC-8)

### Phase 4: Query Optimization (P1)
9. Add eager loading to dashboard queries (BC-9)
10. Optimize velocity chart queries (BC-10)

---

## Testing Strategy

### Exploration Tests (Before Fix)
- Test each bug condition with concrete failing cases
- Verify tests FAIL on unfixed code
- Document counterexamples found

### Preservation Tests (Before Fix)
- Test non-buggy inputs on unfixed code
- Observe and record actual behavior
- Write property-based tests capturing observed patterns
- Verify tests PASS on unfixed code

### Validation Tests (After Fix)
- Re-run exploration tests, verify they PASS
- Re-run preservation tests, verify they still PASS
- Confirm no regressions in existing functionality

---

## Success Criteria

### P0 Fixes (Production Blockers)
- ✅ Database connection pool supports 150-200 connections
- ✅ Host list endpoint uses database pagination for 100K hosts
- ✅ Composite indexes added for dashboard velocity queries

### P1 Fixes (Must Fix Before Scale)
- ✅ CVE export enforces role-based access control
- ✅ Bulk patch validates all host IDs before job creation
- ✅ CVE sync implements rate limiting with exponential backoff
- ✅ WebSocket connections timeout and close after job completion
- ✅ Bulk patch status accurately reflects "jobs_created" state
- ✅ Dashboard queries use eager loading to avoid N+1 problems
- ✅ Dashboard velocity queries use composite indexes

### Performance Targets
- Dashboard load time <5s with 100K hosts
- Host list API response <200ms with pagination
- Connection pool handles 1,666 req/s without exhaustion
- WebSocket memory usage remains constant over time

