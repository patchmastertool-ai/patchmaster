import React, { useEffect, useMemo, useState } from 'react';
import {
  StitchWorkspaceContainer,
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchTable,
  StitchBadge,
  StitchAlert
} from './components/StitchComponents';

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

const statusColor = s => {
  const map = {
    success: 'success',
    partial_success: 'warning',
    failed: 'error',
    running: 'info',
    queued: 'info'
  };
  return map[String(s).toLowerCase()] || 'info';
};

export default function ProvisioningPageStitch({ hosts, API, apiFetch, useInterval }) {
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

  return (
    <StitchWorkspaceContainer workspace="infrastructure" className="min-h-screen bg-[#060e20] text-[#dee5ff] p-8">
      <StitchPageHeader
        workspace="infrastructure"
        title="Image Provisioning"
        description={`${templates.length} golden images · ${runs.length} rollout runs · ${selectedTargetIds.length} targets selected`}
        actions={
          <StitchButton
            variant="ghost"
            icon="refresh"
            onClick={() => { refreshTemplates(); refreshRuns(); }}
          >
            Refresh
          </StitchButton>
        }
      />

      {notice.msg && (
        <StitchAlert
          variant={notice.ok ? 'success' : 'error'}
          icon={notice.ok ? 'check_circle' : 'error'}
          message={notice.msg}
          onDismiss={() => setNotice({ msg: '', ok: true })}
        />
      )}

      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          workspace="infrastructure"
          label="Templates"
          value={templates.length}
          icon="image"
          subtitle="golden images"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Rollout Runs"
          value={runs.length}
          icon="deployed_code"
          subtitle="total runs"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Available Hosts"
          value={hosts.length}
          icon="dns"
          subtitle="fleet"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Selected"
          value={selectedTargetIds.length}
          icon="check_circle"
          subtitle="for rollout"
        />
      </StitchMetricGrid>

      {/* Step 1: Capture + Step 2: Launch — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Capture template */}
        <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">1. Capture Provisioning Template</p>
          
          <StitchFormField label="Source Host">
            <StitchSelect
              value={sourceHostId}
              onChange={(e) => { 
                setSourceHostId(e.target.value); 
                const h = hosts.find(h => String(h.id) === e.target.value); 
                setCaptureForm(c => ({ ...c, site_scope: h?.site || '' })); 
              }}
              options={[
                { value: '', label: 'Select host' },
                ...orderedHosts.map(h => ({ 
                  value: String(h.id), 
                  label: `${h.hostname} (${h.ip})${h.site ? ` - ${h.site}` : ''}` 
                }))
              ]}
            />
          </StitchFormField>
          
          <StitchFormField label="Stored Snapshot">
            <StitchSelect
              value={captureForm.snapshot_name}
              onChange={(e) => setCaptureForm(c => ({ ...c, snapshot_name: e.target.value }))}
              options={[
                { value: '', label: loadingSnaps ? 'Loading snapshots…' : 'Select snapshot' },
                ...sourceSnapshots.map(s => ({ 
                  value: s.name, 
                  label: `${s.name} (${s.mode || 'packages'})${s.created ? ` — ${s.created}` : ''}` 
                }))
              ]}
            />
          </StitchFormField>
          
          <div className="grid grid-cols-2 gap-3">
            <StitchFormField label="Template Name">
              <StitchInput
                value={captureForm.name}
                onChange={(e) => setCaptureForm(c => ({ ...c, name: e.target.value }))}
                placeholder="Golden-April"
              />
            </StitchFormField>
            <StitchFormField label="Site Scope">
              <StitchInput
                value={captureForm.site_scope}
                onChange={(e) => setCaptureForm(c => ({ ...c, site_scope: e.target.value }))}
                placeholder="Optional"
              />
            </StitchFormField>
          </div>
          
          <StitchFormField label="Labels (comma-separated)">
            <StitchInput
              value={captureForm.labels}
              onChange={(e) => setCaptureForm(c => ({ ...c, labels: e.target.value }))}
              placeholder="golden, branch, windows-11"
            />
          </StitchFormField>
          
          {selectedSrcHost && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Source OS', v: `${selectedSrcHost.os || 'Unknown'} ${selectedSrcHost.os_version || ''}` }, 
                { l: 'Source Site', v: selectedSrcHost.site || 'No site' }
              ].map(kv => (
                <div key={kv.l} className="p-2.5 rounded-lg bg-[#031d4b] border border-[#2b4680]">
                  <p className="text-xs uppercase tracking-wide text-[#91aaeb]">{kv.l}</p>
                  <p className="text-sm font-bold mt-0.5 text-[#dee5ff]">{kv.v}</p>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-3">
            <StitchButton
              variant="primary"
              icon="save"
              onClick={captureTemplate}
              disabled={busy}
            >
              {busy ? 'Capturing…' : 'Capture Template'}
            </StitchButton>
            <StitchButton
              variant="ghost"
              icon="refresh"
              onClick={() => refreshSnapshots(sourceHostId)}
              disabled={!sourceHostId || loadingSnaps}
            >
              {loadingSnaps ? 'Refreshing…' : 'Refresh Snapshots'}
            </StitchButton>
          </div>
        </div>

        {/* Launch rollout */}
        <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">2. Launch Provisioning Rollout</p>
          
          <StitchFormField label="Template">
            <StitchSelect
              value={selectedTemplateId}
              onChange={(e) => setSelTemplate(e.target.value)}
              options={[
                { value: '', label: 'Select template' },
                ...templates.map(t => ({ 
                  value: String(t.id), 
                  label: `${t.name} (${t.os_family || 'unknown'})${t.site_scope ? ` — ${t.site_scope}` : ''}` 
                }))
              ]}
            />
          </StitchFormField>
          
          {selectedTemplate && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { 
                  l: 'Archive', 
                  v: selectedTemplate.archive_present ? `${formatBytes(selectedTemplate.archive_size_bytes)} ready` : 'Missing from storage', 
                  color: selectedTemplate.archive_present ? '#7bd0ff' : '#ee7d77' 
                },
                { l: 'Source', v: selectedTemplate.source_host?.hostname || 'Archived source', color: '#dee5ff' },
              ].map(kv => (
                <div key={kv.l} className="p-2.5 rounded-lg bg-[#031d4b] border border-[#2b4680]">
                  <p className="text-xs uppercase tracking-wide text-[#91aaeb]">{kv.l}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: kv.color }}>{kv.v}</p>
                </div>
              ))}
            </div>
          )}
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allowCrossSite} onChange={e => setCrossSite(e.target.checked)} />
            <span className="text-xs text-[#91aaeb]">Allow cross-site rollout</span>
          </label>
          
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Eligible Targets ({matchingTargets.length})</p>
            <div className="flex gap-2">
              <StitchButton variant="ghost" size="sm" onClick={selectAll}>Select All</StitchButton>
              <StitchButton variant="ghost" size="sm" onClick={() => setSelTargets([])}>Clear</StitchButton>
            </div>
          </div>
          
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {matchingTargets.length === 0 ? (
              <p className="text-xs py-4 text-center text-[#91aaeb]">No eligible targets for current template + site guardrails.</p>
            ) : matchingTargets.map(h => (
              <label key={h.id} 
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                  selectedTargetIds.includes(h.id) 
                    ? 'bg-[#7bd0ff]/10 border border-[#7bd0ff]/30' 
                    : 'bg-[#031d4b] border border-[#2b4680]'
                }`}>
                <input type="checkbox" checked={selectedTargetIds.includes(h.id)} onChange={() => toggleTarget(h.id)} />
                <div>
                  <p className="text-xs font-bold text-[#dee5ff]">{h.hostname}</p>
                  <p className="text-[10px] text-[#91aaeb]">{h.ip} · {h.os || 'Unknown OS'}{h.site ? ` · ${h.site}` : ''}{!h.is_online ? ' · offline' : ''}</p>
                </div>
              </label>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <StitchButton
              variant="primary"
              icon="play_arrow"
              onClick={launchRollout}
              disabled={busy || !selectedTemplateId}
            >
              {busy ? 'Queueing…' : 'Queue Rollout'}
            </StitchButton>
            <span className="text-xs text-[#91aaeb]">{selectedTargetIds.length} target{selectedTargetIds.length !== 1 ? 's' : ''} selected</span>
          </div>
        </div>
      </div>

      {/* Templates table */}
      <div className="bg-[#05183c] p-6 rounded-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Provisioning Templates ({templates.length})</p>
          <StitchButton variant="ghost" size="sm" icon="refresh" onClick={refreshTemplates}>
            Refresh
          </StitchButton>
        </div>
        <StitchTable
          columns={[
            { 
              header: 'Name', 
              render: (row) => (
                <div>
                  <p className="text-sm font-bold text-[#dee5ff]">{row.name}</p>
                  <p className="text-xs text-[#91aaeb]">{row.description || 'No description'}</p>
                </div>
              )
            },
            { 
              header: 'Source', 
              render: (row) => (
                <div>
                  <p className="text-xs font-bold text-[#dee5ff]">{row.source_host?.hostname || 'Archived'}</p>
                  <p className="text-xs font-mono text-[#91aaeb]">{row.source_snapshot_name}</p>
                </div>
              )
            },
            { 
              header: 'Scope', 
              render: (row) => (
                <div className="flex gap-1 flex-wrap">
                  <StitchBadge variant="info">{row.os_family || 'unknown'}</StitchBadge>
                  <StitchBadge variant="info">{row.site_scope || 'global'}</StitchBadge>
                </div>
              )
            },
            { 
              header: 'Archive', 
              render: (row) => (
                <div>
                  <StitchBadge variant={row.archive_present ? 'success' : 'error'}>
                    {row.archive_present ? 'stored' : 'missing'}
                  </StitchBadge>
                  <p className="text-xs mt-1 text-[#91aaeb]">{formatBytes(row.archive_size_bytes)}</p>
                </div>
              )
            },
            { 
              header: 'Labels', 
              render: (row) => (
                <div className="flex gap-1 flex-wrap">
                  {(row.labels || []).length > 0 ? row.labels.map(l => <StitchBadge key={l} variant="info">{l}</StitchBadge>) : <span className="text-xs text-[#91aaeb]">No labels</span>}
                </div>
              )
            },
          ]}
          data={templates}
        />
      </div>

      {/* Runs table */}
      <div className="bg-[#05183c] p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Provisioning Run History ({runs.length})</p>
          <StitchButton variant="ghost" size="sm" icon="refresh" onClick={refreshRuns}>
            Refresh
          </StitchButton>
        </div>
        <StitchTable
          columns={[
            { 
              header: 'Template', 
              render: (row) => (
                <div>
                  <p className="text-sm font-bold text-[#dee5ff]">{row.template?.name || `Run ${row.id}`}</p>
                  <p className="text-xs text-[#91aaeb]">By {row.initiated_by || 'system'} · {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</p>
                </div>
              )
            },
            { 
              header: 'Status', 
              render: (row) => <StitchBadge variant={statusColor(row.status)}>{row.status}</StitchBadge>
            },
            { 
              header: 'Targets', 
              render: (row) => (
                <div>
                  <p className="text-sm font-bold text-[#dee5ff]">{row.result_summary?.total_targets ?? row.target_host_ids?.length ?? 0}</p>
                  <p className="text-xs text-[#91aaeb]">{row.result_summary?.success_count ?? 0} ok · {row.result_summary?.failed_count ?? 0} failed</p>
                </div>
              )
            },
            { 
              header: 'Queue Job', 
              render: (row) => <span className="text-xs font-mono text-[#91aaeb]">{row.queue_job_id || 'n/a'}</span>
            },
            { 
              header: 'Details', 
              render: (row) => (
                <details>
                  <summary className="text-xs cursor-pointer text-[#7bd0ff]">View results</summary>
                  <pre className="mt-2 rounded-xl p-3 text-xs font-mono max-h-40 overflow-y-auto bg-black/50 text-[#e2e8f0] whitespace-pre-wrap">
                    {JSON.stringify(row.result_summary || {}, null, 2)}
                  </pre>
                </details>
              )
            },
          ]}
          data={runs}
        />
      </div>
    </StitchWorkspaceContainer>
  );
}