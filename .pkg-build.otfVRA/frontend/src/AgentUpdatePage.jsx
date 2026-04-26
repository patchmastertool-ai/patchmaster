import React, { useCallback, useEffect, useState } from 'react';
import { 
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchBadge
} from './components/StitchComponents';

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
        body: JSON.stringify({ 
          name: form.name, 
          channel: form.channel, 
          auto_update: form.auto_update, 
          target_version: form.target_version || undefined 
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { 
        setMsg('Policy created'); 
        setForm({ name: '', channel: 'stable', auto_update: false, target_version: '' }); 
        fetchAll(); 
      } else {
        setMsg(d.detail || 'Failed to create');
      }
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const deletePolicy = async id => {
    if (!window.confirm('Delete this update policy?')) return;
    try {
      await apiFetch(`${API}/api/agent-updates/policies/${id}`, { method: 'DELETE' });
      setMsg('Policy deleted');
      fetchAll();
    } catch (e) {
      setMsg(e.message || 'Failed to delete');
    }
  };

  const versionList = Array.isArray(versions.versions) ? versions.versions : [];
  const latestVersion = versionList.length > 0 ? versionList[versionList.length - 1].version : 'unknown';
  const totalHosts = versions.total_hosts || 0;

  // Derive real metrics from actual data
  const totalVersions = versionList.length;
  const totalPolicies = policies.length;
  const autoPolicies = policies.filter(p => p.auto_update).length;

  return (
    <div className="flex-1 p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.05em] text-[#91aaeb] font-semibold">INFRASTRUCTURE FLEET</span>
          <h1 className="text-3xl font-bold tracking-tighter text-[#dee5ff] mt-1">Agent Update Center</h1>
          <p className="text-[#939eb5] text-sm mt-2 max-w-2xl">
            Manage agent version policies across {totalHosts} nodes.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchAll}
            disabled={loading}
            className="px-6 py-2.5 bg-[#00225a] border border-[#2b4680]/30 text-[#dee5ff] text-xs font-bold uppercase tracking-widest hover:bg-[#002867] transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`rounded px-5 py-3 text-sm font-bold ${
          msg.includes('created') || msg.includes('deleted')
            ? 'bg-[#4ade80]/10 text-[#4ade80]' 
            : 'bg-[#ffd16f]/10 text-[#ffd16f]'
        }`}>
          {msg}
        </div>
      )}

      {/* Summary Metrics - Real Data Only */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#06122d] p-6 border-t-2 border-[#7bd0ff]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Total Hosts</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{totalHosts}</span>
            <span className="text-[#7bd0ff] text-xs uppercase tracking-widest">Managed</span>
          </div>
        </div>
        <div className="bg-[#06122d] p-6 border-t-2 border-[#7bd0ff]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Agent Versions</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{totalVersions}</span>
            <span className="text-[#7bd0ff] text-xs uppercase tracking-widest">Detected</span>
          </div>
        </div>
        <div className="bg-[#06122d] p-6 border-t-2 border-[#7bd0ff]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Update Policies</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{totalPolicies}</span>
            <span className="text-[#7bd0ff] text-xs uppercase tracking-widest">Configured</span>
          </div>
        </div>
        <div className="bg-[#06122d] p-6 border-t-2 border-[#ffd16f]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Auto-Update</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{autoPolicies}</span>
            <span className="text-[#ffd16f] text-xs uppercase tracking-widest">Active</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-12">
        {/* Version List */}
        <div className="xl:col-span-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold tracking-tight uppercase text-[#dee5ff]">Agent Versions in Fleet</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[#91aaeb] border-b border-[#2b4680]/10">
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4">Version</th>
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4 text-right">Host Count</th>
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-transparent">
                {versionList.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-12">
                      <span className="material-symbols-outlined text-4xl text-[#91aaeb] opacity-30">cloud_off</span>
                      <p className="text-sm text-[#91aaeb] mt-4">No version data available</p>
                    </td>
                  </tr>
                ) : versionList.map((v) => {
                  const percentage = totalHosts > 0 ? ((v.count / totalHosts) * 100).toFixed(1) : 0;
                  return (
                    <tr key={v.version} className="group hover:bg-[#06122d] transition-colors h-14">
                      <td className="px-4 py-2">
                        <span className="text-sm font-mono text-[#dee5ff] font-bold">{v.version}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="text-[11px] font-mono text-[#7bd0ff] bg-[#004c69] px-2 py-0.5 rounded-sm">{v.count}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 bg-[#00225a] rounded-full overflow-hidden">
                            <div className="h-full bg-[#7bd0ff]" style={{ width: `${percentage}%` }}></div>
                          </div>
                          <span className="text-[10px] font-mono text-[#939eb5] w-12 text-right">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Policy Management Sidebar */}
        <div className="xl:col-span-4 bg-[#000000] p-8 border-l border-[#2b4680]/15">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-[#91aaeb] mb-8 flex items-center gap-3">
            <span className="material-symbols-outlined text-sm">policy</span>
            Update Policies
          </h2>
          
          {/* Policy List */}
          <div className="space-y-4 mb-8">
            {policies.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-3xl text-[#91aaeb] opacity-30">policy</span>
                <p className="text-sm text-[#91aaeb] mt-3">No policies configured</p>
              </div>
            ) : policies.map(p => (
              <div key={p.id} className="bg-[#06122d] p-4 rounded border border-[#2b4680]/20">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#dee5ff]">{p.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StitchBadge variant="info">{p.channel}</StitchBadge>
                      <StitchBadge variant={p.auto_update ? 'success' : 'pending'}>
                        {p.auto_update ? 'Auto' : 'Manual'}
                      </StitchBadge>
                    </div>
                    <p className="text-[10px] text-[#939eb5] mt-2 font-mono">
                      Target: {p.target_version || 'latest'}
                    </p>
                    {(p.applies_to_groups?.length > 0 || p.applies_to_hosts?.length > 0) && (
                      <p className="text-[10px] text-[#939eb5] mt-1">
                        Applies to: {p.applies_to_groups?.length || 0} groups, {p.applies_to_hosts?.length || 0} hosts
                      </p>
                    )}
                  </div>
                </div>
                {hasRole?.('admin') && (
                  <div className="flex gap-2 mt-3">
                    <StitchButton
                      variant="danger"
                      size="sm"
                      onClick={() => deletePolicy(p.id)}
                    >
                      Delete
                    </StitchButton>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Create Policy Form */}
          <div className="border-t border-[#2b4680]/20 pt-6">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">Create New Policy</p>
            <div className="space-y-4">
              <StitchFormField label="Policy Name">
                <StitchInput
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Prod Stable Channel"
                />
              </StitchFormField>
              <StitchFormField label="Update Channel">
                <StitchSelect
                  value={form.channel}
                  onChange={(e) => setForm(f => ({ ...f, channel: e.target.value }))}
                >
                  <option value="stable">stable</option>
                  <option value="beta">beta</option>
                  <option value="edge">edge</option>
                </StitchSelect>
              </StitchFormField>
              <StitchFormField label="Pin to Version (optional)">
                <StitchInput
                  value={form.target_version}
                  onChange={(e) => setForm(f => ({ ...f, target_version: e.target.value }))}
                  placeholder="e.g. 2.3.1 (leave blank for latest)"
                />
              </StitchFormField>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={form.auto_update} 
                  onChange={e => setForm(f => ({ ...f, auto_update: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-xs text-[#91aaeb]">Auto-update when new versions are released</span>
              </div>
              <StitchButton
                variant="primary"
                onClick={createPolicy}
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Policy'}
              </StitchButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
