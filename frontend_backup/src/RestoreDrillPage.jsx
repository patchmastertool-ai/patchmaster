import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function RestoreDrillPage({ API, apiFetch, useInterval, toast }) {
  const [configs, setConfigs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [insights, setInsights] = useState(null);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    backup_log_id: '',
    target_path: '',
    target_rto_minutes: '30',
    target_rpo_minutes: '60',
  });

  const selectedConfig = useMemo(
    () => configs.find((c) => String(c.id) === String(selectedConfigId)) || null,
    [configs, selectedConfigId],
  );

  const parseApiError = async (response, fallback) => {
    let detail = '';
    try {
      const payload = await response.clone().json();
      detail = payload?.error?.message || payload?.detail || payload?.message || '';
      if (!detail && payload && typeof payload === 'object') detail = JSON.stringify(payload);
    } catch {
      try {
        detail = await response.clone().text();
      } catch {
        detail = '';
      }
    }
    return detail ? `${fallback}: ${detail}` : `${fallback} (${response.status})`;
  };

  const loadConfigs = useCallback(async () => {
    const response = await apiFetch(`${API}/api/restore-drills/configs`);
    const payload = await response.json().catch(() => []);
    if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load backup configs'));
    const rows = Array.isArray(payload) ? payload : [];
    setConfigs(rows);
    if (rows.length && !rows.find((r) => String(r.id) === String(selectedConfigId))) {
      setSelectedConfigId(String(rows[0].id));
    }
    if (!rows.length) setSelectedConfigId('');
  }, [API, apiFetch, selectedConfigId]);

  const loadRuns = useCallback(async () => {
    const q = new URLSearchParams({ limit: '200' });
    if (selectedConfigId) q.set('config_id', String(selectedConfigId));
    const response = await apiFetch(`${API}/api/restore-drills/runs?${q.toString()}`);
    const payload = await response.json().catch(() => []);
    if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load restore drill runs'));
    setRuns(Array.isArray(payload) ? payload : []);
  }, [API, apiFetch, selectedConfigId]);

  const loadInsights = useCallback(async () => {
    const response = await apiFetch(`${API}/api/restore-drills/insights`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load restore drill insights'));
    setInsights(payload || {});
  }, [API, apiFetch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadConfigs(), loadRuns(), loadInsights()]);
    } catch (err) {
      setError(err.message || 'Failed to load restore drill data');
    } finally {
      setLoading(false);
    }
  }, [loadConfigs, loadInsights, loadRuns]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useInterval(() => {
    loadRuns();
    loadInsights();
  }, 5000);

  const toQueue = (queueJob) => {
    const jobId = String(queueJob?.id || '').trim();
    if (!jobId) return;
    window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId } }));
  };

  const launchDrill = async () => {
    if (!selectedConfigId) return;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch(`${API}/api/restore-drills/run`, {
        method: 'POST',
        body: JSON.stringify({
          config_id: Number(selectedConfigId),
          backup_log_id: form.backup_log_id ? Number(form.backup_log_id) : undefined,
          target_path: form.target_path || undefined,
          target_rto_minutes: form.target_rto_minutes ? Number(form.target_rto_minutes) : undefined,
          target_rpo_minutes: form.target_rpo_minutes ? Number(form.target_rpo_minutes) : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Restore drill launch failed'));
      setMessage(`Restore drill queued for ${selectedConfig?.name || 'config'} (run ${payload?.run?.id || '-'})`);
      if (toast) toast(`Restore drill queued (${payload?.job?.id || 'job'})`, 'success');
      toQueue(payload?.job);
      await loadRuns();
      await loadInsights();
    } catch (err) {
      setError(err.message || 'Restore drill launch failed');
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success') return 'badge-success';
    if (s === 'failed') return 'badge-danger';
    if (s === 'running') return 'badge-info';
    if (s === 'pending') return 'badge-warning';
    return 'badge-secondary';
  };

  return (
    <div>
      <div className="card highlight-card">
        <h3>Restore Drills + SLA Linkage</h3>
        <p>Run restore drills from backup policies, capture RTO/RPO metrics, and track SLA pass/fail over time.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="stat-info"><span className="stat-number">{insights?.total_runs || 0}</span><span className="stat-label">Total Drills</span></div></div>
        <div className="stat-card success"><div className="stat-info"><span className="stat-number">{insights?.successful_runs || 0}</span><span className="stat-label">Successful</span></div></div>
        <div className="stat-card danger"><div className="stat-info"><span className="stat-number">{insights?.failed_runs || 0}</span><span className="stat-label">Failed</span></div></div>
        <div className="stat-card info"><div className="stat-info"><span className="stat-number">{insights?.sla_ok || 0}</span><span className="stat-label">SLA OK</span></div></div>
        <div className="stat-card warning"><div className="stat-info"><span className="stat-number">{insights?.sla_breach || 0}</span><span className="stat-label">SLA Breach</span></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Launch Restore Drill</h3>
          <button className="btn btn-sm" onClick={loadAll} disabled={loading || actionLoading}>Refresh</button>
        </div>
        {error && <div className="ops-command-card" style={{ marginBottom: 10 }}>{error}</div>}
        {message && <div className="ops-command-card" style={{ marginBottom: 10 }}>{message}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select className="input" value={selectedConfigId} onChange={(e) => setSelectedConfigId(e.target.value)}>
            <option value="">Select backup config</option>
            {configs.map((config) => (
              <option key={config.id} value={config.id}>{config.name} — {config.hostname} ({config.ip})</option>
            ))}
          </select>
          <input className="input" placeholder="Backup log id (optional, latest if empty)" value={form.backup_log_id} onChange={(e) => setForm((f) => ({ ...f, backup_log_id: e.target.value }))} />
          <input className="input" placeholder="Target restore path (optional)" value={form.target_path} onChange={(e) => setForm((f) => ({ ...f, target_path: e.target.value }))} />
          <input className="input" type="number" min="1" placeholder="Target RTO minutes" value={form.target_rto_minutes} onChange={(e) => setForm((f) => ({ ...f, target_rto_minutes: e.target.value }))} />
          <input className="input" type="number" min="1" placeholder="Target RPO minutes" value={form.target_rpo_minutes} onChange={(e) => setForm((f) => ({ ...f, target_rpo_minutes: e.target.value }))} />
          <button className="btn btn-primary" onClick={launchDrill} disabled={loading || actionLoading || !selectedConfigId}>Queue Restore Drill</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Restore Drill Runs</h3>
          <div className="ops-subtle">Average RTO: {insights?.avg_rto_seconds || 0}s · Average RPO: {insights?.avg_rpo_minutes || 0}m</div>
        </div>
        <table className="table">
          <thead><tr><th>ID</th><th>Status</th><th>Config</th><th>RTO (s)</th><th>RPO (m)</th><th>SLA</th><th>Queue Job</th><th>Created</th></tr></thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.id}</td>
                <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                <td>{run.config_id}</td>
                <td>{run.actual_rto_seconds != null ? Number(run.actual_rto_seconds).toFixed(2) : '-'}</td>
                <td>{run.actual_rpo_minutes != null ? Number(run.actual_rpo_minutes).toFixed(2) : '-'}</td>
                <td><span className={`badge ${run.within_sla === true ? 'badge-success' : run.within_sla === false ? 'badge-danger' : 'badge-secondary'}`}>{run.within_sla === true ? 'pass' : run.within_sla === false ? 'breach' : 'pending'}</span></td>
                <td>{run.queue_job_id || '-'}</td>
                <td>{run.created_at ? new Date(run.created_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {!runs.length && (
              <tr><td colSpan={8} className="text-muted">{loading ? 'Loading runs...' : 'No restore drill runs yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
