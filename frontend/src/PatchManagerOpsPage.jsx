import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, History, ShieldCheck, Terminal, Database,
  RotateCcw, RefreshCw, Activity, CheckCircle2,
  MoreVertical, AlertTriangle, ChevronDown, Play, Pause
} from 'lucide-react';

export default function PatchManagerOpsPage({ hosts = [], API, apiFetch, AppIcon, useInterval }) {
  const [packages, setPackages]     = useState([]);
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [hostFilter, setHostFilter] = useState('all');
  const [searchQuery, setSearch]    = useState('');
  const [selectedHost, setSelHost]  = useState(null);
  const [scanning, setScanning]     = useState(false);
  const [actionMsg, setActionMsg]   = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!API || !apiFetch) return;
    try {
      const hostId = selectedHost || (hosts[0]?.id);
      if (!hostId) { setLoading(false); return; }

      const [pkgRes, jobRes] = await Promise.all([
        apiFetch(`${API}/api/hosts/${hostId}/packages`).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/jobs/?host_id=${hostId}&limit=20`).then(r => r.json()).catch(() => []),
      ]);

      setPackages(Array.isArray(pkgRes) ? pkgRes : []);
      setJobs(Array.isArray(jobRes) ? jobRes : jobRes?.items ?? []);
    } catch {
      setPackages([]);
      setJobs([]);
    }
    setLoading(false);
  }, [API, apiFetch, selectedHost, hosts]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);
  if (useInterval) useInterval(refresh, 15000);

  // ── Computed ───────────────────────────────────────────────────────────────
  const activeJobs  = jobs.filter(j => j.status === 'running');
  const pendingJobs = jobs.filter(j => ['pending', 'scheduled'].includes(j.status));

  const upgradable = packages.filter(p => p.upgradable || p.available_version);
  const filtered   = upgradable.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !p.name?.toLowerCase().includes(q)) return false;
    if (hostFilter === 'security' && !p.is_security) return false;
    if (hostFilter === 'critical' && p.severity !== 'critical') return false;
    return true;
  });

  const onlineCount  = hosts.filter(h => h.is_online).length;
  const activeHost   = hosts.find(h => h.id === selectedHost) || hosts[0];

  // ── Actions ────────────────────────────────────────────────────────────────
  const scanHost = async () => {
    if (!activeHost) return;
    setScanning(true);
    setActionMsg('Scanning for upgrades…');
    try {
      const r = await apiFetch(`${API}/api/hosts/${activeHost.id}/scan`, { method: 'POST' });
      setActionMsg(r.ok ? 'Scan dispatched successfully.' : 'Scan request failed.');
    } catch { setActionMsg('Connection error during scan.'); }
    setTimeout(() => setActionMsg(''), 4000);
    setScanning(false);
    refresh();
  };

  const patchHost = async () => {
    if (!activeHost) return;
    setActionMsg('Dispatching patch job…');
    try {
      const r = await apiFetch(`${API}/api/hosts/${activeHost.id}/patch`, { method: 'POST' });
      setActionMsg(r.ok ? 'Patch job dispatched.' : 'Patch dispatch failed.');
    } catch { setActionMsg('Connection error.'); }
    setTimeout(() => setActionMsg(''), 4000);
    refresh();
  };

  const abortJob = async (jobId) => {
    try {
      await apiFetch(`${API}/api/jobs/${jobId}/abort`, { method: 'POST' });
      refresh();
    } catch {}
  };

  // ── Severity badge ─────────────────────────────────────────────────────────
  const severityBadge = (pkg) => {
    if (pkg.severity === 'critical' || pkg.is_security)
      return { label: 'SECURITY', cls: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20' };
    if (pkg.severity === 'high')
      return { label: 'HIGH', cls: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20' };
    return { label: 'UPDATE', cls: 'bg-[#7bd0ff]/10 text-[#7bd0ff] border-[#7bd0ff]/20' };
  };

  const jobStatusColor = (s) => {
    if (s === 'success') return 'text-[#10b981]';
    if (s === 'failed')  return 'text-[#ef4444]';
    if (s === 'running') return 'text-[#7bd0ff]';
    return 'text-[#94a3b8]';
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hosts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: '#060e20', color: '#91aaeb' }}>
        <ShieldCheck size={48} className="text-[#2b4680]" />
        <p className="text-lg font-bold text-[#dee5ff]">No hosts registered</p>
        <p className="text-sm">Onboard agents to begin patch management.</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full text-[#dee5ff] overflow-hidden"
      style={{ background: '#060e20', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Left panel: host selector + upgrade queue ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div
          className="shrink-0 px-6 py-4 flex flex-wrap items-center gap-3"
          style={{ borderBottom: '1px solid rgba(43,70,128,0.2)', background: '#060e20' }}
        >
          {/* Host selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#91aaeb]">Host</label>
            <select
              value={selectedHost || activeHost?.id || ''}
              onChange={e => setSelHost(Number(e.target.value) || e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
              style={{ background: 'rgba(3,29,75,0.5)', border: '1px solid rgba(43,70,128,0.35)', color: '#dee5ff' }}
            >
              {hosts.map(h => (
                <option key={h.id} value={h.id}>
                  {h.hostname} {h.is_online ? '●' : '○'}
                </option>
              ))}
            </select>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2">
            {[
              { label: 'All',      value: 'all' },
              { label: 'Security', value: 'security' },
              { label: 'Critical', value: 'critical' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setHostFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                  ${hostFilter === f.value
                    ? 'bg-[#7bd0ff]/20 text-[#7bd0ff] border border-[#7bd0ff]/40'
                    : 'text-[#91aaeb] hover:text-[#dee5ff]'}`}
                style={hostFilter !== f.value ? { background: 'rgba(3,29,75,0.5)', border: '1px solid rgba(43,70,128,0.35)' } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91aaeb]" size={14} />
            <input
              type="text"
              placeholder="Filter packages…"
              value={searchQuery}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#7bd0ff] placeholder-[#91aaeb]"
              style={{ background: 'rgba(3,29,75,0.5)', border: '1px solid rgba(43,70,128,0.35)', color: '#dee5ff', width: 200 }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={scanHost}
              disabled={scanning}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'rgba(123,208,255,0.1)', color: '#7bd0ff', border: '1px solid rgba(123,208,255,0.3)' }}
            >
              {scanning ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
              Scan
            </button>
            <button
              onClick={patchHost}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: '#7bd0ff', color: '#06122d', boxShadow: '0 4px 14px rgba(123,208,255,0.2)' }}
            >
              <ShieldCheck size={14} /> Patch All
            </button>
          </div>
        </div>

        {/* Action feedback */}
        {actionMsg && (
          <div
            className="px-6 py-2 text-xs font-bold"
            style={{ background: 'rgba(123,208,255,0.08)', color: '#7bd0ff', borderBottom: '1px solid rgba(43,70,128,0.2)' }}
          >
            ⟢ {actionMsg}
          </div>
        )}

        {/* ── Upgrade queue table ── */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          <div
            className="rounded-2xl overflow-hidden flex flex-col flex-1"
            style={{ background: 'rgba(6,18,45,0.6)', border: '1px solid rgba(43,70,128,0.25)' }}
          >
            {/* Header row */}
            <div
              className="px-6 py-4 flex items-center justify-between shrink-0"
              style={{ borderBottom: '1px solid rgba(43,70,128,0.2)', background: 'rgba(3,29,75,0.3)' }}
            >
              <div className="flex items-center gap-3">
                <History className="text-[#7bd0ff]" size={18} />
                <h3 className="text-base font-bold text-[#dee5ff]">
                  Upgrade Queue
                  <span className="ml-2 text-[11px] font-black px-2 py-0.5 rounded-full text-[#7bd0ff]"
                    style={{ background: 'rgba(123,208,255,0.15)' }}>
                    {filtered.length}
                  </span>
                </h3>
              </div>
              {activeJobs.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#7bd0ff] rounded-full animate-pulse" />
                  <span className="text-[11px] font-bold text-[#7bd0ff] uppercase tracking-wider">
                    {activeJobs.length} Job{activeJobs.length > 1 ? 's' : ''} Running
                  </span>
                </div>
              )}
            </div>

            {/* Table body */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-[#91aaeb] text-sm gap-3">
                  <RefreshCw size={16} className="animate-spin" /> Loading packages…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#91aaeb]">
                  <CheckCircle2 size={32} className="text-[#10b981]" />
                  <p className="text-sm font-bold text-[#dee5ff]">All packages up to date</p>
                  <p className="text-xs">Run a scan to check for new updates.</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr
                      className="text-[10px] font-bold text-[#91aaeb] uppercase tracking-widest text-left"
                      style={{ background: 'rgba(3,29,75,0.5)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(43,70,128,0.15)' }}
                    >
                      <th className="px-6 py-3">Package</th>
                      <th className="px-6 py-3">Current → Available</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((pkg, i) => {
                      const badge = severityBadge(pkg);
                      return (
                        <tr
                          key={i}
                          className="group transition-colors"
                          style={{ borderBottom: '1px solid rgba(43,70,128,0.08)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(3,29,75,0.3)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-sm text-[#dee5ff]">{pkg.name || pkg.package}</p>
                            {pkg.description && (
                              <p className="text-[10px] text-[#91aaeb] mt-0.5 truncate max-w-[220px]">{pkg.description}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-[#91aaeb]">
                            <span>{pkg.current_version || pkg.version || '—'}</span>
                            {pkg.available_version && (
                              <span className="text-[#10b981]"> → {pkg.available_version}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => apiFetch(`${API}/api/hosts/${activeHost?.id}/patch`, {
                                method: 'POST',
                                body: JSON.stringify({ packages: [pkg.name || pkg.package] }),
                              }).then(refresh)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                              style={{ background: 'rgba(123,208,255,0.15)', color: '#7bd0ff', border: '1px solid rgba(123,208,255,0.3)' }}
                            >
                              Patch
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: Live job feed + status ── */}
      <aside
        className="w-80 flex flex-col shrink-0 overflow-y-auto"
        style={{ background: '#06122d', borderLeft: '1px solid rgba(43,70,128,0.25)' }}
      >
        <div className="p-6 space-y-6">

          {/* Fleet Status Donut */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#91aaeb] mb-5">Live Infrastructure Status</h4>
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center mb-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(3,29,75,0.8)" strokeWidth="12" />
                <circle
                  cx="80" cy="80" r="64" fill="none" stroke="#7bd0ff" strokeWidth="12"
                  strokeDasharray="402"
                  strokeDashoffset={402 - (402 * (hosts.length ? onlineCount / hosts.length : 0))}
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(123,208,255,0.4))' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-[#dee5ff]">
                  {hosts.length ? Math.round((onlineCount / hosts.length) * 100) : 0}%
                </span>
                <span className="text-[10px] font-bold text-[#7bd0ff] uppercase tracking-widest mt-1">Online</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Managed Hosts',  val: hosts.length,     color: '#7bd0ff' },
                { label: 'Online Now',     val: onlineCount,      color: '#10b981' },
                { label: 'Active Jobs',    val: activeJobs.length, color: '#fbbf24' },
                { label: 'Pending Jobs',   val: pendingJobs.length, color: '#94a3b8' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                    <span className="text-[11px] text-[#91aaeb]">{stat.label}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#dee5ff]">{stat.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Job Feed */}
          <div style={{ paddingTop: 16, borderTop: '1px solid rgba(43,70,128,0.15)' }}>
            <div className="flex items-center gap-2 mb-5">
              <Terminal className="text-[#7bd0ff]" size={16} />
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#91aaeb]">Recent Jobs</h4>
            </div>

            {jobs.length === 0 ? (
              <p className="text-xs text-[#91aaeb]">No recent jobs.</p>
            ) : (
              <div className="space-y-4 relative">
                <div
                  className="absolute left-[7px] top-1 bottom-1 w-px"
                  style={{ background: 'rgba(43,70,128,0.3)' }}
                />
                {jobs.slice(0, 8).map((job, i) => (
                  <div key={job.id || i} className="flex gap-4 items-start">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 z-10"
                      style={{
                        background: job.status === 'success' ? '#10b981' : job.status === 'failed' ? '#ef4444' : '#7bd0ff',
                        boxShadow: `0 0 0 3px #06122d`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-wider ${jobStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        {job.status === 'running' && (
                          <button
                            onClick={() => abortJob(job.id)}
                            className="text-[8px] font-black uppercase text-[#ef4444] hover:underline"
                          >
                            Abort
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#dee5ff] truncate mt-0.5">{job.action || job.type || 'patch'}</p>
                      <p className="text-[10px] text-[#91aaeb] mt-0.5">
                        {job.created_at ? new Date(job.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scan summary */}
          {upgradable.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(3,29,75,0.4)', border: '1px solid rgba(43,70,128,0.2)', paddingTop: 16, marginTop: 4 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#91aaeb] mb-3">Upgrade Summary</p>
              <div className="space-y-2">
                {[
                  { label: 'Total Upgradable', val: upgradable.length },
                  { label: 'Security Patches', val: upgradable.filter(p => p.is_security).length },
                  { label: 'Critical',         val: upgradable.filter(p => p.severity === 'critical').length },
                ].map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-xs text-[#91aaeb]">{s.label}</span>
                    <span className="text-xs font-bold text-[#dee5ff]">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}