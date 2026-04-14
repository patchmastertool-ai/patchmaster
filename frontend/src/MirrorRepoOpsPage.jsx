import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Settings, Play, Database, Search, Shield, Trash2, Server } from 'lucide-react';

const providers = [
  { value: 'ubuntu', label: 'Ubuntu' },
  { value: 'redhat', label: 'Red Hat' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'custom', label: 'Custom Feed' },
];

const osFamilies = [
  { value: 'linux', label: 'Linux' },
  { value: 'windows', label: 'Windows' },
];

const providerDefaultSources = {
  ubuntu: 'https://ubuntu.com/security/notices.json',
  redhat: 'https://access.redhat.com/hydra/rest/securitydata/csaf.json',
  microsoft: 'https://api.msrc.microsoft.com/cvrf/v3.0/updates'
};

const defaultForm = () => ({
  name: '', provider: 'ubuntu', os_family: 'linux', channel: 'default',
  source_url: '', enabled: true, metadata_only: true, sync_interval_minutes: 360,
  retention_days: 30, keep_versions: 2
});

const statusColor = s => ({ success: CH.green, failed: CH.red, running: CH.accent, idle: CH.textSub }[String(s).toLowerCase()] || CH.textSub);

export default function MirrorRepoOpsPage({ API, apiFetch }) {
  const [repos, setRepos]             = useState([]);
  const [selectedRepoId, setSelRepo]  = useState(null);
  const [runs, setRuns]               = useState([]);
  const [packages, setPackages]       = useState([]);
  const [query, setQuery]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [busy, setBusy]               = useState(false);
  const [notice, setNotice]           = useState({ msg: '', ok: true });
  const [showAdd, setShowAdd]         = useState(false);
  const [form, setForm]               = useState(defaultForm());
  const [retentionPreview, setRetPreview] = useState([]);

  const selectedRepo = useMemo(() => repos.find(r => r.id === selectedRepoId) || null, [repos, selectedRepoId]);
  const isSatellite = selectedRepo && String(selectedRepo?.extra_config?.feed_family || '').toLowerCase() === 'satellite';

  const patchRepo = mutate => setRepos(p => p.map(r => (r.id === selectedRepo.id ? mutate(r) : r)));

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch(`${API}/api/mirror/repos`); const d = await r.json(); setRepos(Array.isArray(d) ? d : []); } catch {}
    setLoading(false);
  }, [API, apiFetch]);

  const loadData = useCallback(async () => {
    if (!selectedRepoId) { setRuns([]); setPackages([]); return; }
    try {
      const [r1, r2] = await Promise.all([
        apiFetch(`${API}/api/mirror/repos/${selectedRepoId}/runs?limit=20`),
        apiFetch(`${API}/api/mirror/repos/${selectedRepoId}/packages?limit=50&q=${encodeURIComponent(query)}`)
      ]);
      setRuns(Array.isArray(await r1.json()) ? await r1.json() : []);
      const pD = await r2.json(); setPackages(Array.isArray(pD?.items) ? pD.items : []);
    } catch {}
  }, [API, apiFetch, query, selectedRepoId]);

  useEffect(() => { loadRepos(); }, [loadRepos]);
  useEffect(() => { loadData(); }, [loadData]);

  const createRepo = async () => {
    if (!form.name.trim()) { setNotice({ msg: 'Name required', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos`, { method: 'POST', body: JSON.stringify({ ...form, sync_interval_minutes: Number(form.sync_interval_minutes), retention_days: Number(form.retention_days), keep_versions: Number(form.keep_versions) }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Create failed', ok: false }); return; }
      setNotice({ msg: `Repository "${d.name}" created.`, ok: true }); setShowAdd(false); setForm(defaultForm()); loadRepos();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const updateRepo = async () => {
    if (!selectedRepo) return;
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos/${selectedRepo.id}`, { method: 'PUT', body: JSON.stringify({ ...selectedRepo, sync_interval_minutes: Number(selectedRepo.sync_interval_minutes), retention_days: Number(selectedRepo.retention_days), keep_versions: Number(selectedRepo.keep_versions) }) });
      if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Update failed', ok: false }); return; }
      setNotice({ msg: 'Settings saved.', ok: true }); loadRepos();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const deleteRepo = async () => {
    if (!selectedRepo || !window.confirm(`Delete ${selectedRepo.name}?`)) return;
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos/${selectedRepo.id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Delete failed', ok: false }); return; }
      setNotice({ msg: 'Deleted.', ok: true }); setSelRepo(null); loadRepos();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const runSync = async () => {
    if (!selectedRepo) return;
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos/${selectedRepo.id}/sync`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Sync failed', ok: false }); return; }
      setNotice({ msg: d?.summary?.status === 'skipped' ? 'Sync skipped or locked.' : 'Sync queued.', ok: true }); loadData();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const runRetention = async () => {
    if (!selectedRepo) return;
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos/${selectedRepo.id}/retention`, { method: 'POST' });
      if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Retention failed', ok: false }); return; }
      setNotice({ msg: 'Retention run completed.', ok: true }); loadData();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const previewRetention = async () => {
    if (!selectedRepo) return;
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos/${selectedRepo.id}/retention/preview?limit=100`);
      if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Preview failed', ok: false }); return; }
      const d = await r.json(); setRetPreview(d?.summary?.preview || []); setNotice({ msg: `Preview sorted. ${d?.summary?.would_remove_packages || 0} packages would be removed.`, ok: true });
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const autoBootstrap = async () => {
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/automation/bootstrap-sync?online_only=true&max_hosts=500`, { method: 'POST' });
      if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Bootstrap failed', ok: false }); return; }
      setNotice({ msg: 'Automation bootstrap started.', ok: true }); loadRepos();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Vulnerability Intelligence"
        title="Mirror Repositories"
        subtitle={`${repos.length} configured upstream repositories`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={() => { loadRepos(); loadData(); }}><RefreshCw size={14} /></CHBtn>
            <CHBtn variant="default" onClick={autoBootstrap} disabled={busy}><Database size={14} /> Auto-Bootstrap</CHBtn>
            <CHBtn variant="primary" onClick={() => setShowAdd(v => !v)}><Plus size={14} /> {showAdd ? 'Cancel' : 'Add Repository'}</CHBtn>
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
        <CHStat label="Total Mirrors" value={repos.length} sub="configured" accent={CH.accent} />
        <CHStat label="Active" value={repos.filter(r => r.enabled).length} sub="syncing" accent={CH.green} />
        <CHStat label="Last Run" value={runs[0]?.status || '—'} sub="latest sync status" accent="#a78bfa" />
        <CHStat label="Catalog Size" value={packages.length} sub="items in view" accent={CH.yellow} />
      </div>

      {showAdd && (
        <CHCard className="space-y-4 border-l-4" style={{ borderLeftColor: CH.accent }}>
          <CHLabel>Register New Mirror</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <CHLabel>Name</CHLabel>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ubuntu Security" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Provider</CHLabel>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, source_url: providerDefaultSources[e.target.value] || '' }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                {providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>OS Family</CHLabel>
              <select value={form.os_family} onChange={e => setForm(f => ({ ...f, os_family: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                {osFamilies.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Source URL</CHLabel>
              <input value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} placeholder="https://..." className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Channel</CHLabel>
              <input value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} placeholder="main" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
          </div>
          <CHBtn variant="primary" onClick={createRepo} disabled={busy}>{busy ? 'Saving…' : 'Create Mirror'}</CHBtn>
        </CHCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <CHCard>
            <CHLabel>Mirrors ({repos.length})</CHLabel>
            <div className="mt-4 space-y-2">
              {repos.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No mirrors.</p> : null}
              {repos.map(r => (
                <div key={r.id} onClick={() => setSelRepo(r.id)} className="p-3 rounded-xl cursor-pointer transition-all" style={{ background: selectedRepoId === r.id ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', border: `1px solid ${selectedRepoId === r.id ? CH.accent + '40' : CH.border}` }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{r.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: CH.textSub }}>{r.provider} · {r.os_family}</p>
                    </div>
                    <CHBadge color={r.enabled ? CH.green : CH.textSub}>{r.enabled ? 'Active' : 'Disabled'}</CHBadge>
                  </div>
                </div>
              ))}
            </div>
          </CHCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedRepo ? (
            <>
              <CHCard className="space-y-4">
                <div className="flex items-center justify-between">
                  <CHLabel>{selectedRepo.name} Configuration</CHLabel>
                  <div className="flex gap-2">
                    <CHBtn variant="primary" onClick={updateRepo} disabled={busy}>Save</CHBtn>
                    <CHBtn variant="danger" onClick={deleteRepo} disabled={busy}><Trash2 size={14} /></CHBtn>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <CHLabel>Source Provider</CHLabel>
                    <select value={selectedRepo.provider} onChange={e => patchRepo(r => ({ ...r, provider: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                      {providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <CHLabel>OS Target</CHLabel>
                    <select value={selectedRepo.os_family} onChange={e => patchRepo(r => ({ ...r, os_family: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                      {osFamilies.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <CHLabel>Source URL</CHLabel>
                    <input value={selectedRepo.source_url} onChange={e => patchRepo(r => ({ ...r, source_url: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                   <div className="flex flex-col gap-1">
                    <CHLabel>Sync (minutes)</CHLabel>
                    <input type="number" value={selectedRepo.sync_interval_minutes} onChange={e => patchRepo(r => ({ ...r, sync_interval_minutes: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <CHLabel>Retention (days)</CHLabel>
                    <input type="number" value={selectedRepo.retention_days} onChange={e => patchRepo(r => ({ ...r, retention_days: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <CHLabel>Keep Versions</CHLabel>
                    <input type="number" value={selectedRepo.keep_versions} onChange={e => patchRepo(r => ({ ...r, keep_versions: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selectedRepo.enabled} onChange={e => patchRepo(r => ({ ...r, enabled: e.target.checked }))} />
                    <span className="text-sm font-bold" style={{ color: CH.text }}>Enabled</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selectedRepo.metadata_only} onChange={e => patchRepo(r => ({ ...r, metadata_only: e.target.checked }))} />
                    <span className="text-sm font-bold" style={{ color: CH.text }}>Metadata Only</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-2 border-t" style={{ borderColor: CH.border }}>
                  <CHBtn variant="default" onClick={runSync} disabled={busy}><Play size={14} /> Run Sync</CHBtn>
                  <CHBtn variant="ghost" onClick={runRetention} disabled={busy}>Run Retention</CHBtn>
                  <CHBtn variant="ghost" onClick={previewRetention} disabled={busy}>Preview Retention</CHBtn>
                </div>
              </CHCard>

              {runs.length > 0 && (
                <CHCard>
                  <CHLabel>Recent Sync Runs</CHLabel>
                  <CHTable headers={['Status', 'Trigger', 'Time', 'Summary']} emptyMessage="No sync history." className="mt-4">
                    {runs.map(run => (
                      <CHTR key={run.id}>
                        <td className="px-4 py-3"><CHBadge color={statusColor(run.status)}>{run.status}</CHBadge></td>
                        <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{run.trigger_type}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{run.error || `Seen: ${run.summary?.items_seen||0}, Added: ${run.summary?.inserted||0}`}</td>
                      </CHTR>
                    ))}
                  </CHTable>
                </CHCard>
              )}

              {retentionPreview.length > 0 && (
                 <CHCard>
                   <CHLabel>Retention Candidate Preview</CHLabel>
                   <CHTable headers={['Package', 'Version', 'Arch', 'Reason']} className="mt-4">
                      {retentionPreview.map(p => (
                        <CHTR key={p.id}>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: CH.text }}>{p.package_name}</td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{p.package_version || '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{p.architecture || '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{p.reason}</td>
                        </CHTR>
                      ))}
                   </CHTable>
                 </CHCard>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{ border: `1px solid ${CH.border}`, borderRadius: 16 }}>
              <Shield size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
              <p className="text-xs uppercase tracking-widest font-bold mt-4" style={{ color: CH.textSub }}>Select a mirror to manage</p>
            </div>
          )}
        </div>
      </div>
    </CHPage>
  );
}
