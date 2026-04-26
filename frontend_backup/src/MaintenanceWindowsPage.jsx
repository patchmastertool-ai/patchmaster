import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function MaintenanceWindowsPage({ API, apiFetch, toast }) {
  const [windows, setWindows] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', day_of_week: [], start_hour: 2, end_hour: 6, timezone: 'UTC', block_outside: true });
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const load = async () => {
    try {
      const [w, s] = await Promise.all([
        apiFetch(`${API}/api/maintenance/`).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/maintenance/check`).then(r => r.json()).catch(() => null),
      ]);
      setWindows(Array.isArray(w) ? w : []);
      setCurrentStatus(s);
    } catch {
      setWindows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDay = (d) => setForm(f => ({ ...f, day_of_week: f.day_of_week.includes(d) ? f.day_of_week.filter(x => x !== d) : [...f.day_of_week, d] }));

  const save = async () => {
    const r = await apiFetch(`${API}/api/maintenance/`, { method: 'POST', body: JSON.stringify(form) });
    if (r.ok) { toast('Window created', 'success'); setShowForm(false); load(); setForm({ name: '', description: '', day_of_week: [], start_hour: 2, end_hour: 6, timezone: 'UTC', block_outside: true }); }
    else { const d = await r.json(); toast(d.detail || 'Failed', 'danger'); }
  };

  const toggle = async (w) => {
    await apiFetch(`${API}/api/maintenance/${w.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !w.is_active }) });
    load();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this window?')) return;
    await apiFetch(`${API}/api/maintenance/${id}`, { method: 'DELETE' });
    toast('Deleted', 'success'); load();
  };

  return (
    <div>
      {currentStatus && (
        <div className="card" style={{ borderLeft: `4px solid ${currentStatus.in_window ? '#10b981' : '#64748b'}`, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge ${currentStatus.in_window ? 'badge-success' : 'badge-info'}`}>{currentStatus.in_window ? 'Open' : 'Closed'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{currentStatus.in_window ? 'Currently in a maintenance window' : 'No active maintenance window right now'}</div>
              {currentStatus.in_window && <div style={{ fontSize: 12, color: '#64748b' }}>Active: {currentStatus.active_windows.map(w => w.name).join(', ')}</div>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Window</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>New Maintenance Window</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Days of Week</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {DAY_NAMES.map((d, i) => (
                  <button key={i} className={`btn btn-sm ${form.day_of_week.includes(i) ? 'btn-primary' : ''}`} onClick={() => toggleDay(i)}>{d}</button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div>
                <label style={{ fontSize: 12, color: '#64748b' }}>Start Hour (UTC)</label>
                <input className="input" type="number" min={0} max={23} value={form.start_hour} onChange={e => setForm(f => ({ ...f, start_hour: +e.target.value }))} style={{ width: 80, marginLeft: 8 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b' }}>End Hour (UTC)</label>
                <input className="input" type="number" min={0} max={23} value={form.end_hour} onChange={e => setForm(f => ({ ...f, end_hour: +e.target.value }))} style={{ width: 80, marginLeft: 8 }} />
              </div>
              <label className="toggle-option">
                <input type="checkbox" checked={form.block_outside} onChange={e => setForm(f => ({ ...f, block_outside: e.target.checked }))} />
                Block patches outside window
              </label>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={save}>Save</button>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Days</th><th>Hours (UTC)</th><th>Block Outside</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {windows.map(w => (
              <tr key={w.id}>
                <td><strong>{w.name}</strong>{w.description && <div style={{ fontSize: 11, color: '#64748b' }}>{w.description}</div>}</td>
                <td>{w.day_names?.join(', ') || '—'}</td>
                <td>{String(w.start_hour).padStart(2, '0')}:00 – {String(w.end_hour).padStart(2, '0')}:00</td>
                <td>{w.block_outside ? 'Yes' : 'No'}</td>
                <td><span className={`badge badge-${w.is_active ? 'success' : 'warning'}`}>{w.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-warning" onClick={() => toggle(w)}>{w.is_active ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(w.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!windows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>No maintenance windows defined</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Patch Hooks Page ─── */
