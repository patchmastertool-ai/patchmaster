#!/usr/bin/env python3
"""Retrofit remaining pages: SoftwarePage, NotificationsPage, CICDOpsPage, MirrorRepoOpsPage."""
import os

SRC = r'c:\Users\test\Desktop\pat-1\frontend\src'

def find_return_line(filename):
    path = os.path.join(SRC, filename)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if line.strip().startswith('return (') or line.strip() == 'return (':
            return i
    return None

def splice_return(filename, new_return):
    idx = find_return_line(filename)
    if idx is None:
        print(f"  ! Could not find return( in {filename}")
        return
    path = os.path.join(SRC, filename)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    top = ''.join(lines[:idx])
    with open(path, 'w', encoding='utf-8') as f:
        f.write(top)
        f.write(new_return)
    size = os.path.getsize(path)
    print(f"  OK: {filename} ({size} bytes, splice at line {idx+1})")


# ── 1. NotificationsPage - retrofit to ops-shell ──
NOTIFICATIONS_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#a5b4fc', background: 'linear-gradient(145deg, #eef2ff, #f8fbff)' }}>
          <div className="ops-kicker">Event Routing & Alerting</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Active Channels</span>
              <span className="ops-emphasis-value" style={{ color: '#4f46e5' }}>{channels.filter(c => c.is_enabled).length}</span>
              <span className="ops-emphasis-meta">of {channels.length} enabled</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Route patch lifecycle events to your team's communication channels.</h3>
              <p>Configure webhooks, Slack, Telegram, and email notification channels. Each channel subscribes to specific events — patch failures, CVE alerts, compliance changes — and delivers real-time alerts to keep your team informed.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{channels.length} channels total</span>
            <span className="ops-chip">webhook · slack · telegram · email</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Coverage</span>
          <div className="ops-side-metric">{channels.filter(c => c.is_enabled).length}</div>
          <p className="ops-side-note">Active notification channels route events to external systems. Disable any channel to suppress alerts without deleting the configuration.</p>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Notification Channels</div>
            <p className="ops-subtle">All registered notification endpoints. Test individual channels to validate connectivity before relying on them for critical alerts.</p>
          </div>
        </div>
        {channels.length === 0 ? (
          <div className="ops-empty">No notification channels configured yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr><th>Name</th><th>Type</th><th>Events</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {channels.map(channel => (
                  <tr key={channel.id}>
                    <td><strong>{channel.name}</strong></td>
                    <td><span className="badge badge-info">{channel.channel_type}</span></td>
                    <td style={{ maxWidth: 320, fontSize: 11, color: '#64748b' }}>{(channel.events || []).join(', ')}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${channel.is_enabled ? 'btn-success' : ''}`}
                        onClick={() => toggleEnabled(channel)}
                        disabled={!hasRole('admin')}
                      >
                        {channel.is_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      <div className="ops-actions">
                        <button className="btn btn-sm" onClick={() => test(channel.id)}>Test</button>
                        {hasRole('admin') && (
                          <>
                            <button className="btn btn-sm" onClick={() => openEdit(channel)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => del(channel.id)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasRole('admin') && (
        <div className="ops-panel">
          <div className="ops-panel-title" style={{ marginBottom: 14 }}>Add Notification Channel</div>
          <div className="ops-form-grid">
            <div>
              <label className="ops-side-label">Channel Name</label>
              <input className="input" placeholder="e.g. Slack Ops Alerts" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="ops-side-label">Type</label>
              <select className="input" value={form.channel_type} onChange={e => setForm(prev => ({ ...prev, channel_type: e.target.value }))}>
                <option value="webhook">Webhook</option>
                <option value="slack">Slack</option>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
              </select>
            </div>
            {form.channel_type === 'webhook' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Webhook URL</label>
                <input className="input" placeholder="https://..." value={form.url} onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))} />
              </div>
            )}
            {form.channel_type === 'slack' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Slack Incoming Webhook URL</label>
                <input className="input" placeholder="https://hooks.slack.com/services/..." value={form.slack_webhook_url} onChange={e => setForm(prev => ({ ...prev, slack_webhook_url: e.target.value }))} />
              </div>
            )}
            {form.channel_type === 'telegram' && (
              <>
                <div>
                  <label className="ops-side-label">Bot Token</label>
                  <input className="input" placeholder="bot_token" value={form.telegram_bot_token} onChange={e => setForm(prev => ({ ...prev, telegram_bot_token: e.target.value }))} />
                </div>
                <div>
                  <label className="ops-side-label">Chat ID</label>
                  <input className="input" placeholder="chat_id" value={form.telegram_chat_id} onChange={e => setForm(prev => ({ ...prev, telegram_chat_id: e.target.value }))} />
                </div>
              </>
            )}
            {form.channel_type === 'email' && (
              <>
                <div>
                  <label className="ops-side-label">To Email</label>
                  <input className="input" placeholder="ops@company.com" value={form.email_to} onChange={e => setForm(prev => ({ ...prev, email_to: e.target.value }))} />
                </div>
                <div>
                  <label className="ops-side-label">SMTP Host</label>
                  <input className="input" placeholder="smtp.gmail.com" value={form.smtp_host} onChange={e => setForm(prev => ({ ...prev, smtp_host: e.target.value }))} />
                </div>
                <div>
                  <label className="ops-side-label">Port</label>
                  <input className="input" type="number" placeholder="587" value={form.smtp_port} onChange={e => setForm(prev => ({ ...prev, smtp_port: e.target.value }))} />
                </div>
                <div>
                  <label className="ops-side-label">SMTP Username</label>
                  <input className="input" placeholder="smtp_user (optional)" value={form.smtp_username} onChange={e => setForm(prev => ({ ...prev, smtp_username: e.target.value }))} />
                </div>
                <div>
                  <label className="ops-side-label">SMTP Password</label>
                  <input className="input" type="password" placeholder="(optional)" value={form.smtp_password} onChange={e => setForm(prev => ({ ...prev, smtp_password: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.smtp_use_tls} onChange={e => setForm(prev => ({ ...prev, smtp_use_tls: e.target.checked }))} />
                  <label style={{ fontSize: 13 }}>Use TLS</label>
                </div>
              </>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="ops-side-label">Subscribed Events (comma-separated)</label>
              <input className="input" placeholder="job_failed, cve_critical, patch_complete" value={form.events} onChange={e => setForm(prev => ({ ...prev, events: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(prev => ({ ...prev, is_enabled: e.target.checked }))} />
              <label style={{ fontSize: 13 }}>Enable channel immediately</label>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={create}>Add Channel</button>
          </div>
        </div>
      )}

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="ops-table-toolbar" style={{ marginBottom: 20 }}>
              <div className="ops-panel-title">Edit Channel</div>
              <button className="btn btn-sm" onClick={() => setEdit(null)}>Close</button>
            </div>
            {editMsg && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{editMsg}</p>}
            <div className="ops-form-grid">
              <div>
                <label className="ops-side-label">Name</label>
                <input className="input" value={edit.name} onChange={e => setEdit(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label className="ops-side-label">Type</label>
                <select className="input" value={edit.channel_type} onChange={e => setEdit(prev => ({ ...prev, channel_type: e.target.value }))}>
                  <option value="webhook">Webhook</option>
                  <option value="slack">Slack</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                </select>
              </div>
              {edit.channel_type === 'webhook' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Webhook URL</label>
                  <input className="input" placeholder={edit.has_secret_config ? 'Configured (enter new URL to replace)' : 'Webhook URL'} value={edit.url} onChange={e => setEdit(prev => ({ ...prev, url: e.target.value }))} />
                </div>
              )}
              {edit.channel_type === 'slack' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Slack Webhook URL</label>
                  <input className="input" placeholder={edit.has_secret_config ? 'Configured (enter new URL to replace)' : 'Slack Webhook URL'} value={edit.slack_webhook_url} onChange={e => setEdit(prev => ({ ...prev, slack_webhook_url: e.target.value }))} />
                </div>
              )}
              {edit.channel_type === 'telegram' && (
                <>
                  <div>
                    <label className="ops-side-label">Bot Token</label>
                    <input className="input" placeholder={edit.has_secret_config ? 'Configured (enter new token to replace)' : 'bot_token'} value={edit.telegram_bot_token} onChange={e => setEdit(prev => ({ ...prev, telegram_bot_token: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ops-side-label">Chat ID</label>
                    <input className="input" placeholder="chat_id" value={edit.telegram_chat_id} onChange={e => setEdit(prev => ({ ...prev, telegram_chat_id: e.target.value }))} />
                  </div>
                </>
              )}
              {edit.channel_type === 'email' && (
                <>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="ops-side-label">To Email</label>
                    <input className="input" value={edit.email_to} onChange={e => setEdit(prev => ({ ...prev, email_to: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ops-side-label">SMTP Host</label>
                    <input className="input" value={edit.smtp_host} onChange={e => setEdit(prev => ({ ...prev, smtp_host: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ops-side-label">Port</label>
                    <input className="input" type="number" value={edit.smtp_port} onChange={e => setEdit(prev => ({ ...prev, smtp_port: e.target.value }))} />
                  </div>
                </>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Events</label>
                <input className="input" value={edit.events} onChange={e => setEdit(prev => ({ ...prev, events: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={edit.is_enabled} onChange={e => setEdit(prev => ({ ...prev, is_enabled: e.target.checked }))} />
                <label style={{ fontSize: 13 }}>Enabled</label>
              </div>
            </div>
            <div className="ops-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

# ── 2. SoftwarePage.jsx ──
SOFTWARE_RETURN = """  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#e9d5ff', background: 'linear-gradient(145deg, #faf5ff, #f3f0ff)' }}>
          <div className="ops-kicker">Software Distribution Platform</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Fleet Coverage</span>
              <span className="ops-emphasis-value" style={{ color: '#7c3aed' }}>{hosts.length}</span>
              <span className="ops-emphasis-meta">managed endpoints</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Push packages, maintain an approved catalog, and queue installs for controlled shutdown cycles.</h3>
              <p>A unified software distribution workspace: operator-led package actions, self-service kiosk for end-users, and controlled shutdown install queuing for compliance-sensitive environments.</p>
            </div>
          </div>
          <div className="ops-chip-row">
            {summary.map(s => (
              <span key={s.label} className="ops-chip">{s.label}: {s.value}</span>
            ))}
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Distribution stats</span>
          <div className="ops-inline-list">
            {summary.map(s => (
              <div key={s.label} className="ops-inline-card">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ops-panel" style={{ padding: '8px 12px' }}>
        <div className="ops-pills">
          {[['push', 'Operator Push'], ['kiosk', 'Approved Catalog']].map(([k, l]) => (
            <button key={k} className={`ops-pill ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
      </div>

      {view === 'push' && (
        <>
          <div className="grid-2">
            <div className="ops-panel">
              <div className="ops-table-toolbar">
                <div>
                  <div className="ops-panel-title">Target Hosts ({selectedHosts.length} selected)</div>
                  <p className="ops-subtle">Select endpoints for this software action.</p>
                </div>
                <div className="ops-actions">
                  <button className="btn btn-sm" onClick={selectAll}>All</button>
                  <button className="btn btn-sm" onClick={selectNone}>None</button>
                </div>
              </div>
              <div className="ops-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {hosts.map(host => (
                  <label key={host.id} className="ops-list-item" style={{ cursor: 'pointer' }}>
                    <div className="ops-list-copy">
                      <strong>
                        <input type="checkbox" checked={selectedHosts.includes(host.ip)} onChange={() => toggleHost(host.ip)} style={{ marginRight: 8 }} />
                        {host.hostname || host.name}
                      </strong>
                      <span className="ops-table-meta">{host.ip} · {host.os || 'Unknown'}{host.site ? ` · ${host.site}` : ''}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="ops-panel">
              <div className="ops-panel-title" style={{ marginBottom: 14 }}>Configure Action</div>
              <div className="ops-form-grid">
                <div>
                  <label className="ops-side-label">Operation</label>
                  <select className="input" value={action} onChange={e => setAction(e.target.value)}>
                    <option value="install">Install Package</option>
                    <option value="remove">Remove Package</option>
                  </select>
                </div>
                <div>
                  <label className="ops-side-label">Execution Mode</label>
                  <select className="input" value={executionMode} onChange={e => setExecutionMode(e.target.value)}>
                    <option value="immediate">Immediate</option>
                    <option value="shutdown">Queue for Shutdown</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Package Names (comma-separated)</label>
                  <input className="input" placeholder="nginx, curl, vim" value={packages} onChange={e => setPackages(e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="ops-side-label">Change Ticket / Reason</label>
                  <input className="input" placeholder="CHG-12345 (optional)" value={operatorNote} onChange={e => setOperatorNote(e.target.value)} />
                </div>
              </div>
              <div className="ops-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={executeOperatorAction} disabled={loading || !selectedHosts.length || !packages.trim()}>
                  {loading ? 'Processing...' : executionMode === 'shutdown' ? 'Queue Action' : 'Execute Now'}
                </button>
              </div>
              {results.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="ops-panel-title" style={{ marginBottom: 8 }}>Results</div>
                  <div className="ops-list">
                    {results.map((r, idx) => (
                      <div key={`${r.ip}-${idx}`} className="ops-list-item">
                        <div className="ops-list-copy">
                          <strong>{r.ip}</strong>
                          <span>{r.message}</span>
                        </div>
                        <span className={`badge badge-${r.status === 'success' ? 'success' : 'danger'}`}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedSingleHost && (
            <div className="ops-panel">
              <div className="ops-table-toolbar">
                <div>
                  <div className="ops-panel-title">Shutdown Queue — <code style={{ fontSize: 13 }}>{selectedSingleHost}</code></div>
                  <p className="ops-subtle">Actions queued for the next controlled reboot or shutdown.</p>
                </div>
                <div className="ops-actions">
                  <button className="btn btn-sm" onClick={() => fetchQueue(selectedSingleHost)}>{queueState.loading ? 'Refreshing...' : 'Refresh'}</button>
                  <button className="btn btn-sm" onClick={() => runPowerAction('reboot')}>Reboot + Run Queue</button>
                  <button className="btn btn-sm btn-danger" onClick={() => runPowerAction('shutdown')}>Shutdown + Run Queue</button>
                </div>
              </div>
              {queueState.items.length === 0 ? (
                <div className="ops-empty">No shutdown-queued installs for this host.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table ops-table">
                    <thead><tr><th>Queued At</th><th>Action</th><th>Packages</th><th>Requested By</th><th>Reason</th></tr></thead>
                    <tbody>
                      {queueState.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontSize: 11 }}>{item.queued_at ? new Date(item.queued_at).toLocaleString() : '—'}</td>
                          <td><span className="badge badge-info">{item.action}</span></td>
                          <td><code style={{ fontSize: 11 }}>{Array.isArray(item.packages) ? item.packages.join(', ') : ''}</code></td>
                          <td>{item.requested_by || '—'}</td>
                          <td>{item.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {view === 'kiosk' && (
        <>
          <div className="ops-panel">
            <div className="ops-panel-title" style={{ marginBottom: 12 }}>Request Configuration</div>
            <div className="ops-form-grid">
              <div style={{ gridColumn: 'span 2' }}>
                <label className="ops-side-label">Target Host</label>
                <select className="input" value={kioskHostId} onChange={e => setKioskHostId(e.target.value)}>
                  <option value="">Choose target host...</option>
                  {kioskHosts.map(host => <option key={host.id} value={host.id}>{host.hostname || host.name} ({host.ip})</option>)}
                </select>
              </div>
              <div>
                <label className="ops-side-label">Execution Override</label>
                <select className="input" value={kioskExecutionOverride} onChange={e => setKioskExecutionOverride(e.target.value)}>
                  <option value="default">Use catalog default</option>
                  <option value="immediate">Force immediate</option>
                  <option value="shutdown">Force controlled shutdown</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="ops-side-label">Request Note</label>
                <input className="input" placeholder="Reason for this request..." value={kioskNote} onChange={e => setKioskNote(e.target.value)} />
              </div>
            </div>
            {kioskMessage && <p className="ops-subtle" style={{ marginTop: 10, color: '#2563eb' }}>{kioskMessage}</p>}
          </div>

          <div className="ops-panel">
            <div className="ops-table-toolbar">
              <div>
                <div className="ops-panel-title">Approved Software Catalog</div>
                <p className="ops-subtle">Pre-approved packages available for self-service requests.</p>
              </div>
            </div>
            {catalogLoading ? (
              <div className="ops-empty">Loading catalog...</div>
            ) : catalog.length === 0 ? (
              <div className="ops-empty">No catalog items configured.</div>
            ) : (
              <div className="table-wrap">
                <table className="table ops-table">
                  <thead><tr><th>Software Title</th><th>Package ID</th><th>Platforms</th><th>Mode</th><th>Actions</th></tr></thead>
                  <tbody>
                    {catalog.map(item => (
                      <tr key={item.id} style={{ opacity: item.is_enabled ? 1 : 0.5 }}>
                        <td>
                          <strong>{item.name}</strong>
                          <span className="ops-table-meta">{item.description || 'No description'}</span>
                        </td>
                        <td><code style={{ fontSize: 11 }}>{item.package_name}</code></td>
                        <td>{(item.supported_platforms || []).join(', ') || 'Any'}</td>
                        <td><span className="badge badge-info">{item.default_execution_mode}</span></td>
                        <td>
                          <div className="ops-actions">
                            {item.is_enabled && (item.allowed_actions || []).includes('install') && (
                              <button className="btn btn-sm" onClick={() => submitKioskRequest(item, 'install')}>Install</button>
                            )}
                            {item.is_enabled && (item.allowed_actions || []).includes('remove') && (
                              <button className="btn btn-sm btn-danger" onClick={() => submitKioskRequest(item, 'remove')}>Remove</button>
                            )}
                            {isPrivileged && (
                              <button className="btn btn-sm" onClick={() => toggleCatalogItem(item)}>
                                {item.is_enabled ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isPrivileged && (
            <div className="ops-panel">
              <div className="ops-panel-title" style={{ marginBottom: 14 }}>Add Catalog Item</div>
              <div className="ops-form-grid">
                <input className="input" placeholder="Display name" value={catalogForm.name} onChange={e => setCatalogForm(p => ({...p, name: e.target.value}))} />
                <input className="input" placeholder="Package / apt / winget ID" value={catalogForm.package_name} onChange={e => setCatalogForm(p => ({...p, package_name: e.target.value}))} />
                <input className="input" placeholder="Description" value={catalogForm.description} onChange={e => setCatalogForm(p => ({...p, description: e.target.value}))} style={{ gridColumn: '1 / -1' }} />
                <input className="input" placeholder="Platforms (comma-separated)" value={catalogForm.supported_platforms} onChange={e => setCatalogForm(p => ({...p, supported_platforms: e.target.value}))} />
                <input className="input" placeholder="Allowed actions (install,remove)" value={catalogForm.allowed_actions} onChange={e => setCatalogForm(p => ({...p, allowed_actions: e.target.value}))} />
                <select className="input" value={catalogForm.default_execution_mode} onChange={e => setCatalogForm(p => ({...p, default_execution_mode: e.target.value}))}>
                  <option value="immediate">Immediate by default</option>
                  <option value="shutdown">Controlled shutdown by default</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={catalogForm.is_enabled} onChange={e => setCatalogForm(p => ({...p, is_enabled: e.target.checked}))} />
                  Enable item
                </label>
              </div>
              {catalogMessage && <p className="ops-subtle" style={{ marginTop: 10, color: '#2563eb' }}>{catalogMessage}</p>}
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-primary" onClick={createCatalogItem}>Add Item</button>
              </div>
            </div>
          )}

          <div className="ops-panel">
            <div className="ops-table-toolbar">
              <div>
                <div className="ops-panel-title">Request Queue</div>
                <p className="ops-subtle">Pending and completed software installation requests.</p>
              </div>
              <button className="btn btn-sm" onClick={fetchRequests}>Refresh</button>
            </div>
            {requestsLoading ? (
              <div className="ops-empty">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="ops-empty">No kiosk requests yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="table ops-table">
                  <thead><tr><th>#</th><th>Request</th><th>Target Host</th><th>Status</th><th>Requester</th><th>Decisions</th></tr></thead>
                  <tbody>
                    {requests.map(item => (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td>
                          <strong>{item.catalog_item?.name}</strong>
                          <span className="ops-table-meta">{item.requested_action} · {item.note || 'No note'}</span>
                        </td>
                        <td>
                          {item.host?.hostname || 'Unknown'}
                          <span className="ops-table-meta">{item.host?.ip || ''}</span>
                        </td>
                        <td>
                          <span className={`badge badge-${item.status === 'submitted' ? 'warning' : item.status === 'rejected' || item.status === 'failed' ? 'danger' : 'success'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.requested_by?.username || '—'}</td>
                        <td>
                          {isPrivileged && item.status === 'submitted' && (
                            <div className="ops-actions">
                              <button className="btn btn-sm" onClick={() => decideRequest(item.id, 'approve')}>Approve</button>
                              <button className="btn btn-sm btn-danger" onClick={() => decideRequest(item.id, 'reject')}>Reject</button>
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
        </>
      )}
    </div>
  );
}
"""

print("Applying remaining page splices...")
splice_return('NotificationsPage.jsx', NOTIFICATIONS_RETURN)
splice_return('SoftwarePage.jsx', SOFTWARE_RETURN)
print("Done.")
