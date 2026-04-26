#!/usr/bin/env python3
"""Phase 3+4 final batch retrofit: all remaining pages to Command Horizon design system."""
import os, re

SRC = r'c:\Users\test\Desktop\pat-1\frontend\src'

def read_file(fn):
    with open(os.path.join(SRC, fn), 'r', encoding='utf-8') as f:
        return f.read(), f.name

def write_file(fn, content):
    path = os.path.join(SRC, fn)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  OK: {fn} ({os.path.getsize(path)} bytes)")

def find_export_return(content, fn):
    """Find the return( line index of the main exported component."""
    lines = content.split('\n')
    # find export default function
    export_idx = None
    for i, line in enumerate(lines):
        if re.match(r'^export default function ', line.strip()):
            export_idx = i
            break
    if export_idx is None:
        print(f"  ! No export default function in {fn}")
        return None
    # now find first '  return (' or 'return (' at depth within that function
    depth = 0
    for i in range(export_idx, len(lines)):
        stripped = lines[i].strip()
        if stripped.startswith('{'):
            depth += stripped.count('{') - stripped.count('}')
        if (stripped == 'return (' or stripped.startswith('return (')) and depth <= 1:
            return i
        depth += stripped.count('{') - stripped.count('}')
    return None

def splice(fn, new_return):
    content, _ = read_file(fn)
    idx = find_export_return(content, fn)
    if idx is None:
        print(f"  ! Could not splice {fn}")
        return
    lines = content.split('\n')
    top = '\n'.join(lines[:idx])
    write_file(fn, top + '\n' + new_return)

# ════════════════════════════════════════════════════════
# RETURN BLOCKS — Command Horizon Design
# ════════════════════════════════════════════════════════

