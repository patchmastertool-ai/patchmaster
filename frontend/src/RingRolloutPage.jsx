import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Play, Trash2, GitBranch, ExternalLink } from 'lucide-react';

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

const runStatusColor = s => ({ success: CH.green, failed: CH.red, running: CH.accent, pending: CH.yellow, awaiting_approval: '#a78bfa' }[String(s).toLowerCase()] || CH.textSub);

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

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Staged Ring Deployment"
        title="Ring Rollout"
        subtitle={`${policies.length} policies · ${runs.filter(r => r.status === 'running').length} active rollouts`}
        actions={<CHBtn variant="ghost" onClick={() => { loadPolicies(); loadRuns(); loadAudit(); }}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></CHBtn>}
      />

      {notice.msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: notice.type === 'error' ? `${CH.red}12` : `${CH.green}12`, color: notice.type === 'error' ? CH.red : CH.green }}>
          {notice.msg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Policies"       value={policies.length}                                                    accent={CH.accent} />
        <CHStat label="Active Rollouts" value={runs.filter(r => r.status === 'running').length}  sub="in-flight" accent={CH.yellow} />
        <CHStat label="Awaiting Gate"   value={runs.filter(r => r.status === 'awaiting_approval').length}        accent="#a78bfa" />
        <CHStat label="Completed"       value={runs.filter(r => r.status === 'success').length}                  accent={CH.green} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'policies', l: `Policies (${policies.length})` },
          { k: 'runs',     l: `Runs (${runs.length})` },
          { k: 'audit',    l: `Audit (${auditLogs.length})` },
          { k: 'create',   l: '+ Create' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: tab === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', color: tab === t.k ? CH.accent : CH.textSub, border: `1px solid ${tab === t.k ? CH.accent + '40' : CH.border}` }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Policy list + Launch panel */}
      {tab === 'policies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard>
            <CHLabel>Policy Registry</CHLabel>
            <div className="mt-4 space-y-2">
              {policies.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No policies. Create one to get started.</p> : null}
              {policies.map(p => (
                <div key={p.id} className="p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setSelPol(p.id)}
                  style={{ background: p.id === selectedPolicyId ? `${CH.accent}12` : 'rgba(3,29,75,0.3)', border: `1px solid ${p.id === selectedPolicyId ? CH.accent + '40' : CH.border}` }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{p.name}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{p.target_os_family} · {p.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <CHBadge color={p.is_enabled ? CH.green : CH.textSub}>{p.is_enabled ? 'Enabled' : 'Disabled'}</CHBadge>
                    <CHBtn variant="ghost" onClick={e => { e.stopPropagation(); togglePolicy(p); }} disabled={actionLoading}>
                      {p.is_enabled ? 'Disable' : 'Enable'}
                    </CHBtn>
                  </div>
                </div>
              ))}
            </div>
          </CHCard>

          <CHCard className="flex flex-col gap-4">
            <CHLabel>Launch Rollout {selectedPolicy ? `— ${selectedPolicy.name}` : ''}</CHLabel>
            {!selectedPolicy ? (
              <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>Select a policy from the list to launch.</p>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <CHLabel>Action</CHLabel>
                  <select value={launchForm.action} onChange={e => setLaunchForm(f => ({ ...f, action: e.target.value }))}
                    className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                    {['upgrade', 'install', 'security_only'].map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <CHLabel>Packages JSON ([] = all)</CHLabel>
                  <input value={launchForm.packagesText} onChange={e => setLaunchForm(f => ({ ...f, packagesText: e.target.value }))}
                    className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={launchForm.dry_run} onChange={e => setLaunchForm(f => ({ ...f, dry_run: e.target.checked }))} />
                  <span className="text-xs" style={{ color: CH.textSub }}>Dry run (simulate only)</span>
                </div>
                <CHBtn variant="primary" onClick={launchPolicy} disabled={actionLoading}>
                  <Play size={14} /> Launch Ring Rollout
                </CHBtn>
              </>
            )}
          </CHCard>
        </div>
      )}

      {/* Runs */}
      {tab === 'runs' && (
        <CHCard>
          <CHLabel>Rollout Runs</CHLabel>
          <div className="mt-4 space-y-4">
            {runs.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No runs yet. Launch a rollout first.</p> : null}
            {runs.map(run => (
              <div key={run.id} className="p-4 rounded-xl"
                style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}`, borderLeft: `3px solid ${runStatusColor(run.status)}` }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: CH.text }}>Run #{run.id}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>
                      Ring: {run.current_ring_name || `Ring ${run.current_ring || 1}`} · {run.created_at ? new Date(run.created_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <CHBadge color={runStatusColor(run.status)}>{run.status}</CHBadge>
                </div>
                {run.status === 'awaiting_approval' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <input value={approvalNote} onChange={e => setApprovalNote(e.target.value)}
                      placeholder="Approval note (optional)"
                      className="flex-1 rounded-lg px-3 py-2 text-xs" style={inputStyle}
                    />
                    <CHBtn variant="primary" disabled={actionLoading} onClick={() => decide(run, 'approve')}>Approve Ring</CHBtn>
                    <CHBtn variant="danger" disabled={actionLoading} onClick={() => decide(run, 'reject')}>Reject</CHBtn>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CHCard>
      )}

      {/* Audit */}
      {tab === 'audit' && (
        <CHCard>
          <CHLabel>Policy Audit Log</CHLabel>
          <CHTable headers={['Action', 'Actor', 'Details', 'Time']} emptyMessage="No audit records." className="mt-4">
            {auditLogs.map(log => (
              <CHTR key={log.id}>
                <td className="px-6 py-4"><CHBadge color={CH.accent}>{log.action}</CHBadge></td>
                <td className="px-6 py-4 text-xs font-bold" style={{ color: CH.text }}>{log.actor || '—'}</td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{log.detail || '—'}</td>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>
                  {log.created_at ? new Date(log.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}

      {/* Create */}
      {tab === 'create' && (
        <CHCard className="space-y-4">
          <CHLabel>Create Ring Rollout Policy</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <CHLabel>Policy Name</CHLabel>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. April Security Patches" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Target OS Family</CHLabel>
              <select value={form.target_os_family} onChange={e => setForm(f => ({ ...f, target_os_family: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                {['linux', 'windows', 'all'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Description</CHLabel>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What this rollout policy does…" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Rings Config (JSON)</CHLabel>
              <textarea value={form.ringsText} onChange={e => setForm(f => ({ ...f, ringsText: e.target.value }))}
                rows={6} className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y"
                style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}`, color: CH.text, lineHeight: 1.6 }} />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Guardrails (JSON)</CHLabel>
              <textarea value={form.guardrailsText} onChange={e => setForm(f => ({ ...f, guardrailsText: e.target.value }))}
                rows={6} className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y"
                style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}`, color: CH.text, lineHeight: 1.6 }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))} />
            <span className="text-xs" style={{ color: CH.textSub }}>Enable immediately after creation</span>
          </div>
          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={createPolicy} disabled={actionLoading}>{actionLoading ? 'Creating…' : 'Create Policy'}</CHBtn>
            <CHBtn variant="ghost" onClick={() => setTab('policies')}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}
    </CHPage>
  );
}
