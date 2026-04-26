import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function OpsQueuePage({ API, apiFetch, useInterval, toast, focusJobId, focusJobSeq }) {
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ limit: '200' });
      if (statusFilter) q.set('status', statusFilter);
      const response = await apiFetch(`${API}/api/ops-queue/jobs?${q.toString()}`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        const message = payload?.error?.message || payload?.detail || `Failed to load queue jobs (${response.status})`;
        throw new Error(message);
      }
      setJobs(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.message || 'Failed to load operations queue.');
    } finally {
      setLoading(false);
    }
  }, [API, apiFetch, statusFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useInterval(() => {
    loadJobs();
  }, 4000);

  useEffect(() => {
    if (!focusJobId) return;
    loadJobDetail(focusJobId);
  }, [focusJobId, focusJobSeq]);

  const loadJobDetail = async (jobId) => {
    try {
      const response = await apiFetch(`${API}/api/ops-queue/jobs/${jobId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || payload?.detail || `Failed to load job detail (${response.status})`;
        throw new Error(message);
      }
      setSelectedJob(payload);
    } catch (err) {
      setError(err.message || 'Failed to load job detail.');
    }
  };

  const cancelJob = async (jobId) => {
    setActionLoading(true);
    try {
      const response = await apiFetch(`${API}/api/ops-queue/jobs/${jobId}/cancel`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || payload?.detail || `Cancel failed (${response.status})`;
        throw new Error(message);
      }
      if (toast) toast('Queue job canceled', 'success');
      await loadJobs();
      if (selectedJob?.id === jobId) {
        await loadJobDetail(jobId);
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel queue job.');
      if (toast) toast(err.message || 'Failed to cancel queue job.', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const stats = useMemo(() => {
    const base = { total: jobs.length, pending: 0, running: 0, success: 0, failed: 0, canceled: 0 };
    jobs.forEach((j) => {
      const s = String(j.status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(base, s)) base[s] += 1;
    });
    return base;
  }, [jobs]);

  const statusBadge = (s) => {
    const map = {
      pending: 'badge-warning',
      running: 'badge-info',
      success: 'badge-success',
      failed: 'badge-danger',
      canceled: 'badge-secondary',
    };
    return map[String(s || '').toLowerCase()] || 'badge-info';
  };

  return (
    <div>
      <div className="card highlight-card">
        <h3>Operations Queue</h3>
        <p>Unified control plane for long-running operations: mirror sync, retention, backups, bulk patch, testing, and report generation.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="stat-info"><span className="stat-number">{stats.total}</span><span className="stat-label">Total</span></div></div>
        <div className="stat-card warning"><div className="stat-info"><span className="stat-number">{stats.pending}</span><span className="stat-label">Pending</span></div></div>
        <div className="stat-card info"><div className="stat-info"><span className="stat-number">{stats.running}</span><span className="stat-label">Running</span></div></div>
        <div className="stat-card success"><div className="stat-info"><span className="stat-number">{stats.success}</span><span className="stat-label">Success</span></div></div>
        <div className="stat-card danger"><div className="stat-info"><span className="stat-number">{stats.failed}</span><span className="stat-label">Failed</span></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Queue Jobs</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="canceled">Canceled</option>
            </select>
            <button className="btn btn-sm" onClick={loadJobs} disabled={loading || actionLoading}>Refresh</button>
          </div>
        </div>
        {error && <div className="ops-command-card" style={{ marginBottom: 10 }}>{error}</div>}
        <table className="table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Status</th>
              <th>Requested By</th>
              <th>Requested At</th>
              <th>Trace</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{job.op_type}</div>
                  <div className="ops-subtle" style={{ fontSize: 12 }}>{job.id}</div>
                </td>
                <td><span className={`badge ${statusBadge(job.status)}`}>{job.status}</span></td>
                <td>{job.requested_by || '-'}</td>
                <td>{job.requested_at ? new Date(job.requested_at).toLocaleString() : '-'}</td>
                <td>
                  <div style={{ fontSize: 11 }}>req: {job.request_id || '-'}</div>
                  <div style={{ fontSize: 11 }}>trace: {job.trace_token || '-'}</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm" onClick={() => loadJobDetail(job.id)} disabled={actionLoading}>Details</button>
                  {String(job.status).toLowerCase() === 'pending' && (
                    <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }} onClick={() => cancelJob(job.id)} disabled={actionLoading}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
            {!jobs.length && (
              <tr><td colSpan={6} className="text-muted">{loading ? 'Loading queue...' : 'No queue jobs found.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedJob && (
        <div className="card">
          <div className="card-header">
            <h3>Job Detail</h3>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(JSON.stringify(selectedJob, null, 2))}>Copy JSON</button>
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{JSON.stringify(selectedJob, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
