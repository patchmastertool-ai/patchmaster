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
  StitchInput,
  StitchFormField
} from './components/StitchComponents';

const numberFmt = new Intl.NumberFormat();
function formatSize(v) { const n = Number(v || 0); return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)} MB`; }
function extensionFor(name) {
  const l = String(name || '').toLowerCase();
  if (l.endsWith('.tar.gz')) return 'tar.gz';
  const p = l.split('.'); return p.length > 1 ? p.pop() : 'file';
}
const extColor = e => {
  const colorMap = {
    deb: 'success',
    rpm: 'success',
    msi: 'info',
    exe: 'info',
    zip: 'warning',
    'tar.gz': 'warning'
  };
  return colorMap[e] || 'info';
};

export default function LocalRepoOpsPageStitch({ API, apiFetch }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState('');
  const [query, setQuery]       = useState('');

  const fetchPackages = useCallback(() => {
    setLoading(true);
    apiFetch(`${API}/api/packages/local/`)
      .then(r => r.json())
      .then(d => setPackages(Array.isArray(d?.packages) ? d.packages : []))
      .catch(() => setMessage('Unable to load repository packages.'))
      .finally(() => setLoading(false));
  }, [API, apiFetch]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const handleUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setLoading(true); setMessage('');
    try {
      const r = await apiFetch(`${API}/api/packages/local/upload`, { method: 'POST', body: fd });
      if (r.ok) { setMessage('Package uploaded successfully'); fetchPackages(); }
      else { const d = await r.json().catch(() => ({})); setMessage(d.detail || 'Upload failed.'); }
    } catch (err) { setMessage(`Error: ${err.message}`); }
    finally { e.target.value = ''; setLoading(false); }
  };

  const deletePackage = async name => {
    if (!window.confirm(`Delete ${name}?`)) return;
    setMessage('');
    try {
      const r = await apiFetch(`${API}/api/packages/local/${name}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Delete failed.');
      setMessage('Package deleted successfully'); fetchPackages();
    } catch (err) { setMessage(`Error: ${err.message}`); }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...packages].sort((a, b) => (b.created || 0) - (a.created || 0));
    return needle ? sorted.filter(p => String(p?.name || '').toLowerCase().includes(needle)) : sorted;
  }, [packages, query]);

  const stats = useMemo(() => {
    const totalStorage = packages.reduce((s, p) => s + Number(p?.size_mb || 0), 0);
    const latest       = [...packages].sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    const windowsReady = packages.filter(p => ['msi', 'exe'].includes(extensionFor(p?.name))).length;
    const linuxReady   = packages.filter(p => ['deb', 'rpm'].includes(extensionFor(p?.name))).length;
    return { totalStorage, latest, windowsReady, linuxReady };
  }, [packages]);

  const typeBreakdown = useMemo(() => {
    const counts = new Map();
    packages.forEach(p => { const e = extensionFor(p?.name).toUpperCase(); counts.set(e, (counts.get(e) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [packages]);

  const isErr = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed');

  const packageColumns = [
    {
      header: 'Package Name',
      render: (pkg) => (
        <div>
          <div className="text-sm font-bold text-[#dee5ff]">{pkg.name}</div>
          <div className="text-xs text-[#91aaeb]">{formatSize(pkg.size_mb)}</div>
        </div>
      )
    },
    {
      header: 'Type',
      render: (pkg) => (
        <StitchBadge variant={extColor(extensionFor(pkg.name))}>
          {extensionFor(pkg.name).toUpperCase()}
        </StitchBadge>
      )
    },
    {
      header: 'Created',
      render: (pkg) => (
        <span className="text-xs text-[#91aaeb]">
          {pkg.created ? new Date(pkg.created * 1000).toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (pkg) => (
        <StitchButton
          variant="danger"
          size="sm"
          icon="delete"
          onClick={() => deletePackage(pkg.name)}
        >
          Delete
        </StitchButton>
      )
    }
  ];

  return (
    <StitchWorkspaceContainer workspace="infrastructure" className="min-h-screen p-12">
      <StitchPageHeader
        workspace="infrastructure"
        title="Local Repository"
        description="Internal repository management and package storage"
        actions={
          <>
            <StitchButton variant="secondary" icon="sync" onClick={fetchPackages} disabled={loading}>
              Refresh
            </StitchButton>
            <label className="cursor-pointer">
              <StitchButton variant="primary" icon="add" as="div">
                Upload Package
              </StitchButton>
              <input type="file" className="hidden" accept=".deb,.rpm,.msi,.exe,.zip,.tar.gz,.tgz" onChange={handleUpload} />
            </label>
          </>
        }
      />

      {message && (
        <StitchAlert
          variant={isErr ? 'error' : 'success'}
          message={message}
          onDismiss={() => setMessage('')}
        />
      )}

      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          workspace="infrastructure"
          label="Total Packages"
          value={packages.length}
          icon="inventory"
          subtitle="in repository"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Storage Used"
          value={`${stats.totalStorage.toFixed(1)} MB`}
          icon="storage"
          subtitle="total size"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Linux Packages"
          value={stats.linuxReady}
          icon="terminal"
          subtitle="deb/rpm"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Windows Packages"
          value={stats.windowsReady}
          icon="window"
          subtitle="msi/exe"
        />
      </StitchMetricGrid>

      {/* Search Bar */}
      <div className="mt-8 mb-6">
        <StitchFormField label="Search Packages">
          <StitchInput
            placeholder="Filter by package name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </StitchFormField>
      </div>

      {/* Package Type Breakdown */}
      {typeBreakdown.length > 0 && (
        <div className="mb-6 flex gap-2 flex-wrap">
          {typeBreakdown.map(([type, count]) => (
            <StitchBadge key={type} variant="info">
              {type}: {count}
            </StitchBadge>
          ))}
        </div>
      )}

      {/* Packages Table */}
      <StitchTable
        columns={packageColumns}
        data={filtered}
        loading={loading}
        emptyState={
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-[#91aaeb] mb-4">inventory</span>
            <h3 className="text-lg font-bold text-[#dee5ff] mb-2">No Packages Found</h3>
            <p className="text-sm text-[#91aaeb]">
              {query ? 'No packages match your search criteria.' : 'Upload packages to get started.'}
            </p>
          </div>
        }
      />
    </StitchWorkspaceContainer>
  );
}
