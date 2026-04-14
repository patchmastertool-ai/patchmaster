# Roadmap

## v2.1.0 - Additional UI/UX Enhancements and Remaining Fixes

### Phase 3: Additional UI/UX Enhancements and Remaining Fixes

**Goal:** Address remaining UI/UX issues including chart rendering, bulk select, real-time updates, timezone handling, and pagination UX

**Depends on:** Phase 2

**Issues:**

- UI-004: Chart Rendering (large datasets)
- UI-005: Bulk Select Timeout (500+ items)
- UI-006: Real-time Updates
- UI-008: Date/Time Issues (timezone)
- UI-010: Pagination Reset (UX)

**Plans:**
- [x] 03-01-PLAN.md — Fix 5 UI/UX issues (chart rendering, bulk select, real-time, timezone, pagination)
### Phase 4: Features and Integration Implementation

**Goal:** Implement remaining Features (12) and Integrations (9), plus 3 backend issues

**Depends on:** Phase 3

**Issues:**

Features (12):
- FEAT-001: Rolling Restart
- FEAT-002: Windows Snapshot
- FEAT-003: Dependency Resolution
- FEAT-004: Canary Testing
- FEAT-005: RBAC
- FEAT-006: Scheduling
- FEAT-007: Drift Detection
- FEAT-008: Compliance
- FEAT-009: Audit Trail
- FEAT-010: Multi-tenancy
- FEAT-011: Plugin Framework
- FEAT-012: Custom Reports

Integration (9):
- INT-001: GraphQL API
- INT-002: Webhook Retry
- INT-003: Prometheus Metrics
- INT-004: Splunk
- INT-005: Sumo Logic
- INT-006: ServiceNow
- INT-007: Jira
- INT-008: Slack
- INT-009: Custom integrations

Backend (3):
- BACK-001: Logging Performance
- BACK-002: Timezone Handling
- BACK-003: IPv6 Support

**Plans:**
- [x] 04-01-PLAN.md — Core APIs + Integrations (GraphQL, webhook retry, drift, multi-tenant, Prometheus, Splunk/Sumo/ServiceNow)
- [x] 04-02-PLAN.md — Core Features (dependency resolution, RBAC, compliance, audit, plugins, reports, scheduling)
- [x] 04-03-PLAN.md — Remaining Integrations (Jira, Slack, custom, timezone, rolling restart, Windows snapshots, canary)
- [x] 04-04-PLAN.md — Gap Closure (wire 8 unwired artifacts to main.py)

### Phase 5: Agent Blockers, UI Fixes, and Backend Completion

**Goal:** Fix remaining Agent blockers (Windows installer, version mismatch, memory leak), UI issues (slow search, export, themes, etc.), and complete Backend issues (logging, timezone, IPv6)

**Depends on:** Phase 4

**Issues:**

Agent Blockers (3):
- AGENT-002: Windows Agent Installation
- AGENT-003: Agent Version Mismatch
- AGENT-004: Agent Memory Leak

UI Issues (15):
- UI-003: Slow Search
- UI-007: Export Failed
- UI-013: Theme Switching
- UI-014: Keyboard Nav
- UI-015: Tooltips
- UI-016: Print Styles
- UI-017: CSV Encoding
- UI-009: Filter Persistence
- UI-011: Mobile Responsive
- UI-012: Accessibility (ARIA)

Backend (3):
- BACK-018: Logging Performance
- BACK-019: Timezone Handling
- BACK-020: IPv6 Support

**Plans:**
- [x] 05-01-PLAN.md — Agent Blockers and Backend Completion
- [x] 05-02-PLAN.md — UI Fixes and Enhancements

## v2.2.0 - Security Hardening

### Phase 6: Security Foundation

**Goal:** Address security vulnerabilities, implement authentication improvements, and add compliance features

**Depends on:** Phase 5

**Issues:**

Security Hardening:
- SEC-001: Authentication improvements (MFA support, token refresh)
- SEC-002: Input validation and sanitization (XSS, SQL injection prevention)
- SEC-003: Session management (secure cookies, timeout, refresh tokens)
- SEC-004: API security (rate limiting, CORS, security headers)
- SEC-005: RBAC improvements (granular permissions)
- SEC-006: Audit logging for security events

**Plans:**
- [x] 06-01-PLAN.md — Security Foundation (auth, validation, sessions, RBAC, audit)

## v2.3.0 - Feature Completion

**Goal:** Complete all remaining 53 issues across Agent, UI, Backend, Features, and Integrations

**Depends on:** Phase 6

### Pending Issues (53 total)

| Category | Pending |
|----------|---------|
| Agent | 20 |
| UI | 2 |
| Backend | 10 |
| Features | 12 |
| Integration | 9 |

**Plans:**
- [ ] 07-01 — Agent Features (rolling restart, snapshot, canary)
- [ ] 07-02 — Backend Optimization (caching, queries)
- [ ] 07-03 — Remaining UI fixes (2 issues)
- [ ] 07-04 — Integrations (GraphQL, webhooks, metrics, SIEM)
- [ ] 07-05 — Advanced Features (multi-tenancy, plugins, reports)
