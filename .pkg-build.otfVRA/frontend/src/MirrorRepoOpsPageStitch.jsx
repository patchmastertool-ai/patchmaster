import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from './AppIcons';
import {
  StitchWorkspaceContainer,
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchButton,
  StitchAlert,
  StitchTable,
  StitchBadge,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchEmptyState
} from './components/StitchComponents';

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

const statusColor = s => {
  const status = String(s).toLowerCase();
  if (status === 'success') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'info';
  return 'pending';
};

export default function MirrorRepoOpsPageStitch({ API, apiFetch }) {
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

  const selectedRepo = useMemo(() => repos.find(r => r.id === selectedRepoId) || null, [repos, selectedRepoId]);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try { 
      const r = await apiFetch(`${API}/api/mirror/repos`); 
      const d = await r.json(); 
      setRepos(Array.isArray(d) ? d : []); 
    } catch {}
    setLoading(false);
  }, [API, apiFetch]);

  const loadData = useCallback(async () => {
    if (!selectedRepoId) { setRuns([]); setPackages([]); return; }
    try {
      const [r1, r2] = await Promise.all([
        apiFetch(`${API}/api/mirror/repos/${selectedRepoId}/runs?limit=20`),
        apiFetch(`${API}/api/mirror/repos/${selectedRepoId}/packages?limit=50&q=${encodeURIComponent(query)}`)
      ]);
      const runsData = await r1.json();
      setRuns(Array.isArray(runsData) ? runsData : []);
      const pD = await r2.json(); 
      setPackages(Array.isArray(pD?.items) ? pD.items : []);
    } catch {}
  }, [API, apiFetch, query, selectedRepoId]);

  useEffect(() => { loadRepos(); }, [loadRepos]);
  useEffect(() => { loadData(); }, [loadData]);

  const createRepo = async () => {
    if (!form.name.trim()) { setNotice({ msg: 'Name required', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/mirror/repos`, { 
        method: 'POST', 
        body: JSON.stringify({ 
          ...form, 
          sync_interval_minutes: Number(form.sync_interval_minutes), 
          retention_days: Number(form.retention_days), 
          keep_versions: Number(form.keep_versions) 
        }) 
      });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Create failed', ok: false }); return; }
      setNotice({ msg: `Repository "${d.name}" created successfully`, ok: true }); 
      setShowAdd(false); 
      setForm(defaultForm()); 
      loadRepos();
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
      setNotice({ msg: d?.summary?.status === 'skipped' ? 'Sync skipped or locked' : 'Sync queued successfully', ok: true }); 
      loadData();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const repoColumns = [
    {
      header: 'Repository',
      render: (repo) => (
        <div>
          <div className="text-sm font-bold text-[#dee5ff]">{repo.name}</div>
          <div className="text-xs text-[#91aaeb]">{repo.provider || 'custom'} • {repo.os_family || 'linux'}</div>
        </div>
      )
    },
    {
      header: 'Source URL',
      render: (repo) => (
        <div className="text-xs font-mono text-[#91aaeb] truncate max-w-xs">
          {repo.source_url || '—'}
        </div>
      )
    },
    {
      header: 'Status',
      render: (repo) => (
        <StitchBadge variant={repo.enabled ? 'success' : 'default'}>
          {repo.enabled ? 'ENABLED' : 'DISABLED'}
        </StitchBadge>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (repo) => (
        <div className="flex gap-2 justify-end">
          <StitchButton
            variant="secondary"
            size="sm"
            onClick={() => setSelRepo(repo.id)}
          >
            View
          </StitchButton>
          <StitchButton
            variant="primary"
            size="sm"
            icon="sync"
            onClick={() => { setSelRepo(repo.id); setTimeout(() => runSync(), 100); }}
            disabled={busy}
          >
            Sync
          </StitchButton>
        </div>
      )
    }
  ];

  const runColumns = [
    {
      header: 'Run ID',
      render: (run) => <span className="text-xs font-mono">{run.id}</span>
    },
    {
      header: 'Status',
      render: (run) => <StitchBadge variant={statusColor(run.status)}>{run.status}</StitchBadge>
    },
    {
      header: 'Started',
      render: (run) => (
        <span className="text-xs text-[#91aaeb]">
          {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
        </span>
      )
    },
    {
      header: 'Duration',
      render: (run) => (
        <span className="text-xs text-[#91aaeb]">
          {run.duration_seconds ? `${run.duration_seconds}s` : '—'}
        </span>
      )
    }
  ];

  return (
    <StitchWorkspaceContainer workspace="infrastructure" className="min-h-screen p-12">
      <StitchPageHeader
        workspace="infrastructure"
        title="Mirror Configuration"
        description="Air-gap mirroring and repository synchronization"
        actions={
          <StitchButton variant="primary" icon="add" onClick={() => setShowAdd(true)}>
            Create New Mirror
          </StitchButton>
        }
      />

      {notice.msg && (
        <StitchAlert
          variant={notice.ok ? 'success' : 'error'}
          message={notice.msg}
          onDismiss={() => setNotice({ msg: '', ok: true })}
        />
      )}

      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          workspace="infrastructure"
          label="Total Mirrors"
          value={repos.length}
          icon="cloud_sync"
          subtitle="configured"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Active"
          value={repos.filter(r => r.enabled).length}
          icon="check_circle"
          subtitle="enabled"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Recent Runs"
          value={runs.length}
          icon="history"
          subtitle="last 20"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Packages"
          value={packages.length}
          icon="inventory"
          subtitle="in selected repo"
        />
      </StitchMetricGrid>

      {/* Repository List */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Configured Upstream Mirrors</h3>
        <StitchTable
          columns={repoColumns}
          data={repos}
          loading={loading}
          emptyState={
            <StitchEmptyState
              icon="cloud_sync"
              title="No Mirrors Configured"
              description="Create a mirror repository to start synchronizing packages."
              actionLabel="Create Mirror"
              onAction={() => setShowAdd(true)}
            />
          }
        />
      </div>

      {/* Selected Repo Details */}
      {selectedRepo && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Runs */}
          <div>
            <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Sync History: {selectedRepo.name}</h3>
            <StitchTable
              columns={runColumns}
              data={runs}
              emptyState={
                <div className="text-center py-8 text-[#91aaeb]">
                  No sync runs yet
                </div>
              }
            />
          </div>

          {/* Packages */}
          <div>
            <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Packages</h3>
            <StitchFormField label="Search">
              <StitchInput
                placeholder="Filter packages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </StitchFormField>
            <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
              {packages.length === 0 ? (
                <div className="text-center py-8 text-[#91aaeb]">
                  {query ? 'No packages match your search' : 'No packages synced yet'}
                </div>
              ) : (
                packages.map((pkg, idx) => (
                  <div key={idx} className="p-3 bg-[#06122d] rounded-lg">
                    <div className="text-sm font-bold text-[#dee5ff]">{pkg.name || pkg.package_name}</div>
                    <div className="text-xs text-[#91aaeb]">{pkg.version || '—'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#05183c] rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#dee5ff] mb-6">Create Mirror Repository</h2>
            
            <div className="space-y-4">
              <StitchFormField label="Name" required>
                <StitchInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ubuntu-main-mirror"
                />
              </StitchFormField>

              <StitchFormField label="Provider">
                <StitchSelect
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value, source_url: providerDefaultSources[e.target.value] || '' })}
                  options={providers}
                />
              </StitchFormField>

              <StitchFormField label="OS Family">
                <StitchSelect
                  value={form.os_family}
                  onChange={(e) => setForm({ ...form, os_family: e.target.value })}
                  options={osFamilies}
                />
              </StitchFormField>

              <StitchFormField label="Source URL">
                <StitchInput
                  value={form.source_url}
                  onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                  placeholder="https://..."
                />
              </StitchFormField>

              <div className="grid grid-cols-2 gap-4">
                <StitchFormField label="Sync Interval (minutes)">
                  <StitchInput
                    type="number"
                    value={form.sync_interval_minutes}
                    onChange={(e) => setForm({ ...form, sync_interval_minutes: e.target.value })}
                  />
                </StitchFormField>

                <StitchFormField label="Retention (days)">
                  <StitchInput
                    type="number"
                    value={form.retention_days}
                    onChange={(e) => setForm({ ...form, retention_days: e.target.value })}
                  />
                </StitchFormField>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <StitchButton variant="primary" onClick={createRepo} disabled={busy}>
                {busy ? 'Creating...' : 'Create Mirror'}
              </StitchButton>
              <StitchButton variant="secondary" onClick={() => { setShowAdd(false); setForm(defaultForm()); }}>
                Cancel
              </StitchButton>
            </div>
          </div>
        </div>
      )}
    </StitchWorkspaceContainer>
  );
}
