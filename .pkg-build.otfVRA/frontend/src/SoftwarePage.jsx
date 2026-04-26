import { useEffect, useMemo, useState } from 'react';
import { 
  StitchPageHeader, 
  StitchButton, 
  StitchFormField, 
  StitchInput,
  StitchSelect,
  StitchTable,
  StitchBadge,
  StitchTabs,
  StitchSummaryCard,
  StitchMetricGrid
} from './components/StitchComponents';
import { getUser } from './appRuntime';

const INITIAL_CATALOG_FORM = {
  name: '', package_name: '', description: '',
  supported_platforms: 'linux,windows', allowed_actions: 'install',
  default_execution_mode: 'immediate', is_enabled: true,
};

const statusColor = s => {
  const statusMap = {
    success: 'success',
    failed: 'error',
    approved: 'success',
    rejected: 'error',
    submitted: 'warning'
  };
  return statusMap[String(s).toLowerCase()] || 'info';
};

export default function SoftwarePage({ hosts, API, apiFetch }) {
  const user = getUser() || {};
  const isPrivileged = ['admin', 'operator'].includes(user.role);
  const [view, setView]                   = useState('push');
  const [selectedHosts, setSelectedHosts] = useState([]);
  const [packages, setPackages]           = useState('');
  const [action, setAction]               = useState('install');
  const [executionMode, setExecutionMode] = useState('immediate');
  const [operatorNote, setOperatorNote]   = useState('');
  const [loading, setLoading]             = useState(false);
  const [results, setResults]             = useState([]);
  const [queueState, setQueueState]       = useState({ loading: false, hostIp: '', items: [] });
  const [catalog, setCatalog]             = useState([]);
  const [requests, setRequests]           = useState([]);
  const [catalogLoading, setCatalogLoad]  = useState(false);
  const [requestsLoading, setReqLoad]     = useState(false);
  const [catalogForm, setCatalogForm]     = useState(INITIAL_CATALOG_FORM);
  const [catalogMessage, setCatalogMsg]   = useState('');
  const [kioskHostId, setKioskHost]       = useState('');
  const [kioskNote, setKioskNote]         = useState('');
  const [kioskExecOverride, setKioskExec] = useState('default');
  const [kioskMessage, setKioskMsg]       = useState('');
  const [showCatalogForm, setShowCatForm] = useState(false);

  const toggleHost   = ip => setSelectedHosts(p => p.includes(ip) ? p.filter(h => h !== ip) : [...p, ip]);
  const selectAll    = () => setSelectedHosts(hosts.map(h => h.ip));
  const selectNone   = () => setSelectedHosts([]);
  const selectedSingle = selectedHosts.length === 1 ? selectedHosts[0] : '';
  const kioskHosts   = useMemo(() => [...hosts].sort((a, b) => (a.hostname || '').localeCompare(b.hostname || '')), [hosts]);

  const fetchCatalog = async () => {
    setCatalogLoad(true);
    try { const r = await apiFetch(`${API}/api/software-kiosk/catalog${isPrivileged ? '?include_disabled=true' : ''}`); const d = await r.json(); setCatalog(d.items || []); } catch { setCatalog([]); }
    setCatalogLoad(false);
  };
  const fetchRequests = async () => {
    setReqLoad(true);
    try { const r = await apiFetch(`${API}/api/software-kiosk/requests`); const d = await r.json(); setRequests(d.items || []); } catch { setRequests([]); }
    setReqLoad(false);
  };
  const fetchQueue = async hostIp => {
    if (!hostIp) { setQueueState({ loading: false, hostIp: '', items: [] }); return; }
    setQueueState(p => ({ ...p, loading: true, hostIp }));
    try { const r = await apiFetch(`${API}/api/agent/${hostIp}/software/queue`); const d = await r.json(); setQueueState({ loading: false, hostIp, items: d.items || [] }); }
    catch { setQueueState({ loading: false, hostIp, items: [] }); }
  };

  useEffect(() => { fetchCatalog(); fetchRequests(); }, []);
  useEffect(() => { if (selectedSingle) fetchQueue(selectedSingle); else setQueueState({ loading: false, hostIp: '', items: [] }); }, [selectedSingle]);

  const executeOperatorAction = async () => {
    if (!selectedHosts.length || !packages.trim()) return;
    const pkgList = packages.split(',').map(p => p.trim()).filter(Boolean);
    if (!window.confirm(`${action.toUpperCase()} ${pkgList.join(', ')} on ${selectedHosts.length} host(s)?`)) return;
    setLoading(true); setResults([]);
    for (const ip of selectedHosts) {
      try {
        const endpoint = executionMode === 'shutdown' ? `${API}/api/agent/${ip}/software/queue` : `${API}/api/agent/${ip}/software/manage`;
        const r = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ action, packages: pkgList, requested_by: user.username || 'operator', reason: operatorNote }) });
        const d = await r.json();
        setResults(p => [...p, { ip, status: r.ok ? 'success' : 'failed', message: d.status || d.message || d.error || 'Completed' }]);
      } catch (e) { setResults(p => [...p, { ip, status: 'failed', message: e.message }]); }
    }
    setLoading(false);
    if (selectedSingle) fetchQueue(selectedSingle);
  };

  const runPowerAction = async mode => {
    if (!selectedSingle) return;
    if (!window.confirm(`Run queued installs and ${mode} ${selectedSingle}?`)) return;
    try { const r = await apiFetch(`${API}/api/agent/${selectedSingle}/system/${mode}`, { method: 'POST' }); const d = await r.json(); alert(d.status || `${mode} scheduled`); }
    catch (e) { alert(e.message); }
  };

  const createCatalogItem = async () => {
    setCatalogMsg('');
    if (!catalogForm.name.trim() || !catalogForm.package_name.trim()) { setCatalogMsg('Name and package name are required.'); return; }
    try {
      const r = await apiFetch(`${API}/api/software-kiosk/catalog`, { method: 'POST', body: JSON.stringify({ name: catalogForm.name.trim(), package_name: catalogForm.package_name.trim(), description: catalogForm.description.trim(), supported_platforms: catalogForm.supported_platforms.split(',').map(v => v.trim()).filter(Boolean), allowed_actions: catalogForm.allowed_actions.split(',').map(v => v.trim()).filter(Boolean), default_execution_mode: catalogForm.default_execution_mode, is_enabled: catalogForm.is_enabled }) });
      const d = await r.json();
      if (!r.ok) { setCatalogMsg(d.detail || d.error || 'Failed to create catalog item.'); return; }
      setCatalogMsg('✓ Catalog item created.'); setCatalogForm(INITIAL_CATALOG_FORM); setShowCatForm(false); fetchCatalog();
    } catch (e) { setCatalogMsg(e.message); }
  };

  const toggleCatalogItem = async item => {
    try { await apiFetch(`${API}/api/software-kiosk/catalog/${item.id}`, { method: 'PUT', body: JSON.stringify({ ...item, is_enabled: !item.is_enabled }) }); fetchCatalog(); }
    catch (e) { setCatalogMsg(e.message); }
  };

  const submitKioskRequest = async (item, requestedAction) => {
    setKioskMsg('');
    if (!kioskHostId) { setKioskMsg('Choose a target host first.'); return; }
    try {
      const r = await apiFetch(`${API}/api/software-kiosk/requests`, { method: 'POST', body: JSON.stringify({ catalog_item_id: item.id, host_id: Number(kioskHostId), requested_action: requestedAction, execution_mode: kioskExecOverride === 'default' ? item.default_execution_mode : kioskExecOverride, note: kioskNote }) });
      const d = await r.json();
      if (!r.ok) { setKioskMsg(d.detail || d.error || 'Failed to submit request.'); return; }
      setKioskMsg(`✓ Request #${d.id} submitted.`); setKioskNote(''); fetchRequests();
    } catch (e) { setKioskMsg(e.message); }
  };

  const decideRequest = async (id, decision) => {
    try { const r = await apiFetch(`${API}/api/software-kiosk/requests/${id}/${decision}`, { method: 'POST' }); if (!r.ok) { const d = await r.json(); alert(d.detail || 'Failed'); return; } fetchRequests(); }
    catch (e) { alert(e.message); }
  };

  const openReqs   = requests.filter(r => r.status === 'submitted').length;

  return (
    <div className="min-h-screen bg-[#05183c] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <StitchPageHeader
          kicker="Marketplace & Deployment"
          title="Software Kiosk"
          description="Deploy approved software packages across your fleet. Manage installations, removals, and deployment queues."
          actions={
            <div className="flex gap-4 p-1 bg-[#06122d] rounded-xl">
              <StitchButton
                variant={view === 'push' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setView('push')}
              >
                Operator Push
              </StitchButton>
              <StitchButton
                variant={view === 'kiosk' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setView('kiosk')}
              >
                Approved Catalog
              </StitchButton>
            </div>
          }
        />

        {/* Stats Grid */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Fleet"
            value={hosts.length}
            subtitle="managed endpoints"
            icon="dns"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Catalog"
            value={catalog.filter(i => i.is_enabled).length}
            subtitle="enabled items"
            icon="inventory"
            color="#fcc025"
          />
          <StitchSummaryCard
            label="Open Requests"
            value={openReqs}
            subtitle="pending approval"
            icon="pending"
            color="#ee7d77"
          />
          <StitchSummaryCard
            label="In Queue"
            value={queueState.items.length}
            subtitle="shutdown queue"
            icon="schedule"
            color="#91aaeb"
          />
        </StitchMetricGrid>

        {/* PUSH VIEW */}
        {view === 'push' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Host Selection Card */}
              <div className="bg-[#06122d] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">
                    Target Hosts ({selectedHosts.length} selected)
                  </h3>
                  <div className="flex gap-2">
                    <StitchButton variant="tertiary" size="sm" onClick={selectAll}>All</StitchButton>
                    <StitchButton variant="tertiary" size="sm" onClick={selectNone}>None</StitchButton>
                  </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {hosts.map(h => (
                    <label key={h.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedHosts.includes(h.ip) 
                        ? 'bg-[#7bd0ff]/10 border-[#7bd0ff]/25' 
                        : 'bg-[#05183c] border-[#2b4680]/20 hover:bg-[#031d4b]'
                    }`}>
                      <input 
                        type="checkbox" 
                        checked={selectedHosts.includes(h.ip)} 
                        onChange={() => toggleHost(h.ip)}
                        className="w-4 h-4 rounded border-[#2b4680] bg-[#05183c] text-[#7bd0ff] focus:ring-[#7bd0ff] focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#dee5ff]">{h.hostname || h.name}</p>
                        <p className="text-xs text-[#91aaeb]">{h.ip} · {h.os || 'Unknown'}{h.site ? ` · ${h.site}` : ''}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Configuration Card */}
              <div className="bg-[#06122d] rounded-xl p-6 space-y-6">
                <h3 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">Configure Action</h3>
                
                <StitchFormField label="Operation">
                  <StitchSelect
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    options={[
                      { value: 'install', label: 'Install Package' },
                      { value: 'remove', label: 'Remove Package' }
                    ]}
                  />
                </StitchFormField>

                <StitchFormField label="Execution Mode">
                  <StitchSelect
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value)}
                    options={[
                      { value: 'immediate', label: 'Immediate' },
                      { value: 'shutdown', label: 'Queue for Shutdown' }
                    ]}
                  />
                </StitchFormField>

                <StitchFormField label="Packages (comma-separated)">
                  <StitchInput
                    value={packages}
                    onChange={(e) => setPackages(e.target.value)}
                    placeholder="nginx, curl, vim"
                  />
                </StitchFormField>

                <StitchFormField label="Change Ticket / Reason (optional)">
                  <StitchInput
                    value={operatorNote}
                    onChange={(e) => setOperatorNote(e.target.value)}
                    placeholder="CHG-12345"
                  />
                </StitchFormField>

                <StitchButton
                  variant="primary"
                  icon={loading ? undefined : "play_arrow"}
                  onClick={executeOperatorAction}
                  disabled={loading || !selectedHosts.length || !packages.trim()}
                  className="w-full"
                >
                  {loading ? 'Processing…' : executionMode === 'shutdown' ? 'Queue Action' : 'Execute Now'}
                </StitchButton>

                {/* Execution Results */}
                {results.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">Execution Results</h4>
                    {results.map((r, idx) => (
                      <div key={`${r.ip}-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-[#05183c] border border-[#2b4680]/20">
                        <div>
                          <p className="text-xs font-bold font-mono text-[#dee5ff]">{r.ip}</p>
                          <p className="text-xs text-[#91aaeb]">{r.message}</p>
                        </div>
                        <StitchBadge variant={r.status === 'success' ? 'success' : 'error'}>
                          {r.status}
                        </StitchBadge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Shutdown Queue */}
            {selectedSingle && (
              <div className="bg-[#06122d] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">
                    Shutdown Queue — <span className="font-mono text-[#7bd0ff]">{selectedSingle}</span>
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <StitchButton 
                      variant="tertiary"
                      size="sm"
                      icon="refresh"
                      onClick={() => fetchQueue(selectedSingle)}
                      disabled={queueState.loading}
                    >
                      {queueState.loading ? 'Refreshing…' : 'Refresh'}
                    </StitchButton>
                    <StitchButton 
                      variant="secondary"
                      size="sm"
                      icon="restart_alt"
                      onClick={() => runPowerAction('reboot')}
                    >
                      Reboot + Run Queue
                    </StitchButton>
                    <StitchButton 
                      variant="danger"
                      size="sm"
                      icon="power_settings_new"
                      onClick={() => runPowerAction('shutdown')}
                    >
                      Shutdown + Run Queue
                    </StitchButton>
                  </div>
                </div>
                <StitchTable
                  columns={[
                    { 
                      key: 'queued_at', 
                      header: 'Queued At', 
                      render: (row) => row.queued_at ? new Date(row.queued_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' 
                    },
                    { 
                      key: 'action', 
                      header: 'Action', 
                      render: (row) => <StitchBadge variant="info">{row.action}</StitchBadge>
                    },
                    { 
                      key: 'packages', 
                      header: 'Packages', 
                      render: (row) => Array.isArray(row.packages) ? row.packages.join(', ') : ''
                    },
                    { key: 'requested_by', header: 'Requested By', render: (row) => row.requested_by || '—' },
                    { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' }
                  ]}
                  data={queueState.items}
                />
              </div>
            )}
          </div>
        )}

        {/* KIOSK VIEW */}
        {view === 'kiosk' && (
          <div className="space-y-8">
            {/* Request Configuration */}
            <div className="bg-[#06122d] rounded-xl p-6 space-y-6">
              <h3 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">Request Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <StitchFormField label="Target Host">
                    <StitchSelect
                      value={kioskHostId}
                      onChange={(e) => setKioskHost(e.target.value)}
                      options={[
                        { value: '', label: 'Choose target host…' },
                        ...kioskHosts.map(h => ({ value: String(h.id), label: `${h.hostname || h.name} (${h.ip})` }))
                      ]}
                    />
                  </StitchFormField>
                </div>
                <StitchFormField label="Execution Override">
                  <StitchSelect
                    value={kioskExecOverride}
                    onChange={(e) => setKioskExec(e.target.value)}
                    options={[
                      { value: 'default', label: 'Use catalog default' },
                      { value: 'immediate', label: 'Force immediate' },
                      { value: 'shutdown', label: 'Force controlled shutdown' }
                    ]}
                  />
                </StitchFormField>
                <div className="md:col-span-3">
                  <StitchFormField label="Request Note (optional)">
                    <StitchInput
                      value={kioskNote}
                      onChange={(e) => setKioskNote(e.target.value)}
                      placeholder="Reason for this request…"
                    />
                  </StitchFormField>
                </div>
              </div>
              {kioskMessage && (
                <div className={`text-sm font-bold ${kioskMessage.startsWith('✓') ? 'text-[#10b981]' : 'text-[#ee7d77]'}`}>
                  {kioskMessage}
                </div>
              )}
            </div>

            {/* Catalog Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">
                Approved Software Catalog ({catalog.length} items)
              </h3>
              <div className="flex gap-2">
                <StitchButton 
                  variant="tertiary"
                  size="sm"
                  icon="refresh"
                  onClick={fetchCatalog}
                  disabled={catalogLoading}
                />
                {isPrivileged && (
                  <StitchButton 
                    variant="primary"
                    size="sm"
                    icon={showCatalogForm ? 'close' : 'add'}
                    onClick={() => setShowCatForm(v => !v)}
                  >
                    {showCatalogForm ? 'Cancel' : 'Add Item'}
                  </StitchButton>
                )}
              </div>
            </div>

            {/* Catalog Form */}
            {showCatalogForm && (
              <div className="bg-[#06122d] rounded-xl p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <StitchFormField label="Display Name">
                    <StitchInput
                      value={catalogForm.name}
                      onChange={(e) => setCatalogForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Display name"
                    />
                  </StitchFormField>
                  <StitchFormField label="Package ID">
                    <StitchInput
                      value={catalogForm.package_name}
                      onChange={(e) => setCatalogForm(p => ({ ...p, package_name: e.target.value }))}
                      placeholder="Package / apt / winget ID"
                    />
                  </StitchFormField>
                  <div className="md:col-span-2">
                    <StitchFormField label="Description">
                      <StitchInput
                        value={catalogForm.description}
                        onChange={(e) => setCatalogForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Description"
                      />
                    </StitchFormField>
                  </div>
                  <StitchFormField label="Platforms">
                    <StitchInput
                      value={catalogForm.supported_platforms}
                      onChange={(e) => setCatalogForm(p => ({ ...p, supported_platforms: e.target.value }))}
                      placeholder="linux,windows"
                    />
                  </StitchFormField>
                  <StitchFormField label="Default Execution Mode">
                    <StitchSelect
                      value={catalogForm.default_execution_mode}
                      onChange={(e) => setCatalogForm(p => ({ ...p, default_execution_mode: e.target.value }))}
                      options={[
                        { value: 'immediate', label: 'Immediate by default' },
                        { value: 'shutdown', label: 'Controlled shutdown by default' }
                      ]}
                    />
                  </StitchFormField>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={catalogForm.is_enabled} 
                      onChange={e => setCatalogForm(p => ({ ...p, is_enabled: e.target.checked }))}
                      className="w-4 h-4 rounded border-[#2b4680] bg-[#05183c] text-[#7bd0ff] focus:ring-[#7bd0ff] focus:ring-offset-0"
                    />
                    <span className="text-xs text-[#91aaeb]">Enable item immediately</span>
                  </label>
                </div>
                {catalogMessage && (
                  <div className={`text-sm font-bold ${catalogMessage.startsWith('✓') ? 'text-[#10b981]' : 'text-[#ee7d77]'}`}>
                    {catalogMessage}
                  </div>
                )}
                <StitchButton variant="primary" icon="add" onClick={createCatalogItem}>
                  Add Catalog Item
                </StitchButton>
              </div>
            )}

            {/* Bento Grid of Software Packages - Stitch Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {catalog.map((item, idx) => {
                // Determine border color and size based on index for visual variety
                const borderColors = ['#7bd0ff', '#fcc025', '#47c4ff', '#5b74b1', '#ee7d77'];
                const borderColor = borderColors[idx % borderColors.length];
                
                // Make some cards larger (span 2 columns) for featured items
                const isLarge = idx === 0 || (idx > 0 && idx % 6 === 0);
                const colSpan = isLarge ? 'col-span-1 md:col-span-2' : '';
                
                // Icon mapping for common software
                const iconMap = {
                  'docker': 'box',
                  'nginx': 'router',
                  'python': 'terminal',
                  'postgres': 'database',
                  'redis': 'memory',
                  'kubernetes': 'settings_input_component',
                  'k3s': 'settings_input_component'
                };
                const iconName = Object.keys(iconMap).find(key => 
                  item.name.toLowerCase().includes(key) || item.package_name.toLowerCase().includes(key)
                ) || 'inventory';
                const icon = iconMap[iconName] || 'inventory';

                return (
                  <div 
                    key={item.id} 
                    className={`${colSpan} group relative overflow-hidden p-6 rounded-xl bg-[#06122d] border-t-2 transition-all hover:bg-[#05183c] ${!item.is_enabled ? 'opacity-50' : ''}`}
                    style={{ borderTopColor: borderColor }}
                  >
                    {/* Background gradient effect */}
                    <div className="absolute inset-0 opacity-30" style={{
                      background: `linear-gradient(135deg, ${borderColor}1a 0%, transparent 40%)`
                    }}></div>

                    {/* Icon and Status Badge */}
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <div 
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: `${borderColor}33` }}
                      >
                        <span className="material-symbols-outlined text-2xl" style={{ color: borderColor }}>
                          {icon}
                        </span>
                      </div>
                      {item.is_enabled && (
                        <StitchBadge variant="success" size="sm">Active</StitchBadge>
                      )}
                      {!item.is_enabled && (
                        <StitchBadge variant="info" size="sm">Disabled</StitchBadge>
                      )}
                      {item.popular && (
                        <StitchBadge variant="primary" size="sm">Recommended</StitchBadge>
                      )}
                    </div>

                    {/* Title and Description */}
                    <div className="relative z-10">
                      <h3 className={`font-bold text-[#dee5ff] mb-2 ${isLarge ? 'text-xl' : 'text-lg'}`}>
                        {item.name}
                      </h3>
                      <p className={`text-[#91aaeb] mb-6 leading-relaxed ${isLarge ? 'text-sm' : 'text-xs'} ${isLarge ? 'min-h-[4rem]' : 'min-h-[3rem]'}`}>
                        {item.description || 'No description available'}
                      </p>

                      {/* Metadata */}
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-semibold">
                          <span className="text-[#91aaeb]">Package ID</span>
                          <span className="font-mono text-[#dee5ff]">{item.package_name}</span>
                        </div>
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-semibold">
                          <span className="text-[#91aaeb]">Platforms</span>
                          <span className="text-[#dee5ff]">{(item.supported_platforms || []).join(', ') || 'Any'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-semibold">
                          <span className="text-[#91aaeb]">Mode</span>
                          <span className="text-[#dee5ff]">{item.default_execution_mode}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        {item.is_enabled && (item.allowed_actions || []).includes('install') && (
                          <StitchButton 
                            variant="primary"
                            icon="send"
                            onClick={() => submitKioskRequest(item, 'install')}
                            className="w-full justify-center"
                          >
                            {isLarge ? 'Deploy to Fleet' : 'Deploy'}
                          </StitchButton>
                        )}
                        {item.is_enabled && (item.allowed_actions || []).includes('remove') && (
                          <StitchButton 
                            variant="secondary"
                            icon="delete"
                            onClick={() => submitKioskRequest(item, 'remove')}
                            className="w-full justify-center"
                          >
                            Remove
                          </StitchButton>
                        )}
                        {isPrivileged && (
                          <StitchButton 
                            variant="tertiary"
                            onClick={() => toggleCatalogItem(item)}
                            className="w-full justify-center"
                          >
                            {item.is_enabled ? 'Disable' : 'Enable'}
                          </StitchButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          {/* Request Queue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7bd0ff]" style={{ fontSize: '18px' }}>queue</span>
                <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">
                  Active Request Queue
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-[#91aaeb] font-bold uppercase tracking-widest">
                  {requests.length} Tasks Remaining
                </span>
                <StitchButton 
                  onClick={fetchRequests} 
                  variant="ghost"
                  icon="refresh"
                  size="sm"
                />
              </div>
            </div>
            <div className="bg-[#06122d] rounded-xl overflow-hidden border border-[#2b4680]/10">
              <StitchTable
                columns={[
                  { header: '#', render: (row) => <span className="text-xs font-mono text-[#91aaeb]">#{row.id}</span> },
                  { 
                    header: 'Package', 
                    render: (row) => (
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#7bd0ff]" style={{ fontSize: '14px' }}>inventory</span>
                        <div>
                          <p className="text-sm font-semibold text-[#dee5ff]">{row.catalog_item?.name}</p>
                          <p className="text-xs text-[#91aaeb]">{row.requested_action} | {row.note || 'No note'}</p>
                        </div>
                      </div>
                    )
                  },
                  { 
                    header: 'Target', 
                    render: (row) => (
                      <span className="text-sm font-mono text-[#91aaeb]">{row.host?.hostname || row.host?.ip || 'Unknown'}</span>
                    )
                  },
                  { 
                    header: 'Status', 
                    render: (row) => (
                      <span className={`flex items-center gap-2 text-xs font-bold ${
                        row.status === 'submitted' ? 'text-[#ffd16f]' : 
                        row.status === 'approved' ? 'text-[#7bd0ff]' : 
                        row.status === 'rejected' ? 'text-[#ee7d77]' : 
                        'text-[#91aaeb]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          row.status === 'submitted' ? 'bg-[#ffd16f] animate-pulse' : 
                          row.status === 'approved' ? 'bg-[#7bd0ff]' : 
                          row.status === 'rejected' ? 'bg-[#ee7d77]' : 
                          'bg-[#91aaeb]'
                        }`}></span>
                        {row.status}
                      </span>
                    )
                  },
                  { header: 'Requester', render: (row) => <span className="text-xs text-[#91aaeb]">{row.requested_by?.username || '-'}</span> },
                  { 
                    header: 'Actions',
                    align: 'right',
                    render: (row) => (
                      isPrivileged && row.status === 'submitted' ? (
                        <div className="flex gap-2 justify-end">
                          <StitchButton onClick={() => decideRequest(row.id, 'approve')} variant="primary" icon="check" size="sm">Approve</StitchButton>
                          <StitchButton onClick={() => decideRequest(row.id, 'reject')} variant="danger" icon="close" size="sm">Reject</StitchButton>
                        </div>
                      ) : null
                    )
                  }
                ]}
                data={requests}
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
