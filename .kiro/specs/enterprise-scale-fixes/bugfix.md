# Bugfix Requirements Document: Enterprise Scale Fixes

## Introduction

This document addresses 10 critical production issues identified in the Enterprise Scale Test Report for 100,000 machine deployments. The system is currently production-ready for <5,000 hosts but requires these fixes to scale to 100,000 hosts. These issues span database performance, security vulnerabilities, data validation, and resource management.

**Affected Components:**
- Database connection pooling (backend/database.py)
- Host list pagination (backend/api/hosts_v2.py)
- CVE export permissions (backend/api/cve.py)
- Dashboard query optimization (backend/api/dashboard.py)
- Bulk patch validation (backend/api/bulk_patch.py)
- WebSocket resource management (backend/api/jobs_v2.py)

**Impact:** System cannot scale beyond 5,000 hosts without these fixes. Critical security vulnerability allows unauthorized data export.

---

## Bug Analysis

### Current Behavior (Defect)

#### P0-1: Database Connection Pool Exhaustion
1.1 WHEN 100K agents make concurrent requests (1,666 req/s) THEN the system exhausts the 30-connection pool and returns 503 errors

1.2 WHEN connection pool is exhausted THEN new requests hang indefinitely waiting for available connections

1.3 WHEN the system scales beyond 5,000 hosts THEN database connection pool becomes a bottleneck causing request timeouts

#### P0-2: Host List Endpoint Memory Overflow
1.4 WHEN GET /api/hosts is called with 100K hosts THEN the system loads all 100K records into memory (200MB) causing OOM crash

1.5 WHEN pagination parameters are provided THEN the system still loads ALL hosts from database before applying in-memory pagination

1.6 WHEN multiple concurrent requests fetch host lists THEN memory usage multiplies causing system instability

#### P0-3: Missing Composite Database Indexes
1.7 WHEN dashboard velocity chart queries by (created_at, status) THEN the system performs full table scan without composite index

1.8 WHEN complex queries filter by multiple columns THEN query performance degrades exponentially with data growth

#### P1-1: CVE Export Permission Bypass
1.9 WHEN a user with "viewer" role calls GET /api/cve/export THEN the system allows export of sensitive CVE data without role validation

1.10 WHEN any authenticated user accesses the export endpoint THEN they can download complete CVE reports including host details

#### P1-2: Bulk Patch Host Validation Missing
1.11 WHEN POST /api/bulk-patch is called with invalid host IDs THEN the system creates a bulk job without validating host existence

1.12 WHEN bulk patch job runs with invalid host IDs THEN individual job creation fails silently, leaving incorrect success counts

#### P1-3: CVE Sync Rate Limiting Not Implemented
1.13 WHEN /api/cve/sync is called repeatedly THEN the system makes unlimited requests to NVD API without rate limiting

1.14 WHEN NVD API rate limit is exceeded THEN the IP gets banned and CVE sync fails for all users

#### P1-4: Job Status WebSocket Memory Leak
1.15 WHEN WebSocket connection is established at /ws/job/{job_id} THEN the connection never times out or closes automatically

1.16 WHEN job completes but client doesn't close connection THEN WebSocket remains open indefinitely consuming memory

1.17 WHEN multiple clients monitor jobs THEN unclosed WebSocket connections accumulate causing memory exhaustion

#### P1-5: Bulk Patch Status Incorrect
1.18 WHEN bulk patch job creates individual jobs THEN the bulk job status is set to "completed" instead of "jobs_created"

1.19 WHEN individual patch jobs are still pending THEN the bulk job incorrectly reports as "completed" misleading users

#### P1-6: Dashboard Recent Jobs N+1 Query
1.20 WHEN dashboard loads recent jobs THEN the system makes 1 query for jobs + N queries for host details (N+1 problem)

1.21 WHEN dashboard is accessed frequently THEN database load increases linearly with number of recent jobs

#### P1-7: Dashboard Velocity Query Performance
1.22 WHEN dashboard velocity chart loads THEN the system makes 7 separate queries (one per day) without using composite index

1.23 WHEN velocity chart queries filter by created_at and status THEN full table scans occur on large datasets

---

### Expected Behavior (Correct)

