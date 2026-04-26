import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from './AppIcons';
import {
  StitchWorkspaceContainer,
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchButton,
  StitchBadge,
  StitchAlert,
  StitchEmptyState
} from './components/StitchComponents';

const statusColor = s => {
  const statusMap = {
    success: 'success',
    failed: 'error',
    running: 'info',
    canceled: 'info',
    pending: 'warning'
  };
  return statusMap[String(s || '').toLowerCase()] || 'warning';
};

export default function OpsQueuePageStitch({ API, apiFetch, useInterval, toast, focusJobId, focusJobSeq }) {
  const [jobs, setJobs]           = useState([]);
  const [statusFilter, setFilter] = useState('');
  const [selectedJob, setSelJob]  = useState(null);
  const [loading, setLoading]     = useState(false);
  const [actionLoading, setActing]= useState(false);
  const [error, setError]         = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ limit: '200' });
      if (statusFilter) q.set('status', statusFilter);
      const r = await apiFetch(`${API}/api/ops-queue/jobs?${q}`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(d?.detail || `Failed to load queue (${r.status})`);
      setJobs(Array.isArray(d) ? d : []);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [API, apiFetch, statusFilter]);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  if (useInterval) useInterval(loadJobs, 4000);

  useEffect(() => {
    if (!focusJobId) return;
    loadJobDetail(focusJobId);
  }, [focusJobId, focusJobSeq]);

  const loadJobDetail = async jobId => {
    try {
      const r = await apiFetch(`${API}/api/ops-queue/jobs/${jobId}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || 'Failed to load detail');
      setSelJob(d);
    } catch (err) { setError(err.message); }
  };

  const cancelJob = async jobId => {
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/ops-queue/jobs/${jobId}/cancel`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || 'Cancel failed');
      if (toast) toast('Job canceled', 'success');
      await loadJobs();
      if (selectedJob?.id === jobId) await loadJobDetail(jobId);
    } catch (err) {
      if (toast) toast(err.message, 'danger');
    }
    setActing(false);
  };

  const stats = useMemo(() => {
    const base = { total: jobs.length, pending: 0, running: 0, success: 0, failed: 0, canceled: 0 };
    jobs.forEach(j => { const s = String(j.status || '').toLowerCase(); if (s in base) base[s]++; });
    return base;
  }, [jobs]);

  const FILTERS = ['', 'pending', 'running', 'success', 'failed', 'canceled'];

  return (
    <StitchWorkspaceContainer workspace="infrastructure" className="min-h-screen p-8">
      <StitchPageHeader
        workspace="infrastructure"
        title="Operations Queue"
        description="Queue management and job execution monitoring"
      />

      {error && (
        <StitchAlert
          variant="error"
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          workspace="infrastructure"
          label="Total Jobs"
          value={stats.total}
          icon="list"
          subtitle="in queue"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Active Tasks"
          value={stats.running}
          icon="sync"
          subtitle="currently running"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Pending"
          value={stats.pending}
          icon="hourglass_empty"
          subtitle="awaiting execution"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Failed"
          value={stats.failed}
          icon="warning"
          subtitle="requires review"
        />
      </StitchMetricGrid>

      {/* Queue Table Section */}
      <div className="bg-[#05183c] overflow-hidden rounded-xl mt-8">
        {/* Filters Bar */}
        <div className="px-6 py-4 flex items-center justify-between bg-[#031d4b] border-b border-[#2b4680]/10">
          <div className="flex gap-6">
            {FILTERS.map(f => {
              const count = f ? jobs.filter(j => j.status === f).length : jobs.length;
              return (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[11px] font-bold uppercase tracking-[0.1em] flex items-center gap-2 ${
                    statusFilter === f 
                      ? 'text-[#7bd0ff]' 
                      : 'text-[#91aaeb]/60 hover:text-[#dee5ff]'
                  }`}
                >
                  {f || 'All Jobs'} <span className={`px-1.5 py-0.5 rounded text-[9px] ${statusFilter === f ? 'bg-[#7bd0ff]/20' : ''}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#91aaeb] text-sm cursor-pointer">filter_list</span>
            <span className="material-symbols-outlined text-[#91aaeb] text-sm cursor-pointer" onClick={loadJobs}>refresh</span>
          </div>
        </div>

        {/* Job List */}
        {loading ? (
          <div className="p-12 text-center text-[#91aaeb]">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <StitchEmptyState
            icon="inbox"
            title="No Jobs in Queue"
            description="The operations queue is currently empty. Jobs will appear here when scheduled or triggered."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#000000]/20">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-semibold">Job ID</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-semibold">Type</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-semibold">Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-semibold">Progress</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-semibold text-right">Created</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-4 divide-[#05183c]">
                {jobs.map(job => (
                  <tr key={job.id} className={`group hover:bg-[#06122d] transition-colors ${job.status === 'failed' ? 'bg-[#ee7d77]/5' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono text-[#dee5ff] font-semibold">{job.id}</span>
                        {job.worker_node && (
                          <span className="text-[10px] text-[#91aaeb]">Worker: {job.worker_node}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[11px] text-[#dee5ff] px-2 py-1 bg-[#00225a] rounded">{job.job_type || 'TASK'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <StitchBadge variant={statusColor(job.status)}>
                        {String(job.status || 'pending').toUpperCase()}
                      </StitchBadge>
                    </td>
                    <td className="px-6 py-5 min-w-[150px]">
                      {job.progress !== undefined && job.progress !== null ? (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-[#00225a] h-1 rounded-full overflow-hidden">
                            <div className="bg-[#7bd0ff] h-full" style={{ width: `${job.progress}%` }}></div>
                          </div>
                          <span className="text-[10px] font-mono text-[#7bd0ff] font-bold">{job.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#91aaeb]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right font-mono text-[11px] text-[#91aaeb]">
                      {job.created_at ? new Date(job.created_at).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(job.status === 'pending' || job.status === 'running') && (
                          <span 
                            className="material-symbols-outlined text-sm cursor-pointer hover:text-[#ee7d77]"
                            onClick={() => cancelJob(job.id)}
                          >
                            cancel
                          </span>
                        )}
                        <span 
                          className="material-symbols-outlined text-sm cursor-pointer hover:text-[#7bd0ff]"
                          onClick={() => loadJobDetail(job.id)}
                        >
                          visibility
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {jobs.length > 0 && (
          <div className="px-6 py-3 bg-[#000000]/30 border-t border-[#2b4680]/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-[#91aaeb]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7bd0ff] animate-pulse"></span>
                QUEUE SYSTEM ONLINE
              </div>
              <span className="h-3 w-px bg-[#2b4680]/30"></span>
              <div className="text-[10px] text-[#91aaeb] uppercase tracking-widest">
                {jobs.length} JOBS LOADED
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Job Detail Panel */}
      {selectedJob && (
        <div className="mt-8 bg-[#06122d] p-6 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7bd0ff]">Job Details: {selectedJob.id}</h3>
            <StitchButton variant="ghost" size="sm" onClick={() => setSelJob(null)}>
              Close
            </StitchButton>
          </div>
          <div className="bg-[#000000] p-4 font-mono text-[12px] leading-relaxed text-[#939eb5] border border-[#2b4680]/5 rounded">
            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedJob, null, 2)}</pre>
          </div>
        </div>
      )}
    </StitchWorkspaceContainer>
  );
}
