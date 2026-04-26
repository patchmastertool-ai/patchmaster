import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  StitchPageHeader,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchTable,
  StitchBadge,
  StitchSummaryCard,
  StitchMetricGrid
} from './components/StitchComponents';

const DEFAULT_RINGS = JSON.stringify([
  { name: 'canary', batch_percent: 5,   wait_seconds: 60 },
  { name: 'pilot',  batch_percent: 20,  wait_seconds: 120 },
  { name: 'broad',  batch_percent: 100, wait_seconds: 0 },
], null, 2);

const DEFAULT_GUARDRAILS = JSON.stringify({
  maintenance: { require_window: true },
  health:      { require_online: true, min_compliance_score: 60, max_cve_count: 500 },
  rollback:    { max_failed_percent: 25 },
}, null, 2);

const runStatusColor = s => {
  const statusMap = {
    success: 'success',
    failed: 'error',
    running: 'info',
    pending: 'warning',
    awaiting_approval: 'pending'
  };
  return statusMap[String(s).toLowerCase()] || 'info';
};

export default function RingRolloutPage({ API, apiFetch, useInterval, toast }) {
  const [policies, setPolicies]         = useState([]);
  const [selectedPolicyId, setSelPol]   = useState(null);
  const [runs, setRuns]                 = useState([]);
  const [auditLogs, setAuditLogs]       = useState([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActing]      = useState(false);
  const [notice, setNotice]             = useState({ msg: '', type: 'info' });
  const [tab, setTab]                   = useState('policies');
  const [form, setForm]                 = useState({
    name: '', description: '', target_os_family: 'linux', is_enabled: true,
    ringsText: DEFAULT_RINGS, guardrailsText: DEFAULT_GUARDRAILS, rolloutConfigText: '{}',
  });
  const [launchForm, setLaunchForm]     = useState({ action: 'upgrade', dry_run: true, packagesText: '[]', holdPackagesText: '[]' });

  // Layout state
  const [currentPage, setCurrentPage] = useState('ring-rollout');
  const [user] = useState({ name: 'Admin', role: 'Administrator' });
  const [licenseInfo] = useState({ tier: 'Enterprise', active: true });

  const selectedPolicy = policies.find(p => p.id === selectedPolicyId) || null;

  const parseErr = async (r, fb) => {
    let d = '';
    try { const p = await r.clone().json(); d = p?.error?.message || p?.detail || p?.message || ''; } catch {}
    return d ? `${fb}: ${d}` : `${fb} (${r.status})`;
  };

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/api/ring-rollout/policies`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(await parseErr(r, 'Failed to load policies'));
      const rows = Array.isArray(d) ? d : [];
      setPolicies(rows);
      if (rows.length && !rows.find(p => p.id === selectedPolicyId)) setSelPol(rows[0].id);
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setLoading(false);
  }, [API, apiFetch, selectedPolicyId]);

  const loadRuns = useCallback(async () => {
    if (!selectedPolicyId) { setRuns([]); return; }
    try {
      const r = await apiFetch(`${API}/api/ring-rollout/policies/${selectedPolicyId}/runs?limit=200`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(await parseErr(r, 'Failed to load runs'));
      setRuns(Array.isArray(d) ? d : []);
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
  }, [API, apiFetch, selectedPolicyId]);

  const loadAudit = useCallback(async () => {
    if (!selectedPolicyId) { setAuditLogs([]); return; }
    try {
      const r = await apiFetch(`${API}/api/ring-rollout/policies/${selectedPolicyId}/audit?limit=200`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(await parseErr(r, 'Failed to load audit'));
      setAuditLogs(Array.isArray(d) ? d : []);
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
  }, [API, apiFetch, selectedPolicyId]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);
  useEffect(() => { loadRuns(); loadAudit(); }, [loadRuns, loadAudit]);
  if (useInterval) useInterval(() => { loadPolicies(); loadRuns(); loadAudit(); }, 5000);

  const toQueue = job => { const id = String(job?.id || '').trim(); if (id) window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: id } })); };

  const createPolicy = async () => {
    setActing(true);
    try {
      const rings = JSON.parse(form.ringsText || '[]');
      const guardrails = JSON.parse(form.guardrailsText || '{}');
      const rolloutConfig = JSON.parse(form.rolloutConfigText || '{}');
      const r = await apiFetch(`${API}/api/ring-rollout/policies`, { method: 'POST', body: JSON.stringify({ name: form.name.trim(), description: form.description, target_os_family: form.target_os_family, is_enabled: Boolean(form.is_enabled), rings, guardrails, rollout_config: rolloutConfig }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Create failed'));
      setNotice({ msg: `Policy created: ${d.name}`, type: 'success' }); setSelPol(d.id); await loadPolicies(); await loadRuns(); setTab('policies');
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setActing(false);
  };

  const launchPolicy = async () => {
    if (!selectedPolicy) return;
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/ring-rollout/policies/${selectedPolicy.id}/launch`, { method: 'POST', body: JSON.stringify({ action: launchForm.action, dry_run: Boolean(launchForm.dry_run), packages: JSON.parse(launchForm.packagesText || '[]'), hold_packages: JSON.parse(launchForm.holdPackagesText || '[]') }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Launch failed'));
      setNotice({ msg: `Rollout queued for ${selectedPolicy.name}`, type: 'success' });
      if (toast) toast(`Rollout queued`, 'success');
      toQueue(d?.job); await loadRuns();
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setActing(false);
  };

  const togglePolicy = async policy => {
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/ring-rollout/policies/${policy.id}`, { method: 'PUT', body: JSON.stringify({ is_enabled: !policy.is_enabled }) });
      if (!r.ok) throw new Error(await parseErr(r, 'Update failed'));
      await loadPolicies(); await loadRuns(); await loadAudit();
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setActing(false);
  };

  const decide = async (run, decision) => {
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/ring-rollout/runs/${run.id}/${decision}`, { method: 'POST', body: JSON.stringify({ note: approvalNote }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, `${decision} failed`));
      setNotice({ msg: `Run ${run.id} ${decision}d`, type: 'success' });
      if (d?.job?.id) toQueue(d.job);
      setApprovalNote(''); await loadRuns(); await loadAudit();
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setActing(false);
  };

  return (
    <div className="min-h-screen bg-[#05183c] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <StitchPageHeader
          kicker="Staged Ring Deployment"
          title="Ring Rollout"
          description="Manage staged rollout policies with ring-based deployment and approval gates."
          actions={
            <StitchButton
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => { loadPolicies(); loadRuns(); loadAudit(); }}
              disabled={loading}
            >
              Refresh
            </StitchButton>
          }
        />

        {/* Notice */}
        {notice.msg && (
          <div className={`rounded-xl px-5 py-3 text-sm font-bold mb-6 ${
            notice.type === 'error' 
              ? 'bg-[#ee7d77]/10 text-[#ee7d77]' 
              : 'bg-[#7bd0ff]/10 text-[#7bd0ff]'
          }`}>
            {notice.msg}
          </div>
        )}

        {/* KPI Cards */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Policies"
            value={policies.length}
            icon="policy"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Active Rollouts"
            value={runs.filter(r => r.status === 'running').length}
            subtitle="in-flight"
            icon="deployed_code"
            color="#ffd16f"
          />
          <StitchSummaryCard
            label="Awaiting Gate"
            value={runs.filter(r => r.status === 'awaiting_approval').length}
            subtitle="pending"
            icon="approval"
            color="#ee7d77"
          />
          <StitchSummaryCard
            label="Completed"
            value={runs.filter(r => r.status === 'success').length}
            subtitle="successful"
            icon="check_circle"
            color="#10b981"
          />
        </StitchMetricGrid>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { k: 'policies', l: `Policies (${policies.length})` },
            { k: 'runs',     l: `Runs (${runs.length})` },
            { k: 'audit',    l: `Audit (${auditLogs.length})` },
            { k: 'create',   l: '+ Create' },
          ].map(t => (
            <StitchButton
              key={t.k}
              variant={tab === t.k ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTab(t.k)}
            >
              {t.l}
            </StitchButton>
          ))}
        </div>

        {/* Policy list + Launch panel */}
        {tab === 'policies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">Policy Registry</p>
              <div className="space-y-2">
                {policies.length === 0 ? (
                  <p className="text-sm py-4 text-center text-[#91aaeb]">No policies. Create one to get started.</p>
                ) : null}
                {policies.map(p => (
                  <div 
                    key={p.id} 
                    className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all border ${
                      p.id === selectedPolicyId 
                        ? 'bg-[#7bd0ff]/10 border-[#7bd0ff]/40' 
                        : 'bg-[#031d4b]/30 border-[#2b4680]'
                    }`}
                    onClick={() => setSelPol(p.id)}
                  >
                    <div>
                      <p className="text-sm font-bold text-[#dee5ff]">{p.name}</p>
                      <p className="text-xs text-[#91aaeb]">{p.target_os_family} · {p.description || 'No description'}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <StitchBadge variant={p.is_enabled ? 'success' : 'info'}>
                        {p.is_enabled ? 'Enabled' : 'Disabled'}
                      </StitchBadge>
                      <StitchButton 
                        variant="tertiary"
                        size="sm"
                        onClick={e => { e.stopPropagation(); togglePolicy(p); }} 
                        disabled={actionLoading}
                      >
                        {p.is_enabled ? 'Disable' : 'Enable'}
                      </StitchButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#06122d] p-6 rounded-xl flex flex-col gap-4 border border-[#2b4680]/20">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">
                Launch Rollout {selectedPolicy ? `— ${selectedPolicy.name}` : ''}
              </p>
              {!selectedPolicy ? (
                <p className="text-sm py-4 text-center text-[#91aaeb]">Select a policy from the list to launch.</p>
              ) : (
                <>
                  <StitchFormField label="Action">
                    <StitchSelect
                      value={launchForm.action}
                      onChange={(e) => setLaunchForm(f => ({ ...f, action: e.target.value }))}
                      options={['upgrade', 'install', 'security_only'].map(a => ({ value: a, label: a }))}
                    />
                  </StitchFormField>
                  <StitchFormField label="Packages JSON ([] = all)">
                    <StitchInput
                      value={launchForm.packagesText}
                      onChange={(e) => setLaunchForm(f => ({ ...f, packagesText: e.target.value }))}
                      placeholder="[]"
                    />
                  </StitchFormField>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={launchForm.dry_run} 
                      onChange={e => setLaunchForm(f => ({ ...f, dry_run: e.target.checked }))} 
                      className="w-4 h-4 rounded border-[#2b4680] bg-[#05183c] text-[#7bd0ff] focus:ring-[#7bd0ff]"
                    />
                    <span className="text-xs text-[#91aaeb]">Dry run (simulate only)</span>
                  </div>
                  <StitchButton 
                    variant="primary"
                    icon="play_arrow"
                    onClick={launchPolicy} 
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Launching…' : 'Launch Ring Rollout'}
                  </StitchButton>
                </>
              )}
            </div>
          </div>
        )}

        {/* Runs */}
        {tab === 'runs' && (
          <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">Rollout Runs</p>
            <div className="space-y-4">
              {runs.length === 0 ? (
                <p className="text-sm py-4 text-center text-[#91aaeb]">No runs yet. Launch a rollout first.</p>
              ) : null}
              {runs.map(run => {
                const statusType = runStatusColor(run.status);
                const borderColors = {
                  success: '#7bd0ff',
                  error: '#ee7d77',
                  info: '#7bd0ff',
                  warning: '#ffd16f',
                  pending: '#5b74b1'
                };
                return (
                  <div 
                    key={run.id} 
                    className="p-4 rounded-xl bg-[#031d4b]/40 border border-[#2b4680]"
                    style={{ borderLeft: `3px solid ${borderColors[statusType]}` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-bold text-[#dee5ff]">Run #{run.id}</p>
                        <p className="text-xs text-[#91aaeb]">
                          Ring: {run.current_ring_name || `Ring ${run.current_ring || 1}`} · {run.created_at ? new Date(run.created_at).toLocaleString() : '—'}
                        </p>
                      </div>
                      <StitchBadge 
                        variant={statusType === 'success' ? 'success' : statusType === 'error' ? 'error' : statusType === 'warning' ? 'warning' : 'info'}
                      >
                        {run.status}
                      </StitchBadge>
                    </div>
                    {run.status === 'awaiting_approval' && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <input 
                          value={approvalNote} 
                          onChange={e => setApprovalNote(e.target.value)}
                          placeholder="Approval note (optional)"
                          className="flex-1 rounded-lg px-3 py-2 text-xs bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none"
                        />
                        <StitchButton 
                          variant="primary"
                          size="sm"
                          disabled={actionLoading} 
                          onClick={() => decide(run, 'approve')}
                        >
                          Approve Ring
                        </StitchButton>
                        <StitchButton 
                          variant="danger"
                          size="sm"
                          disabled={actionLoading} 
                          onClick={() => decide(run, 'reject')}
                        >
                          Reject
                        </StitchButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Audit */}
        {tab === 'audit' && (
          <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">Policy Audit Log</p>
            <StitchTable
              columns={[
                { key: 'action', header: 'Action', render: (row) => <StitchBadge variant="info">{row.action}</StitchBadge> },
                { key: 'actor', header: 'Actor', render: (row) => <span className="text-xs font-bold text-[#dee5ff]">{row.actor || '—'}</span> },
                { key: 'detail', header: 'Details', render: (row) => <span className="text-xs text-[#91aaeb]">{row.detail || '—'}</span> },
                { 
                  key: 'created_at', 
                  header: 'Time', 
                  render: (row) => (
                    <span className="font-mono text-xs text-[#91aaeb]">
                      {row.created_at ? new Date(row.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  )
                },
              ]}
              data={auditLogs}
            />
          </div>
        )}

        {/* Create */}
        {tab === 'create' && (
          <div className="bg-[#06122d] p-6 rounded-xl space-y-4 border border-[#2b4680]/20">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Create Ring Rollout Policy</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StitchFormField label="Policy Name">
                <StitchInput
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. April Security Patches"
                />
              </StitchFormField>
              <StitchFormField label="Target OS Family">
                <StitchSelect
                  value={form.target_os_family}
                  onChange={(e) => setForm(f => ({ ...f, target_os_family: e.target.value }))}
                  options={['linux', 'windows', 'all'].map(o => ({ value: o, label: o }))}
                />
              </StitchFormField>
              <div className="md:col-span-2">
                <StitchFormField label="Description">
                  <StitchInput
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What this rollout policy does…"
                  />
                </StitchFormField>
              </div>
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">Rings Config (JSON)</label>
                <textarea 
                  value={form.ringsText} 
                  onChange={(e) => setForm(f => ({ ...f, ringsText: e.target.value }))}
                  rows={6} 
                  className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y bg-[#000000] border border-[#2b4680] text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none"
                  style={{ lineHeight: 1.6 }}
                />
              </div>
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">Guardrails (JSON)</label>
                <textarea 
                  value={form.guardrailsText} 
                  onChange={(e) => setForm(f => ({ ...f, guardrailsText: e.target.value }))}
                  rows={6} 
                  className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y bg-[#000000] border border-[#2b4680] text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none"
                  style={{ lineHeight: 1.6 }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={form.is_enabled} 
                onChange={(e) => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-[#2b4680] bg-[#05183c] text-[#7bd0ff] focus:ring-[#7bd0ff]"
              />
              <span className="text-xs text-[#91aaeb]">Enable immediately after creation</span>
            </div>
            <div className="flex gap-3">
              <StitchButton 
                variant="primary"
                icon="add"
                onClick={createPolicy} 
                disabled={actionLoading}
              >
                {actionLoading ? 'Creating…' : 'Create Policy'}
              </StitchButton>
              <StitchButton 
                variant="secondary"
                onClick={() => setTab('policies')}
              >
                Cancel
              </StitchButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