#### P0-1: Database Connection Pool Sizing
2.1 WHEN 100K agents make concurrent requests THEN the system SHALL handle load with 150-200 database connections without exhaustion

2.2 WHEN connection pool reaches capacity THEN the system SHALL fail fast with 10-second timeout instead of hanging indefinitely

2.3 WHEN the system scales to 100K hosts THEN database connection pool SHALL support 1,666 req/s throughput

#### P0-2: Host List Pagination
2.4 WHEN GET /api/hosts is called with pagination parameters THEN the system SHALL use database-level LIMIT/OFFSET to fetch only requested page

2.5 WHEN 100K hosts exist THEN the system SHALL load only per_page records (default 50) into memory per request

2.6 WHEN counting total hosts THEN the system SHALL use COUNT query without loading full records

#### P0-3: Composite Database Indexes
2.7 WHEN dashboard velocity chart queries by (created_at, status) THEN the system SHALL use composite index for efficient filtering

2.8 WHEN complex queries filter by multiple columns THEN the system SHALL leverage composite indexes to avoid full table scans

#### P1-1: CVE Export Permission Enforcement
2.9 WHEN a user with "viewer" role calls GET /api/cve/export THEN the system SHALL return 403 Forbidden error

2.10 WHEN CVE export is requested THEN the system SHALL verify user role is admin, operator, or auditor before allowing export

#### P1-2: Bulk Patch Host Validation
2.11 WHEN POST /api/bulk-patch is called with host IDs THEN the system SHALL validate all host IDs exist before creating bulk job

2.12 WHEN invalid host IDs are provided THEN the system SHALL return 400 Bad Request with list of invalid IDs

#### P1-3: CVE Sync Rate Limiting
2.13 WHEN /api/cve/sync is called THEN the system SHALL enforce rate limit of 5 requests per 30 seconds to NVD API

2.14 WHEN rate limit is exceeded THEN the system SHALL implement exponential backoff with delays of 1s, 2s, 4s, 8s

2.15 WHEN NVD API returns 429 Too Many Requests THEN the system SHALL wait for retry-after period before retrying

#### P1-4: Job Status WebSocket Timeout
2.16 WHEN WebSocket connection is established THEN the system SHALL set 5-minute inactivity timeout

2.17 WHEN job reaches terminal state (success/failed/rolled_back) THEN the system SHALL close WebSocket connection after sending final status

2.18 WHEN WebSocket timeout is reached THEN the system SHALL close connection and free resources

#### P1-5: Bulk Patch Status Accuracy
2.19 WHEN bulk patch job creates individual jobs THEN the bulk job status SHALL be set to "jobs_created" not "completed"

2.20 WHEN all individual jobs complete THEN the bulk job status SHALL remain "jobs_created" (bulk job only tracks job creation, not execution)

#### P1-6: Dashboard Recent Jobs Query Optimization
2.21 WHEN dashboard loads recent jobs THEN the system SHALL use eager loading (selectinload) to fetch jobs and hosts in single query

2.22 WHEN recent jobs are displayed THEN the system SHALL avoid N+1 queries by pre-loading host relationships

#### P1-7: Dashboard Velocity Query Optimization
2.23 WHEN dashboard velocity chart loads THEN the system SHALL use composite index on (created_at, status) for efficient filtering

2.24 WHEN velocity queries execute THEN the system SHALL leverage index to avoid full table scans

---

### Unchanged Behavior (Regression Prevention)

#### Database Operations
3.1 WHEN connection pool is properly sized THEN the system SHALL CONTINUE TO use pool_pre_ping and pool_recycle for connection health

3.2 WHEN database queries execute THEN the system SHALL CONTINUE TO use async SQLAlchemy sessions

3.3 WHEN transactions fail THEN the system SHALL CONTINUE TO rollback automatically

#### Host List Functionality
3.4 WHEN host list is filtered by search/group/tag/site THEN the system SHALL CONTINUE TO apply filters correctly

3.5 WHEN host deduplication runs THEN the system SHALL CONTINUE TO merge duplicates by IP/hostname

3.6 WHEN host list is sorted THEN the system SHALL CONTINUE TO order by hostname

#### CVE Export Functionality
3.7 WHEN authorized users export CVE data THEN the system SHALL CONTINUE TO generate CSV with all required fields

