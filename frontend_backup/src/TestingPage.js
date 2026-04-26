import React, { useEffect, useMemo, useState } from 'react';

function statusTone(status) {
  if (status === 'passed') return 'success';
  if (status === 'running' || status === 'queued') return 'info';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function prettyStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(value) {
  if (value === null || value === undefined) return '-';
  if (value < 60) return `${value.toFixed ? value.toFixed(1) : value}s`;
  const mins = Math.floor(value / 60);
  const secs = Math.round(value % 60);
  return `${mins}m ${secs}s`;
}

export default function TestingPage({ apiBase, apiFetch, toast }) {
  const [overview, setOverview] = useState(null);
  const [testingConfig, setTestingConfig] = useState({
    external_frontend_url: '',
    external_frontend_expect_text: '',
    external_frontend_expect_status: '',
    external_frontend_paths: '',
    external_backend_url: '',
    external_backend_health_path: '',
    external_backend_expect_field: '',
    external_backend_expect_value: '',
    external_backend_expect_status: '',
    external_timeout_seconds: '',
  });
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyTarget, setBusyTarget] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = async (keepSelection = true) => {
    try {
      const response = await apiFetch(`${apiBase}/api/testing/overview`);
      const data = await response.json();
      setOverview(data);
      setTestingConfig(prev => ({
        ...prev,
        ...(data?.environment?.testing_config || {}),
      }));
      setError('');
      if (!keepSelection) return;
      const preferredRunId = selectedRunId || data.active_run?.run_id || data.recent_runs?.[0]?.run_id || null;
      if (preferredRunId) {
        setSelectedRunId(preferredRunId);
      }
    } catch (err) {
      setError('Failed to load testing overview.');
    } finally {
      setLoading(false);
    }
  };

  const loadRun = async (runId) => {
    if (!runId) {
      setSelectedRun(null);
      return;
    }
    try {
      const response = await apiFetch(`${apiBase}/api/testing/runs/${runId}`);
      const data = await response.json();
      setSelectedRun(data);
    } catch (err) {
      setSelectedRun(null);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadRun(selectedRunId);
  }, [selectedRunId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOverview();
      if (selectedRunId) loadRun(selectedRunId);
    }, overview?.active_run ? 5000 : 12000);
    return () => clearInterval(interval);
  }, [overview?.active_run, selectedRunId]);

  const recentRuns = overview?.recent_runs || [];
  const activeRun = overview?.active_run || null;
  const targets = overview?.targets || [];

  const latestByTarget = useMemo(() => {
    const map = {};
    for (const run of recentRuns) {
      if (!map[run.target]) map[run.target] = run;
    }
    return map;
  }, [recentRuns]);

  const startRun = async (target) => {
    try {
      setBusyTarget(target);
      const response = await apiFetch(`${apiBase}/api/testing/run`, {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start test run');
      }
      setSelectedRunId(data.run_id);
      await loadOverview(false);
      await loadRun(data.run_id);
      setOverview(prev => prev ? { ...prev, active_run: data, recent_runs: [data, ...(prev.recent_runs || []).filter(r => r.run_id !== data.run_id)] } : prev);
      if (data?.queue_job?.id) {
        window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: data.queue_job.id } }));
      }
      if (toast) toast(`${data.label} started`, 'success');
    } catch (err) {
      setError(err.message || 'Failed to start test run.');
      if (toast) toast(err.message || 'Failed to start test run.', 'danger');
    } finally {
      setBusyTarget('');
    }
  };

  const saveConfig = async () => {
    try {
      setSavingConfig(true);
      const response = await apiFetch(`${apiBase}/api/testing/config`, {
        method: 'PUT',
        body: JSON.stringify(testingConfig),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save testing configuration');
      }
      setTestingConfig(prev => ({ ...prev, ...(data?.config || {}) }));
      await loadOverview(false);
      if (toast) toast('Testing target configuration saved', 'success');
    } catch (err) {
      setError(err.message || 'Failed to save configuration.');
      if (toast) toast(err.message || 'Failed to save configuration.', 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div>
      <div className="card highlight-card">
        <div className="card-header">
          <div>
            <h3 style={{ marginBottom: 6 }}>Testing Center</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>
              Run external frontend and backend checks for client systems with live logs, recent history, and report artifacts.
            </p>
          </div>
          <button className="btn btn-sm" onClick={() => { setLoading(true); loadOverview(); if (selectedRunId) loadRun(selectedRunId); }}>
            Refresh
          </button>
        </div>
        {overview?.environment?.external_frontend_target || overview?.environment?.external_backend_target ? (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', color: '#0f766e' }}>
            External targets configured:
            {overview?.environment?.external_frontend_target ? (
              <span> frontend <strong>{overview.environment.external_frontend_target}</strong></span>
            ) : null}
            {overview?.environment?.external_backend_target ? (
              <span> backend <strong>{overview.environment.external_backend_target}</strong></span>
            ) : null}
          </div>
        ) : (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#9a3412' }}>
            Configure target URLs on the server: <code>TESTING_EXTERNAL_FRONTEND_URL</code> and <code>TESTING_EXTERNAL_BACKEND_URL</code>. Optional assertions use <code>TESTING_EXTERNAL_FRONTEND_EXPECT_TEXT</code>, <code>TESTING_EXTERNAL_FRONTEND_PATHS</code>, <code>TESTING_EXTERNAL_BACKEND_EXPECT_FIELD</code>, and <code>TESTING_EXTERNAL_BACKEND_EXPECT_VALUE</code>.
          </div>
        )}
        {activeRun ? (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <strong>{activeRun.label}</strong> is running now.
            <span style={{ marginLeft: 8, color: '#64748b' }}>Started {formatTime(activeRun.started_at || activeRun.requested_at)}</span>
          </div>
        ) : (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            No active run. You can launch external frontend, backend, or full external suite checks.
          </div>
        )}
        {error && <p style={{ marginTop: 12, color: '#b91c1c', fontWeight: 600 }}>{error}</p>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>External Target Configuration</h3>
          <button className="btn btn-primary" disabled={savingConfig} onClick={saveConfig}>
            {savingConfig ? 'Saving...' : 'Save Targets'}
          </button>
        </div>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          Configure external URLs and assertions directly from dashboard.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Frontend URL</span>
            <input value={testingConfig.external_frontend_url || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_frontend_url: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Frontend Expected Text</span>
            <input value={testingConfig.external_frontend_expect_text || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_frontend_expect_text: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Frontend Expected Status</span>
            <input value={testingConfig.external_frontend_expect_status || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_frontend_expect_status: e.target.value }))} placeholder="200,301,302" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Frontend Paths</span>
            <input value={testingConfig.external_frontend_paths || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_frontend_paths: e.target.value }))} placeholder="/,/login,/dashboard" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Backend URL</span>
            <input value={testingConfig.external_backend_url || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_backend_url: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Backend Health Path</span>
            <input value={testingConfig.external_backend_health_path || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_backend_health_path: e.target.value }))} placeholder="/health" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Backend Field Name</span>
            <input value={testingConfig.external_backend_expect_field || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_backend_expect_field: e.target.value }))} placeholder="status" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Backend Field Value</span>
            <input value={testingConfig.external_backend_expect_value || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_backend_expect_value: e.target.value }))} placeholder="ok" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Backend Expected Status</span>
            <input value={testingConfig.external_backend_expect_status || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_backend_expect_status: e.target.value }))} placeholder="200,204" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Timeout Seconds</span>
            <input value={testingConfig.external_timeout_seconds || ''} onChange={(e) => setTestingConfig(prev => ({ ...prev, external_timeout_seconds: e.target.value }))} placeholder="20" />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        {targets.map((target) => {
          const lastRun = latestByTarget[target.key];
          const blocked = Boolean(activeRun);
          return (
            <div className="card" key={target.key} style={{ marginBottom: 0 }}>
              <div className="card-header">
                <h3>{target.label}</h3>
                <span className={`badge badge-${target.available ? 'success' : 'warning'}`}>
                  {target.available ? 'Ready' : 'Needs Setup'}
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, minHeight: 38 }}>{target.description}</p>
              {target.notes?.length ? (
                <div style={{ margin: '10px 0', padding: 10, borderRadius: 8, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: 12 }}>
                  {target.notes.join(' ')}
                </div>
              ) : null}
              <div style={{ margin: '12px 0', fontSize: 12, color: '#64748b' }}>
                <div>Last run: <strong style={{ color: '#0f172a' }}>{lastRun ? formatTime(lastRun.requested_at) : 'Never'}</strong></div>
                <div>Status: <span className={`badge badge-${statusTone(lastRun?.status)}`} style={{ marginLeft: 6 }}>{prettyStatus(lastRun?.status || 'idle')}</span></div>
              </div>
              <button
                className="btn btn-primary"
                disabled={blocked || busyTarget === target.key || !target.available}
                onClick={() => startRun(target.key)}
                style={{ width: '100%' }}
              >
                {busyTarget === target.key ? 'Starting...' : blocked ? 'Another run is active' : `Run ${target.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 16, marginTop: 20 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Recent Runs</h3>
          {loading ? <p style={{ color: '#64748b' }}>Loading test history...</p> : null}
          {!loading && recentRuns.length === 0 ? <p style={{ color: '#64748b' }}>No test runs yet.</p> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentRuns.map((run) => (
              <button
                key={run.run_id}
                className="btn"
                onClick={() => setSelectedRunId(run.run_id)}
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  background: selectedRunId === run.run_id ? '#dbeafe' : '#f8fafc',
                  color: '#0f172a',
                  border: selectedRunId === run.run_id ? '1px solid #60a5fa' : '1px solid #e2e8f0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{run.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{formatTime(run.requested_at)}</div>
                  <div style={{ marginTop: 6 }}>
                    <span className={`badge badge-${statusTone(run.status)}`}>{prettyStatus(run.status)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <h3>Run Details</h3>
          {!selectedRun ? (
            <p style={{ color: '#64748b' }}>Pick a run to inspect logs, duration, and generated artifacts.</p>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span className={`badge badge-${statusTone(selectedRun.status)}`}>{prettyStatus(selectedRun.status)}</span>
                <span className="badge badge-info">{selectedRun.label}</span>
                <span className="badge badge-warning">By {selectedRun.requested_by || 'system'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 16 }}>
                <div className="mini-stat">
                  <span className="stat-label">Requested</span>
                  <span style={{ fontWeight: 700, marginTop: 6 }}>{formatTime(selectedRun.requested_at)}</span>
                </div>
                <div className="mini-stat">
                  <span className="stat-label">Started</span>
                  <span style={{ fontWeight: 700, marginTop: 6 }}>{formatTime(selectedRun.started_at)}</span>
                </div>
                <div className="mini-stat">
                  <span className="stat-label">Duration</span>
                  <span style={{ fontWeight: 700, marginTop: 6 }}>{formatDuration(selectedRun.duration_seconds)}</span>
                </div>
                <div className="mini-stat">
                  <span className="stat-label">Return Code</span>
                  <span style={{ fontWeight: 700, marginTop: 6 }}>{selectedRun.return_code ?? '-'}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Artifacts</h3>
                {selectedRun.artifacts?.length ? (
                  <ul style={{ marginTop: 0 }}>
                    {selectedRun.artifacts.map((artifact) => (
                      <li key={artifact}><code>{artifact}</code></li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#64748b' }}>No artifact paths recorded for this run yet.</p>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Live Log Tail</h3>
                <pre className="code-block" style={{ maxHeight: 420, overflow: 'auto' }}>
                  {selectedRun.log_tail || 'No log output yet.'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
