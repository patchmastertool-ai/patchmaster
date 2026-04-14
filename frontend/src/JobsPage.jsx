import React, { useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CHLoading, CHInput, CHEmpty, CH } from './CH.jsx';
import { Activity, Search, RefreshCw, CheckCircle, AlertTriangle, Clock, Terminal, X } from 'lucide-react';

const STATUS_TABS = ['all', 'pending', 'running', 'success', 'failed', 'rolled_back'];

const jobStatusColor = s => {
  if (s === 'success' || s === 'completed') return CH.green;
  if (s === 'failed')  return CH.red;
  if (s === 'running') return CH.accent;
  return CH.textSub;
};

export default function JobsPage({ jobs = [], setJobs, API, apiFetch, useInterval, hasRole }) {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [selectedJob, setSelJob]  = useState(null);
  const [jobDetail, setDetail]    = useState(null);

  const refresh = () => apiFetch(`${API}/api/jobs/`).then(r => r.json()).then(setJobs).catch(() => {});

  useEffect(() => { refresh(); }, []);
  if (useInterval) useInterval(refresh, 8000);

  const openDetail = async job => {
    setSelJob(job);
    try {
      const r = await apiFetch(`${API}/api/jobs/${job.id}`);
      setDetail(await r.json());
    } catch { setDetail(job); }
  };

  // Auto-refresh detail for running jobs
  if (useInterval) useInterval(async () => {
    if (selectedJob && jobDetail?.status === 'running') {
      try { const r = await apiFetch(`${API}/api/jobs/${selectedJob.id}`); setDetail(await r.json()); } catch {}
    }
  }, selectedJob ? 3000 : null);

  const filtered = useMemo(() => jobs.filter(j => {
    const term = search.toLowerCase();
    const matchSearch = (j.action || '').toLowerCase().includes(term)
      || (j.host_name || j.hostname || '').toLowerCase().includes(term)
      || (j.status || '').toLowerCase().includes(term);
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  }), [jobs, search, statusFilter]);

  const counts = useMemo(() => {
    const c = {};
    STATUS_TABS.forEach(s => { c[s] = s === 'all' ? jobs.length : jobs.filter(j => j.status === s).length; });
    return c;
  }, [jobs]);

  return (
    <CHPage>
      <CHHeader
        kicker="Execution Ledger"
        title="Job History"
        subtitle={`${jobs.length} total jobs across all operations`}
        actions={<CHBtn variant="ghost" onClick={refresh}><RefreshCw size={14} /> Refresh</CHBtn>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Jobs"  value={jobs.length}                                         accent={CH.accent} />
        <CHStat label="Running"     value={counts.running}  sub="currently executing"           accent={CH.accent} />
        <CHStat label="Successful"  value={counts.success}  sub="completed without error"       accent={CH.green} />
        <CHStat label="Failed"      value={counts.failed}   sub="require investigation"         accent={CH.red} />
      </div>

      {/* Filter Bar + Table */}
      <CHCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {STATUS_TABS.map(s => (
              <button key={s}
                onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: statusFilter === s ? `${jobStatusColor(s)}20` : 'rgba(3,29,75,0.4)',
                  color: statusFilter === s ? jobStatusColor(s) : CH.textSub,
                  border: `1px solid ${statusFilter === s ? jobStatusColor(s) + '50' : CH.border}`,
                }}
              >
                {s === 'rolled_back' ? 'Rolled Back' : s.charAt(0).toUpperCase() + s.slice(1)}
                <span className="ml-1.5 opacity-70">({counts[s] || 0})</span>
              </button>
            ))}
          </div>
          <CHInput placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={14} />} className="ml-auto max-w-xs" />
        </div>

        <CHTable headers={['#', 'Job Type', 'Host', 'Status', 'Operator', 'Started', 'Duration']}
          emptyMessage="No jobs match the current filters.">
          {filtered.map(job => {
            const dur = job.completed_at && job.created_at
              ? `${Math.round((new Date(job.completed_at) - new Date(job.created_at)) / 1000)}s` : '—';
            return (
              <CHTR key={job.id} onClick={() => openDetail(job)} selected={selectedJob?.id === job.id}>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>#{job.id}</td>
                <td className="px-6 py-4">
                  <CHBadge color={CH.accent}>{job.action || job.job_type || job.type || '—'}</CHBadge>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold" style={{ color: CH.text }}>{job.hostname || job.host_name || '—'}</p>
                  {job.host_ip && <p className="text-[11px] font-mono" style={{ color: CH.textSub }}>{job.host_ip}</p>}
                </td>
                <td className="px-6 py-4">
                  <CHBadge color={jobStatusColor(job.status)}>{job.status}</CHBadge>
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{job.triggered_by || job.operator || '—'}</td>
                <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>
                  {job.created_at ? new Date(job.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>{dur}</td>
              </CHTR>
            );
          })}
        </CHTable>
      </CHCard>

      {/* Detail Panel */}
      {selectedJob && (
        <CHCard>
          <div className="flex items-center justify-between mb-5">
            <div>
              <CHLabel>Job Detail</CHLabel>
              <h3 className="text-xl font-bold mt-1" style={{ color: CH.text }}>
                {jobDetail?.action || selectedJob.action} <span className="font-mono text-sm" style={{ color: CH.textSub }}>#{selectedJob.id}</span>
              </h3>
            </div>
            <div className="flex gap-2">
              {jobDetail?.status === 'running' && (
                <CHBtn variant="danger" onClick={async () => {
                  await apiFetch(`${API}/api/jobs/${selectedJob.id}/abort`, { method: 'POST' });
                  refresh();
                }}>Abort</CHBtn>
              )}
              <CHBtn variant="ghost" onClick={() => { setSelJob(null); setDetail(null); }}><X size={14} /></CHBtn>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Status',    val: jobDetail?.status || '—',         color: jobStatusColor(jobDetail?.status) },
              { label: 'Host',      val: jobDetail?.hostname || jobDetail?.host_name || '—' },
              { label: 'Started',   val: jobDetail?.created_at ? new Date(jobDetail.created_at).toLocaleString() : '—' },
              { label: 'Operator',  val: jobDetail?.triggered_by || jobDetail?.operator || 'system' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <CHLabel>{item.label}</CHLabel>
                <p className="text-sm font-bold mt-1" style={{ color: item.color || CH.text }}>{item.val}</p>
              </div>
            ))}
          </div>
          {jobDetail?.output && (
            <div className="mt-5">
              <CHLabel>Output Log</CHLabel>
              <pre className="mt-2 p-4 rounded-xl text-xs font-mono overflow-auto max-h-64 leading-relaxed"
                style={{ background: 'rgba(0,0,0,0.4)', color: CH.textSub, border: `1px solid ${CH.border}` }}>
                {jobDetail.output}
              </pre>
            </div>
          )}
        </CHCard>
      )}
    </CHPage>
  );
}