3.8 WHEN CVE export uses Authorization header THEN the system SHALL CONTINUE TO authenticate via JWT token

3.9 WHEN CVE export includes host mappings THEN the system SHALL CONTINUE TO join HostCVE and Host tables

#### Dashboard Functionality
3.10 WHEN dashboard summary loads THEN the system SHALL CONTINUE TO calculate risk score, host counts, and CVE statistics

3.11 WHEN dashboard velocity chart displays THEN the system SHALL CONTINUE TO show 7-day patch job history

3.12 WHEN dashboard recent jobs display THEN the system SHALL CONTINUE TO show last 5 jobs with host details

#### Bulk Patch Functionality
3.13 WHEN bulk patch job is created THEN the system SHALL CONTINUE TO create individual PatchJob records per host

3.14 WHEN bulk patch runs THEN the system SHALL CONTINUE TO track success_count and failed_count

3.15 WHEN bulk patch completes THEN the system SHALL CONTINUE TO store job_ids array

#### WebSocket Functionality
3.16 WHEN WebSocket connects THEN the system SHALL CONTINUE TO send job status updates every 2 seconds

3.17 WHEN job status changes THEN the system SHALL CONTINUE TO broadcast updates to connected clients

3.18 WHEN WebSocket sends data THEN the system SHALL CONTINUE TO use _job_to_out() serialization

#### CVE Sync Functionality
3.19 WHEN CVE sync runs THEN the system SHALL CONTINUE TO fetch from NVD API and enrich with metadata

3.20 WHEN CVE sync processes records THEN the system SHALL CONTINUE TO validate CVE ID format

3.21 WHEN CVE sync completes THEN the system SHALL CONTINUE TO return created/updated counts

---

## Bug Condition Analysis

### Bug Condition Functions

#### BC-1: Database Connection Pool Exhaustion
```pascal
FUNCTION isBugCondition_ConnectionPool(X)
  INPUT: X of type SystemLoad
  OUTPUT: boolean
  
  // Bug occurs when concurrent requests exceed pool capacity
  RETURN (X.concurrent_requests > 30) AND (X.total_hosts > 5000)
END FUNCTION
```

#### BC-2: Host List Memory Overflow
```pascal
FUNCTION isBugCondition_HostList(X)
  INPUT: X of type HostListRequest
  OUTPUT: boolean
  
  // Bug occurs when fetching large host lists without database pagination
  RETURN (X.total_hosts >= 10000) AND (X.uses_database_pagination = false)
END FUNCTION
```

#### BC-3: Missing Composite Indexes
```pascal
FUNCTION isBugCondition_MissingIndex(X)
  INPUT: X of type DatabaseQuery
  OUTPUT: boolean
  
  // Bug occurs when querying by multiple columns without composite index
  RETURN (X.filters_by_created_at = true) AND 
         (X.filters_by_status = true) AND 
         (X.has_composite_index = false)
END FUNCTION
```

#### BC-4: CVE Export Permission Bypass
```pascal
FUNCTION isBugCondition_CVEExport(X)
  INPUT: X of type ExportRequest
  OUTPUT: boolean
  
  // Bug occurs when viewer role can export sensitive data
  RETURN (X.user_role = "viewer") AND (X.endpoint = "/api/cve/export")
END FUNCTION
```

#### BC-5: Bulk Patch Invalid Hosts
```pascal
FUNCTION isBugCondition_BulkPatch(X)
  INPUT: X of type BulkPatchRequest
  OUTPUT: boolean
  
  // Bug occurs when bulk patch accepts non-existent host IDs
  RETURN EXISTS(host_id IN X.host_ids WHERE NOT EXISTS(Host WHERE id = host_id))
END FUNCTION
```

#### BC-6: CVE Sync Rate Limit
```pascal
FUNCTION isBugCondition_CVESync(X)
  INPUT: X of type CVESyncRequest
  OUTPUT: boolean
  
  // Bug occurs when sync makes unlimited API requests
  RETURN (X.requests_per_minute > 5) AND (X.has_rate_limiter = false)
END FUNCTION
```

