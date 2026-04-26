import React, { useCallback, useEffect, useState } from 'react';
import { 
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchBadge
} from './components/StitchComponents';

const statusColor = s => {
  const map = {
    jobs_created: 'success',
    completed: 'success',
    running: 'info',
    failed: 'error',
    pending: 'pending'
  };
  return map[s] || 'info';
};

export default function BulkPatchPage({ hosts = [], linuxHosts = [], windowsHosts = [], API, apiFetch, toast }) {
  const [channel, setChannel]       = useState('linux');
  const [jobs, setJobs]             = useState([]);
  const [selectedIds, setSelected]  = useState([]);
  const [form, setForm]             = useState({ 
    name: '', 
    packages: '', 
    action: 'server_patch', 
    dry_run: false, 
    auto_snapshot: true, 
    auto_rollback: true 
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]       = useState(false);

  const channelHosts = channel === 'linux' ? linuxHosts : windowsHosts;

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`${API}/api/bulk-patch/`).catch(() => null);
    if (r?.ok) setJobs(await r.json().catch(() => []));
    setLoading(false);
  }, [API, apiFetch]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const toggleHost  = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll   = () => setSelected(s => s.length === channelHosts.length && channelHosts.length > 0 ? [] : channelHosts.map(h => h.id));

  const submit = async () => {
    if (!form.name.trim()) { if (toast) toast('Enter a job name', 'warning'); return; }
    if (!selectedIds.length) { if (toast) toast('Select at least one host', 'warning'); return; }
    
    const channelIdSet = new Set(channelHosts.map(h => h.id));
    const safe = selectedIds.filter(id => channelIdSet.has(id));
    if (!safe.length) { if (toast) toast('No valid hosts for this channel', 'danger'); return; }
    
    setSubmitting(true);
    const body = {
      name: form.name.trim(),
      host_ids: safe,
      packages: form.packages ? form.packages.split(/[\s,]+/).filter(Boolean) : [],
      action: form.action,
      dry_run: form.dry_run,
      auto_snapshot: form.auto_snapshot,
      auto_rollback: form.auto_rollback,
    };
    
    try {
      const r = await apiFetch(`${API}/api/bulk-patch/`, { method: 'POST', body: JSON.stringify(body) });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (toast) toast(`Bulk patch queued | ${safe.length} host(s)`, 'success');
        if (d?.job?.id) window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: d.job.id } }));
        setSelected([]); 
        setForm(f => ({ ...f, name: '', packages: '' })); 
        loadJobs();
      } else {
        const d = await r.json().catch(() => ({}));
        if (toast) toast(d.detail || 'Failed to start job', 'danger');
      }
    } catch (e) { 
      if (toast) toast(e.message || 'Network error', 'danger'); 
    }
    setSubmitting(false);
  };

  const allSelected = channelHosts.length > 0 && selectedIds.length === channelHosts.length;

  return (
    <div className="flex-1 p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.05em] text-[#91aaeb] font-semibold">INFRASTRUCTURE MANAGEMENT</span>
          <h1 className="text-3xl font-bold tracking-tighter text-[#dee5ff] mt-1">Bulk Patch Operations</h1>
          <p className="text-[#939eb5] text-sm mt-2">
            {hosts.length} total hosts | {linuxHosts.length} Linux | {windowsHosts.length} Windows
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={loadJobs}
            disabled={loading}
            className="px-6 py-2.5 bg-[#00225a] border border-[#2b4680]/30 text-[#dee5ff] text-xs font-bold uppercase tracking-widest hover:bg-[#002867] transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#06122d] p-6 border-t-2 border-[#7bd0ff]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Total Hosts</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{hosts.length}</span>
            <span className="text-[#7bd0ff] text-xs uppercase tracking-widest">In Fleet</span>
          </div>
        </div>
        <div className="bg-[#06122d] p-6 border-t-2 border-[#10b981]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Linux Hosts</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{linuxHosts.length}</span>
            <span className="text-[#10b981] text-xs uppercase tracking-widest">APT/YUM</span>
          </div>
        </div>
        <div className="bg-[#06122d] p-6 border-t-2 border-[#7bd0ff]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Windows Hosts</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{windowsHosts.length}</span>
            <span className="text-[#7bd0ff] text-xs uppercase tracking-widest">WSUS/WUA</span>
          </div>
        </div>
        <div className="bg-[#06122d] p-6 border-t-2 border-[#ffd16f]/40">
          <span className="text-[10px] uppercase tracking-[0.05em] text-[#91aaeb] font-bold">Selected</span>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-4xl font-bold tracking-tight text-[#dee5ff]">{selectedIds.length}</span>
            <span className="text-[#ffd16f] text-xs uppercase tracking-widest">For Job</span>
          </div>
        </div>
      </div>

      {/* Channel Selector */}
      <div className="flex gap-2">
        {[
          { k: 'linux',   l: `Linux (${linuxHosts.length})` },
          { k: 'windows', l: `Windows (${windowsHosts.length})` },
        ].map(ch => (
          <button
            key={ch.k}
            onClick={() => { setChannel(ch.k); setSelected([]); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              channel === ch.k
                ? 'bg-[#7bd0ff] text-[#004560]'
                : 'bg-[#00225a] text-[#dee5ff] hover:bg-[#002867]'
            }`}
          >
            {ch.l}
          </button>
        ))}
      </div>

      {/* Main Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Target Selection */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-[#06122d] p-6 rounded border border-[#2b4680]/20 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7bd0ff]/50 to-transparent"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#dee5ff] flex items-center">
                <span className="material-symbols-outlined mr-2 text-[#7bd0ff]">target</span>
                Target Selection
              </h3>
              <button
                onClick={toggleAll}
                className="px-3 py-1.5 bg-[#00225a] text-[10px] font-bold text-[#dee5ff] uppercase tracking-widest hover:bg-[#002867] transition-colors"
              >
                {allSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {channelHosts.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-[#91aaeb] opacity-30">dns</span>
                  <p className="text-sm text-[#91aaeb] mt-4">No {channel} hosts registered</p>
                </div>
              ) : channelHosts.map(host => {
                const isSelected = selectedIds.includes(host.id);
                return (
                  <div
                    key={host.id}
                    onClick={() => toggleHost(host.id)}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#05183c] border border-[#7bd0ff]/30'
                        : 'bg-[#031d4b] hover:bg-[#002867]'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center mr-4 ${
                      isSelected ? 'border-[#7bd0ff] bg-[#7bd0ff]/20' : 'border-[#2b4680]'
                    }`}>
                      {isSelected && (
                        <span className="material-symbols-outlined text-xs text-[#7bd0ff] font-bold">check</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#dee5ff]">{host.hostname || host.name}</p>
                      <p className="text-[10px] text-[#91aaeb] uppercase tracking-tight">
                        {host.ip} | {host.os || 'Unknown OS'}{host.site ? ` | ${host.site}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <StitchBadge variant={host.is_online !== false ? 'success' : 'error'}>
                        {host.is_online !== false ? 'Online' : 'Offline'}
                      </StitchBadge>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Impact Analysis - Real Data Derived */}
          <section className="bg-[#06122d] p-6 rounded border-l-4 border-[#7bd0ff]/40">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#dee5ff] mb-4">Impact Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#00225a]/30 p-4 rounded-lg">
                <span className="material-symbols-outlined text-[#7bd0ff] text-xl mb-2">dns</span>
                <p className="text-[10px] text-[#91aaeb] uppercase tracking-widest">Target Hosts</p>
                <p className="text-xl font-bold text-[#dee5ff]">{selectedIds.length}</p>
              </div>
              <div className="bg-[#00225a]/30 p-4 rounded-lg">
                <span className="material-symbols-outlined text-[#ffd16f] text-xl mb-2">package_2</span>
                <p className="text-[10px] text-[#91aaeb] uppercase tracking-widest">Action Type</p>
                <p className="text-sm font-bold text-[#dee5ff] uppercase">{form.action.replace('_', ' ')}</p>
              </div>
              <div className="bg-[#00225a]/30 p-4 rounded-lg">
                <span className="material-symbols-outlined text-[#10b981] text-xl mb-2">
                  {form.dry_run ? 'preview' : 'rocket_launch'}
                </span>
                <p className="text-[10px] text-[#91aaeb] uppercase tracking-widest">Mode</p>
                <p className="text-sm font-bold text-[#dee5ff] uppercase">{form.dry_run ? 'Dry Run' : 'Live'}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Patch Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-[#06122d] p-6 rounded border border-[#2b4680]/20 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ffd16f]/50 to-transparent"></div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#dee5ff] mb-6 flex items-center">
              <span className="material-symbols-outlined mr-2 text-[#ffd16f]">package_2</span>
              Patch Configuration
            </h3>
            
            <div className="space-y-4">
              <StitchFormField label="Job Name">
                <StitchInput
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Weekly Security Patch - Prod"
                  required
                />
              </StitchFormField>
              
              <StitchFormField label="Action">
                <StitchSelect
                  value={form.action}
                  onChange={(e) => setForm(f => ({ ...f, action: e.target.value }))}
                >
                  <option value="server_patch">Upgrade All Packages</option>
                  <option value="specific_packages">Install / Upgrade Specific</option>
                  <option value="security_only">Security Updates Only</option>
                </StitchSelect>
              </StitchFormField>
              
              {form.action === 'specific_packages' && (
                <StitchFormField label="Package List (comma-separated)">
                  <StitchInput
                    value={form.packages}
                    onChange={(e) => setForm(f => ({ ...f, packages: e.target.value }))}
                    placeholder="nginx, curl, openssl"
                  />
                </StitchFormField>
              )}
              
              <div className="bg-[#031d4b] p-4 rounded border border-[#2b4680]/20">
                <p className="text-[10px] text-[#91aaeb] uppercase tracking-widest mb-3">Deployment Options</p>
                <div className="space-y-2.5">
                  {[
                    { k: 'dry_run',        l: 'Dry run (simulate only)'     },
                    { k: 'auto_snapshot',  l: 'Auto-snapshot before patching' },
                    { k: 'auto_rollback',  l: 'Auto-rollback on failure'     },
                  ].map(opt => (
                    <label key={opt.k} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!form[opt.k]} 
                        onChange={e => setForm(f => ({ ...f, [opt.k]: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-[#91aaeb]">{opt.l}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <button
                onClick={submit}
                disabled={submitting || !selectedIds.length}
                className="w-full bg-[#7bd0ff] text-[#004560] font-bold py-3 rounded hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                <span>{submitting ? 'Dispatching...' : `Patch ${selectedIds.length} Host${selectedIds.length !== 1 ? 's' : ''}`}</span>
              </button>
              <p className="text-[10px] text-center text-[#91aaeb] mt-2">
                Job will be queued in Operations Queue
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Recent Bulk Jobs */}
      {jobs.length > 0 && (
        <section className="bg-[#06122d] p-6 rounded border border-[#2b4680]/20 mt-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#dee5ff] mb-6">Recent Bulk Jobs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[#91aaeb] border-b border-[#2b4680]/10">
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4">Job Name</th>
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4 text-right">Hosts</th>
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4 text-right">Action</th>
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4 text-right">Status</th>
                  <th className="pb-3 text-[10px] uppercase tracking-[0.1em] font-bold px-4 text-right">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-transparent">
                {jobs.map((job) => (
                  <tr key={job.id} className="group hover:bg-[#031d4b] transition-colors h-14">
                    <td className="px-4 py-2">
                      <span className="text-sm font-bold text-[#dee5ff]">{job.name}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-xs font-mono text-[#91aaeb]">
                        {job.total_hosts || job.host_ids?.length || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-xs text-[#91aaeb]">{job.action || '-'}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <StitchBadge variant={statusColor(job.status)}>{job.status}</StitchBadge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-xs font-mono text-[#91aaeb]">
                        {job.created_at 
                          ? new Date(job.created_at).toLocaleString([], { 
                              month: 'short', 
                              day: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            }) 
                          : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
