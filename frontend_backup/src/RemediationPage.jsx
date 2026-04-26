import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function RemediationPage({ API, apiFetch, toast }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = async () => {
    const url = statusFilter === 'all' ? `${API}/api/remediation/` : `${API}/api/remediation/?status=${statusFilter}`;
    try {
      const [items, sum] = await Promise.all([
        apiFetch(url).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/remediation/summary`).then(r => r.json()).catch(() => null),
      ]);
      setItems(Array.isArray(items) ? items : []);
      setSummary(sum);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const openEdit = (item) => { setEditing(item); setEditForm({ status: item.status, notes: item.notes, due_date: item.due_date ? item.due_date.slice(0, 10) : '' }); };

  const saveEdit = async () => {
    const r = await apiFetch(`${API}/api/remediation/${editing.id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    if (r.ok) { toast('Updated', 'success'); setEditing(null); load(); }
    else { const d = await r.json(); toast(d.detail || 'Failed', 'danger'); }
  };

  const sevColor = s => s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : s === 'medium' ? '#f59e0b' : '#3b82f6';
  const statusColor = s => ({ open: 'danger', in_progress: 'warning', resolved: 'success', accepted_risk: 'info', false_positive: '' }[s] || '');

  return (
    <div>
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'Open', val: summary.open, cls: 'danger' },
            { label: 'In Progress', val: summary.in_progress, cls: 'warning' },
            { label: 'Resolved', val: summary.resolved, cls: 'success' },
            { label: 'Overdue', val: summary.overdue, cls: 'danger' },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.cls}`}>
              <div className="stat-info"><div className="stat-number">{s.val}</div><div className="stat-label">{s.label}</div></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'open', 'in_progress', 'resolved', 'accepted_risk', 'false_positive'].map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Host</th><th>CVE</th><th>Severity</th><th>CVSS</th><th>Status</th><th>Assignee</th><th>Due Date</th><th></th></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.hostname}</td>
                <td><code>{item.cve_id}</code></td>
                <td><span className="badge" style={{ background: sevColor(item.severity), color: '#fff' }}>{item.severity}</span></td>
                <td style={{ fontWeight: 600, color: item.cvss_score >= 9 ? '#ef4444' : item.cvss_score >= 7 ? '#f97316' : '#64748b' }}>{item.cvss_score?.toFixed(1)}</td>
                <td><span className={`badge badge-${statusColor(item.status)}`}>{item.status.replace('_', ' ')}</span></td>
                <td>{item.assignee_name || <span style={{ color: '#64748b' }}>Unassigned</span>}</td>
                <td style={{ color: item.due_date && new Date(item.due_date) < new Date() ? '#ef4444' : '' }}>{item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}</td>
                <td><button className="btn btn-sm btn-info" onClick={() => openEdit(item)}>Edit</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b' }}>No remediations found</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Edit Remediation — {editing.cve_id} on {editing.hostname}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
                <select className="input" style={{ width: '100%' }} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {['open', 'in_progress', 'resolved', 'accepted_risk', 'false_positive'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Due Date</label>
                <input className="input" type="date" style={{ width: '100%' }} value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea className="input" rows={3} style={{ width: '100%' }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="btn-group">
                <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Maintenance Windows Page ─── */
