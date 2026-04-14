---
phase: "01"
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - agent/main.py
  - agent/agent.py
  - agent/windows_installer.py
autonomous: false
requirements:
  - AGENT-002
  - AGENT-003
  - AGENT-004
---

<objective>
Fix critical agent stability issues: Windows installation failures, version mismatch, and memory leak detection.

Purpose: Ensure reliable agent deployment and operation on Windows systems.
Output: Verified installer, version sync, and memory profiling tools.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@ISSUE_TRACKER.md (lines 66-70: AGENT-002, AGENT-003, AGENT-004 priority issues)

@agent/main.py:
- Line 21: AGENT_VERSION from env with fallback "2.0.0"
- Lines 302-316: register() function sends version in inventory
- Lines 318-333: heartbeat() sends version in body

@agent/agent.py:
- Line 46: __version__ = "2.0.0" (module-level version)
- Lines 237-265: update_metrics_loop() runs continuously with 15s sleep

@agent/windows_installer.py:
- Lines 458-471: File copy with retry logic after killing processes
- Lines 271-276: Service installation with error handling

@backend/api/agent_update.py:
- Lines 96-110: get_agent_versions() API endpoint
</context>

<tasks>

<task type="auto">
  <name>Task 1: Document AGENT-002 failure scenarios and improve installer resilience</name>
  <files>agent/windows_installer.py</files>
  <action>
Add comprehensive failure handling and logging for common Windows installation scenarios:

1. Add failure detection for:
   - Permission denied on Program Files
   - Service registration timeout
   - Firewall rule creation failure
   - Winsw.exe binary missing or corrupted

2. Improve error messages to include:
   - Specific failure point (file copy vs service install vs firewall)
   - Suggested resolution (e.g., "Run as Administrator" vs "Disable antivirus")

3. Add retry logic with exponential backoff for:
   - Service startup (lines 286-298: _install_services)
   - Health check polling

4. Add diagnostic dump on failure:
   - Service status via sc query
   - Event log excerpt for Windows service errors
</action>
  <verify>
Automated: python agent/windows_installer.py --help shows help without errors
Manual: Test installer on clean Windows VM with various failure conditions
  </verify>
  <done>Installation failures produce actionable error messages with suggested resolutions</done>
</task>

<task type="auto">
  <name>Task 2: Verify and enhance AGENT-003 version synchronization</name>
  <files>agent/main.py, agent/agent.py</files>
  <action>
Ensure agent version is consistently reported to backend:

1. In agent/main.py:
   - Verify AGENT_VERSION env var is read at startup (line 21)
   - Add version check against backend expected version on registration
   - Log version mismatch warnings

2. In agent/agent.py:
   - Add /api/version endpoint returning __version__ (line 46)
   - Compare reported version with backend stored version on heartbeat
   - Add version validation in inventory on each heartbeat

3. In backend/api/agent_update.py:
   - Ensure get_agent_versions() correctly reads from hosts table
   - Add compatibility check endpoint that compares agent vs expected version

4. Add version fallback: if version read fails, log error but continue with "unknown"
</action>
  <verify>
Automated: curl http://localhost:8080/api/version returns {"version": "2.0.0"}
Manual: Check backend shows correct version in hosts table after registration
  </verify>
  <done>Agent version 2.0.0 correctly stored and displayed in backend</done>
</task>

<task type="checkpoint:human-verify">
  <what-built>AGENT-002 and AGENT-003 fixes verified</what-built>
  <how-to-verify>
1. Test installer: python agent/windows_installer.py --master-url http://localhost:8000
2. Check version: curl http://localhost:8080/api/version
3. Verify backend: GET /api/agent-updates/versions
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Add AGENT-004 memory profiling and leak detection</name>
  <files>agent/agent.py</files>
  <action>
Add memory monitoring and leak detection:

1. Track memory growth over time:
   - In update_metrics_loop() (lines 237-265): add memory baseline tracking
   - Store baseline on first run, compare every 5 minutes
   - Log warning if memory grows >100MB above baseline after 30 minutes
   - Log error if memory grows >200MB above baseline

2. Add memory profiling endpoint:
   - GET /api/debug/memory returns:
     - current memory (RSS, VMS)
     - baseline memory
     - delta from baseline
     - uptime seconds
     - count of active threads
     - count of open file handles (if available)

3. Add GC trigger endpoint:
   - POST /api/debug/gc runs gc.collect() and returns freed bytes

4. Fix potential leak sources:
   - Ensure logging handlers don't accumulate (line 303-309)
   - Ensure no unbounded list growth in package managers

5. Add memory leak indicator in metrics:
   - Export as gauge: agent_memory_delta_bytes
</action>
  <verify>
Automated: curl http://localhost:8080/api/debug/memory returns JSON with memory stats
Manual: Run agent for 30+ minutes, verify no unbounded memory growth in task manager
  </verify>
  <done>Memory profiling endpoint available, memory growth tracked and logged</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| agent→backend | Untrusted network, version info crosses here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Tampering | Agent version | accept | Version displayed but not used for auth decisions |
| T-01-02 | DoS | Memory leak | mitigate | Add memory limits and automatic restart on threshold |
| T-01-03 | Elevation | Installer runs as SYSTEM | accept | Required for Windows service installation |
</threat_model>

<verification>
1. Windows installer runs without admin prompt failures
2. Agent version shows 2.0.0 in backend
3. Memory endpoint responds with valid JSON
</verification>

<success_criteria>
- AGENT-002: Installation failures produce actionable diagnostics
- AGENT-003: Version synchronization verified (agent and backend agree on 2.0.0)
- AGENT-004: Memory profiling endpoint functional, leak detection logging active
</success_criteria>

<output>
After completion, create .planning/01/01-SUMMARY.md
</output>