#### BC-7: WebSocket Memory Leak
```pascal
FUNCTION isBugCondition_WebSocket(X)
  INPUT: X of type WebSocketConnection
  OUTPUT: boolean
  
  // Bug occurs when WebSocket never closes after job completion
  RETURN (X.job_status IN ["success", "failed", "rolled_back"]) AND 
         (X.connection_open = true) AND 
         (X.has_timeout = false)
END FUNCTION
```

#### BC-8: Bulk Patch Status Incorrect
```pascal
FUNCTION isBugCondition_BulkStatus(X)
  INPUT: X of type BulkPatchJob
  OUTPUT: boolean
  
  // Bug occurs when bulk job marked "completed" instead of "jobs_created"
  RETURN (X.individual_jobs_created = true) AND 
         (X.status = "completed") AND 
         (X.individual_jobs_pending = true)
END FUNCTION
```

#### BC-9: Dashboard N+1 Query
```pascal
FUNCTION isBugCondition_DashboardN1(X)
  INPUT: X of type DashboardRequest
  OUTPUT: boolean
  
  // Bug occurs when recent jobs load without eager loading hosts
  RETURN (X.loads_recent_jobs = true) AND (X.uses_selectinload = false)
END FUNCTION
```

#### BC-10: Dashboard Velocity Performance
```pascal
FUNCTION isBugCondition_VelocityQuery(X)
  INPUT: X of type VelocityChartQuery
  OUTPUT: boolean
  
  // Bug occurs when velocity queries lack composite index
  RETURN (X.queries_by_date_and_status = true) AND 
         (X.has_composite_index = false)
END FUNCTION
```

---

## Property Specifications

### Fix Checking Properties

#### Property 1: Connection Pool Capacity
```pascal
// Property: Fix Checking - Connection Pool Handles 100K Load
FOR ALL X WHERE isBugCondition_ConnectionPool(X) DO
  result ← handleRequest'(X)
  ASSERT (result.connection_acquired = true) AND 
         (result.response_time < 10_seconds) AND
         (result.status_code != 503)
END FOR
```

#### Property 2: Host List Pagination
```pascal
// Property: Fix Checking - Host List Uses Database Pagination
FOR ALL X WHERE isBugCondition_HostList(X) DO
  result ← listHosts'(X)
  ASSERT (result.memory_usage < 10MB) AND 
         (result.uses_limit_offset = true) AND
         (result.loads_only_page_records = true)
END FOR
```

#### Property 3: Composite Index Usage
```pascal
// Property: Fix Checking - Queries Use Composite Index
FOR ALL X WHERE isBugCondition_MissingIndex(X) DO
  result ← executeQuery'(X)
  ASSERT (result.uses_index_scan = true) AND 
         (result.avoids_full_table_scan = true) AND
         (result.query_time < 100ms)
END FOR
```

#### Property 4: CVE Export Permission
```pascal
// Property: Fix Checking - CVE Export Enforces Roles
FOR ALL X WHERE isBugCondition_CVEExport(X) DO
  result ← exportCVE'(X)
  ASSERT (result.status_code = 403) AND 
         (result.error_message CONTAINS "Insufficient permissions")
END FOR
```

#### Property 5: Bulk Patch Validation
```pascal
// Property: Fix Checking - Bulk Patch Validates Hosts
FOR ALL X WHERE isBugCondition_BulkPatch(X) DO
  result ← createBulkPatch'(X)
  ASSERT (result.status_code = 400) AND 
         (result.error_message CONTAINS "Unknown host IDs") AND
         (result.invalid_ids = [list of invalid IDs])
END FOR
```

#### Property 6: CVE Sync Rate Limiting
```pascal
// Property: Fix Checking - CVE Sync Enforces Rate Limits
FOR ALL X WHERE isBugCondition_CVESync(X) DO
  result ← syncCVE'(X)
  ASSERT (result.requests_per_minute <= 5) AND 
         (result.uses_exponential_backoff = true) AND
         (result.respects_retry_after = true)
END FOR
```

#### Property 7: WebSocket Timeout
```pascal
// Property: Fix Checking - WebSocket Closes After Job Completion
FOR ALL X WHERE isBugCondition_WebSocket(X) DO
  result ← monitorJobStatus'(X)
  ASSERT (result.connection_closed = true) AND 
         (result.close_time <= 5_minutes) AND
         (result.resources_freed = true)
END FOR
```

