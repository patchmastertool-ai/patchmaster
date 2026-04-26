import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from './AppIcons';

export default function SLAOpsPage({ API, apiFetch, toast }) {
  const [slas, setSlas] = useState([]);
  const [violations, setViolations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('policies');
  const [form, setForm] = useState({ name: '', severity: 'critical', days_to_patch: 7, notify_before_days: 1 });
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    try {
      const [s, v, sum] = await Promise.all([
        apiFetch(`${API}/api/sla/`).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/sla/violations`).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/sla/violations/summary`).then(r => r.json()).catch(() => null),
      ]);
      setSlas(Array.isArray(s) ? s : []);
      setViolations(Array.isArray(v) ? v : []);
      setSummary(sum);
    } catch {
      setSlas([]); setViolations([]);
    }
  };

  useEffect(() => { load(); }, []);

  const createSLA = async () => {
    const r = await apiFetch(`${API}/api/sla/`, { method: 'POST', body: JSON.stringify(form) });
    if (r.ok) { toast('SLA policy created', 'success'); load(); setForm({ name: '', severity: 'critical', days_to_patch: 7, notify_before_days: 1 }); }
    else { const d = await r.json(); toast(d.detail || 'Failed', 'danger'); }
  };

  const deleteSLA = async (id) => {
    if (!window.confirm('Delete this SLA policy?')) return;
    await apiFetch(`${API}/api/sla/${id}`, { method: 'DELETE' });
    toast('Deleted', 'success'); load();
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await apiFetch(`${API}/api/sla/scan`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      toast(`Scanned ${d.scanned ?? 0} CVEs, created ${d.created ?? 0} violations`, 'success');
      load();
    } catch (e) {
      toast(e.message || 'Scan failed', 'danger');
    } finally {
      setScanning(false);
    }
  };

  const sevColor = s => s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'medium' ? '#f59e0b' : '#3b82f6';

  return (
    <div>
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total Tracked', val: summary.total, cls: 'info' },
            { label: 'Active Violations', val: summary.violated, cls: 'danger' },
            { label: 'Resolved', val: summary.resolved, cls: 'success' },
            { label: 'Due in 3 Days', val: summary.upcoming_deadline, cls: 'warning' },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.cls}`}>
              <div className="stat-info"><div className="stat-number">{s.val}</div><div className="stat-label">{s.label}</div></div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['policies', 'violations'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : ''}`} onClick={() => setTab(t)}>
            {t === 'policies' ? 'SLA Policies' : 'Violations'}
          </button>
        ))}
        <button className="btn btn-warning" onClick={scan} disabled={scanning} style={{ marginLeft: 'auto' }}>
          {scanning ? <span className="spinner" /> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppIcon name="search" size={14} />Scan Now</span>}
        </button>
      </div>

      {tab === 'policies' && (
        <div>
          <div className="card">
            <h3>Add SLA Policy</h3>
            <div className="form-row">
              <input className="input" placeholder="Policy name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <select className="input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="input" type="number" placeholder="Days to patch" value={form.days_to_patch} onChange={e => setForm(f => ({ ...f, days_to_patch: +e.target.value }))} style={{ width: 130 }} />
              <input className="input" type="number" placeholder="Notify before (days)" value={form.notify_before_days} onChange={e => setForm(f => ({ ...f, notify_before_days: +e.target.value }))} style={{ width: 160 }} />
              <button className="btn btn-primary" onClick={createSLA}>+ Add</button>
            </div>
          </div>
          <div className="card">
            <table className="table">
              <thead><tr><th>Name</th><th>Severity</th><th>Days to Patch</th><th>Notify Before</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {slas.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td><span className="badge" style={{ background: sevColor(s.severity), color: '#fff' }}>{s.severity}</span></td>
                    <td>{s.days_to_patch}d</td>
                    <td>{s.notify_before_days}d</td>
                    <td><span className={`badge badge-${s.is_active ? 'success' : 'warning'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => deleteSLA(s.id)}>Delete</button></td>
                  </tr>
                ))}
                {!slas.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>No SLA policies defined</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'violations' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Host</th><th>CVE</th><th>Severity</th><th>Deadline</th><th>Days Overdue</th><th>Status</th></tr></thead>
            <tbody>
              {violations.map(v => (
                <tr key={v.id} style={{ background: v.is_violated && !v.is_resolved ? 'rgba(239,68,68,0.05)' : '' }}>
                  <td>{v.hostname}</td>
                  <td><code>{v.cve_id}</code></td>
                  <td><span className="badge" style={{ background: sevColor(v.severity), color: '#fff' }}>{v.severity}</span></td>
                  <td>{new Date(v.deadline).toLocaleDateString()}</td>
                  <td style={{ color: v.days_overdue > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{v.days_overdue > 0 ? `+${v.days_overdue}d` : '—'}</td>
                  <td><span className={`badge badge-${v.is_resolved ? 'success' : v.is_violated ? 'danger' : 'warning'}`}>{v.is_resolved ? 'Resolved' : v.is_violated ? 'Violated' : 'Pending'}</span></td>
                </tr>
              ))}
              {!violations.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>No violations found — run a scan</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Remediation Page ─── */
