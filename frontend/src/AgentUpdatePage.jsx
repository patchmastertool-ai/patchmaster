import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Cpu, Download, AlertTriangle } from 'lucide-react';

const CHANNEL_COLORS = { stable: CH.green, beta: CH.yellow, edge: '#818cf8' };

export default function AgentUpdatePage({ hosts = [], API, apiFetch, hasRole }) {
  const [versions, setVersions]   = useState({ versions: [], total_hosts: 0 });
  const [policies, setPolicies]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  const [form, setForm]           = useState({ name: '', channel: 'stable', auto_update: false, target_version: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true); setMsg('');
    try {
      const [vr, pr] = await Promise.all([
        apiFetch(`${API}/api/agent-updates/versions`),
        apiFetch(`${API}/api/agent-updates/policies`),
      ]);
      const vd = await vr.json().catch(() => ({}));
      const pd = await pr.json().catch(() => []);
      setVersions(vd && typeof vd === 'object' ? vd : { versions: [], total_hosts: 0 });
      setPolicies(Array.isArray(pd) ? pd : []);
    } catch (e) { setMsg(e.message || 'Failed to load'); }
    setLoading(false);
  }, [API, apiFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createPolicy = async () => {
    if (!form.name.trim()) return setMsg('Policy name is required.');
    setSaving(true); setMsg('');
    try {
      const r = await apiFetch(`${API}/api/agent-updates/policies`, {
        method: 'POST',
        body: JSON.stringify({ name: form.name, channel: form.channel, auto_update: form.auto_update, target_version: form.target_version || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMsg('✓ Policy created'); setForm({ name: '', channel: 'stable', auto_update: false, target_version: '' }); fetchAll(); }
      else setMsg(d.detail || 'Failed to create');
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const deletePolicy = async id => {
    if (!window.confirm('Delete this update policy?')) return;
    await apiFetch(`${API}/api/agent-updates/policies/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const triggerUpdate = async id => {
    const r = await apiFetch(`${API}/api/agent-updates/policies/${id}/trigger`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? `✓ Update triggered: ${d.triggered_hosts ?? 0} hosts` : d.detail || 'Trigger failed');
    fetchAll();
  };

  const versionList   = Array.isArray(versions.versions) ? versions.versions : [];
  const latestVersion = versionList[0]?.version || '—';
  const stableCount   = versionList.filter(v => v.channel === 'stable').length;

  return (
    <CHPage>
      <CHHeader
        kicker="Agent Fleet Management"
        title="Agent Updates"
        subtitle={`${versions.total_hosts || hosts.length} hosts · latest stable: ${latestVersion}`}
        actions={<CHBtn variant="ghost" onClick={fetchAll}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</CHBtn>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Hosts"     value={versions.total_hosts || hosts.length} sub="managed agents"         accent={CH.accent} />
        <CHStat label="Latest Version"  value={latestVersion}                         sub="newest available"       accent={CH.green} />
        <CHStat label="Update Policies" value={policies.length}                       sub="configured"             accent="#a78bfa" />
        <CHStat label="Stable Versions" value={stableCount}                           sub="in release channel"     accent={CH.green} />
      </div>

      {/* Message */}
      {msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: msg.startsWith('✓') ? `${CH.green}12` : `${CH.yellow}15`, color: msg.startsWith('✓') ? CH.green : CH.yellow }}>
          {msg}
        </div>
      )}

      {/* Versions + Create Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Available Versions */}
        <CHCard>
          <CHLabel>Available Agent Versions</CHLabel>
          <div className="mt-4 space-y-2">
            {versionList.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: CH.textSub }}>No version data available.</p>
            ) : versionList.map(v => (
              <div key={v.version} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <div className="flex items-center gap-3">
                  <Cpu size={16} style={{ color: CHANNEL_COLORS[v.channel] || CH.textSub }} />
                  <div>
                    <p className="text-sm font-bold font-mono" style={{ color: CH.text }}>v{v.version}</p>
                    <p className="text-[10px]" style={{ color: CH.textSub }}>{v.released_at ? new Date(v.released_at).toLocaleDateString() : 'Unknown date'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CHBadge color={CHANNEL_COLORS[v.channel] || CH.textSub}>{v.channel || 'stable'}</CHBadge>
                  {v.hosts_count > 0 && <span className="text-[10px]" style={{ color: CH.textSub }}>{v.hosts_count} hosts</span>}
                </div>
              </div>
            ))}
          </div>
        </CHCard>

        {/* Create Policy */}
        <CHCard className="flex flex-col gap-4">
          <CHLabel>Create Update Policy</CHLabel>
          <div className="flex flex-col gap-1">
            <CHLabel>Policy Name</CHLabel>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Prod Stable Channel"
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Update Channel</CHLabel>
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
              {['stable', 'beta', 'edge'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Pin to Version (optional)</CHLabel>
            <input value={form.target_version} onChange={e => setForm(f => ({ ...f, target_version: e.target.value }))}
              placeholder="e.g. 2.3.1 (leave blank for latest)"
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.auto_update} onChange={e => setForm(f => ({ ...f, auto_update: e.target.checked }))} />
            <span className="text-xs" style={{ color: CH.textSub }}>Auto-update when new versions are released</span>
          </div>
          <CHBtn variant="primary" onClick={createPolicy} disabled={saving}>{saving ? 'Creating…' : 'Create Policy'}</CHBtn>
        </CHCard>
      </div>

      {/* Policies Table */}
      <CHCard>
        <CHLabel>Update Policies</CHLabel>
        <CHTable headers={['Policy', 'Channel', 'Auto-Update', 'Target Version', 'Hosts', 'Actions']}
          emptyMessage="No update policies configured." className="mt-4">
          {policies.map(p => (
            <CHTR key={p.id}>
              <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{p.name}</td>
              <td className="px-6 py-4"><CHBadge color={CHANNEL_COLORS[p.channel] || CH.textSub}>{p.channel}</CHBadge></td>
              <td className="px-6 py-4"><CHBadge color={p.auto_update ? CH.green : CH.textSub}>{p.auto_update ? 'Yes' : 'No'}</CHBadge></td>
              <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>{p.target_version || 'latest'}</td>
              <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{p.hosts_count ?? '—'}</td>
              <td className="px-6 py-4 text-right">
                <div className="flex gap-2 justify-end">
                  <CHBtn variant="default" onClick={() => triggerUpdate(p.id)}>
                    <Download size={12} /> Deploy
                  </CHBtn>
                  {hasRole?.('admin') && (
                    <CHBtn variant="danger" onClick={() => deletePolicy(p.id)}>Delete</CHBtn>
                  )}
                </div>
              </td>
            </CHTR>
          ))}
        </CHTable>
      </CHCard>
    </CHPage>
  );
}
