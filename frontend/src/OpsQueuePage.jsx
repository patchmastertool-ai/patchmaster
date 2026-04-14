import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CHLoading, CHEmpty, CH } from './CH.jsx';
import { Activity, RefreshCw, X, Play, XCircle, CheckCircle2, Clock } from 'lucide-react';

const statusColor = s => {
  const k = String(s || '').toLowerCase();
  if (k === 'success') return CH.green;
  if (k === 'failed')  return CH.red;
  if (k === 'running') return CH.accent;
  if (k === 'canceled') return CH.textSub;
  return CH.yellow;
};

export default function OpsQueuePage({ API, apiFetch, useInterval, toast, focusJobId, focusJobSeq }) {
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
    <CHPage>
      <CHHeader
        kicker="Operations Execution"
        title="Ops Queue"
        subtitle="Live view of all background tasks, patch jobs, and agent dispatches"
        actions={<CHBtn variant="ghost" onClick={loadJobs}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</CHBtn>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Active"   value={stats.running}  sub="currently executing"  accent={CH.accent} />
        <CHStat label="Pending"  value={stats.pending}  sub="queued up"            accent={CH.yellow} />
        <CHStat label="Complete" value={stats.success}  sub="successful"           accent={CH.green} />
        <CHStat label="Failed"   value={stats.failed}   sub="require attention"    accent={CH.red} />
      </div>

      {error && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: `${CH.red}15`, color: CH.red, border: `1px solid ${CH.red}30` }}>
          {error}
        </div>
      )}

      {/* Filter Tabs + Table */}
      <CHCard className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: statusFilter === f ? `${statusColor(f) || CH.accent}20` : 'rgba(3,29,75,0.4)',
                color: statusFilter === f ? (statusColor(f) || CH.accent) : CH.textSub,
                border: `1px solid ${statusFilter === f ? (statusColor(f) || CH.accent) + '50' : CH.border}`,
              }}
            >
              {f || 'All'} ({f ? jobs.filter(j => j.status === f).length : jobs.length})
            </button>
          ))}
        </div>

        {loading
          ? <CHLoading message="Loading operations queue…" />
          : <CHTable headers={['Operation', 'Type', 'Target', 'Status', 'Started', 'Actions']}
              emptyMessage="No operations in queue.">
              {jobs.map(job => (
                <CHTR key={job.id} onClick={() => loadJobDetail(job.id)} selected={selectedJob?.id === job.id}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{job.operation || job.type || 'Task'}</p>
                    <p className="text-[11px] font-mono" style={{ color: CH.textSub }}>#{job.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <CHBadge color={CH.accent}>{job.task_type || job.type || '—'}</CHBadge>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>
                    {job.target_host || job.host_ip || job.target || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <CHBadge color={statusColor(job.status)}>{job.status}</CHBadge>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>
                    {job.created_at ? new Date(job.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {(job.status === 'pending' || job.status === 'running') && (
                      <CHBtn variant="danger" disabled={actionLoading} onClick={e => { e.stopPropagation(); cancelJob(job.id); }}>
                        Cancel
                      </CHBtn>
                    )}
                  </td>
                </CHTR>
              ))}
            </CHTable>
        }
      </CHCard>

      {/* Detail panel */}
      {selectedJob && (
        <CHCard>
          <div className="flex items-center justify-between mb-5">
            <div>
              <CHLabel>Operation Detail</CHLabel>
              <h3 className="text-xl font-bold mt-1" style={{ color: CH.text }}>
                {selectedJob.operation || selectedJob.type}
                <span className="font-mono text-sm ml-2" style={{ color: CH.textSub }}>#{selectedJob.id}</span>
              </h3>
            </div>
            <CHBtn variant="ghost" onClick={() => setSelJob(null)}><X size={14} /></CHBtn>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Status',  val: selectedJob.status,   color: statusColor(selectedJob.status) },
              { label: 'Target',  val: selectedJob.target_host || selectedJob.host_ip || '—' },
              { label: 'Started', val: selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString() : '—' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <CHLabel>{item.label}</CHLabel>
                <p className="text-sm font-bold mt-1" style={{ color: item.color || CH.text }}>{item.val}</p>
              </div>
            ))}
          </div>
          {selectedJob.result && (
            <div className="mt-5">
              <CHLabel>Result</CHLabel>
              <pre className="mt-2 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60"
                style={{ background: 'rgba(0,0,0,0.4)', color: CH.textSub }}>
                {typeof selectedJob.result === 'string' ? selectedJob.result : JSON.stringify(selectedJob.result, null, 2)}
              </pre>
            </div>
          )}
        </CHCard>
      )}
    </CHPage>
  );
}
