import React, { useCallback, useEffect, useMemo, useState } from 'react';

const defaultRings = [
  { name: 'canary', batch_percent: 5, wait_seconds: 60 },
  { name: 'pilot', batch_percent: 20, wait_seconds: 120 },
  { name: 'broad', batch_percent: 100, wait_seconds: 0 },
];

export default function RingRolloutPage({ API, apiFetch, useInterval, toast }) {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    target_os_family: 'linux',
    is_enabled: true,
    ringsText: JSON.stringify(defaultRings, null, 2),
    guardrailsText: JSON.stringify({
      maintenance: { require_window: true },
      health: { require_online: true, min_compliance_score: 60, max_cve_count: 500 },
      rollback: { max_failed_percent: 25 },
    }, null, 2),
    rolloutConfigText: '{}',
  });
  const [launchForm, setLaunchForm] = useState({
    action: 'upgrade',
    dry_run: true,
    packagesText: '[]',
    holdPackagesText: '[]',
  });

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.id === selectedPolicyId) || null,
    [policies, selectedPolicyId],
  );
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId],
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

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/ring-rollout/policies`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load rollout policies'));
      const rows = Array.isArray(payload) ? payload : [];
      setPolicies(rows);
      if (rows.length && !rows.find((p) => p.id === selectedPolicyId)) setSelectedPolicyId(rows[0].id);
      if (!rows.length) setSelectedPolicyId(null);
    } catch (err) {
      setError(err.message || 'Failed to load rollout policies');
    } finally {
      setLoading(false);
    }
  }, [API, apiFetch, selectedPolicyId]);

  const loadRuns = useCallback(async () => {
    if (!selectedPolicyId) {
      setRuns([]);
      return;
    }
    try {
      const response = await apiFetch(`${API}/api/ring-rollout/policies/${selectedPolicyId}/runs?limit=200`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load rollout runs'));
      const rows = Array.isArray(payload) ? payload : [];
      setRuns(rows);
      if (rows.length && !rows.find((r) => r.id === selectedRunId)) setSelectedRunId(rows[0].id);
      if (!rows.length) setSelectedRunId(null);
    } catch (err) {
      setError(err.message || 'Failed to load rollout runs');
    }
  }, [API, apiFetch, selectedPolicyId, selectedRunId]);

  const loadAudit = useCallback(async () => {
    if (!selectedPolicyId) {
      setAuditLogs([]);
      return;
    }
    try {
      const response = await apiFetch(`${API}/api/ring-rollout/policies/${selectedPolicyId}/audit?limit=200`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load rollout audit logs'));
      setAuditLogs(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.message || 'Failed to load rollout audit logs');
    }
  }, [API, apiFetch, selectedPolicyId]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useInterval(() => {
    loadPolicies();
    loadRuns();
    loadAudit();
  }, 5000);

  const toQueue = (queueJob) => {
    const jobId = String(queueJob?.id || '').trim();
    if (!jobId) return;
    window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId } }));
  };

  const createPolicy = async () => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const rings = JSON.parse(form.ringsText || '[]');
      const guardrails = JSON.parse(form.guardrailsText || '{}');
      const rolloutConfig = JSON.parse(form.rolloutConfigText || '{}');
      const response = await apiFetch(`${API}/api/ring-rollout/policies`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          target_os_family: form.target_os_family,
          is_enabled: Boolean(form.is_enabled),
          rings,
          guardrails,
          rollout_config: rolloutConfig,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Create rollout policy failed'));
      setMessage(`Policy created: ${payload.name}`);
      setSelectedPolicyId(payload.id);
      await loadPolicies();
      await loadRuns();
      await loadAudit();
    } catch (err) {
      setError(err.message || 'Create rollout policy failed');
    } finally {
      setActionLoading(false);
    }
  };

  const launchPolicy = async () => {
    if (!selectedPolicy) return;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const packages = JSON.parse(launchForm.packagesText || '[]');
      const hold = JSON.parse(launchForm.holdPackagesText || '[]');
      const response = await apiFetch(`${API}/api/ring-rollout/policies/${selectedPolicy.id}/launch`, {
        method: 'POST',
        body: JSON.stringify({
          action: launchForm.action,
          dry_run: Boolean(launchForm.dry_run),
          packages: Array.isArray(packages) ? packages : [],
          hold_packages: Array.isArray(hold) ? hold : [],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Launch rollout failed'));
      setMessage(`Rollout queued for policy ${selectedPolicy.name}`);
      if (toast) toast(`Rollout queued (${payload?.job?.id || 'job'})`, 'success');
      toQueue(payload?.job);
      await loadRuns();
    } catch (err) {
      setError(err.message || 'Launch rollout failed');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePolicy = async (policy) => {
    setActionLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/ring-rollout/policies/${policy.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: !policy.is_enabled }),
      });
      if (!response.ok) throw new Error(await parseApiError(response, 'Policy update failed'));
      await loadPolicies();
      await loadRuns();
      await loadAudit();
    } catch (err) {
      setError(err.message || 'Policy update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const decideApproval = async (run, decision) => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch(`${API}/api/ring-rollout/runs/${run.id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ note: approvalNote }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, `${decision} failed`));
      setMessage(`Run ${run.id} ${decision}d.`);
      if (payload?.job?.id) {
        toQueue(payload.job);
      }
      setApprovalNote('');
      await loadRuns();
      await loadAudit();
    } catch (err) {
      setError(err.message || `${decision} failed`);
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
        <h3>Ring Rollout Policy Engine</h3>
        <p>Create canary/pilot/broad rollout policies, launch queued runs, and monitor rollout run progression with guardrail-ready data.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Create Rollout Policy</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" placeholder="Policy name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <select className="input" value={form.target_os_family} onChange={(e) => setForm((f) => ({ ...f, target_os_family: e.target.value }))}>
              <option value="linux">linux</option>
              <option value="windows">windows</option>
              <option value="any">any</option>
            </select>
            <textarea className="input" rows={6} placeholder="Rings JSON" value={form.ringsText} onChange={(e) => setForm((f) => ({ ...f, ringsText: e.target.value }))} />
            <textarea className="input" rows={3} placeholder="Guardrails JSON" value={form.guardrailsText} onChange={(e) => setForm((f) => ({ ...f, guardrailsText: e.target.value }))} />
            <div className="ops-subtle">Guardrails support maintenance.require_window, health(min_compliance_score/max_cve_count), rollback.max_failed_percent.</div>
            <textarea className="input" rows={3} placeholder="Rollout config JSON" value={form.rolloutConfigText} onChange={(e) => setForm((f) => ({ ...f, rolloutConfigText: e.target.value }))} />
            <label className="toggle-option"><input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))} /> Enabled</label>
            <button className="btn btn-primary" onClick={createPolicy} disabled={loading || actionLoading}>Create Policy</button>
          </div>
        </div>

        <div className="card">
          <h3>Launch Rollout</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select className="input" value={launchForm.action} onChange={(e) => setLaunchForm((f) => ({ ...f, action: e.target.value }))}>
              <option value="upgrade">upgrade</option>
              <option value="install">install</option>
              <option value="rollback">rollback</option>
            </select>
            <textarea className="input" rows={3} placeholder="Packages JSON array" value={launchForm.packagesText} onChange={(e) => setLaunchForm((f) => ({ ...f, packagesText: e.target.value }))} />
            <textarea className="input" rows={3} placeholder="Hold packages JSON array" value={launchForm.holdPackagesText} onChange={(e) => setLaunchForm((f) => ({ ...f, holdPackagesText: e.target.value }))} />
            <label className="toggle-option"><input type="checkbox" checked={launchForm.dry_run} onChange={(e) => setLaunchForm((f) => ({ ...f, dry_run: e.target.checked }))} /> Dry run</label>
            <button className="btn btn-success" onClick={launchPolicy} disabled={loading || actionLoading || !selectedPolicyId}>Launch Selected Policy</button>
            <div className="ops-subtle">{selectedPolicy ? `Selected policy: ${selectedPolicy.name}` : 'Select a policy from list to launch.'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Rollout Policies</h3>
          <button className="btn btn-sm" onClick={loadPolicies} disabled={loading || actionLoading}>Refresh</button>
        </div>
        {error && <div className="ops-command-card" style={{ marginBottom: 10 }}>{error}</div>}
        {message && <div className="ops-command-card" style={{ marginBottom: 10 }}>{message}</div>}
        <table className="table">
          <thead><tr><th>Name</th><th>OS</th><th>Status</th><th>Rings</th><th>Actions</th></tr></thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id} className={selectedPolicyId === policy.id ? 'row-selected' : ''}>
                <td><button className="btn btn-sm" onClick={() => setSelectedPolicyId(policy.id)}>{policy.name}</button></td>
                <td>{policy.target_os_family}</td>
                <td><span className={`badge ${policy.is_enabled ? 'badge-success' : 'badge-secondary'}`}>{policy.is_enabled ? 'enabled' : 'disabled'}</span></td>
                <td>{Array.isArray(policy.rings) ? policy.rings.length : 0}</td>
                <td><button className="btn btn-sm" onClick={() => togglePolicy(policy)} disabled={actionLoading}>{policy.is_enabled ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
            {!policies.length && (
              <tr><td colSpan={5} className="text-muted">{loading ? 'Loading policies...' : 'No rollout policies yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Rollout Runs {selectedPolicy ? `— ${selectedPolicy.name}` : ''}</h3>
          <button className="btn btn-sm" onClick={loadRuns} disabled={actionLoading || !selectedPolicyId}>Refresh Runs</button>
        </div>
        <table className="table">
          <thead><tr><th>ID</th><th>Status</th><th>Action</th><th>Dry Run</th><th>Queue Job</th><th>Created</th><th>Approval</th></tr></thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className={selectedRunId === run.id ? 'row-selected' : ''}>
                <td><button className="btn btn-sm" onClick={() => setSelectedRunId(run.id)}>{run.id}</button></td>
                <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                <td>{run.action}</td>
                <td>{run.dry_run ? 'yes' : 'no'}</td>
                <td>{run.queue_job_id || '-'}</td>
                <td>{run.created_at ? new Date(run.created_at).toLocaleString() : '-'}</td>
                <td>
                  {run?.summary?.awaiting_approval ? (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => decideApproval(run, 'approve')} disabled={actionLoading}>Approve</button>
                      <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }} onClick={() => decideApproval(run, 'reject')} disabled={actionLoading}>Reject</button>
                    </>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {!runs.length && (
              <tr><td colSpan={7} className="text-muted">{selectedPolicyId ? 'No runs yet.' : 'Select a policy to view runs.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Gate Decision Log {selectedRun ? `— Run ${selectedRun.id}` : ''}</h3>
        </div>
        <input className="input" placeholder="Approval note (used for approve/reject)" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} style={{ marginBottom: 10 }} />
        <table className="table">
          <thead><tr><th>Ring</th><th>Gate</th><th>Decision</th><th>Details</th><th>Time</th></tr></thead>
          <tbody>
            {(selectedRun?.summary?.gate_decisions || []).map((item, idx) => (
              <tr key={`gate-${idx}`}>
                <td>{item.ring_name || item.ring_index}</td>
                <td>{item.gate || '-'}</td>
                <td>{item.decision || '-'}</td>
                <td><code>{JSON.stringify(item.state || item.health_block_reasons || {})}</code></td>
                <td>{item.at ? new Date(item.at).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {!selectedRun?.summary?.gate_decisions?.length && (
              <tr><td colSpan={5} className="text-muted">{selectedRun ? 'No gate decisions recorded yet.' : 'Select a run to inspect decisions.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Policy Audit Trail</h3>
          <button className="btn btn-sm" onClick={loadAudit} disabled={!selectedPolicyId || actionLoading}>Refresh Audit</button>
        </div>
        <table className="table">
          <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {auditLogs.map((item) => (
              <tr key={`audit-${item.id}`}>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                <td>{item.action}</td>
                <td>{item.target_type}:{item.target_id}</td>
                <td><code>{JSON.stringify(item.details || {})}</code></td>
              </tr>
            ))}
            {!auditLogs.length && (
              <tr><td colSpan={4} className="text-muted">{selectedPolicyId ? 'No audit records yet.' : 'Select a policy to view audit trail.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
