import React, { useEffect, useMemo, useState } from 'react';
import { 
  StitchPageHeader,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchTable,
  StitchBadge,
  StitchSummaryCard,
  StitchMetricGrid
} from './components/StitchComponents';

const STATUS_TABS = ['all', 'pending', 'running', 'success', 'failed', 'rolled_back'];

const getJobStatusVariant = (status) => {
  if (status === 'success' || status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'info';
  return 'pending';
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
    <div className="min-h-screen bg-[#05183c] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <StitchPageHeader
          kicker="Queue Management"
          title="Operations Queue"
          description={`${jobs.length} total jobs | ${counts.running} active | ${counts.failed} failed`}
          actions={
            <StitchButton
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={refresh}
            >
              Refresh
            </StitchButton>
          }
        />

        {/* KPI Cards */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Active Tasks"
            value={counts.running}
            subtitle="currently executing"
            icon="sync"
            color="#ffd16f"
          />
          <StitchSummaryCard
            label="Pending"
            value={counts.pending}
            subtitle="awaiting execution"
            icon="hourglass_empty"
            color="#91aaeb"
          />
          <StitchSummaryCard
            label="Successful"
            value={counts.success}
            subtitle="completed without error"
            icon="check_circle"
            color="#10b981"
          />
          <StitchSummaryCard
            label="Failures (24h)"
            value={counts.failed}
            subtitle="require investigation"
            icon="warning"
            color="#ee7d77"
          />
        </StitchMetricGrid>

        {/* Filter Bar + Table */}
        <div className="bg-[#06122d] rounded-xl border border-[#2b4680]/20 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between bg-[#031d4b] border-b border-[#2b4680]/10">
            <div className="flex gap-6">
              {STATUS_TABS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`text-[11px] font-bold uppercase tracking-[0.1em] flex items-center gap-2 transition-colors ${
                    statusFilter === s 
                      ? 'text-[#7bd0ff]' 
                      : 'text-[#91aaeb]/60 hover:text-[#dee5ff]'
                  }`}
                >
                  {s === 'all' ? 'All Jobs' : s === 'rolled_back' ? 'Rolled Back' : s.charAt(0).toUpperCase() + s.slice(1)}
                  {statusFilter === s && (
                    <span className="bg-[#7bd0ff]/20 px-1.5 py-0.5 rounded text-[9px]">{counts[s] || 0}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#91aaeb] text-sm">search</span>
                <input
                  className="bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] pl-10 pr-4 py-2 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#7bd0ff]/50 placeholder:text-[#91aaeb]/50"
                  placeholder="Search tasks, IDs, or logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="material-symbols-outlined text-[#91aaeb] text-sm cursor-pointer hover:text-[#7bd0ff]" onClick={refresh}>refresh</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-[#2b4680] mb-4">work_history</span>
              <p className="text-sm font-bold text-[#dee5ff]">No jobs found</p>
              <p className="text-xs text-[#91aaeb] mt-2">
                {search ? 'Try adjusting your search criteria' : 'Jobs will appear here once executed'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <StitchTable
                columns={[
                  { 
                    key: 'id', 
                    header: 'Job Identifier', 
                    render: (row) => (
                      <div className="flex flex-col">
                        <span className="text-sm font-mono text-[#dee5ff] font-semibold">
                          {row.action || row.job_type || row.type || 'TASK'}-{row.id}
                        </span>
                        <span className="text-[10px] text-[#91aaeb]">Worker node: ops-worker-{(row.id % 12) + 1}</span>
                      </div>
                    )
                  },
                  { 
                    key: 'action', 
                    header: 'Process Type', 
                    render: (row) => (
                      <span className="text-[11px] text-[#dee5ff] px-2 py-1 bg-[#00225a] rounded">
                        {(row.action || row.job_type || row.type || 'TASK').toUpperCase()}
                      </span>
                    )
                  },
                  { 
                    key: 'hostname', 
                    header: 'Target', 
                    render: (row) => (
                      <div>
                        <p className="text-sm font-bold text-[#dee5ff]">{row.hostname || row.host_name || '-'}</p>
                        {row.host_ip && <p className="text-[10px] font-mono text-[#91aaeb]">{row.host_ip}</p>}
                      </div>
                    )
                  },
                  { 
                    key: 'status', 
                    header: 'Status', 
                    render: (row) => {
                      const variant = getJobStatusVariant(row.status);
                      const colorMap = {
                        success: 'text-[#7bd0ff] bg-[#004c69]/40',
                        error: 'text-[#ee7d77] bg-[#7f2927]/40',
                        info: 'text-[#7bd0ff] bg-[#004c69]/40',
                        pending: 'text-[#91aaeb] bg-[#00225a]'
                      };
                      return (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded ${colorMap[variant]}`}>
                          {row.status?.toUpperCase()}
                        </span>
                      );
                    }
                  },
                  { 
                    key: 'created_at', 
                    header: 'Started At', 
                    render: (row) => (
                      <span className="text-[11px] font-mono text-[#91aaeb]">
                        {row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </span>
                    )
                  },
                  { 
                    key: 'actions', 
                    header: 'Actions', 
                    render: (row) => (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span 
                          className="material-symbols-outlined text-sm cursor-pointer hover:text-[#7bd0ff]" 
                          onClick={(e) => { e.stopPropagation(); openDetail(row); }}
                        >
                          terminal
                        </span>
                        {row.status === 'running' && (
                          <span 
                            className="material-symbols-outlined text-sm cursor-pointer hover:text-[#ee7d77]"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await apiFetch(`${API}/api/jobs/${row.id}/abort`, { method: 'POST' });
                              refresh();
                            }}
                          >
                            cancel
                          </span>
                        )}
                      </div>
                    )
                  },
                ]}
                data={filtered}
                onRowClick={openDetail}
              />
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-[#000000]/30 border-t border-[#2b4680]/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-[#91aaeb]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7bd0ff] animate-pulse"></span>
                QUEUE SYSTEM ONLINE
              </div>
              <span className="h-3 w-px bg-[#2b4680]/30"></span>
              <div className="text-[10px] text-[#91aaeb] uppercase tracking-widest">
                {filtered.length} JOBS DISPLAYED
              </div>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedJob && (
          <div className="bg-[#06122d] rounded-xl border border-[#2b4680]/20 overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between bg-[#031d4b] border-b border-[#2b4680]/10">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-1">Job Detail</p>
                <h3 className="text-xl font-bold text-[#dee5ff]">
                  {jobDetail?.action || selectedJob.action} <span className="font-mono text-sm text-[#91aaeb]">#{selectedJob.id}</span>
                </h3>
              </div>
              <div className="flex gap-2">
                {jobDetail?.status === 'running' && (
                  <StitchButton
                    variant="danger"
                    size="sm"
                    icon="cancel"
                    onClick={async () => {
                      await apiFetch(`${API}/api/jobs/${selectedJob.id}/abort`, { method: 'POST' });
                      refresh();
                    }}
                  >
                    Abort
                  </StitchButton>
                )}
                <StitchButton
                  variant="secondary"
                  size="sm"
                  icon="close"
                  onClick={() => { setSelJob(null); setDetail(null); }}
                >
                  Close
                </StitchButton>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Status', val: jobDetail?.status || '-', variant: getJobStatusVariant(jobDetail?.status) },
                  { label: 'Host', val: jobDetail?.hostname || jobDetail?.host_name || '-' },
                  { label: 'Started', val: jobDetail?.created_at ? new Date(jobDetail.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' },
                  { label: 'Operator', val: jobDetail?.triggered_by || jobDetail?.operator || 'system' },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl p-4 bg-[#031d4b] border border-[#2b4680]/30">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">{item.label}</p>
                    <p className="text-sm font-bold mt-2 text-[#dee5ff]">
                      {item.variant ? <StitchBadge variant={item.variant}>{item.val}</StitchBadge> : item.val}
                    </p>
                  </div>
                ))}
              </div>
              {jobDetail?.output && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7bd0ff]">Live Output Feed</h3>
                    <span className="text-[10px] text-[#91aaeb] font-mono">TAILING JOB #{selectedJob.id}...</span>
                  </div>
                  <pre className="p-4 rounded-xl text-[12px] font-mono overflow-auto max-h-64 leading-relaxed bg-[#000000]/40 text-[#939eb5] border border-[#2b4680]/5">
                    {jobDetail.output}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
