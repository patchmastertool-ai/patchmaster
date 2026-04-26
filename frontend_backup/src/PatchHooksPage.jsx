import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function PatchHooksPage({ API, apiFetch, toast }) {
  const [hooks, setHooks] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [tab, setTab] = useState('hooks');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'pre_patch', script_type: 'bash', script_content: '', timeout_seconds: 120, stop_on_failure: true });

  const TRIGGERS = ['pre_patch', 'post_patch', 'pre_snapshot', 'post_snapshot', 'on_failure', 'on_success'];
  const SCRIPT_TYPES = ['bash', 'powershell', 'python'];

  const load = async () => {
    try {
      const [h, e] = await Promise.all([
        apiFetch(`${API}/api/hooks/`).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/hooks/executions`).then(r => r.json()).catch(() => []),
      ]);
      setHooks(Array.isArray(h) ? h : []);
      setExecutions(Array.isArray(e) ? e : []);
    } catch {
      setHooks([]); setExecutions([]);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.script_content) { toast('Name and script are required', 'warning'); return; }
    const r = await apiFetch(`${API}/api/hooks/`, { method: 'POST', body: JSON.stringify(form) });
    if (r.ok) { toast('Hook created', 'success'); setShowForm(false); load(); setForm({ name: '', trigger: 'pre_patch', script_type: 'bash', script_content: '', timeout_seconds: 120, stop_on_failure: true }); }
    else { const d = await r.json(); toast(d.detail || 'Failed', 'danger'); }
  };

  const toggle = async (h) => {
    await apiFetch(`${API}/api/hooks/${h.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !h.is_active }) });
    load();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this hook?')) return;
    await apiFetch(`${API}/api/hooks/${id}`, { method: 'DELETE' });
    toast('Deleted', 'success'); load();
  };

  const triggerColor = t => ({ pre_patch: '#3b82f6', post_patch: '#10b981', on_failure: '#ef4444', on_success: '#22c55e', pre_snapshot: '#8b5cf6', post_snapshot: '#a78bfa' }[t] || '#64748b');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['hooks', 'executions'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : ''}`} onClick={() => setTab(t)}>
            {t === 'hooks' ? 'Hooks' : 'Execution Log'}
          </button>
        ))}
        {tab === 'hooks' && <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(!showForm)}>+ New Hook</button>}
      </div>

      {tab === 'hooks' && showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>New Patch Hook</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-row">
              <input className="input" placeholder="Hook name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ flex: 1 }} />
              <select className="input" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                {TRIGGERS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <select className="input" value={form.script_type} onChange={e => setForm(f => ({ ...f, script_type: e.target.value }))}>
                {SCRIPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="input" type="number" placeholder="Timeout (s)" value={form.timeout_seconds} onChange={e => setForm(f => ({ ...f, timeout_seconds: +e.target.value }))} style={{ width: 110 }} />
            </div>
            <textarea className="input code-block" rows={6} placeholder="#!/bin/bash&#10;# Your script here" value={form.script_content} onChange={e => setForm(f => ({ ...f, script_content: e.target.value }))} style={{ fontFamily: 'monospace', fontSize: 13, background: '#1a1a2e', color: '#a5d6a7' }} />
            <label className="toggle-option">
              <input type="checkbox" checked={form.stop_on_failure} onChange={e => setForm(f => ({ ...f, stop_on_failure: e.target.checked }))} />
              Stop patch job on hook failure
            </label>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={save}>Save Hook</button>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'hooks' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Name</th><th>Trigger</th><th>Type</th><th>Timeout</th><th>Stop on Fail</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {hooks.map(h => (
                <tr key={h.id}>
                  <td><strong>{h.name}</strong></td>
                  <td><span className="badge" style={{ background: triggerColor(h.trigger), color: '#fff' }}>{h.trigger.replace('_', ' ')}</span></td>
                  <td><code>{h.script_type}</code></td>
                  <td>{h.timeout_seconds}s</td>
                  <td>{h.stop_on_failure ? 'Yes' : 'No'}</td>
                  <td><span className={`badge badge-${h.is_active ? 'success' : 'warning'}`}>{h.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-warning" onClick={() => toggle(h)}>{h.is_active ? 'Disable' : 'Enable'}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(h.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!hooks.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>No hooks defined</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'executions' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Hook</th><th>Trigger</th><th>Host</th><th>Job</th><th>Status</th><th>Exit Code</th><th>Time</th></tr></thead>
            <tbody>
              {executions.map(e => (
                <tr key={e.id}>
                  <td>{e.hook_name}</td>
                  <td><span className="badge" style={{ background: triggerColor(e.trigger), color: '#fff' }}>{e.trigger.replace('_', ' ')}</span></td>
                  <td>#{e.host_id}</td>
                  <td>{e.job_id ? `#${e.job_id}` : '—'}</td>
                  <td><span className={`badge badge-${e.status === 'success' ? 'success' : e.status === 'failed' ? 'danger' : 'warning'}`}>{e.status}</span></td>
                  <td style={{ fontFamily: 'monospace' }}>{e.exit_code ?? '—'}</td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{new Date(e.started_at).toLocaleString()}</td>
                </tr>
              ))}
              {!executions.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b' }}>No executions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Bulk Patch Page ─── */
