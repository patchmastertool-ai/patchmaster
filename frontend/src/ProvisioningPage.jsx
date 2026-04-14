import React, { useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Play, Image } from 'lucide-react';

function formatBytes(v) {
  const n = Number(v || 0);
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
function osFamily(host) {
  const v = String(host?.os || '').toLowerCase();
  if (v.includes('win')) return 'windows';
  if (v) return 'linux';
  return 'unknown';
}
const statusColor = s => ({ success: CH.green, partial_success: CH.yellow, failed: CH.red, running: CH.accent, queued: CH.accent }[String(s).toLowerCase()] || CH.textSub);

export default function ProvisioningPage({ hosts, API, apiFetch, useInterval }) {
  const [templates, setTemplates]           = useState([]);
  const [runs, setRuns]                     = useState([]);
  const [sourceHostId, setSourceHostId]     = useState('');
  const [sourceSnapshots, setSourceSnaps]   = useState([]);
  const [loadingSnaps, setLoadingSnaps]     = useState(false);
  const [captureForm, setCaptureForm]       = useState({ name: '', snapshot_name: '', description: '', labels: '', site_scope: '' });
  const [selectedTemplateId, setSelTemplate] = useState('');
  const [selectedTargetIds, setSelTargets]  = useState([]);
  const [allowCrossSite, setCrossSite]      = useState(false);
  const [busy, setBusy]                     = useState(false);
  const [notice, setNotice]                 = useState({ msg: '', ok: true });

  const orderedHosts    = useMemo(() => [...hosts].sort((a, b) => String(a.hostname || '').localeCompare(String(b.hostname || ''))), [hosts]);
  const selectedSrcHost = useMemo(() => hosts.find(h => String(h.id) === String(sourceHostId)), [hosts, sourceHostId]);
  const selectedTemplate = useMemo(() => templates.find(t => String(t.id) === String(selectedTemplateId)), [templates, selectedTemplateId]);

  const matchingTargets = useMemo(() => {
    if (!selectedTemplate) return hosts;
    return hosts.filter(h => {
      if (selectedTemplate.source_host?.id && h.id === selectedTemplate.source_host.id) return false;
      const familyOk = !selectedTemplate.os_family || selectedTemplate.os_family === 'unknown' || osFamily(h) === selectedTemplate.os_family;
      if (!familyOk) return false;
      if (!allowCrossSite && selectedTemplate.site_scope && h.site && h.site !== selectedTemplate.site_scope) return false;
      return true;
    });
  }, [allowCrossSite, hosts, selectedTemplate]);

  const refreshTemplates = async () => {
    try { const r = await apiFetch(`${API}/api/provisioning/templates`); const d = await r.json(); const items = d.items || []; setTemplates(items); setSelTemplate(c => c && items.some(i => String(i.id) === c) ? c : String(items[0]?.id || '')); } catch { setTemplates([]); }
  };
  const refreshRuns = async () => {
    try { const r = await apiFetch(`${API}/api/provisioning/runs`); const d = await r.json(); setRuns(d.items || []); } catch { setRuns([]); }
  };
  const refreshSnapshots = async hostId => {
    if (!hostId) { setSourceSnaps([]); return; }
    setLoadingSnaps(true);
    try {
      const r = await apiFetch(`${API}/api/agent/by-host/${hostId}/snapshot/list`);
      const d = await r.json();
      const sorted = (Array.isArray(d.snapshots) ? d.snapshots : []).filter(s => String(s.mode || '').toLowerCase() === 'full_system').sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
      setSourceSnaps(sorted);
      setCaptureForm(c => ({ ...c, snapshot_name: c.snapshot_name && sorted.some(s => s.name === c.snapshot_name) ? c.snapshot_name : String(sorted[0]?.name || '') }));
    } catch { setSourceSnaps([]); }
    setLoadingSnaps(false);
  };

  useEffect(() => { refreshTemplates(); refreshRuns(); }, []);
  useEffect(() => { refreshSnapshots(sourceHostId); }, [sourceHostId]);
  if (useInterval) useInterval(() => { refreshRuns(); }, 5000);

  const captureTemplate = async () => {
    if (!sourceHostId || !captureForm.name.trim() || !captureForm.snapshot_name.trim()) { setNotice({ msg: 'Choose a source host, template name, and snapshot first.', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/provisioning/templates/capture`, { method: 'POST', body: JSON.stringify({ host_id: Number(sourceHostId), name: captureForm.name.trim(), snapshot_name: captureForm.snapshot_name.trim(), description: captureForm.description.trim(), labels: captureForm.labels.split(',').map(s => s.trim()).filter(Boolean), site_scope: captureForm.site_scope.trim(), snapshot_mode: 'full_system' }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || d.error?.message || 'Could not capture template.', ok: false }); return; }
      setNotice({ msg: `Template "${d.name}" captured and stored.`, ok: true });
      setCaptureForm({ name: '', snapshot_name: '', description: '', labels: '', site_scope: selectedSrcHost?.site || '' });
      await refreshTemplates(); setSelTemplate(String(d.id));
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const launchRollout = async () => {
    if (!selectedTemplateId || selectedTargetIds.length === 0) { setNotice({ msg: 'Pick a template and at least one target host.', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/provisioning/runs`, { method: 'POST', body: JSON.stringify({ template_id: Number(selectedTemplateId), target_host_ids: selectedTargetIds.map(Number), allow_cross_site: allowCrossSite }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || d.error?.message || 'Could not start rollout.', ok: false }); return; }
      setNotice({ msg: `Rollout queued. Queue job: ${d.job?.id || 'pending'}.`, ok: true });
      setSelTargets([]); await refreshRuns();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const toggleTarget = id => setSelTargets(c => c.includes(id) ? c.filter(v => v !== id) : [...c, id]);
  const selectAll    = () => setSelTargets(matchingTargets.map(h => h.id));

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Provisioning Center"
        title="Image Provisioning"
        subtitle={`${templates.length} golden images · ${runs.length} rollout runs · ${selectedTargetIds.length} targets selected`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={() => { refreshTemplates(); refreshRuns(); }}><RefreshCw size={14} /></CHBtn>
          </div>
        }
      />

      {notice.msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: notice.ok ? `${CH.green}12` : `${CH.red}12`, color: notice.ok ? CH.green : CH.red }}>
          {notice.msg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Templates"       value={templates.length}           sub="golden images"   accent={CH.accent} />
        <CHStat label="Rollout Runs"    value={runs.length}                sub="total runs"      accent={CH.green} />
        <CHStat label="Available Hosts" value={hosts.length}               sub="fleet"           accent="#a78bfa" />
        <CHStat label="Selected"        value={selectedTargetIds.length}   sub="for rollout"     accent={CH.yellow} />
      </div>

      {/* Step 1: Capture + Step 2: Launch — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Capture template */}
        <CHCard className="space-y-4">
          <CHLabel>1. Capture Provisioning Template</CHLabel>
          <div className="flex flex-col gap-1">
            <CHLabel>Source Host</CHLabel>
            <select value={sourceHostId} onChange={e => { setSourceHostId(e.target.value); const h = hosts.find(h => String(h.id) === e.target.value); setCaptureForm(c => ({ ...c, site_scope: h?.site || '' })); }} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="">Select host</option>
              {orderedHosts.map(h => <option key={h.id} value={h.id}>{h.hostname} ({h.ip}){h.site ? ` - ${h.site}` : ''}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Stored Snapshot</CHLabel>
            <select value={captureForm.snapshot_name} onChange={e => setCaptureForm(c => ({ ...c, snapshot_name: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="">{loadingSnaps ? 'Loading snapshots…' : 'Select snapshot'}</option>
              {sourceSnapshots.map(s => <option key={s.name} value={s.name}>{s.name} ({s.mode || 'packages'}){s.created ? ` — ${s.created}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <CHLabel>Template Name</CHLabel>
              <input value={captureForm.name} onChange={e => setCaptureForm(c => ({ ...c, name: e.target.value }))} placeholder="Golden-April" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Site Scope</CHLabel>
              <input value={captureForm.site_scope} onChange={e => setCaptureForm(c => ({ ...c, site_scope: e.target.value }))} placeholder="Optional" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Labels (comma-separated)</CHLabel>
            <input value={captureForm.labels} onChange={e => setCaptureForm(c => ({ ...c, labels: e.target.value }))} placeholder="golden, branch, windows-11" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
          </div>
          {selectedSrcHost && (
            <div className="grid grid-cols-2 gap-3">
              {[{ l: 'Source OS', v: `${selectedSrcHost.os || 'Unknown'} ${selectedSrcHost.os_version || ''}` }, { l: 'Source Site', v: selectedSrcHost.site || 'No site' }].map(kv => (
                <div key={kv.l} className="p-2.5 rounded-lg" style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: CH.textSub }}>{kv.l}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: CH.text }}>{kv.v}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={captureTemplate} disabled={busy}>{busy ? 'Capturing…' : 'Capture Template'}</CHBtn>
            <CHBtn variant="ghost" onClick={() => refreshSnapshots(sourceHostId)} disabled={!sourceHostId || loadingSnaps}>
              {loadingSnaps ? 'Refreshing…' : 'Refresh Snapshots'}
            </CHBtn>
          </div>
        </CHCard>

        {/* Launch rollout */}
        <CHCard className="space-y-4">
          <CHLabel>2. Launch Provisioning Rollout</CHLabel>
          <div className="flex flex-col gap-1">
            <CHLabel>Template</CHLabel>
            <select value={selectedTemplateId} onChange={e => setSelTemplate(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="">Select template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.os_family || 'unknown'}){t.site_scope ? ` — ${t.site_scope}` : ''}</option>)}
            </select>
          </div>
          {selectedTemplate && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Archive', v: selectedTemplate.archive_present ? `${formatBytes(selectedTemplate.archive_size_bytes)} ready` : 'Missing from storage', color: selectedTemplate.archive_present ? CH.green : CH.red },
                { l: 'Source', v: selectedTemplate.source_host?.hostname || 'Archived source', color: CH.text },
              ].map(kv => (
                <div key={kv.l} className="p-2.5 rounded-lg" style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: CH.textSub }}>{kv.l}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: kv.color || CH.text }}>{kv.v}</p>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allowCrossSite} onChange={e => setCrossSite(e.target.checked)} />
            <span className="text-xs" style={{ color: CH.textSub }}>Allow cross-site rollout</span>
          </label>
          <div className="flex items-center justify-between">
            <CHLabel>Eligible Targets ({matchingTargets.length})</CHLabel>
            <div className="flex gap-2">
              <CHBtn variant="ghost" onClick={selectAll}>Select All</CHBtn>
              <CHBtn variant="ghost" onClick={() => setSelTargets([])}>Clear</CHBtn>
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {matchingTargets.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: CH.textSub }}>No eligible targets for current template + site guardrails.</p>
            ) : matchingTargets.map(h => (
              <label key={h.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer"
                style={{ background: selectedTargetIds.includes(h.id) ? `${CH.accent}10` : 'rgba(3,29,75,0.3)', border: `1px solid ${selectedTargetIds.includes(h.id) ? CH.accent + '25' : CH.border}` }}>
                <input type="checkbox" checked={selectedTargetIds.includes(h.id)} onChange={() => toggleTarget(h.id)} />
                <div>
                  <p className="text-xs font-bold" style={{ color: CH.text }}>{h.hostname}</p>
                  <p className="text-[10px]" style={{ color: CH.textSub }}>{h.ip} · {h.os || 'Unknown OS'}{h.site ? ` · ${h.site}` : ''}{!h.is_online ? ' · offline' : ''}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <CHBtn variant="primary" onClick={launchRollout} disabled={busy || !selectedTemplateId}>
              <Play size={14} /> {busy ? 'Queueing…' : 'Queue Rollout'}
            </CHBtn>
            <span className="text-xs" style={{ color: CH.textSub }}>{selectedTargetIds.length} target{selectedTargetIds.length !== 1 ? 's' : ''} selected</span>
          </div>
        </CHCard>
      </div>

      {/* Templates table */}
      <CHCard>
        <div className="flex items-center justify-between mb-4">
          <CHLabel>Provisioning Templates ({templates.length})</CHLabel>
          <CHBtn variant="ghost" onClick={refreshTemplates}><RefreshCw size={14} /></CHBtn>
        </div>
        <CHTable headers={['Name', 'Source', 'Scope', 'Archive', 'Labels']} emptyMessage="No templates yet. Capture one from a validated source host snapshot.">
          {templates.map(t => (
            <CHTR key={t.id}>
              <td className="px-4 py-3">
                <p className="text-sm font-bold" style={{ color: CH.text }}>{t.name}</p>
                <p className="text-xs" style={{ color: CH.textSub }}>{t.description || 'No description'}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-xs font-bold" style={{ color: CH.text }}>{t.source_host?.hostname || 'Archived'}</p>
                <p className="text-xs font-mono" style={{ color: CH.textSub }}>{t.source_snapshot_name}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  <CHBadge color={CH.accent}>{t.os_family || 'unknown'}</CHBadge>
                  <CHBadge color={CH.textSub}>{t.site_scope || 'global'}</CHBadge>
                </div>
              </td>
              <td className="px-4 py-3">
                <CHBadge color={t.archive_present ? CH.green : CH.red}>{t.archive_present ? 'stored' : 'missing'}</CHBadge>
                <p className="text-xs mt-1" style={{ color: CH.textSub }}>{formatBytes(t.archive_size_bytes)}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {(t.labels || []).length > 0 ? t.labels.map(l => <CHBadge key={l} color={CH.textSub}>{l}</CHBadge>) : <span className="text-xs" style={{ color: CH.textSub }}>No labels</span>}
                </div>
              </td>
            </CHTR>
          ))}
        </CHTable>
      </CHCard>

      {/* Runs table */}
      <CHCard>
        <div className="flex items-center justify-between mb-4">
          <CHLabel>Provisioning Run History ({runs.length})</CHLabel>
          <CHBtn variant="ghost" onClick={refreshRuns}><RefreshCw size={14} /></CHBtn>
        </div>
        <CHTable headers={['Template', 'Status', 'Targets', 'Queue Job', 'Details']} emptyMessage="No provisioning runs yet.">
          {runs.map(run => (
            <CHTR key={run.id}>
              <td className="px-4 py-3">
                <p className="text-sm font-bold" style={{ color: CH.text }}>{run.template?.name || `Run ${run.id}`}</p>
                <p className="text-xs" style={{ color: CH.textSub }}>By {run.initiated_by || 'system'} · {run.created_at ? new Date(run.created_at).toLocaleDateString() : '—'}</p>
              </td>
              <td className="px-4 py-3"><CHBadge color={statusColor(run.status)}>{run.status}</CHBadge></td>
              <td className="px-4 py-3">
                <p className="text-sm font-bold" style={{ color: CH.text }}>{run.result_summary?.total_targets ?? run.target_host_ids?.length ?? 0}</p>
                <p className="text-xs" style={{ color: CH.textSub }}>{run.result_summary?.success_count ?? 0} ok · {run.result_summary?.failed_count ?? 0} failed</p>
              </td>
              <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{run.queue_job_id || 'n/a'}</td>
              <td className="px-4 py-3">
                <details>
                  <summary className="text-xs cursor-pointer" style={{ color: CH.accent }}>View results</summary>
                  <pre className="mt-2 rounded-xl p-3 text-xs font-mono max-h-40 overflow-y-auto"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(run.result_summary || {}, null, 2)}
                  </pre>
                </details>
              </td>
            </CHTR>
          ))}
        </CHTable>
      </CHCard>
    </CHPage>
  );
}
