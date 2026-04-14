import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Upload, Trash2, Package, HardDrive } from 'lucide-react';

const numberFmt = new Intl.NumberFormat();
function formatSize(v) { const n = Number(v || 0); return `${n >= 100 ? n.toFixed(0) : n.toFixed(1)} MB`; }
function extensionFor(name) {
  const l = String(name || '').toLowerCase();
  if (l.endsWith('.tar.gz')) return 'tar.gz';
  const p = l.split('.'); return p.length > 1 ? p.pop() : 'file';
}
const extColor = e => ({ deb: CH.green, rpm: CH.green, msi: '#60a5fa', exe: '#60a5fa', zip: CH.yellow, 'tar.gz': CH.yellow }[e] || CH.textSub);

export default function LocalRepoOpsPage({ API, apiFetch }) {
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
      if (r.ok) { setMessage('✓ Package uploaded successfully.'); fetchPackages(); }
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
      setMessage('✓ Package deleted.'); fetchPackages();
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

  return (
    <CHPage>
      <CHHeader
        kicker="Local Repository"
        title="Local Package Repo"
        subtitle={`${numberFmt.format(packages.length)} packages · ${formatSize(stats.totalStorage)} stored · air-gapped mode`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={fetchPackages}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></CHBtn>
            <label className="cursor-pointer">
              <CHBtn variant="primary" as="span"><Upload size={14} /> Upload Package</CHBtn>
              <input type="file" className="hidden" accept=".deb,.rpm,.msi,.exe,.zip,.tar.gz,.tgz" onChange={handleUpload} />
            </label>
          </div>
        }
      />

      {message && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: isErr ? `${CH.red}12` : `${CH.green}12`, color: isErr ? CH.red : CH.green }}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Packages"   value={numberFmt.format(packages.length)} sub="stored"        accent={CH.accent} />
        <CHStat label="Repository Size"  value={formatSize(stats.totalStorage)}   sub="in use"         accent={CH.green} />
        <CHStat label="Linux-Ready"      value={stats.linuxReady}                 sub="deb / rpm"      accent="#34d399" />
        <CHStat label="Windows-Ready"    value={stats.windowsReady}               sub="msi / exe"      accent="#60a5fa" />
      </div>

      {/* Search + Table */}
      <CHCard className="space-y-4">
        <div className="flex items-center gap-3">
          <CHLabel>Repository Inventory</CHLabel>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by filename…"
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
          />
        </div>
        <CHTable headers={['Package', 'Type', 'Size', 'Uploaded', 'Actions']} emptyMessage={loading ? 'Loading…' : 'No packages match the current filter.'}>
          {filtered.map(pkg => {
            const ext = extensionFor(pkg.name);
            return (
              <CHTR key={pkg.name}>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold font-mono" style={{ color: CH.text }}>{pkg.name}</p>
                  <p className="text-xs" style={{ color: CH.textSub }}>Push-ready from master repo</p>
                </td>
                <td className="px-6 py-4"><CHBadge color={extColor(ext)}>{ext.toUpperCase()}</CHBadge></td>
                <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>{formatSize(pkg.size_mb)}</td>
                <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>
                  {pkg.created ? new Date(pkg.created * 1000).toLocaleDateString() : 'Unknown'}
                </td>
                <td className="px-6 py-4">
                  <CHBtn variant="danger" onClick={() => deletePackage(pkg.name)}><Trash2 size={12} /></CHBtn>
                </td>
              </CHTR>
            );
          })}
        </CHTable>
      </CHCard>

      {/* Bottom row: Workflow + Type mix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CHCard>
          <CHLabel>Recommended Workflow</CHLabel>
          <div className="mt-4 space-y-3">
            {[
              'Upload a vetted package from your packaging or release team.',
              'Review the inventory list and confirm the filename matches your rollout plan.',
              'Open the target host and choose Push from Master Repo.',
              'Track the install job and keep the repository clean by removing superseded builds.',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                <span className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: `${CH.accent}15`, color: CH.accent }}>{i + 1}</span>
                <p className="text-xs" style={{ color: CH.textSub }}>{step}</p>
              </div>
            ))}
          </div>
        </CHCard>

        <CHCard>
          <CHLabel>Repository Mix</CHLabel>
          {typeBreakdown.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: CH.textSub }}>Upload packages to see type breakdown.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {typeBreakdown.map(([ext, count]) => {
                const pct = packages.length ? Math.round((count / packages.length) * 100) : 0;
                return (
                  <div key={ext} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono" style={{ color: CH.text }}>{ext}</span>
                      <span className="text-xs" style={{ color: CH.textSub }}>{count} pkg{count !== 1 ? 's' : ''} · {pct}%</span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background: CH.surface }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: extColor(ext.toLowerCase()) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CHCard>
      </div>
    </CHPage>
  );
}
