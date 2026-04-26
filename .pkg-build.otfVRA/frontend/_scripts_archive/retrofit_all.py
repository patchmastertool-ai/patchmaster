#!/usr/bin/env python3
"""Batch retrofit all Phase 3 & Phase 4 pages to Command Horizon design system."""
import os, sys

SRC = r'c:\Users\test\Desktop\pat-1\frontend\src'

def keep_lines(filename, n):
    """Return content of first n lines from file."""
    path = os.path.join(SRC, filename)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    return ''.join(lines[:n])

def write_file(filename, content):
    path = os.path.join(SRC, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    size = os.path.getsize(path)
    print(f"  OK: {filename} ({size} bytes)")

# ── Helper to find the return( line ──
def find_return_line(filename):
    path = os.path.join(SRC, filename)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('return (') or stripped == 'return (':
            return i  # 0-indexed
    return None

def splice_return(filename, new_return):
    idx = find_return_line(filename)
    if idx is None:
        print(f"  ✗ Could not find return( in {filename}")
        return
    content = keep_lines(filename, idx)
    write_file(filename, content + new_return)

# ════════════════════════════════════════════════════════════════
# PHASE 3  — Developer Tools & Advanced Config
# ════════════════════════════════════════════════════════════════

# ── 1. AgentUpdatePage.jsx ──
AGENT_UPDATE_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#bbf7d0', background: 'linear-gradient(145deg, #f0fdf4, #f7fff9)' }}>
          <div className="ops-kicker">Agent Lifecycle Management</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Fleet Coverage</span>
              <span className="ops-emphasis-value" style={{ color: '#15803d' }}>{coveredHosts}</span>
              <span className="ops-emphasis-meta">hosts tracked</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Control agent version channels and auto-update policies across your fleet.</h3>
              <p>Manage rollout channels (stable, beta, edge) for PatchMaster agents, create per-group update policies, and monitor version distribution across the entire fleet with precision.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            {(versions.versions || []).map(v => (
              <span key={v.version} className="ops-chip">v{v.version}: {v.count} hosts</span>
            ))}
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Active policies</span>
          <div className="ops-side-metric">{policies.length}</div>
          <p className="ops-side-note">Update policies define channel and auto-update rules per host group. Create policies to orchestrate fleet-wide agent upgrades safely.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Fleet Agent Versions</div>
              <p className="ops-subtle">Current version distribution across {coveredHosts} managed hosts.</p>
            </div>
            <button className="btn btn-sm" onClick={fetchAll} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
          {(versions.versions || []).length === 0 ? (
            <div className="ops-empty">No agent version data yet.</div>
          ) : (
            <div className="ops-summary-grid">
              {(versions.versions || []).map(v => (
                <div key={v.version} className="ops-summary-card">
                  <div className="ops-summary-head">
                    <span className="ops-summary-icon" style={{ color: '#0369a1', background: 'rgba(14,165,233,0.14)' }}>AG</span>
                    <span className="ops-summary-label">v{v.version}</span>
                  </div>
                  <div className="ops-summary-value">{v.count}</div>
                  <div className="ops-summary-sub">hosts on this version</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasRole('admin') && (
          <div className="ops-panel">
            <div className="ops-panel-title" style={{ marginBottom: 14 }}>New Update Policy</div>
            <div className="ops-form-grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Policy Name</label>
                <input className="input" placeholder="Policy name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="ops-side-label">Channel</label>
                <select className="input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="edge">Edge</option>
                </select>
              </div>
              <div>
                <label className="ops-side-label">Target Version (optional)</label>
                <input className="input" placeholder="e.g. 2.5.1" value={form.target_version} onChange={e => setForm(f => ({ ...f, target_version: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={form.auto_update} onChange={e => setForm(f => ({ ...f, auto_update: e.target.checked }))} />
                  Auto-update agents automatically
                </label>
              </div>
            </div>
            {msg && <p style={{ marginTop: 10, color: msg.toLowerCase().includes('success') ? '#15803d' : '#ef4444', fontSize: 13 }}>{msg}</p>}
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Saving...' : 'Create Policy'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Update Policies ({policies.length})</div>
            <p className="ops-subtle">Fleet update policies define which channel and version each host group targets.</p>
          </div>
          {!hasRole('admin') && <span className="badge badge-info">Read only</span>}
        </div>
        {!policies.length ? (
          <div className="ops-empty">No policies yet. Create one above to manage rollout channels.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr><th>Name</th><th>Channel</th><th>Auto-Update</th><th>Target Version</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {policies.map(policy => (
                  <tr key={policy.id}>
                    <td><strong>{policy.name}</strong></td>
                    <td>
                      <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 12, background: channelColors[policy.channel] || '#3b82f6', color: '#fff' }}>{policy.channel}</span>
                    </td>
                    <td>{policy.auto_update ? <span className="badge badge-success">Yes</span> : <span className="badge badge-info">No</span>}</td>
                    <td><code style={{ fontSize: 12 }}>{policy.target_version || 'latest'}</code></td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(policy.created_at).toLocaleDateString()}</td>
                    <td>{hasRole('admin') ? <button className="btn btn-sm btn-danger" onClick={() => removePolicy(policy.id)}>Delete</button> : <span style={{ color: '#64748b', fontSize: 12 }}>Read-only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
"""

# ── 2. LiveCommandPage.jsx ──
LIVE_COMMAND_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#c7d2fe', background: 'linear-gradient(145deg, #eef2ff, #f8fbff)' }}>
          <div className="ops-kicker">Remote Execution Console</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Online Hosts</span>
              <span className="ops-emphasis-value" style={{ color: '#4338ca' }}>{hostList.filter(h => h.is_online !== false).length}</span>
              <span className="ops-emphasis-meta">ready for commands</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Run diagnostic commands on one host or broadcast to your entire online fleet.</h3>
              <p>The Live Command console provides instant remote execution with persistent working directory tracking, output capture, and run history. Perfect for fleet health checks and incident response.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{hostList.length} total hosts</span>
            <span className="ops-chip">{mode === 'all' ? 'Broadcast mode' : 'Single host mode'}</span>
            <span className="ops-chip">Timeout: {timeoutSec}s</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Execution target</span>
          <div className="ops-side-metric">{mode === 'all' ? 'All' : '1'}</div>
          <p className="ops-side-note">Switch between single-host mode with CWD tracking and fleet-broadcast mode to run commands across all online hosts simultaneously.</p>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Command Input</div>
            <p className="ops-subtle">Select target, enter command, press Run or Ctrl+Enter.</p>
          </div>
          <div className="ops-pills">
            <button className={`ops-pill ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single Host</button>
            <button className={`ops-pill ${mode === 'all' ? 'active' : ''}`} onClick={() => setMode('all')}>All Online ({hostList.filter(h => h.is_online !== false).length})</button>
          </div>
        </div>
        <div className="ops-form-grid" style={{ gridTemplateColumns: mode === 'single' ? '2fr 1fr auto' : '1fr auto' }}>
          {mode === 'single' && (
            <div>
              <label className="ops-side-label">Host</label>
              <select className="input" value={selectedHostId} onChange={e => setSelectedHostId(e.target.value)}>
                <option value="">-- Select host --</option>
                {hostList.map(h => (
                  <option key={h.id} value={String(h.id)}>{h.hostname || h.name} ({h.ip})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="ops-side-label">Timeout (s)</label>
            <input className="input" type="number" min="1" max="300" value={timeoutSec} onChange={e => setTimeoutSec(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleRun} disabled={running || !command.trim() || (mode === 'single' && !selectedHostId)}>
              {running ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>
        {mode === 'single' && selectedHost && (
          <div className="ops-chip-row" style={{ marginTop: 12 }}>
            <span className={`badge badge-${selectedHost.is_online ? 'success' : 'danger'}`}>{selectedHost.is_online ? 'Online' : 'Offline'}</span>
            <span className="badge badge-info">{selectedHost.os || 'Unknown OS'}</span>
            <span className="badge badge-info">{selectedHost.ip}</span>
            {workingDir && <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>cwd: {workingDir}</span>}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <label className="ops-side-label">Command</label>
          <textarea
            ref={textareaRef}
            className="input"
            style={{ minHeight: 90, resize: 'vertical', fontFamily: 'Consolas, Monaco, monospace', marginTop: 6 }}
            placeholder="Enter command… (Ctrl+Enter to run)"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRun(); } }}
          />
        </div>
      </div>

      {mode === 'single' && (
        <div className="grid-2">
          <div className="ops-panel">
            <div className="ops-table-toolbar">
              <div className="ops-panel-title">Latest Output</div>
              {result && (
                <span className={`badge badge-${result.ok ? 'success' : 'danger'}`}>
                  {result.ok ? `EXIT ${result.rc}` : 'FAILED'}
                </span>
              )}
            </div>
            {!result ? (
              <div className="ops-empty">Run a command to see output here.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  {result.host_ip} · {new Date(result.started_at).toLocaleString()}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(37,99,235,0.08)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                  {result.command}
                </div>
                <pre style={{ margin: 0, background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 14, minHeight: 200, whiteSpace: 'pre-wrap', overflowX: 'auto', fontSize: 13 }}>
                  {result.output || '(no output)'}
                </pre>
                {result.working_dir && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                    cwd after: {result.working_dir}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ops-panel">
            <div className="ops-table-toolbar">
              <div className="ops-panel-title">Recent Runs</div>
              <button className="btn btn-sm" onClick={() => persistHistory([])} disabled={!history.length}>Clear</button>
            </div>
            {!history.length ? (
              <div className="ops-empty">No history yet.</div>
            ) : (
              <div className="ops-list">
                {history.map((item, idx) => (
                  <button key={`${item.started_at}-${idx}`} className="ops-list-item" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => {
                      const found = hostList.find(h => h.ip === item.host_ip || String(h.id) === String(item.host_id));
                      if (found) setSelectedHostId(String(found.id));
                      setCommand(item.command || '');
                      setResult(item);
                    }}
                  >
                    <div className="ops-list-copy">
                      <strong>{item.hostname || item.host_ip}</strong>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.command}</span>
                    </div>
                    <span className={`badge badge-${item.ok ? 'success' : 'danger'}`}>{item.ok ? `EXIT ${item.rc}` : 'ERR'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'all' && multiResults.length > 0 && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Results — {multiResults.length} hosts</div>
            </div>
            <div className="ops-chip-row">
              <span className="badge badge-success">{multiResults.filter(r => r.ok).length} ok</span>
              <span className="badge badge-danger">{multiResults.filter(r => !r.ok).length} failed</span>
              {running && <span className="badge badge-info">running…</span>}
            </div>
          </div>
          <div className="ops-list">
            {multiResults.map((r, idx) => (
              <div key={`${r.host_ip}-${idx}`} className="ops-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 14 }}>{r.hostname || r.host_ip}</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{r.host_ip}</span>
                    {r.working_dir && <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>cwd: {r.working_dir}</span>}
                  </div>
                  <span className={`badge badge-${r.status === 'running' ? 'info' : r.ok ? 'success' : 'danger'}`}>
                    {r.status === 'running' ? 'running…' : r.ok ? `EXIT ${r.rc}` : 'FAILED'}
                  </span>
                </div>
                <pre style={{ margin: 0, background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: '10px 14px', maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {r.status === 'running' ? 'Waiting for response…' : (r.output || '(no output)')}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
"""

# ── 3. PluginIntegrationsPage.jsx  ──
PLUGIN_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#fde68a', background: 'linear-gradient(145deg, #fffbeb, #fffdf5)' }}>
          <div className="ops-kicker">Integration Ecosystem</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Integrations</span>
              <span className="ops-emphasis-value" style={{ color: '#b45309' }}>{integrations.filter(i => i.is_enabled).length}</span>
              <span className="ops-emphasis-meta">of {integrations.length} enabled</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Extend PatchMaster with webhooks, ticketing, SIEM, and notification integrations.</h3>
              <p>Connect your patch lifecycle to external systems — from Jira and ServiceNow to Splunk, PagerDuty, and Slack. Each integration fires at configurable lifecycle events with field mapping.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{integrations.length} total integrations</span>
            <span className="ops-chip">{integrations.filter(i => i.last_status === 'ok').length} last-run OK</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Available types</span>
          <div className="ops-inline-list">
            {['webhook', 'slack', 'jira', 'servicenow', 'pagerduty', 'teams'].map(t => (
              <div key={t} className="ops-inline-card"><strong>{t}</strong></div>
            ))}
          </div>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Active Integrations</div>
            <p className="ops-subtle">Manage and monitor all registered plugin integrations and their last execution status.</p>
          </div>
          <div className="ops-actions">
            <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: 160 }}>
              <option value="">All types</option>
              {['webhook', 'slack', 'jira', 'servicenow', 'pagerduty', 'teams', 'email'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="ops-empty">No integrations match the current filter.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr><th>Name</th><th>Type</th><th>Events</th><th>Status</th><th>Last Run</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(itg => (
                  <tr key={itg.id}>
                    <td>
                      <strong>{itg.name}</strong>
                      <span className="ops-table-meta">{itg.description || 'No description'}</span>
                    </td>
                    <td><span className="badge badge-info">{itg.integration_type}</span></td>
                    <td style={{ maxWidth: 200, fontSize: 11, color: '#64748b' }}>{(itg.trigger_events || []).join(', ')}</td>
                    <td>
                      <span className={`badge badge-${itg.is_enabled ? 'success' : 'secondary'}`}>{itg.is_enabled ? 'Enabled' : 'Disabled'}</span>
                    </td>
                    <td>
                      {itg.last_status && (
                        <span className={`badge badge-${itg.last_status === 'ok' ? 'success' : 'danger'}`}>{itg.last_status}</span>
                      )}
                      <span className="ops-table-meta">{itg.last_triggered_at ? new Date(itg.last_triggered_at).toLocaleString() : 'Never'}</span>
                    </td>
                    <td>
                      <div className="ops-actions">
                        <button className="btn btn-sm" onClick={() => testIntegration(itg.id)}>Test</button>
                        <button className="btn btn-sm" onClick={() => toggleIntegration(itg)}>
                          {itg.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteIntegration(itg.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ops-panel">
        <div className="ops-panel-title" style={{ marginBottom: 14 }}>Register New Integration</div>
        <div className="ops-form-grid">
          <div>
            <label className="ops-side-label">Integration Name</label>
            <input className="input" placeholder="e.g. Slack Alerts" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <div>
            <label className="ops-side-label">Type</label>
            <select className="input" value={form.integration_type} onChange={e => setForm(f => ({...f, integration_type: e.target.value}))}>
              {['webhook', 'slack', 'jira', 'servicenow', 'pagerduty', 'teams', 'email'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="ops-side-label">Endpoint URL / Webhook URL</label>
            <input className="input" placeholder="https://hooks.slack.com/services/..." value={form.endpoint_url} onChange={e => setForm(f => ({...f, endpoint_url: e.target.value}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="ops-side-label">Description</label>
            <input className="input" placeholder="What does this integration do?" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="ops-side-label">Trigger Events (comma-separated)</label>
            <input className="input" placeholder="patch.completed, patch.failed, host.alert" value={form.trigger_events} onChange={e => setForm(f => ({...f, trigger_events: e.target.value}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="ops-side-label">Auth Token / Secret (optional)</label>
            <input className="input" type="password" placeholder="Bearer token or secret key" value={form.auth_token} onChange={e => setForm(f => ({...f, auth_token: e.target.value}))} />
          </div>
        </div>
        {msg && <p style={{ marginTop: 10, color: msg.includes('success') || msg.includes('Success') ? '#15803d' : '#ef4444', fontSize: 13 }}>{msg}</p>}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={createIntegration} disabled={loading}>{loading ? 'Saving...' : 'Register Integration'}</button>
        </div>
      </div>
    </div>
  );
}
"""

# ── 4. RestoreDrillPage.jsx ──
RESTORE_DRILL_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#fca5a5', background: 'linear-gradient(145deg, #fef2f2, #fff6f6)' }}>
          <div className="ops-kicker">Disaster Recovery Validation</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Drill Status</span>
              <span className="ops-emphasis-value" style={{ color: '#b91c1c' }}>{drills.filter(d => d.status === 'running').length > 0 ? 'ACTIVE' : drills.length}</span>
              <span className="ops-emphasis-meta">{drills.filter(d => d.status === 'running').length > 0 ? 'drill in progress' : 'completed drills'}</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Validate your disaster recovery posture with scheduled and on-demand restore drills.</h3>
              <p>Run automated or manual restore verification drills against backup artifacts. Each drill tests the full recovery cycle — from backup retrieval to service validation — generating an audit-ready evidence report.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{drills.filter(d => d.status === 'success').length} passed</span>
            <span className="ops-chip">{drills.filter(d => d.status === 'failed').length} failed</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Last drill result</span>
          <div className="ops-side-metric" style={{ color: drills[0]?.status === 'success' ? '#15803d' : drills[0]?.status === 'failed' ? '#b91c1c' : '#475569' }}>
            {drills[0]?.status || 'None'}
          </div>
          <p className="ops-side-note">Restore drills should be run monthly to ensure backup integrity and validate RTO/RPO targets across all critical workloads.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 14 }}>Schedule New Restore Drill</div>
          <div className="ops-form-grid">
            <div>
              <label className="ops-side-label">Target Host</label>
              <select className="input" value={form.host_id} onChange={e => setForm(f => ({...f, host_id: e.target.value}))}>
                <option value="">Select host</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.hostname} ({h.ip})</option>)}
              </select>
            </div>
            <div>
              <label className="ops-side-label">Backup Job</label>
              <select className="input" value={form.backup_config_id} onChange={e => setForm(f => ({...f, backup_config_id: e.target.value}))}>
                <option value="">Select backup</option>
                {backupConfigs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Restore Target Path (optional)</label>
              <input className="input" placeholder="/tmp/restore-drill" value={form.restore_target} onChange={e => setForm(f => ({...f, restore_target: e.target.value}))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Validation Script (optional)</label>
              <textarea className="input" rows={3} style={{ fontFamily: 'monospace' }} placeholder="#!/bin/bash\ntest -f /tmp/restore-drill/config.yml && echo OK" value={form.validation_script} onChange={e => setForm(f => ({...f, validation_script: e.target.value}))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Notes</label>
              <input className="input" placeholder="Quarterly DR compliance drill..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </div>
          </div>
          {msg && <p style={{ marginTop: 10, color: msg.includes('success') || msg.includes('scheduled') ? '#15803d' : '#ef4444', fontSize: 13 }}>{msg}</p>}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={scheduleDrill} disabled={loading}>{loading ? 'Scheduling...' : 'Schedule Drill'}</button>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div className="ops-panel-title">Drill History</div>
            <button className="btn btn-sm" onClick={fetchDrills}>Refresh</button>
          </div>
          {drills.length === 0 ? (
            <div className="ops-empty">No restore drills yet.</div>
          ) : (
            <div className="ops-list">
              {drills.map(d => (
                <div key={d.id} className="ops-list-item">
                  <div className="ops-list-copy">
                    <strong>{d.host?.hostname || 'Unknown Host'}</strong>
                    <span>{d.backup_config?.name || 'Unknown Backup'}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{new Date(d.scheduled_at || d.created_at).toLocaleString()}</span>
                  </div>
                  <div className="ops-list-metrics">
                    <span className={`badge badge-${d.status === 'success' ? 'success' : d.status === 'failed' ? 'danger' : d.status === 'running' ? 'warning' : 'info'}`}>{d.status}</span>
                    <button className="btn btn-sm" onClick={() => viewDrillReport(d.id)}>Report</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedDrill && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Drill Report #{selectedDrill.id}</div>
              <p className="ops-subtle">{selectedDrill.host?.hostname} — {selectedDrill.backup_config?.name}</p>
            </div>
            <button className="btn btn-sm" onClick={() => setSelectedDrill(null)}>Close</button>
          </div>
          <div className="ops-detail-grid">
            <div className="ops-detail-item"><span>Status</span><strong className={selectedDrill.status === 'success' ? '' : 'text-danger'}>{selectedDrill.status}</strong></div>
            <div className="ops-detail-item"><span>Duration</span><strong>{selectedDrill.duration_seconds ? `${Math.round(selectedDrill.duration_seconds)}s` : '—'}</strong></div>
            <div className="ops-detail-item"><span>Restore Path</span><strong><code style={{ fontSize: 12 }}>{selectedDrill.restore_target || '—'}</code></strong></div>
            <div className="ops-detail-item"><span>Validation</span><strong>{selectedDrill.validation_result === true ? '✓ Passed' : selectedDrill.validation_result === false ? '✗ Failed' : '—'}</strong></div>
          </div>
          {selectedDrill.output && (
            <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 14, marginTop: 16, whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 300, overflowY: 'auto' }}>
              {selectedDrill.output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
"""

# ════════════════════════════════════════════════════════════════
# PHASE 4  — Admin / Identity Management
# ════════════════════════════════════════════════════════════════

# ── 5. AuditPage.jsx ──
AUDIT_RETURN = """  return (
    <div className="ops-shell">
      {stats && (
        <div className="ops-hero">
          <div className="ops-hero-main" style={{ borderColor: '#c7d2fe', background: 'linear-gradient(145deg, #eef2ff, #f8fbff)' }}>
            <div className="ops-kicker">Compliance & Audit Trail</div>
            <div className="ops-hero-row">
              <div className="ops-hero-emphasis">
                <span className="ops-emphasis-label">Today</span>
                <span className="ops-emphasis-value" style={{ color: '#4338ca' }}>{stats.today}</span>
                <span className="ops-emphasis-meta">audit events</span>
              </div>
              <div className="ops-hero-copy">
                <h3>Full traceability across all operator actions and system events.</h3>
                <p>The audit log captures every privilege-escalated action, configuration change, and access event with actor, resource, and timestamp. Export or filter for compliance reporting.</p>
              </div>
            </div>
            <div className="ops-chip-row">
              <span className="ops-chip">Today: {stats.today} events</span>
              <span className="ops-chip">This week: {stats.this_week} events</span>
            </div>
          </div>
          <div className="ops-hero-side">
            <span className="ops-side-label">Weekly volume</span>
            <div className="ops-side-metric">{stats.this_week}</div>
            <p className="ops-side-note">Filter by action type or time window to narrow scope for compliance reviews and security investigations.</p>
          </div>
        </div>
      )}

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Audit Logs</div>
            <p className="ops-subtle">Filterable event log covering all privileged operator and system actions.</p>
          </div>
          <div className="ops-actions">
            <input className="input search-input" placeholder="Filter by action type" value={actionFilter} onChange={e => setActionFilter(e.target.value)} />
            <select className="input" value={days} onChange={e => setDays(e.target.value)} style={{ width: 140 }}>
              <option value={1}>Last 1 day</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
        {logs.length === 0 ? (
          <div className="ops-empty">No audit logs found for the selected filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th></tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const detailText = formatDetailsText(log.details);
                  const detailPreview = detailText ? (detailText.length > 140 ? `${detailText.slice(0, 140)}...` : detailText) : '';
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{sanitizeDisplayText(log.username || log.user_id || 'system', 'system')}</td>
                      <td><span className="badge badge-info">{sanitizeDisplayText(log.action, 'UNKNOWN')}</span></td>
                      <td>{sanitizeDisplayText(`${log.resource_type || ''} ${log.resource_id ? `#${log.resource_id}` : ''}`.trim(), '-')}</td>
                      <td style={{ minWidth: 320, maxWidth: 560 }}>
                        {detailText ? (
                          <details>
                            <summary style={{ cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {detailPreview}
                            </summary>
                            <pre className="code-block" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto', marginTop: 8 }}>
                              {detailText}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
"""

# ── 6. BackupManagerPage.jsx ──
BACKUP_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#a5f3fc', background: 'linear-gradient(145deg, #ecfeff, #f0ffff)' }}>
          <div className="ops-kicker">Backup &amp; Disaster Recovery</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Jobs</span>
              <span className="ops-emphasis-value" style={{ color: '#0e7490' }}>{configs.length}</span>
              <span className="ops-emphasis-meta">configured backup jobs</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Enterprise backup orchestration with one-click restore and compliance history.</h3>
              <p>Configure and monitor database, file, and system backups. Run jobs on-demand, view full execution history, and trigger restore drills for compliance reporting. Full encryption and retention management.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{configs.filter(c => c.last_run_status === 'success').length} last succeeded</span>
            <span className="ops-chip">{configs.filter(c => c.last_run_status === 'failed').length} last failed</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Backup coverage</span>
          <div className="ops-side-metric">{configs.length}</div>
          <p className="ops-side-note">Create backup jobs for databases, file paths, and full system images. Set cron-based schedules, configure retention, and optionally encrypt output archives.</p>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Backup Jobs</div>
            <p className="ops-subtle">All configured backup routines. Run on-demand or review execution logs for compliance.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Backup Job</button>
          </div>
        </div>
        {configs.length === 0 ? (
          <div className="ops-empty">No backup jobs configured yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr><th>Job Name</th><th>Host</th><th>Type</th><th>Storage</th><th>Schedule</th><th>Retention</th><th>Last Run</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {configs.map(c => {
                  const h = hosts.find(x => x.id === c.host_id);
                  return (
                    <tr key={c.id} className={selectedConfig === c.id ? 'selected' : ''}>
                      <td><strong>{c.name}</strong></td>
                      <td>{h ? h.hostname : c.host_id}</td>
                      <td><span className="badge badge-info">{c.backup_type}</span></td>
                      <td>
                        <span style={{ display: 'block', fontSize: 11 }}>{c.storage_type || 'local'}</span>
                        <span className="ops-table-meta">{c.storage_path || '—'}</span>
                      </td>
                      <td><code style={{ fontSize: 11 }}>{c.schedule || 'Manual'}</code></td>
                      <td>{c.retention_count} copies</td>
                      <td>
                        {c.last_run_status && (
                          <span className={`badge badge-${c.last_run_status === 'success' ? 'success' : c.last_run_status === 'failed' ? 'danger' : 'info'}`}>{c.last_run_status}</span>
                        )}
                        <span className="ops-table-meta">{c.last_run_at ? new Date(c.last_run_at).toLocaleString() : '—'}</span>
                      </td>
                      <td>
                        <div className="ops-actions">
                          <button className="btn btn-sm" onClick={() => runBackup(c.id)}>Run Now</button>
                          <button className="btn btn-sm" onClick={() => viewLogs(c.id)}>Logs</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedConfig && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Run History</div>
              <p className="ops-subtle">Full execution log for the selected backup job.</p>
            </div>
            <button className="btn btn-sm" onClick={() => setSelectedConfig(null)}>Close</button>
          </div>
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr><th>Status</th><th>Started</th><th>Completed</th><th>Size</th><th>Duration</th><th>Output</th><th>Restore</th></tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td><span className={`badge badge-${l.status === 'success' ? 'success' : l.status === 'failed' ? 'danger' : l.status === 'running' ? 'warning' : 'info'}`}>{l.status}</span></td>
                    <td style={{ fontSize: 11 }}>{new Date(l.started_at).toLocaleString()}</td>
                    <td style={{ fontSize: 11 }}>{l.completed_at ? new Date(l.completed_at).toLocaleString() : '—'}</td>
                    <td>{l.file_size_bytes ? `${l.file_size_bytes}B` : '—'}</td>
                    <td>{l.duration_seconds ? `${Math.round(l.duration_seconds)}s` : '—'}</td>
                    <td>
                      {l.output ? (
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: 11 }}>View</summary>
                          <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 10, marginTop: 6, fontSize: 11, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{l.output}</pre>
                        </details>
                      ) : '—'}
                    </td>
                    <td>
                      {l.status === 'success' && (
                        <button className="btn btn-sm" onClick={() => runRestore(l.id)}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="ops-table-toolbar" style={{ marginBottom: 20 }}>
              <div className="ops-panel-title">Create Backup Job</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕ Close</button>
            </div>
            {msg && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{msg}</p>}
            <div className="ops-form-grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Job Name</label>
                <input className="input" placeholder="e.g. Daily DB Backup" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="ops-side-label">Host</label>
                <select className="input" value={formData.host_id} onChange={e => setFormData({...formData, host_id: e.target.value})}>
                  <option value="">Select Host</option>
                  {hosts.map(h => <option key={h.id} value={h.id}>{h.hostname} ({h.ip})</option>)}
                </select>
              </div>
              <div>
                <label className="ops-side-label">Backup Type</label>
                <select className="input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="file">File / Folder</option>
                  <option value="database">Database Dump</option>
                  <option value="vm">VM Snapshot</option>
                  <option value="live">Live Sync</option>
                  <option value="full_system">Full System Image</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Source Path / Connection String</label>
                <input className="input" style={{ fontFamily: 'monospace' }} placeholder={formData.type === 'database' ? 'postgresql://user:pass@local/db' : '/var/www/html'} value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} />
              </div>
              {formData.type === 'database' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Database Type</label>
                  <select className="input" value={formData.db_type} onChange={e => setFormData({...formData, db_type: e.target.value})}>
                    <option value="">Auto-detect</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL / MariaDB</option>
                    <option value="mongodb">MongoDB</option>
                    <option value="redis">Redis</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                </div>
              )}
              <div>
                <label className="ops-side-label">Cron Schedule</label>
                <input className="input" style={{ fontFamily: 'monospace' }} placeholder="0 2 * * *" value={formData.schedule} onChange={e => setFormData({...formData, schedule: e.target.value})} />
              </div>
              <div>
                <label className="ops-side-label">Retention (copies)</label>
                <input type="number" className="input" value={formData.retention} onChange={e => setFormData({...formData, retention: e.target.value})} />
              </div>
              <div>
                <label className="ops-side-label">Storage Type</label>
                <select className="input" value={formData.storage_type} onChange={e => setFormData({...formData, storage_type: e.target.value})}>
                  <option value="local">Local / Mounted</option>
                </select>
              </div>
              <div>
                <label className="ops-side-label">Storage Path</label>
                <input className="input" style={{ fontFamily: 'monospace' }} placeholder="/mnt/backup" value={formData.storage_path} onChange={e => setFormData({...formData, storage_path: e.target.value})} />
              </div>
              <div>
                <label className="ops-side-label">Compression (0-9)</label>
                <input type="number" className="input" min="0" max="9" value={formData.compression} onChange={e => setFormData({...formData, compression: e.target.value})} />
              </div>
              <div>
                <label className="ops-side-label">Encryption Key</label>
                <input type="password" className="input" placeholder="AES-256 Key (optional)" value={formData.encryption_key} onChange={e => setFormData({...formData, encryption_key: e.target.value})} />
              </div>
              {testMsg && <p style={{ gridColumn: '1 / -1', fontSize: 13, color: testMsg.startsWith('Success') ? '#15803d' : '#ef4444' }}>{testMsg}</p>}
            </div>
            <div className="ops-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createConfig} disabled={loading}>{loading ? 'Creating...' : 'Create Job'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

# ── 7. UsersOpsPage.jsx – read to find return line, then check if it already has ops-shell ──
# ── 8. LicenseOpsPage.jsx ── 
# ── 9. OnboardingOpsPage.jsx ──
# ── 10. SettingsOpsPage.jsx ──
# ── 11. NotificationsPage.jsx ──

# ════════════════════════════════════════════════════════════════
# APPLY ALL SPLICES
# ════════════════════════════════════════════════════════════════

print("Applying Phase 3 splices...")
splice_return('AgentUpdatePage.jsx', AGENT_UPDATE_RETURN)
splice_return('LiveCommandPage.jsx', LIVE_COMMAND_RETURN)
splice_return('AuditPage.jsx', AUDIT_RETURN)
splice_return('BackupManagerPage.jsx', BACKUP_RETURN)

# For PluginIntegrationsPage and RestoreDrillPage we need to check if they exist
for fn in ['PluginIntegrationsPage.jsx', 'RestoreDrillPage.jsx']:
    p = os.path.join(SRC, fn)
    if not os.path.exists(p):
        print(f"  ! {fn} does not exist, skipping")

if os.path.exists(os.path.join(SRC, 'PluginIntegrationsPage.jsx')):
    splice_return('PluginIntegrationsPage.jsx', PLUGIN_RETURN)

if os.path.exists(os.path.join(SRC, 'RestoreDrillPage.jsx')):
    splice_return('RestoreDrillPage.jsx', RESTORE_DRILL_RETURN)

print("Done with batch 1 (AgentUpdate, LiveCommand, Audit, Backup, Plugin, RestoreDrill)")