#### Property 8: Bulk Patch Status
```pascal
// Property: Fix Checking - Bulk Patch Status Accurate
FOR ALL X WHERE isBugCondition_BulkStatus(X) DO
  result ← getBulkPatchStatus'(X)
  ASSERT (result.status = "jobs_created") AND 
         (result.status != "completed")
END FOR
```

#### Property 9: Dashboard Query Optimization
```pascal
// Property: Fix Checking - Dashboard Avoids N+1 Queries
FOR ALL X WHERE isBugCondition_DashboardN1(X) DO
  result ← loadDashboard'(X)
  ASSERT (result.query_count = 1) AND 
         (result.uses_eager_loading = true) AND
         (result.avoids_n_plus_one = true)
END FOR
```

#### Property 10: Velocity Query Performance
```pascal
// Property: Fix Checking - Velocity Chart Uses Index
FOR ALL X WHERE isBugCondition_VelocityQuery(X) DO
  result ← loadVelocityChart'(X)
  ASSERT (result.uses_composite_index = true) AND 
         (result.query_time < 100ms) AND
         (result.avoids_full_scan = true)
END FOR
```

### Preservation Checking

```pascal
// Property: Preservation Checking - All Non-Buggy Inputs Unchanged
FOR ALL X WHERE NOT (
  isBugCondition_ConnectionPool(X) OR
  isBugCondition_HostList(X) OR
  isBugCondition_MissingIndex(X) OR
  isBugCondition_CVEExport(X) OR
  isBugCondition_BulkPatch(X) OR
  isBugCondition_CVESync(X) OR
  isBugCondition_WebSocket(X) OR
  isBugCondition_BulkStatus(X) OR
  isBugCondition_DashboardN1(X) OR
  isBugCondition_VelocityQuery(X)
) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that:
- Small deployments (<5K hosts) continue working normally
- Authorized CVE exports still function
- Valid bulk patch requests process correctly
- Normal-rate CVE syncs work unchanged
- WebSockets for running jobs remain open
- All other API endpoints maintain existing behavior

---

## Counterexamples

### Example 1: Connection Pool Exhaustion
```
Input: 100,000 agents polling every 60 seconds = 1,666 req/s
Current: 30 connections exhausted, 503 errors, requests hang
Expected: 150 connections handle load, <10s timeout, no 503 errors
```

### Example 2: Host List OOM
```
Input: GET /api/hosts with 100,000 hosts
Current: Loads 200MB into memory, OOM crash
Expected: Loads 50 records (per_page default), ~100KB memory
```

### Example 3: CVE Export Bypass
```
Input: User with role="viewer" calls GET /api/cve/export
Current: Export succeeds, sensitive data leaked
Expected: 403 Forbidden, "Insufficient permissions to export CVE data"
```

### Example 4: Bulk Patch Invalid Hosts
```
Input: POST /api/bulk-patch with host_ids=[1, 2, 999999]
Current: Bulk job created, fails silently on host 999999
Expected: 400 Bad Request, "Unknown host IDs: [999999]"
```

### Example 5: WebSocket Memory Leak
```
Input: 1000 clients monitor jobs, jobs complete, clients don't close
Current: 1000 WebSocket connections remain open indefinitely
Expected: WebSockets auto-close after job completion or 5-minute timeout
```

---

## Testing Strategy

### Unit Tests
- Test connection pool exhaustion with simulated high load
- Test host list pagination with 100K mock records
- Test CVE export with different user roles
- Test bulk patch validation with invalid host IDs
- Test WebSocket timeout and auto-close logic

### Integration Tests
- Test dashboard queries with composite indexes
- Test CVE sync rate limiting with mock NVD API
- Test bulk patch status accuracy through full workflow
- Test N+1 query prevention with query count assertions

### Performance Tests
- Benchmark host list endpoint with 10K, 50K, 100K hosts
- Benchmark dashboard load time with large datasets
- Benchmark connection pool under 1,666 req/s load
- Measure WebSocket memory usage over time

### Security Tests
- Verify CVE export rejects viewer role
- Verify rate limiting prevents API abuse
- Verify bulk patch validation prevents invalid operations

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

### Scalability Validation
- System supports 10,000 hosts without performance degradation
- System supports 50,000 hosts with acceptable performance
- System supports 100,000 hosts with all fixes applied
