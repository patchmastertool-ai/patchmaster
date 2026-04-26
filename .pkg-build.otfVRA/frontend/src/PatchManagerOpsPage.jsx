import { useState, useEffect, useCallback } from 'react';
import { 
  StitchPageHeader,
  StitchButton,
  StitchBadge,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchTable,
  StitchSummaryCard,
  StitchMetricGrid
} from './components/StitchComponents';

export default function PatchManagerOpsPage({ hosts = [], API, apiFetch, useInterval }) {
  const [packages, setPackages]     = useState([]);
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [hostFilter, setHostFilter] = useState('all');
  const [searchQuery, setSearch]    = useState('');
  const [selectedHost, setSelHost]  = useState(null);
  const [scanning, setScanning]     = useState(false);
  const [actionMsg, setActionMsg]   = useState('');

  const refresh = useCallback(async () => {
    if (!API || !apiFetch) return;
    try {
      const hostId = selectedHost || (hosts[0]?.id);
      if (!hostId) { setLoading(false); return; }

      const [pkgRes, jobRes] = await Promise.all([
        apiFetch(`${API}/api/hosts/${hostId}/packages`).then(r => r.json()).catch(() => []),
        apiFetch(`${API}/api/jobs/?host_id=${hostId}&limit=20`).then(r => r.json()).catch(() => []),
      ]);

      setPackages(Array.isArray(pkgRes) ? pkgRes : []);
      setJobs(Array.isArray(jobRes) ? jobRes : jobRes?.items ?? []);
    } catch {
      setPackages([]);
      setJobs([]);
    }
    setLoading(false);
  }, [API, apiFetch, selectedHost, hosts]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);
  if (useInterval) useInterval(refresh, 15000);

  const activeJobs  = jobs.filter(j => j.status === 'running');
  const upgradable = packages.filter(p => p.upgradable || p.available_version);
  const filtered   = upgradable.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !p.name?.toLowerCase().includes(q)) return false;
    if (hostFilter === 'security' && !p.is_security) return false;
    if (hostFilter === 'critical' && p.severity !== 'critical') return false;
    return true;
  });

  const onlineCount  = hosts.filter(h => h.is_online).length;
  const activeHost   = hosts.find(h => h.id === selectedHost) || hosts[0];

  const scanHost = async () => {
    if (!activeHost) return;
    setScanning(true);
    setActionMsg('Scanning for upgrades...');
    try {
      const r = await apiFetch(`${API}/api/hosts/${activeHost.id}/scan`, { method: 'POST' });
      setActionMsg(r.ok ? 'Scan dispatched successfully.' : 'Scan request failed.');
    } catch { setActionMsg('Connection error during scan.'); }
    setTimeout(() => setActionMsg(''), 4000);
    setScanning(false);
    refresh();
  };

  const patchHost = async () => {
    if (!activeHost) return;
    setActionMsg('Dispatching patch job...');
    try {
      const r = await apiFetch(`${API}/api/hosts/${activeHost.id}/patch`, { method: 'POST' });
      setActionMsg(r.ok ? 'Patch job dispatched.' : 'Patch dispatch failed.');
    } catch { setActionMsg('Connection error.'); }
    setTimeout(() => setActionMsg(''), 4000);
    refresh();
  };

  const getSeverityStatus = (pkg) => {
    if (pkg.severity === 'critical' || pkg.is_security) return 'error';
    if (pkg.severity === 'high') return 'warning';
    return 'info';
  };

  const getSeverityLabel = (pkg) => {
    if (pkg.severity === 'critical' || pkg.is_security) return 'CRITICAL';
    if (pkg.severity === 'high') return 'HIGH';
    return 'STANDARD';
  };

  const jobStatusMap = (s) => {
    if (s === 'success') return 'success';
    if (s === 'failed')  return 'error';
    if (s === 'running') return 'info';
    return 'pending';
  };

  if (!hosts.length) {
    return (
      <div className="min-h-screen bg-[#05183c] p-6 flex flex-col items-center justify-center gap-4 text-[#91aaeb]">
        <span className="material-symbols-outlined text-5xl text-[#2b4680]">security</span>
        <p className="text-lg font-bold text-[#dee5ff]">No hosts registered</p>
        <p className="text-sm">Onboard agents to begin patch management.</p>
      </div>
    );
  }

  const getSeverityBadge = (pkg) => {
    const status = getSeverityStatus(pkg);
    const label = getSeverityLabel(pkg);
    
    if (status === 'error') {
      return <StitchBadge variant="error">{label}</StitchBadge>;
    } else if (status === 'warning') {
      return <StitchBadge variant="warning">{label}</StitchBadge>;
    } else {
      return <StitchBadge variant="info">{label}</StitchBadge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#05183c] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <StitchPageHeader
          kicker="Infrastructure"
          title="Patch Manager"
          description={`${hosts.length} total hosts | ${onlineCount} online`}
          actions={
            <StitchButton
              variant="secondary"
              size="sm"
              icon={scanning ? 'refresh' : 'search'}
              onClick={scanHost}
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : 'Scan'}
            </StitchButton>
          }
        />

        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Total Hosts"
            value={hosts.length}
            subtitle="registered"
            icon="dns"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Online"
            value={onlineCount}
            subtitle="ready for patching"
            icon="sensors"
            color="#10b981"
          />
          <StitchSummaryCard
            label="Upgradable"
            value={upgradable.length}
            subtitle="packages available"
            icon="update"
            color="#ffd16f"
          />
          <StitchSummaryCard
            label="Active Jobs"
            value={activeJobs.length}
            subtitle="currently running"
            icon="pending"
            color="#7bd0ff"
          />
        </StitchMetricGrid>

        {actionMsg && (
          <div className="rounded-xl px-5 py-3 text-sm font-bold bg-[#7bd0ff]/10 text-[#7bd0ff]">
            {actionMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20 space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <StitchFormField label="Host">
                    <StitchSelect
                      value={selectedHost || activeHost?.id || ''}
                      onChange={(e) => setSelHost(Number(e.target.value) || e.target.value)}
                    >
                      {hosts.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.hostname} {h.is_online ? '(online)' : '(offline)'}
                        </option>
                      ))}
                    </StitchSelect>
                  </StitchFormField>
                </div>
                <div className="flex gap-2">
                  {[
                    { label: 'All', value: 'all' },
                    { label: 'Security', value: 'security' },
                    { label: 'Critical', value: 'critical' },
                  ].map(f => (
                    <StitchButton
                      key={f.value}
                      variant={hostFilter === f.value ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setHostFilter(f.value)}
                    >
                      {f.label}
                    </StitchButton>
                  ))}
                </div>
              </div>
              <StitchFormField label="">
                <StitchInput
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter packages..."
                />
              </StitchFormField>
            </div>

            <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#dee5ff]">Pending Updates</h3>
                  <p className="text-xs text-[#91aaeb]">
                    {filtered.filter(p => p.is_security || p.severity === 'critical').length} critical and security patches
                  </p>
                </div>
                <StitchButton
                  variant="primary"
                  icon="bolt"
                  onClick={patchHost}
                >
                  Execute Patching
                </StitchButton>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32 text-[#91aaeb] text-sm gap-3">
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  Loading packages...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#91aaeb]">
                  <span className="material-symbols-outlined text-3xl text-[#10b981]">check_circle</span>
                  <p className="text-sm font-bold text-[#dee5ff]">All packages up to date</p>
                  <p className="text-xs">Run a scan to check for new updates.</p>
                </div>
              ) : (
                <StitchTable
                  columns={[
                    { 
                      key: 'name', 
                      header: 'Package', 
                      render: (row) => (
                        <div>
                          <p className="text-sm font-bold text-[#dee5ff]">{row.name || row.package}</p>
                          {row.description && <p className="text-[10px] text-[#91aaeb]">{row.description}</p>}
                        </div>
                      )
                    },
                    { 
                      key: 'current_version', 
                      header: 'Current', 
                      render: (row) => <span className="text-xs font-mono text-[#b4c0d7]">{row.current_version || row.version || '-'}</span>
                    },
                    { 
                      key: 'available_version', 
                      header: 'Target', 
                      render: (row) => <span className="text-xs font-mono text-[#7bd0ff]">{row.available_version || '-'}</span>
                    },
                    { 
                      key: 'severity', 
                      header: 'Severity', 
                      render: (row) => getSeverityBadge(row)
                    },
                  ]}
                  data={filtered}
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#06122d] p-6 rounded-xl border-l-4 border-[#ffd16f] border border-[#2b4680]/20">
              <h4 className="text-[10px] uppercase tracking-widest text-[#91aaeb] font-bold mb-4">Patch Impact</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-[#b4c0d7]">Downtime Estimate</span>
                  <span className="text-sm font-bold text-[#ffd16f]">4m 12s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#b4c0d7]">Reboot Required</span>
                  <span className="text-sm font-bold text-[#dee5ff]">Yes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#b4c0d7]">Success Rate</span>
                  <span className="text-sm font-bold text-[#7bd0ff]">98.4%</span>
                </div>
              </div>
            </div>

            <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20">
              <h4 className="text-[10px] uppercase tracking-widest text-[#91aaeb] font-bold mb-4">Infrastructure Status</h4>
              <div className="flex flex-col items-center py-4">
                <div className="text-4xl font-bold text-[#dee5ff]">
                  {hosts.length ? Math.round((onlineCount / hosts.length) * 100) : 0}%
                </div>
                <span className="text-[10px] text-[#91aaeb] uppercase">Healthy</span>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex justify-between">
                  <span className="text-xs text-[#b4c0d7]">Secured Nodes</span>
                  <span className="text-xs font-bold text-[#dee5ff]">{onlineCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#b4c0d7]">Outdated Nodes</span>
                  <span className="text-xs font-bold text-[#ee7d77]">{hosts.length - onlineCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20">
              <h4 className="text-[10px] uppercase tracking-widest text-[#91aaeb] font-bold mb-4">Live Execution</h4>
              <div className="space-y-2">
                {jobs.slice(0, 5).map((job, i) => (
                  <div key={job.id || i} className="flex gap-2 text-[10px]">
                    <span className="font-mono text-[#91aaeb]">
                      {job.created_at ? new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                    <span className="text-[#dee5ff] flex-1">{job.action || 'patch'}</span>
                    <StitchBadge variant={jobStatusMap(job.status)}>{job.status}</StitchBadge>
                  </div>
                ))}
                {jobs.length === 0 && <p className="text-xs text-[#91aaeb]">No recent activity.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
