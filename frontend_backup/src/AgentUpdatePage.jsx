import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function AgentUpdatePage({ hosts, API, apiFetch, hasRole, CodeIcon }) {
  const [versions, setVersions] = useState({ versions: [], total_hosts: 0 });
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    channel: 'stable',
    auto_update: false,
    target_version: '',
  });

  const channelColors = { stable: '#10b981', beta: '#f59e0b', edge: '#6366f1' };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const [versionsRes, policiesRes] = await Promise.all([
        apiFetch(`${API}/api/agent-updates/versions`),
        apiFetch(`${API}/api/agent-updates/policies`),
      ]);
      const versionsData = await versionsRes.json();
      const policiesData = await policiesRes.json();
      setVersions(versionsData && typeof versionsData === 'object' ? versionsData : { versions: [], total_hosts: 0 });
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
    } catch (error) {
      setMsg(String(error.message || error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = async () => {
    if (!form.name.trim()) {
      setMsg('Policy name is required.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await apiFetch(`${API}/api/agent-updates/policies`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          channel: form.channel,
          auto_update: !!form.auto_update,
          target_version: form.target_version.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to create policy');
      }
      setForm({ name: '', channel: 'stable', auto_update: false, target_version: '' });
      setMsg('Policy created successfully.');
      fetchAll();
    } catch (error) {
      setMsg(String(error.message || error));
    } finally {
      setSaving(false);
    }
  };

  const removePolicy = async (policyId) => {
    if (!window.confirm('Delete this update policy?')) return;
    try {
      const res = await apiFetch(`${API}/api/agent-updates/policies/${policyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to delete policy');
      }
      fetchAll();
    } catch (error) {
      setMsg(String(error.message || error));
    }
  };

  const coveredHosts = versions.total_hosts || hosts.length || 0;

  return (
    <div>
      <div className="card highlight-card">
        <div className="card-header">
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CodeIcon code="AU" size={20} />
            Agent Update Manager
          </h2>
          <button className="btn btn-sm" onClick={fetchAll} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Control agent version channels and auto-update policies across your fleet.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Fleet Agent Versions</h3>
            <span className="badge badge-info">{coveredHosts} hosts</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(versions.versions || []).map(v => (
              <div key={v.version} style={{ padding: '12px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 116 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <CodeIcon code="AG" tone="#0369a1" bg="rgba(14,165,233,0.14)" size={16} />
                  <strong>v{v.version}</strong>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{v.count}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>hosts</div>
              </div>
            ))}
            {!(versions.versions || []).length && <p style={{ color: '#64748b' }}>No agent version data yet.</p>}
          </div>
        </div>

        {hasRole('admin') && (
          <div className="card">
            <h3>New Update Policy</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <input className="input" placeholder="Policy name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select className="input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="edge">Edge</option>
                </select>
                <input className="input" placeholder="Target version (optional)" value={form.target_version} onChange={e => setForm(f => ({ ...f, target_version: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.auto_update} onChange={e => setForm(f => ({ ...f, auto_update: e.target.checked }))} />
                Auto-update agents
              </label>
              <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Saving...' : 'Create Policy'}</button>
            </div>
            {msg && <p style={{ marginTop: 10, color: msg.toLowerCase().includes('success') ? '#15803d' : '#ef4444', fontSize: 13 }}>{msg}</p>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Update Policies ({policies.length})</h3>
          {!hasRole('admin') && <span className="badge badge-info">Read only</span>}
        </div>
        {!policies.length ? (
          <p style={{ color: '#64748b' }}>No policies yet. Create one above to manage rollout channels.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>Auto-Update</th>
                <th>Target Version</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(policy => (
                <tr key={policy.id}>
                  <td><strong>{policy.name}</strong></td>
                  <td><span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 12, background: channelColors[policy.channel] || '#3b82f6', color: '#fff' }}>{policy.channel}</span></td>
                  <td>{policy.auto_update ? <span className="badge badge-success">Yes</span> : <span className="badge badge-info">No</span>}</td>
                  <td><code style={{ fontSize: 12 }}>{policy.target_version || 'latest'}</code></td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(policy.created_at).toLocaleDateString()}</td>
                  <td>{hasRole('admin') ? <button className="btn btn-sm btn-danger" onClick={() => removePolicy(policy.id)}>Delete</button> : <span style={{ color: '#64748b', fontSize: 12 }}>No changes</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