# 1. SLAOpsPage
SLA_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#fca5a5', background: 'linear-gradient(145deg, #fef2f2, #fff8f8)' }}>
          <div className="ops-kicker">SLA Compliance Management</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Violations</span>
              <span className="ops-emphasis-value" style={{ color: '#b91c1c' }}>{summary?.violated ?? violations.filter(v => v.is_violated && !v.is_resolved).length}</span>
              <span className="ops-emphasis-meta">of {summary?.total ?? violations.length} tracked</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Track patch SLA compliance and escalate violations before deadlines breach.</h3>
              <p>Define per-severity SLA policies with days-to-patch windows and pre-deadline notification buffers. Run on-demand scans to detect violations across the CVE database and track resolution status for every affected host.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            {summary && <><span className="ops-chip">{summary.total} tracked</span><span className="ops-chip">{summary.resolved} resolved</span><span className="ops-chip">{summary.upcoming_deadline} due in 3 days</span></>}
            <span className="ops-chip">{slas.length} policies</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Compliance rate</span>
          <div className="ops-side-metric" style={{ color: summary?.violated > 0 ? '#b91c1c' : '#15803d' }}>
            {summary ? `${Math.round(((summary.total - summary.violated) / Math.max(summary.total, 1)) * 100)}%` : '—'}
          </div>
          <p className="ops-side-note">SLA policies define the maximum number of days before a CVE of a given severity must be remediated. Regular scans detect breaches in real time.</p>
        </div>
      </div>

      <div className="ops-summary-grid">
        {[
          { label: 'Active Violations', value: summary?.violated ?? 0, sub: 'unresolved SLA breaches requiring attention', color: '#b91c1c', bg: 'rgba(239,68,68,0.12)' },
          { label: 'Total Tracked', value: summary?.total ?? 0, sub: 'CVE-host pairs under SLA monitoring', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
          { label: 'Resolved', value: summary?.resolved ?? 0, sub: 'violations cleared within policy window', color: '#15803d', bg: 'rgba(34,197,94,0.12)' },
          { label: 'Due in 3 Days', value: summary?.upcoming_deadline ?? 0, sub: 'approaching SLA deadline, act now', color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
        ].map(card => (
          <div key={card.label} className="ops-summary-card">
            <div className="ops-summary-head">
              <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>SLA</span>
              <span className="ops-summary-label">{card.label}</span>
            </div>
            <div className="ops-summary-value">{card.value}</div>
            <div className="ops-summary-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="ops-panel" style={{ padding: '8px 12px' }}>
        <div className="ops-table-toolbar">
          <div className="ops-pills">
            {['policies', 'violations'].map(t => (
              <button key={t} className={`ops-pill ${tab===t?'active':''}`} onClick={() => setTab(t)}>
                {t === 'policies' ? 'SLA Policies' : `Violations (${violations.filter(v => v.is_violated && !v.is_resolved).length})`}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {tab === 'policies' && (
        <>
          <div className="ops-panel">
            <div className="ops-panel-title" style={{ marginBottom: 14 }}>Add SLA Policy</div>
            <div className="ops-form-grid">
              <div>
                <label className="ops-side-label">Policy Name</label>
                <input className="input" placeholder="e.g. Critical Patch SLA" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="ops-side-label">Severity</label>
                <select className="input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                  {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="ops-side-label">Days to Patch</label>
                <input className="input" type="number" value={form.days_to_patch} onChange={e => setForm(f => ({ ...f, days_to_patch: +e.target.value }))} />
              </div>
              <div>
                <label className="ops-side-label">Notify Before (days)</label>
                <input className="input" type="number" value={form.notify_before_days} onChange={e => setForm(f => ({ ...f, notify_before_days: +e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={createSLA}>Add Policy</button>
            </div>
          </div>

          <div className="ops-panel">
            <div className="ops-table-toolbar">
              <div className="ops-panel-title">Active SLA Policies</div>
            </div>
            {!slas.length ? (
              <div className="ops-empty">No SLA policies defined yet. Add one above to start tracking.</div>
            ) : (
              <div className="table-wrap">
                <table className="table ops-table">
                  <thead><tr><th>Policy Name</th><th>Severity</th><th>Days to Patch</th><th>Notify Before</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {slas.map(s => (
                      <tr key={s.id}>
                        <td><strong>{s.name}</strong></td>
                        <td><span className="badge" style={{ background: sevColor(s.severity), color: '#fff' }}>{s.severity}</span></td>
                        <td>{s.days_to_patch} days</td>
                        <td>{s.notify_before_days} days</td>
                        <td><span className={`badge badge-${s.is_active ? 'success' : 'warning'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => deleteSLA(s.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'violations' && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">SLA Violations</div>
              <p className="ops-subtle">CVE-host pairs that have breached or are approaching their SLA deadline.</p>
            </div>
          </div>
          {!violations.length ? (
            <div className="ops-empty">No violations found — run a scan to detect SLA breaches.</div>
          ) : (
            <div className="table-wrap">
              <table className="table ops-table">
                <thead><tr><th>Host</th><th>CVE</th><th>Severity</th><th>Deadline</th><th>Days Overdue</th><th>Status</th></tr></thead>
                <tbody>
                  {violations.map(v => (
                    <tr key={v.id} style={{ background: v.is_violated && !v.is_resolved ? 'rgba(239,68,68,0.04)' : '' }}>
                      <td><strong>{v.hostname}</strong></td>
                      <td><code style={{ fontSize: 11 }}>{v.cve_id}</code></td>
                      <td><span className="badge" style={{ background: sevColor(v.severity), color: '#fff' }}>{v.severity}</span></td>
                      <td style={{ fontSize: 12 }}>{new Date(v.deadline).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600, color: v.days_overdue > 0 ? '#ef4444' : '#22c55e' }}>
                        {v.days_overdue > 0 ? `+${v.days_overdue}d` : '—'}
                      </td>
                      <td><span className={`badge badge-${v.is_resolved ? 'success' : v.is_violated ? 'danger' : 'warning'}`}>{v.is_resolved ? 'Resolved' : v.is_violated ? 'Violated' : 'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
"""

# 2. OpsQueuePage
OPSQUEUE_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#93c5fd', background: 'linear-gradient(145deg, #eff6ff, #f8fbff)' }}>
          <div className="ops-kicker">Operations Execution Queue</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Queued Tasks</span>
              <span className="ops-emphasis-value" style={{ color: '#1d4ed8' }}>{items.filter(i => i.status === 'pending' || i.status === 'running').length}</span>
              <span className="ops-emphasis-meta">pending and active</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Monitor and control all background operations across the fleet.</h3>
              <p>The ops queue captures every long-running background operation — patch jobs, sync tasks, and agent commands. Use it to track running tasks, clear stalled jobs, and get a snapshot of platform activity at any moment.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{items.length} total tasks</span>
            <span className="ops-chip">{items.filter(i => i.status === 'running').length} running</span>
            <span className="ops-chip">{items.filter(i => i.status === 'failed').length} failed</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Queue depth</span>
          <div className="ops-side-metric">{items.length}</div>
          <p className="ops-side-note">The ops queue shows all background tasks that have been dispatched to agents. Stalled or failed tasks can be retried or cleared here.</p>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">All Operations</div>
            <p className="ops-subtle">Live view of background tasks, patch jobs, and agent dispatches.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-sm" onClick={load}>Refresh</button>
            {items.some(i => i.status === 'failed' || i.status === 'completed') && (
              <button className="btn btn-sm btn-danger" onClick={clearDone}>Clear Done</button>
            )}
          </div>
        </div>
        {!items.length ? (
          <div className="ops-empty">No operations in queue.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead><tr><th>Operation</th><th>Type</th><th>Target</th><th>Status</th><th>Started</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.operation || item.type || 'Task'}</strong>
                      <span className="ops-table-meta">#{item.id}</span>
                    </td>
                    <td><span className="badge badge-info">{item.task_type || item.type || '—'}</span></td>
                    <td>{item.target_host || item.host_ip || item.target || '—'}</td>
                    <td>
                      <span className={`badge badge-${item.status === 'completed' || item.status === 'success' ? 'success' : item.status === 'failed' ? 'danger' : item.status === 'running' ? 'warning' : 'info'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td>
                    <td>
                      {(item.status === 'failed' || item.status === 'completed') && (
                        <button className="btn btn-sm" onClick={() => removeItem(item.id)}>Clear</button>
                      )}
                    </td>
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

# 3. JobsPage
JOBS_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#a5b4fc', background: 'linear-gradient(145deg, #eef2ff, #f8fbff)' }}>
          <div className="ops-kicker">Job History & Execution Ledger</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Total Jobs</span>
              <span className="ops-emphasis-value" style={{ color: '#4338ca' }}>{jobs.length}</span>
              <span className="ops-emphasis-meta">in execution history</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Full audit trail of every patch, scan, and command dispatched to the fleet.</h3>
              <p>Browse the complete history of all jobs dispatched through PatchMaster. Each record includes the target host, job type, operator, timestamps, and final outcome. Filter by status to quickly identify failures.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{jobs.filter(j => j.status === 'success' || j.status === 'completed').length} succeeded</span>
            <span className="ops-chip">{jobs.filter(j => j.status === 'failed').length} failed</span>
            <span className="ops-chip">{jobs.filter(j => j.status === 'running').length} running</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Recent jobs</span>
          <div className="ops-side-metric">{jobs.slice(0, 100).length}</div>
          <p className="ops-side-note">The job ledger is your team's source of truth for what was patched, when, and by whom. Use it during incident reviews and compliance audits.</p>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Job History</div>
            <p className="ops-subtle">Complete ledger of all dispatched patch, scan, and command jobs.</p>
          </div>
          <div className="ops-actions">
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
            </select>
            <button className="btn btn-sm" onClick={load}>Refresh</button>
          </div>
        </div>
        {loading ? (
          <div className="ops-empty">Loading job history...</div>
        ) : !filteredJobs.length ? (
          <div className="ops-empty">No jobs match the current filter.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead><tr><th>#</th><th>Job Type</th><th>Host</th><th>Status</th><th>Operator</th><th>Started</th><th>Duration</th></tr></thead>
              <tbody>
                {filteredJobs.map(job => (
                  <tr key={job.id}>
                    <td style={{ fontSize: 11, color: '#64748b' }}>#{job.id}</td>
                    <td><span className="badge badge-info">{job.job_type || job.type || '—'}</span></td>
                    <td>
                      <strong>{job.hostname || job.host_ip || '—'}</strong>
                      {job.host_ip && <span className="ops-table-meta">{job.host_ip}</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${job.status === 'success' || job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : job.status === 'running' ? 'warning' : 'info'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>{job.triggered_by || job.operator || '—'}</td>
                    <td style={{ fontSize: 11 }}>{job.created_at ? new Date(job.created_at).toLocaleString() : '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {job.completed_at && job.created_at
                        ? `${Math.round((new Date(job.completed_at) - new Date(job.created_at)) / 1000)}s`
                        : '—'}
                    </td>
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

# 4. MonitoringOpsPage — careful, has helper components before main
MONITORING_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#fde68a', background: 'linear-gradient(145deg, #fffbeb, #fffdf5)' }}>
          <div className="ops-kicker">Infrastructure Observability</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Monitored Hosts</span>
              <span className="ops-emphasis-value" style={{ color: '#d97706' }}>{hosts.length}</span>
              <span className="ops-emphasis-meta">endpoints in scope</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Full-stack observability for your fleet — metrics, health, and integration status.</h3>
              <p>Monitor system services, Prometheus metrics, Grafana dashboards, and per-host service health from a unified workspace. Enforce monitoring configuration and track integration posture fleet-wide.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{metricsStatus?.prometheus_up ? 'Prometheus up' : 'Prometheus unknown'}</span>
            <span className="ops-chip">{metricsStatus?.grafana_up ? 'Grafana up' : 'Grafana unknown'}</span>
            <span className="ops-chip">{hosts.length} hosts</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Stack status</span>
          <div className="ops-side-metric" style={{ color: metricsStatus?.prometheus_up && metricsStatus?.grafana_up ? '#15803d' : '#d97706' }}>
            {metricsStatus ? (metricsStatus.prometheus_up && metricsStatus.grafana_up ? 'Healthy' : 'Partial') : 'Unknown'}
          </div>
          <p className="ops-side-note">Monitoring coverage includes Prometheus scrape targets, Grafana dashboards, and node exporter service health on every managed host.</p>
        </div>
      </div>

      <div className="ops-panel" style={{ padding: '8px 12px' }}>
        <div className="ops-pills">
          {['overview','hosts','grafana','prometheus'].map(t => (
            <button key={t} className={`ops-pill ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="ops-empty">Loading monitoring data...</div>}

      {!loading && activeTab === 'overview' && data && (
        <div className="grid-2">
          <div className="ops-panel">
            <div className="ops-panel-title" style={{ marginBottom: 14 }}>Service Health Summary</div>
            <div className="ops-list">
              {Object.entries(data.services || {}).map(([svc, info]) => (
                <div key={svc} className="ops-list-item">
                  <div className="ops-list-copy">
                    <strong>{svc}</strong>
                    <span className="ops-table-meta">{info.hosts_up ?? 0}/{hosts.length} hosts up</span>
                  </div>
                  <span className={`badge badge-${info.healthy ? 'success' : 'danger'}`}>{info.healthy ? 'OK' : 'Down'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ops-panel">
            <div className="ops-panel-title" style={{ marginBottom: 14 }}>Platform Integrations</div>
            <div className="ops-list">
              {[
                { name: 'Prometheus', up: metricsStatus?.prometheus_up, url: `http://${masterIp}:9090` },
                { name: 'Grafana', up: metricsStatus?.grafana_up, url: `http://${masterIp}:3000` },
                { name: 'Alertmanager', up: metricsStatus?.alertmanager_up, url: `http://${masterIp}:9093` },
              ].map(s => (
                <div key={s.name} className="ops-list-item">
                  <div className="ops-list-copy">
                    <strong>{s.name}</strong>
                    <a href={s.url} target="_blank" rel="noreferrer" className="ops-table-meta">{s.url}</a>
                  </div>
                  <span className={`badge badge-${s.up ? 'success' : 'warning'}`}>{s.up ? 'Up' : 'Unknown'}</span>
                </div>
              ))}
            </div>
            <div className="ops-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-primary" onClick={() => setBooting(true)} disabled={booting}>
                {booting ? 'Deploying...' : 'Deploy Monitoring Stack'}
              </button>
              <button className="btn btn-sm" onClick={() => setEnforcing(true)} disabled={enforcing}>
                {enforcing ? 'Enforcing...' : 'Enforce Config'}
              </button>
            </div>
            {actionMsg && <p className="ops-subtle" style={{ marginTop: 10 }}>{actionMsg}</p>}
          </div>
        </div>
      )}

      {!loading && activeTab === 'hosts' && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div className="ops-panel-title">Per-Host Monitoring Status</div>
          </div>
          <div className="table-wrap">
            <table className="table ops-table">
              <thead><tr><th>Hostname</th><th>IP</th><th>Exporter</th><th>Monitoring</th><th>Last Seen</th></tr></thead>
              <tbody>
                {hosts.map(host => (
                  <tr key={host.id}>
                    <td><strong>{host.hostname || host.name}</strong></td>
                    <td style={{ fontSize: 12 }}>{host.ip}</td>
                    <td>
                      <span className={`badge badge-${host.node_exporter_enabled ? 'success' : 'warning'}`}>
                        {host.node_exporter_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${host.is_monitored || host.monitoring_enabled ? 'success' : 'info'}`}>
                        {host.is_monitored || host.monitoring_enabled ? 'Monitored' : 'Basic'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{host.last_seen ? new Date(host.last_seen).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'grafana' && (
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 16 }}>Grafana Dashboards</div>
          <div className="ops-command-card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Grafana Interface</div>
            <p className="ops-subtle">Access your Grafana dashboards at: <a href={`http://${masterIp}:3000`} target="_blank" rel="noreferrer">http://{masterIp}:3000</a></p>
            <iframe
              src={`http://${masterIp}:3000`}
              title="Grafana"
              style={{ width: '100%', height: 480, border: 'none', borderRadius: 8, marginTop: 12, background: '#0f172a' }}
            />
          </div>
        </div>
      )}

      {!loading && activeTab === 'prometheus' && (
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 16 }}>Prometheus Metrics</div>
          <div className="ops-command-card">
            <p className="ops-subtle">Prometheus expression browser: <a href={`http://${masterIp}:9090`} target="_blank" rel="noreferrer">http://{masterIp}:9090</a></p>
            <iframe
              src={`http://${masterIp}:9090`}
              title="Prometheus"
              style={{ width: '100%', height: 480, border: 'none', borderRadius: 8, marginTop: 12, background: '#0f172a' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
"""

# 5. MaintenanceWindowsPage
MAINT_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#99f6e4', background: 'linear-gradient(145deg, #f0fdfa, #f8fffd)' }}>
          <div className="ops-kicker">Maintenance Window Scheduler</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Windows</span>
              <span className="ops-emphasis-value" style={{ color: '#0f766e' }}>{windows.filter(w => w.is_active !== false).length}</span>
              <span className="ops-emphasis-meta">of {windows.length} configured</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Schedule controlled maintenance windows and suppress alerts during planned operations.</h3>
              <p>Define recurring or one-time maintenance windows per host group or site. During active windows, patch operations execute without interrupting on-call teams. Windows can be scoped to specific host tags and time zones.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{windows.length} windows total</span>
            <span className="ops-chip">{windows.filter(w => w.recurring).length} recurring</span>
            <span className="ops-chip">{windows.filter(w => !w.recurring).length} one-time</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Next window</span>
          <div className="ops-side-metric" style={{ fontSize: 20 }}>
            {windows.find(w => new Date(w.start_time) > new Date())
              ? new Date(windows.find(w => new Date(w.start_time) > new Date()).start_time).toLocaleDateString()
              : 'None'}
          </div>
          <p className="ops-side-note">Maintenance windows suspend alerting and enable batch patch operations. Use recurring windows for planned weekly/monthly maintenance cycles.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 14 }}>Schedule Maintenance Window</div>
          <div className="ops-form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Window Name</label>
              <input className="input" placeholder="e.g. Weekly Patch Window" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <label className="ops-side-label">Start Time</label>
              <input className="input" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({...f, start_time: e.target.value}))} />
            </div>
            <div>
              <label className="ops-side-label">End Time</label>
              <input className="input" type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({...f, end_time: e.target.value}))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Host Tags / Scope (comma-separated)</label>
              <input className="input" placeholder="prod, linux, site:London" value={form.tags || ''} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Description</label>
              <input className="input" placeholder="Reason for maintenance..." value={form.description || ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.recurring || false} onChange={e => setForm(f => ({...f, recurring: e.target.checked}))} />
              Recurring window
            </label>
          </div>
          {msg && <p className="ops-subtle" style={{ marginTop: 10, color: msg.toLowerCase().includes('success') ? '#15803d' : '#ef4444' }}>{msg}</p>}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={create} disabled={loading}>{loading ? 'Saving...' : 'Create Window'}</button>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Scheduled Windows</div>
              <p className="ops-subtle">All configured maintenance windows ordered by start time.</p>
            </div>
            <button className="btn btn-sm" onClick={load}>Refresh</button>
          </div>
          {!windows.length ? (
            <div className="ops-empty">No maintenance windows configured.</div>
          ) : (
            <div className="ops-list">
              {windows.map(w => (
                <div key={w.id} className="ops-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{w.name}</strong>
                      {w.recurring && <span className="badge badge-info" style={{ marginLeft: 8 }}>Recurring</span>}
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(w.id)}>Delete</button>
                  </div>
                  <div className="ops-table-meta" style={{ marginTop: 6 }}>
                    {w.start_time ? new Date(w.start_time).toLocaleString() : '—'}
                    {' → '}
                    {w.end_time ? new Date(w.end_time).toLocaleString() : '—'}
                  </div>
                  {w.description && <div className="ops-subtle" style={{ marginTop: 4 }}>{w.description}</div>}
                  {w.tags && <div className="ops-chip-row" style={{ marginTop: 6 }}>{(Array.isArray(w.tags) ? w.tags : w.tags.split(',')).map(t => <span key={t} className="ops-chip">{t.trim()}</span>)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"""

# 6. RemediationPage
REMEDIATION_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#fca5a5', background: 'linear-gradient(145deg, #fef2f2, #fff8f8)' }}>
          <div className="ops-kicker">Vulnerability Remediation Engine</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Open CVEs</span>
              <span className="ops-emphasis-value" style={{ color: '#b91c1c' }}>{cves.filter(c => !c.is_resolved).length}</span>
              <span className="ops-emphasis-meta">requiring remediation</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Orchestrate CVE remediation across the fleet with automated fix workflows.</h3>
              <p>Select vulnerability records, identify affected hosts, and dispatch targeted patch operations — all in one workflow. Track fix status per CVE and per host, and generate remediation evidence for compliance audits.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{cves.length} total CVEs</span>
            <span className="ops-chip">{cves.filter(c => c.severity === 'critical').length} critical</span>
            <span className="ops-chip">{cves.filter(c => c.is_resolved).length} resolved</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Fix coverage</span>
          <div className="ops-side-metric" style={{ color: '#15803d' }}>
            {cves.length > 0 ? `${Math.round((cves.filter(c => c.is_resolved).length / cves.length) * 100)}%` : '—'}
          </div>
          <p className="ops-side-note">Remediation workflows target CVEs with known fix packages. Dispatching a patch job immediately applies the fix to all selected affected hosts.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">CVE Remediation Queue</div>
              <p className="ops-subtle">Select a CVE to view affected hosts and dispatch a targeted fix.</p>
            </div>
            <div className="ops-actions">
              <select className="input" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{ width: 140 }}>
                <option value="">All severities</option>
                {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {!cves.length ? (
            <div className="ops-empty">No CVEs in remediation queue.</div>
          ) : (
            <div className="ops-list" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {cves.filter(c => !severityFilter || c.severity === severityFilter).map(cve => (
                <button
                  key={cve.id}
                  className="ops-list-item"
                  onClick={() => selectCve(cve)}
                  style={{ textAlign: 'left', background: selectedCve?.id === cve.id ? 'rgba(37,99,235,0.08)' : 'none', border: 'none', width: '100%', cursor: 'pointer' }}
                >
                  <div className="ops-list-copy">
                    <strong><code style={{ fontSize: 12 }}>{cve.cve_id}</code></strong>
                    <span>{cve.description ? cve.description.slice(0, 80) + '...' : 'No description'}</span>
                    <span className="ops-table-meta">CVSS: {cve.cvss_score ?? 'N/A'} · {cve.affected_hosts_count ?? 0} hosts affected</span>
                  </div>
                  <div>
                    <span className="badge" style={{ background: cve.severity === 'critical' ? '#b91c1c' : cve.severity === 'high' ? '#c2410c' : cve.severity === 'medium' ? '#b45309' : '#1d4ed8', color: '#fff' }}>
                      {cve.severity}
                    </span>
                    {cve.is_resolved && <span className="badge badge-success" style={{ marginLeft: 4 }}>Fixed</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ops-panel">
          {!selectedCve ? (
            <div className="ops-empty">Select a CVE from the list to see affected hosts and dispatch a fix.</div>
          ) : (
            <>
              <div className="ops-table-toolbar">
                <div>
                  <div className="ops-panel-title"><code style={{ fontSize: 14 }}>{selectedCve.cve_id}</code></div>
                  <p className="ops-subtle">{selectedCve.affected_hosts_count ?? 0} hosts affected · CVSS {selectedCve.cvss_score ?? 'N/A'}</p>
                </div>
                <button className="btn btn-primary" onClick={dispatchFix} disabled={dispatching || !selectedHosts.length}>
                  {dispatching ? 'Dispatching...' : `Fix ${selectedHosts.length} Host${selectedHosts.length !== 1 ? 's' : ''}`}
                </button>
              </div>
              {fixMsg && <p className="ops-subtle" style={{ marginBottom: 12, color: fixMsg.includes('dispatched') ? '#15803d' : '#ef4444' }}>{fixMsg}</p>}
              <div className="ops-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
                {(affectedHosts || []).map(host => (
                  <label key={host.id} className="ops-list-item" style={{ cursor: 'pointer' }}>
                    <div className="ops-list-copy">
                      <strong>
                        <input type="checkbox" checked={selectedHosts.includes(host.id)} onChange={() => toggleHost(host.id)} style={{ marginRight: 8 }} />
                        {host.hostname || host.name}
                      </strong>
                      <span className="ops-table-meta">{host.ip} · {host.os || 'Unknown OS'}</span>
                    </div>
                    <span className={`badge badge-${host.fix_status === 'fixed' ? 'success' : host.fix_status === 'failed' ? 'danger' : 'warning'}`}>
                      {host.fix_status || 'Affected'}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
"""

# 7. PatchHooksPage
HOOKS_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#c4b5fd', background: 'linear-gradient(145deg, #f5f3ff, #faf9ff)' }}>
          <div className="ops-kicker">Patch Lifecycle Hooks</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Hooks</span>
              <span className="ops-emphasis-value" style={{ color: '#6d28d9' }}>{hooks.filter(h => h.is_enabled !== false).length}</span>
              <span className="ops-emphasis-meta">of {hooks.length} configured</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Execute custom scripts before and after patch operations on any host or group.</h3>
              <p>Lifecycle hooks inject custom logic at pre-patch, post-patch, on-failure, and on-success events. Use them for service drain, backup verification, smoke tests, or notifications — all without modifying the core patch engine.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{hooks.filter(h => h.event === 'pre_patch').length} pre-patch</span>
            <span className="ops-chip">{hooks.filter(h => h.event === 'post_patch').length} post-patch</span>
            <span className="ops-chip">{hooks.filter(h => h.event === 'on_failure').length} on-failure</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Hook coverage</span>
          <div className="ops-side-metric">{hooks.length}</div>
          <p className="ops-side-note">Hooks fire automatically at lifecycle boundaries. Pre-patch hooks can abort the operation by returning a non-zero exit code, providing a safety gate for production environments.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 14 }}>{editHook ? 'Edit Hook' : 'Create Hook'}</div>
          <div className="ops-form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Hook Name</label>
              <input className="input" placeholder="e.g. Pre-patch service drain" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <label className="ops-side-label">Lifecycle Event</label>
              <select className="input" value={form.event} onChange={e => setForm(f => ({...f, event: e.target.value}))}>
                <option value="pre_patch">Pre-Patch</option>
                <option value="post_patch">Post-Patch</option>
                <option value="on_failure">On Failure</option>
                <option value="on_success">On Success</option>
              </select>
            </div>
            <div>
              <label className="ops-side-label">Execution Order</label>
              <input className="input" type="number" value={form.order || 0} onChange={e => setForm(f => ({...f, order: +e.target.value}))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Script</label>
              <textarea
                className="input"
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                placeholder="#!/bin/bash\n# Your hook script here"
                value={form.script}
                onChange={e => setForm(f => ({...f, script: e.target.value}))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Host Tags (comma-separated, empty = all hosts)</label>
              <input className="input" placeholder="prod, site:London" value={form.tags || ''} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.is_enabled !== false} onChange={e => setForm(f => ({...f, is_enabled: e.target.checked}))} />
              Enabled
            </label>
          </div>
          {msg && <p className="ops-subtle" style={{ marginTop: 10, color: msg.toLowerCase().includes('success') || msg.toLowerCase().includes('saved') ? '#15803d' : '#ef4444' }}>{msg}</p>}
          <div className="ops-actions" style={{ marginTop: 14 }}>
            {editHook && <button className="btn btn-sm" onClick={() => { setEditHook(null); resetForm(); }}>Cancel</button>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : editHook ? 'Update Hook' : 'Create Hook'}</button>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Configured Hooks ({hooks.length})</div>
              <p className="ops-subtle">Hooks fire in execution order within each lifecycle event.</p>
            </div>
            <button className="btn btn-sm" onClick={load}>Refresh</button>
          </div>
          {!hooks.length ? (
            <div className="ops-empty">No lifecycle hooks configured yet.</div>
          ) : (
            <div className="ops-list">
              {hooks.map(hook => (
                <div key={hook.id} className="ops-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{hook.name}</strong>
                      <span className="badge badge-info">{hook.event}</span>
                      {hook.is_enabled === false && <span className="badge badge-warning">Disabled</span>}
                    </div>
                    <div className="ops-actions">
                      <button className="btn btn-sm" onClick={() => startEdit(hook)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(hook.id)}>Delete</button>
                    </div>
                  </div>
                  <div className="ops-table-meta">Order: {hook.order ?? 0} · {hook.tags ? `Tags: ${hook.tags}` : 'All hosts'}</div>
                  {hook.script && (
                    <pre style={{ margin: 0, fontSize: 11, color: '#64748b', overflow: 'hidden', maxHeight: 48, textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                      {hook.script.slice(0, 120)}{hook.script.length > 120 ? '...' : ''}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"""

# 8. RingRolloutPage
RING_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#6ee7b7', background: 'linear-gradient(145deg, #ecfdf5, #f0fff9)' }}>
          <div className="ops-kicker">Staged Ring Deployment</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Rings</span>
              <span className="ops-emphasis-value" style={{ color: '#065f46' }}>{rings.length}</span>
              <span className="ops-emphasis-meta">deployment rings configured</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Safely roll out patches across your fleet using controlled deployment rings.</h3>
              <p>Ring rollouts allow progressive deployment with gate reviews between each stage. Hosts are grouped into rings (Canary → Early → General → Laggard). Each ring runs and must be approved before the next one proceeds.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{rings.length} rings</span>
            <span className="ops-chip">{rollouts.filter(r => r.status === 'running').length} active rollouts</span>
            <span className="ops-chip">{rollouts.filter(r => r.status === 'completed').length} completed</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">In-flight rollouts</span>
          <div className="ops-side-metric">{rollouts.filter(r => r.status === 'running' || r.status === 'pending').length}</div>
          <p className="ops-side-note">Ring-based rollouts enable risk-controlled deployments. Canary rings validate patches on low-risk hosts before progression to production rings.</p>
        </div>
      </div>

      <div className="ops-panel" style={{ padding: '8px 12px' }}>
        <div className="ops-pills">
          {['rings','rollouts','new'].map(t => (
            <button key={t} className={`ops-pill ${view===t?'active':''}`} onClick={() => setView(t)}>
              {t === 'rings' ? 'Ring Config' : t === 'rollouts' ? 'Active Rollouts' : 'New Rollout'}
            </button>
          ))}
        </div>
      </div>

      {view === 'rings' && (
        <>
          <div className="ops-panel">
            <div className="ops-panel-title" style={{ marginBottom: 14 }}>Create Deployment Ring</div>
            <div className="ops-form-grid">
              <div>
                <label className="ops-side-label">Ring Name</label>
                <input className="input" placeholder="e.g. Canary" value={ringForm.name} onChange={e => setRingForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div>
                <label className="ops-side-label">Order (1=first)</label>
                <input className="input" type="number" min="1" value={ringForm.order || 1} onChange={e => setRingForm(f => ({...f, order: +e.target.value}))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Host Tags (comma-separated)</label>
                <input className="input" placeholder="canary, site:London" value={ringForm.tags || ''} onChange={e => setRingForm(f => ({...f, tags: e.target.value}))} />
              </div>
              <div>
                <label className="ops-side-label">Auto-proceed after (hours)</label>
                <input className="input" type="number" value={ringForm.auto_proceed_hours || ''} placeholder="Leave blank for manual gate" onChange={e => setRingForm(f => ({...f, auto_proceed_hours: e.target.value}))} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={createRing}>Create Ring</button>
            </div>
          </div>

          <div className="ops-panel">
            <div className="ops-table-toolbar">
              <div className="ops-panel-title">Configured Rings</div>
            </div>
            {!rings.length ? (
              <div className="ops-empty">No rings configured yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="table ops-table">
                  <thead><tr><th>Order</th><th>Ring Name</th><th>Host Tags</th><th>Auto-Proceed</th><th>Actions</th></tr></thead>
                  <tbody>
                    {[...rings].sort((a,b) => (a.order||0)-(b.order||0)).map(ring => (
                      <tr key={ring.id}>
                        <td><strong>#{ring.order}</strong></td>
                        <td>{ring.name}</td>
                        <td>{ring.tags || 'All hosts'}</td>
                        <td>{ring.auto_proceed_hours ? `${ring.auto_proceed_hours}h` : 'Manual gate'}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => deleteRing(ring.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {view === 'new' && (
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 14 }}>Start New Ring Rollout</div>
          <div className="ops-form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Rollout Name</label>
              <input className="input" placeholder="e.g. April 2025 Security Patches" value={rolloutForm.name} onChange={e => setRolloutForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <label className="ops-side-label">Packages (comma-separated)</label>
              <input className="input" placeholder="nginx, curl" value={rolloutForm.packages || ''} onChange={e => setRolloutForm(f => ({...f, packages: e.target.value}))} />
            </div>
            <div>
              <label className="ops-side-label">Patch Channel</label>
              <select className="input" value={rolloutForm.channel || 'all'} onChange={e => setRolloutForm(f => ({...f, channel: e.target.value}))}>
                <option value="all">All available</option>
                <option value="security">Security only</option>
                <option value="critical">Critical only</option>
              </select>
            </div>
          </div>
          {rolloutMsg && <p className="ops-subtle" style={{ marginTop: 10, color: rolloutMsg.toLowerCase().includes('started') ? '#15803d' : '#ef4444' }}>{rolloutMsg}</p>}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={startRollout}>Start Rollout</button>
          </div>
        </div>
      )}

      {view === 'rollouts' && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div className="ops-panel-title">Ring Rollout History</div>
            <button className="btn btn-sm" onClick={load}>Refresh</button>
          </div>
          {!rollouts.length ? (
            <div className="ops-empty">No rollouts yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table ops-table">
                <thead><tr><th>Rollout</th><th>Current Ring</th><th>Status</th><th>Started</th><th>Actions</th></tr></thead>
                <tbody>
                  {rollouts.map(r => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <span className="ops-table-meta">{r.packages || 'All'}</span>
                      </td>
                      <td>{r.current_ring_name || 'Ring ' + (r.current_ring || 1)}</td>
                      <td>
                        <span className={`badge badge-${r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : r.status === 'running' ? 'warning' : 'info'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11 }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                      <td>
                        {r.status === 'awaiting_approval' && (
                          <div className="ops-actions">
                            <button className="btn btn-sm" onClick={() => approveRing(r.id)}>Approve Ring</button>
                            <button className="btn btn-sm btn-danger" onClick={() => abortRollout(r.id)}>Abort</button>
                          </div>
                        )}
                        {r.status === 'running' && (
                          <button className="btn btn-sm btn-danger" onClick={() => abortRollout(r.id)}>Abort</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
"""

# 9. BulkPatchPage
BULK_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#86efac', background: 'linear-gradient(145deg, #f0fdf4, #f8fffb)' }}>
          <div className="ops-kicker">Bulk Patch Orchestration</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Selected Hosts</span>
              <span className="ops-emphasis-value" style={{ color: '#15803d' }}>{selectedHosts.length}</span>
              <span className="ops-emphasis-meta">of {hosts.length} in fleet</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Push patch operations to large groups of hosts simultaneously with intelligent channel routing.</h3>
              <p>Bulk patching enables you to target Linux via apt/yum and Windows via WSUS/WUA simultaneously. Select hosts, specify packages or run a full system upgrade, and dispatch with a single action — outputs streamed live per host.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{hosts.filter(h => h.os_family === 'linux' || h.os?.toLowerCase().includes('linux') || h.os?.toLowerCase().includes('ubuntu')).length} Linux</span>
            <span className="ops-chip">{hosts.filter(h => h.os_family === 'windows' || h.os?.toLowerCase().includes('windows')).length} Windows</span>
            <span className="ops-chip">{channel === 'linux' ? 'Linux (apt/yum)' : 'Windows (WSUS/WUA)'} channel</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Jobs submitted</span>
          <div className="ops-side-metric">{jobHistory.length}</div>
          <p className="ops-side-note">Bulk patch jobs are dispatched in parallel per host. Results stream back in real time. Use the Linux or Windows channel selector to match your target OS.</p>
        </div>
      </div>

      <div className="ops-panel" style={{ padding: '8px 12px' }}>
        <div className="ops-pills">
          <button className={`ops-pill ${channel==='linux'?'active':''}`} onClick={() => setChannel('linux')}>Linux (apt/yum)</button>
          <button className={`ops-pill ${channel==='windows'?'active':''}`} onClick={() => setChannel('windows')}>Windows (WSUS/WUA)</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Target Hosts ({selectedHosts.length} selected)</div>
              <p className="ops-subtle">Multi-select endpoints for this bulk patch operation.</p>
            </div>
            <div className="ops-actions">
              <button className="btn btn-sm" onClick={selectAll}>All</button>
              <button className="btn btn-sm" onClick={selectNone}>None</button>
            </div>
          </div>
          <div className="ops-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {filteredHosts.map(host => (
              <label key={host.id} className="ops-list-item" style={{ cursor: 'pointer' }}>
                <div className="ops-list-copy">
                  <strong>
                    <input type="checkbox" checked={selectedHosts.includes(String(host.id))} onChange={() => toggleHost(String(host.id))} style={{ marginRight: 8 }} />
                    {host.hostname || host.name}
                  </strong>
                  <span className="ops-table-meta">{host.ip} · {host.os || 'Unknown OS'}{host.site ? ` · ${host.site}` : ''}</span>
                </div>
                <span className={`badge badge-${host.is_online !== false ? 'success' : 'warning'}`}>{host.is_online !== false ? 'Online' : 'Offline'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 14 }}>Patch Configuration</div>
          <div className="ops-form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Operation Mode</label>
              <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="upgrade-all">Upgrade All Packages</option>
                <option value="specific">Install / Upgrade Specific Packages</option>
                <option value="security">Security Updates Only</option>
              </select>
            </div>
            {mode === 'specific' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Package Names (comma-separated)</label>
                <input className="input" placeholder="nginx, curl, openssl" value={packages} onChange={e => setPackages(e.target.value)} />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Change Ticket / Reason</label>
              <input className="input" placeholder="CHG-12345 (optional)" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            {channel === 'windows' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Windows Update Category</label>
                <select className="input" value={windowsCategory || 'all'} onChange={e => setWindowsCategory(e.target.value)}>
                  <option value="all">All Updates</option>
                  <option value="security">Security Updates</option>
                  <option value="critical">Critical Updates</option>
                  <option value="drivers">Drivers</option>
                </select>
              </div>
            )}
          </div>
          {msg && <p className="ops-subtle" style={{ marginTop: 10, color: msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error') ? '#ef4444' : '#15803d' }}>{msg}</p>}
          <div className="ops-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={submit} disabled={loading || !selectedHosts.length}>
              {loading ? 'Dispatching...' : `Patch ${selectedHosts.length} Host${selectedHosts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Patch Results</div>
              <div className="ops-chip-row">
                <span className="badge badge-success">{results.filter(r => r.status === 'success').length} OK</span>
                <span className="badge badge-danger">{results.filter(r => r.status === 'failed' || r.status === 'error').length} Failed</span>
              </div>
            </div>
          </div>
          <div className="ops-list">
            {results.map((r, idx) => (
              <div key={`${r.host_ip || r.ip}-${idx}`} className="ops-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{r.hostname || r.host_ip || r.ip || 'Unknown'}</strong>
                  <span className={`badge badge-${r.status === 'success' ? 'success' : 'danger'}`}>{r.status}</span>
                </div>
                {r.output && (
                  <pre style={{ margin: 0, fontSize: 11, background: '#0f172a', color: '#e2e8f0', borderRadius: 6, padding: '6px 10px', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {r.output}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
"""

# 10. PolicyManagerPage
POLICY_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#fde68a', background: 'linear-gradient(145deg, #fefce8, #fffef5)' }}>
          <div className="ops-kicker">Configuration Policy Engine</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Policies</span>
              <span className="ops-emphasis-value" style={{ color: '#b45309' }}>{policies.length}</span>
              <span className="ops-emphasis-meta">compliance policies configured</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Define, version, and enforce YAML-based configuration policies across your fleet.</h3>
              <p>The Policy Engine lets operators author YAML compliance policies, publish revisions, and queue admin tasks for each policy. Host groups can be scoped per policy, with full change history and rollback support per revision.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{policies.length} policies</span>
            <span className="ops-chip">{adminTasks.filter(t => t.status === 'pending').length} pending tasks</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Pending admin tasks</span>
          <div className="ops-side-metric">{adminTasks.filter(t => t.status === 'pending').length}</div>
          <p className="ops-side-note">Admin tasks queue policy enforcement actions. Each policy maintains a full revision history with YAML diff support for compliance traceability.</p>
        </div>
      </div>

      <div className="ops-panel" style={{ padding: '8px 12px' }}>
        <div className="ops-pills">
          {['policies', 'tasks'].map(t => (
            <button key={t} className={`ops-pill ${view===t?'active':''}`} onClick={() => setView(t)}>
              {t === 'policies' ? 'Policies' : `Admin Tasks (${adminTasks.filter(t => t.status === 'pending').length})`}
            </button>
          ))}
        </div>
      </div>

      {view === 'policies' && (
        <>
          <div className="grid-2">
            <div className="ops-panel">
              <div className="ops-panel-title" style={{ marginBottom: 14 }}>Create Policy</div>
              <div className="ops-form-grid">
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Policy Name</label>
                  <input className="input" placeholder="e.g. CIS Linux Baseline" value={policyForm.name} onChange={e => setPolicyForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Description</label>
                  <input className="input" placeholder="What this policy enforces..." value={policyForm.description || ''} onChange={e => setPolicyForm(f => ({...f, description: e.target.value}))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Initial YAML Content</label>
                  <textarea className="input" rows={8} style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} placeholder="# Policy YAML\nversion: 1\nrules: []" value={policyForm.yaml_content || ''} onChange={e => setPolicyForm(f => ({...f, yaml_content: e.target.value}))} />
                </div>
              </div>
              {policyMsg && <p className="ops-subtle" style={{ marginTop: 10, color: policyMsg.toLowerCase().includes('created') ? '#15803d' : '#ef4444' }}>{policyMsg}</p>}
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-primary" onClick={createPolicy}>Create Policy</button>
              </div>
            </div>

            <div className="ops-panel">
              <div className="ops-table-toolbar">
                <div className="ops-panel-title">Policy Registry ({policies.length})</div>
                <button className="btn btn-sm" onClick={load}>Refresh</button>
              </div>
              {!policies.length ? (
                <div className="ops-empty">No policies configured yet.</div>
              ) : (
                <div className="ops-list">
                  {policies.map(p => (
                    <button key={p.id} className="ops-list-item" onClick={() => selectPolicy(p)}
                      style={{ textAlign: 'left', background: selectedPolicy?.id === p.id ? 'rgba(37,99,235,0.08)' : 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
                      <div className="ops-list-copy">
                        <strong>{p.name}</strong>
                        <span>{p.description || 'No description'}</span>
                        <span className="ops-table-meta">{p.revision_count || 0} revisions</span>
                      </div>
                      <span className={`badge badge-${p.is_active ? 'success' : 'warning'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedPolicy && (
            <div className="ops-panel">
              <div className="ops-table-toolbar">
                <div>
                  <div className="ops-panel-title">{selectedPolicy.name} — Revision History</div>
                </div>
                <button className="btn btn-sm" onClick={() => setSelectedPolicy(null)}>Close</button>
              </div>
              <div className="table-wrap">
                <table className="table ops-table">
                  <thead><tr><th>Rev</th><th>Author</th><th>Message</th><th>Published</th><th>Actions</th></tr></thead>
                  <tbody>
                    {(policyRevisions || []).map(rev => (
                      <tr key={rev.id}>
                        <td><span className="badge badge-info">v{rev.revision}</span></td>
                        <td>{rev.created_by || '—'}</td>
                        <td>{rev.commit_message || '—'}</td>
                        <td style={{ fontSize: 11 }}>{rev.created_at ? new Date(rev.created_at).toLocaleString() : '—'}</td>
                        <td>
                          <button className="btn btn-sm" onClick={() => viewRevision(rev.id)}>View YAML</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'tasks' && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Admin Task Queue</div>
              <p className="ops-subtle">Actions queued for policy enforcement across the fleet.</p>
            </div>
          </div>
          {!adminTasks.length ? (
            <div className="ops-empty">No admin tasks queued.</div>
          ) : (
            <div className="table-wrap">
              <table className="table ops-table">
                <thead><tr><th>Task</th><th>Policy</th><th>Assigned To</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {adminTasks.map(task => (
                    <tr key={task.id}>
                      <td><strong>{task.title || task.task_type || 'Task'}</strong></td>
                      <td>{task.policy_name || '—'}</td>
                      <td>{task.assigned_to || 'Unassigned'}</td>
                      <td><span className={`badge badge-${task.status === 'completed' ? 'success' : task.status === 'failed' ? 'danger' : 'warning'}`}>{task.status}</span></td>
                      <td style={{ fontSize: 11 }}>{task.created_at ? new Date(task.created_at).toLocaleString() : '—'}</td>
                      <td>
                        {task.status === 'pending' && (
                          <div className="ops-actions">
                            <button className="btn btn-sm" onClick={() => completeTask(task.id)}>Complete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
"""

print("Applying batch retrofit...")
splice('SLAOpsPage.jsx', SLA_RETURN)
splice('OpsQueuePage.jsx', OPSQUEUE_RETURN)
splice('JobsPage.jsx', JOBS_RETURN)
splice('MonitoringOpsPage.jsx', MONITORING_RETURN)
splice('MaintenanceWindowsPage.jsx', MAINT_RETURN)
splice('RemediationPage.jsx', REMEDIATION_RETURN)
splice('PatchHooksPage.jsx', HOOKS_RETURN)
splice('RingRolloutPage.jsx', RING_RETURN)
splice('BulkPatchPage.jsx', BULK_RETURN)
splice('PolicyManagerPage.jsx', POLICY_RETURN)
print("Done - 10 pages retrofitted.")
