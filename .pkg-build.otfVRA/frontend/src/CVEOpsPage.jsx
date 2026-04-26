import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  StitchBadge, 
  StitchButton, 
  StitchSelect, 
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchFormField
} from './components/StitchComponents';
import { AppIcon } from './AppIcons';

export default function CVEOpsPage({ API, apiFetch, hasRole }) {
  const [cves, setCves]             = useState([]);
  const [stats, setStats]           = useState(null);
  const [search, setSearch]         = useState('');
  const [severity, setSeverity]     = useState('');
  const [onlyWithHosts, setOnlyWithHosts] = useState(false);
  const [form, setForm]             = useState({ cve_id: '', description: '', severity: 'medium', cvss_score: '', affected_packages: '', advisory_url: '' });
  const [toast, setToast]           = useState(null);
  const [nvdDays, setNvdDays]       = useState(2);
  const [syncSource, setSyncSource] = useState('nvd');
  const [importing, setImporting]   = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [selectedCve, setSelectedCve]   = useState(null);
  const [cveDetail, setCveDetail]       = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAddForm, setShowAddForm]   = useState(false);
  const fileInputRef = useRef(null);

  const refresh = useCallback(() => {
    const params = new URLSearchParams({ limit: '500' });
    if (severity)     params.set('severity', severity);
    if (search)       params.set('search', search);
    if (onlyWithHosts) params.set('include_hosts_only', 'true');
    apiFetch(`${API}/api/cve/?${params}`).then(r => r.json()).then(setCves).catch(() => {});
    apiFetch(`${API}/api/cve/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, [API, apiFetch, severity, search, onlyWithHosts]);

  useEffect(() => { refresh(); }, [refresh]);

  const showToast = (text, type = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const create = () => {
    if (!form.cve_id) return showToast('CVE ID required', 'error');
    const body = {
      ...form,
      cvss_score: form.cvss_score ? parseFloat(form.cvss_score) : null,
      affected_packages: form.affected_packages ? form.affected_packages.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    apiFetch(`${API}/api/cve/`, { method: 'POST', body: JSON.stringify(body) })
      .then(r => { if (!r.ok) throw new Error('Failed to add'); return r; })
      .then(() => {
        refresh();
        setForm({ cve_id: '', description: '', severity: 'medium', cvss_score: '', affected_packages: '', advisory_url: '' });
        setShowAddForm(false);
        showToast('CVE added successfully', 'success');
      })
      .catch(e => showToast(e.message, 'error'));
  };

  const del = (id) => {
    if (!window.confirm('Delete this CVE?')) return;
    apiFetch(`${API}/api/cve/${id}`, { method: 'DELETE' }).then(() => { refresh(); showToast('CVE deleted', 'success'); });
  };

  const syncFeed = async () => {
    setSyncing(true);
    try {
      const params = new URLSearchParams({ source: syncSource });
      if (syncSource === 'nvd') params.set('days', String(nvdDays || 2));
      const r = await apiFetch(`${API}/api/cve/sync?${params}`, { method: 'POST' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.detail?.error || d?.error || 'Sync failed');
      }
      const d = await r.json();
      refresh();
      showToast(`Synced: ${d.fetched} CVEs fetched, ${d.created} created, ${d.updated} updated`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
    setSyncing(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await apiFetch(`${API}/api/cve/import`, { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Import failed');
      refresh();
      showToast(`Import done: ${d.created} added, ${d.updated} updated`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
    setImporting(false); e.target.value = '';
  };

  const exportCSV = async () => {
    try {
      const r = await apiFetch(`${API}/api/cve/export`);
      if (!r.ok) throw new Error(`Export failed (${r.status})`);
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `cve_report_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch (e) { showToast(e.message || 'Export failed', 'error'); }
  };

  const openDetail = async (cveId) => {
    setSelectedCve(cveId); setLoadingDetail(true);
    try {
      const r = await apiFetch(`${API}/api/cve/${cveId}`);
      setCveDetail(await r.json());
    } catch (err) { setCveDetail({ error: err.message }); }
    setLoadingDetail(false);
  };

  const s = stats || {};
  const criticalCount = s.by_severity?.critical || 0;
  const highCount     = s.by_severity?.high      || 0;
  const mediumCount   = s.by_severity?.medium    || 0;
  const lowCount      = s.by_severity?.low       || 0;
  const openCount     = s.open_vulnerabilities   || 0;
  const patchedCount  = s.patched_vulnerabilities|| 0;
  const closureRate   = openCount + patchedCount ? Math.round((patchedCount / (openCount + patchedCount)) * 100) : 0;

  const sevFilters = ['', 'critical', 'high', 'medium', 'low'];

  // Table column definitions
  const cveColumns = [
    {
      key: 'cve_id',
      label: 'CVE Identifier & Description',
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <button
            onClick={(e) => { e.stopPropagation(); openDetail(row.cve_id); }}
            className="font-bold text-sm text-[#7bd0ff] hover:underline tracking-tight mb-1"
          >
            {row.cve_id}
          </button>
          <span className="text-xs text-[#91aaeb] truncate pr-4 max-w-md">
            {row.description || 'No description available.'}
          </span>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (val, row) => {
        const cvssScore = row.cvss_score ? ` ${row.cvss_score}` : '';
        const severityLabel = `${val?.toUpperCase() || 'UNKNOWN'}${cvssScore}`;
        
        // Match Stitch design with dot indicator and shadow for critical
        const getDotColor = () => {
          if (val === 'critical') return 'bg-[#ee7d77]';
          if (val === 'high') return 'bg-[#ffd16f]';
          if (val === 'medium') return 'bg-[#7bd0ff]';
          return 'bg-[#91aaeb]';
        };

        const getBgColor = () => {
          if (val === 'critical') return 'bg-[#7f2927] text-[#ff9993]';
          if (val === 'high') return 'bg-[#ffd16f]/20 text-[#ffd16f]';
          if (val === 'medium') return 'bg-[#7bd0ff]/20 text-[#7bd0ff]';
          return 'bg-[#91aaeb]/20 text-[#91aaeb]';
        };

        const shadowClass = val === 'critical' ? 'shadow-[0_0_8px_rgba(238,125,119,0.2)]' : '';

        return (
          <span className={`px-2 py-1 ${getBgColor()} text-[8px] font-black uppercase rounded tracking-widest flex w-fit items-center gap-1 ${shadowClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getDotColor()}`}></span>
            {severityLabel}
          </span>
        );
      },
    },
    {
      key: 'affected_hosts',
      label: 'Affected Hosts',
      sortable: true,
      render: (val) => <span className="font-mono text-sm text-[#dee5ff] font-bold">{val || 0}</span>,
    },
    {
      key: 'published_at',
      label: 'Published',
      sortable: true,
      render: (val) => (
        <span className="text-xs text-[#91aaeb]">
          {val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex h-full bg-[#060e20] text-[#dee5ff] overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden px-6 sm:px-12 py-6 sm:py-8">
        {/* Toast */}
        {toast && (
          <div
            className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-bold shadow-2xl"
            style={{
              background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: toast.type === 'success' ? '#10b981' : '#ee7d77',
              border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ee7d77'}40`,
              backdropFilter: 'blur(12px)',
            }}
          >
            {toast.text}
          </div>
        )}

        {/* ── Header Section ── */}
        <section className="shrink-0">
          {/* Stats Bento Grid - Moved to top per Stitch design */}
          <StitchMetricGrid cols={3}>
            {/* Total Open CVEs */}
            <StitchSummaryCard
              label="Total Open CVEs"
              value={openCount}
              icon="bug_report"
              color="#ee7d77"
              trend={criticalCount > 0 ? `${criticalCount} critical` : 'Stable'}
              workspace="governance"
            />

            {/* Hosts at Risk */}
            <StitchSummaryCard
              label="Hosts at Risk"
              value={cves.reduce((sum, cve) => sum + (cve.affected_hosts || 0), 0)}
              subtitle={`/ ${stats?.total_hosts || 0} Total`}
              icon="warning"
              color="#ffd16f"
              workspace="governance"
            />

            {/* Remediation Rate */}
            <StitchSummaryCard
              label="Remediation Rate"
              value={`${closureRate}%`}
              subtitle="Target 98%"
              icon="check_circle"
              color="#7bd0ff"
              workspace="governance"
            />
          </StitchMetricGrid>

          {/* Page Title and Actions */}
          <StitchPageHeader
            kicker="Vulnerability Management"
            title="CVE Tracker & Remediation"
            description="Real-time CVE tracking and rapid response deployment"
            workspace="governance"
            actions={
              <>
                <StitchButton variant="ghost" icon="download" onClick={exportCSV}>
                  Export CSV
                </StitchButton>
                <StitchButton variant="ghost" icon="refresh" onClick={refresh}>
                  Refresh
                </StitchButton>
                {hasRole('admin', 'operator') && (
                  <>
                    <StitchButton
                      variant="ghost"
                      icon="upload"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      {importing ? 'Importing…' : 'Import'}
                    </StitchButton>
                    <input type="file" ref={fileInputRef} accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={handleImport} />
                  </>
                )}
              </>
            }
          />
        </section>

        {/* Feed controls */}
        {hasRole('admin', 'operator') && (
          <div className="shrink-0 py-6 bg-[#06122d] rounded-xl mb-6">
            <div className="px-6 flex flex-wrap items-end gap-4">
              <StitchFormField label="Sync Source">
                <StitchSelect
                  value={syncSource}
                  onChange={(e) => setSyncSource(e.target.value)}
                  options={[
                    { value: 'nvd', label: 'NVD' },
                    { value: 'cis', label: 'CIS' },
                  ]}
                />
              </StitchFormField>
              {syncSource === 'nvd' && (
                <StitchFormField label="Days Window">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={nvdDays}
                    onChange={e => setNvdDays(parseInt(e.target.value || '2'))}
                    className="rounded-lg px-3 py-2 text-sm w-24 bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                  />
                </StitchFormField>
              )}
              <StitchButton
                variant="primary"
                icon={syncing ? 'refresh' : 'sync'}
                onClick={syncFeed}
                disabled={syncing}
              >
                {syncing ? 'Syncing…' : 'Fetch Latest'}
              </StitchButton>
              {hasRole('admin', 'operator') && (
                <StitchButton
                  variant="ghost"
                  icon={showAddForm ? 'close' : 'add'}
                  onClick={() => setShowAddForm(v => !v)}
                >
                  {showAddForm ? 'Cancel' : 'Register CVE'}
                </StitchButton>
              )}
            </div>

            {/* Manual add form */}
            {showAddForm && hasRole('admin', 'operator') && (
              <div className="mt-6 pt-6 px-6 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-[#2b4680]/20">
                <input
                  placeholder="CVE-2026-XXXX"
                  value={form.cve_id}
                  onChange={e => setForm(c => ({ ...c, cve_id: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                />
                <input
                  placeholder="CVSS Score"
                  value={form.cvss_score}
                  onChange={e => setForm(c => ({ ...c, cvss_score: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                />
                <select
                  value={form.severity}
                  onChange={e => setForm(c => ({ ...c, severity: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                >
                  {['critical', 'high', 'medium', 'low'].map(s => <option key={s}>{s}</option>)}
                </select>
                <input
                  placeholder="Affected packages (comma-sep)"
                  value={form.affected_packages}
                  onChange={e => setForm(c => ({ ...c, affected_packages: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm col-span-2 bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                />
                <input
                  placeholder="Advisory URL"
                  value={form.advisory_url}
                  onChange={e => setForm(c => ({ ...c, advisory_url: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm col-span-2 bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                />
                <input
                  placeholder="Description"
                  value={form.description}
                  onChange={e => setForm(c => ({ ...c, description: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm col-span-3 bg-[#05183c] border border-[#2b4680]/20 text-[#dee5ff] focus:outline-none focus:ring-1 focus:ring-[#7bd0ff]"
                />
                <div className="col-span-3">
                  <StitchButton variant="primary" icon="add" onClick={create}>
                    Add CVE
                  </StitchButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters + Table */}
        <div className="flex-1 overflow-hidden pb-12">
          <div className="flex flex-col gap-1">
            {/* Filter controls above table */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex gap-2">
                {sevFilters.map(f => (
                  <button
                    key={f}
                    onClick={() => setSeverity(f)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      severity === f
                        ? 'bg-[#7bd0ff]/20 text-[#7bd0ff] border border-[#7bd0ff]/40'
                        : 'bg-[#05183c] text-[#91aaeb] border border-[#2b4680]/35 hover:text-[#dee5ff]'
                    }`}
                  >
                    {f || 'All'}
                  </button>
                ))}
              </div>
              <div className="flex-1 max-w-xs relative">
                <AppIcon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91aaeb]" />
                <input
                  placeholder="Search vulnerabilities..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-lg py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#7bd0ff] placeholder-[#91aaeb]/50 bg-[#031d4b] border border-[#2b4680]/20 text-[#dee5ff]"
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-[#91aaeb]">
                <input
                  type="checkbox"
                  checked={onlyWithHosts}
                  onChange={e => setOnlyWithHosts(e.target.checked)}
                  className="rounded"
                />
                Host-linked only
              </label>
              <span className="text-[11px] ml-auto text-[#91aaeb]">{cves.length} results</span>
            </div>

            {/* CVE List - No borders principle */}
            <div className="flex flex-col gap-1">
              {cves.length === 0 ? (
                <div className="px-6 py-12 text-center text-[#91aaeb]">
                  No CVEs found matching your filters.
                </div>
              ) : (
                cves.map((cve, idx) => (
                  <div
                    key={cve.id || idx}
                    className="grid grid-cols-12 px-6 py-5 items-center bg-[#05183c] rounded-lg hover:bg-[#031d4b] transition-colors group cursor-pointer"
                    onClick={() => openDetail(cve.cve_id)}
                  >
                    <div className="col-span-5">
                      {cveColumns[0].render(cve.cve_id, cve)}
                    </div>
                    <div className="col-span-2">
                      {cveColumns[1].render(cve.severity, cve)}
                    </div>
                    <div className="col-span-2 text-right">
                      {cveColumns[2].render(cve.affected_hosts, cve)}
                    </div>
                    <div className="col-span-2 text-right">
                      {cveColumns[3].render(cve.published_at, cve)}
                    </div>
                    <div className="col-span-1 text-right">
                      {hasRole('admin') && (
                        <button
                          className="p-2 text-[#7bd0ff] hover:bg-[#7bd0ff]/10 rounded-full transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            del(cve.id);
                          }}
                          title="Delete CVE"
                        >
                          <AppIcon name="delete" size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedCve && (
          <div className="shrink-0 py-8">
            <div className="bg-[#05183c] rounded-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#91aaeb]">CVE Detail</span>
                  <h3 className="text-xl font-bold mt-1 text-[#dee5ff] tracking-tight">{selectedCve}</h3>
                </div>
                <StitchButton
                  variant="ghost"
                  icon="close"
                  onClick={() => {
                    setSelectedCve(null);
                    setCveDetail(null);
                  }}
                >
                  Close
                </StitchButton>
              </div>
              {loadingDetail ? (
                <div className="flex items-center justify-center h-32 text-[#91aaeb] text-sm gap-3">
                  <AppIcon name="refresh" size={16} className="animate-spin" /> Loading CVE details…
                </div>
              ) : cveDetail?.error ? (
                <p className="text-sm text-[#ee7d77]">{cveDetail.error}</p>
              ) : cveDetail ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Severity', val: cveDetail.severity || '—' },
                      { label: 'CVSS', val: cveDetail.cvss_score || '—' },
                      {
                        label: 'Published',
                        val: cveDetail.published_at ? new Date(cveDetail.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                      },
                      { label: 'Advisory', val: cveDetail.advisory_url ? '🔗 Link' : '—', href: cveDetail.advisory_url },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-4 bg-[#031d4b]/40 border border-[#2b4680]/20"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#91aaeb]">{item.label}</span>
                        {item.href ? (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-bold hover:underline text-[#7bd0ff] block mt-1"
                          >
                            {item.val}
                          </a>
                        ) : (
                          <p className="text-sm font-bold mt-1 text-[#dee5ff]">{item.val}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {cveDetail.description && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#91aaeb] block mb-2">Description</span>
                      <p className="text-sm leading-relaxed text-[#91aaeb]">{cveDetail.description}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#91aaeb] block mb-3">
                      Affected Hosts ({cveDetail.affected_hosts?.length || 0})
                    </span>
                    {!cveDetail.affected_hosts?.length ? (
                      <p className="text-sm mt-2 text-[#91aaeb]">No hosts currently linked.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cveDetail.affected_hosts.map(host => (
                          <div
                            key={host.host_id}
                            className="flex items-center justify-between p-4 rounded-xl bg-[#031d4b]/40 border border-[#2b4680]/20"
                          >
                            <div>
                              <p className="text-sm font-bold text-[#dee5ff]">{host.hostname}</p>
                              <p className="text-[11px] text-[#91aaeb]">{host.ip}</p>
                            </div>
                            <StitchBadge
                              variant={
                                host.status === 'patched'
                                  ? 'success'
                                  : host.status === 'affected'
                                  ? 'error'
                                  : 'warning'
                              }
                            >
                              {host.status?.toUpperCase() || 'UNKNOWN'}
                            </StitchBadge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
