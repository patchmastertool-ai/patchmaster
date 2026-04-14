import React, { useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Play, Package, Trash2 } from 'lucide-react';
import { getUser } from './appRuntime';

const INITIAL_CATALOG_FORM = {
  name: '', package_name: '', description: '',
  supported_platforms: 'linux,windows', allowed_actions: 'install',
  default_execution_mode: 'immediate', is_enabled: true,
};

const statusColor = s => ({ success: CH.green, failed: CH.red, approved: CH.green, rejected: CH.red, submitted: CH.yellow }[String(s).toLowerCase()] || CH.textSub);

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

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };
  const openReqs   = requests.filter(r => r.status === 'submitted').length;

  return (
    <CHPage>
      <CHHeader
        kicker="Software Distribution Platform"
        title="Software Center"
        subtitle={`${hosts.length} endpoints · ${catalog.filter(i => i.is_enabled).length} catalog items · ${openReqs} open requests`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Fleet"          value={hosts.length}                              sub="managed endpoints" accent={CH.accent} />
        <CHStat label="Catalog"        value={catalog.filter(i => i.is_enabled).length}  sub="enabled items"    accent={CH.green} />
        <CHStat label="Open Requests"  value={openReqs}                                  sub="pending approval" accent={CH.yellow} />
        <CHStat label="In Queue"       value={queueState.items.length}                   sub="shutdown queue"   accent="#a78bfa" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {[{ k: 'push', l: 'Operator Push' }, { k: 'kiosk', l: 'Approved Catalog' }].map(t => (
          <button key={t.k} onClick={() => setView(t.k)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: view === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', color: view === t.k ? CH.accent : CH.textSub, border: `1px solid ${view === t.k ? CH.accent + '40' : CH.border}` }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── PUSH VIEW ── */}
      {view === 'push' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Host picker */}
            <CHCard>
              <div className="flex items-center justify-between mb-4">
                <CHLabel>Target Hosts ({selectedHosts.length} selected)</CHLabel>
                <div className="flex gap-2">
                  <CHBtn variant="ghost" onClick={selectAll}>All</CHBtn>
                  <CHBtn variant="ghost" onClick={selectNone}>None</CHBtn>
                </div>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {hosts.map(h => (
                  <label key={h.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all"
                    style={{ background: selectedHosts.includes(h.ip) ? `${CH.accent}10` : 'rgba(3,29,75,0.3)', border: `1px solid ${selectedHosts.includes(h.ip) ? CH.accent + '25' : CH.border}` }}>
                    <input type="checkbox" checked={selectedHosts.includes(h.ip)} onChange={() => toggleHost(h.ip)} />
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{h.hostname || h.name}</p>
                      <p className="text-xs" style={{ color: CH.textSub }}>{h.ip} · {h.os || 'Unknown'}{h.site ? ` · ${h.site}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CHCard>

            {/* Action config */}
            <CHCard className="flex flex-col gap-4">
              <CHLabel>Configure Action</CHLabel>
              <div className="flex flex-col gap-1">
                <CHLabel>Operation</CHLabel>
                <select value={action} onChange={e => setAction(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="install">Install Package</option>
                  <option value="remove">Remove Package</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Execution Mode</CHLabel>
                <select value={executionMode} onChange={e => setExecutionMode(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="immediate">Immediate</option>
                  <option value="shutdown">Queue for Shutdown</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Packages (comma-separated)</CHLabel>
                <input value={packages} onChange={e => setPackages(e.target.value)} placeholder="nginx, curl, vim" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Change Ticket / Reason (optional)</CHLabel>
                <input value={operatorNote} onChange={e => setOperatorNote(e.target.value)} placeholder="CHG-12345" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
              <CHBtn variant="primary" onClick={executeOperatorAction} disabled={loading || !selectedHosts.length || !packages.trim()}>
                <Play size={14} /> {loading ? 'Processing…' : executionMode === 'shutdown' ? 'Queue Action' : 'Execute Now'}
              </CHBtn>

              {results.length > 0 && (
                <div className="space-y-2 mt-2">
                  <CHLabel>Execution Results</CHLabel>
                  {results.map((r, idx) => (
                    <div key={`${r.ip}-${idx}`} className="flex items-center justify-between p-2.5 rounded-lg"
                      style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                      <div>
                        <p className="text-xs font-bold font-mono" style={{ color: CH.text }}>{r.ip}</p>
                        <p className="text-xs" style={{ color: CH.textSub }}>{r.message}</p>
                      </div>
                      <CHBadge color={r.status === 'success' ? CH.green : CH.red}>{r.status}</CHBadge>
                    </div>
                  ))}
                </div>
              )}
            </CHCard>
          </div>

          {/* Shutdown queue */}
          {selectedSingle && (
            <CHCard>
              <div className="flex items-center justify-between mb-4">
                <CHLabel>Shutdown Queue — <span className="font-mono">{selectedSingle}</span></CHLabel>
                <div className="flex gap-2 flex-wrap">
                  <CHBtn variant="ghost" onClick={() => fetchQueue(selectedSingle)}>{queueState.loading ? 'Refreshing…' : 'Refresh'}</CHBtn>
                  <CHBtn variant="default" onClick={() => runPowerAction('reboot')}>Reboot + Run Queue</CHBtn>
                  <CHBtn variant="danger" onClick={() => runPowerAction('shutdown')}>Shutdown + Run Queue</CHBtn>
                </div>
              </div>
              <CHTable headers={['Queued At', 'Action', 'Packages', 'Requested By', 'Reason']} emptyMessage="No shutdown-queued installs for this host.">
                {queueState.items.map(item => (
                  <CHTR key={item.id}>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{item.queued_at ? new Date(item.queued_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-3"><CHBadge color={CH.accent}>{item.action}</CHBadge></td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{Array.isArray(item.packages) ? item.packages.join(', ') : ''}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{item.requested_by || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{item.reason || '—'}</td>
                  </CHTR>
                ))}
              </CHTable>
            </CHCard>
          )}
        </>
      )}

      {/* ── KIOSK VIEW ── */}
      {view === 'kiosk' && (
        <>
          {/* Request config */}
          <CHCard className="space-y-4">
            <CHLabel>Request Configuration</CHLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 md:col-span-2">
                <CHLabel>Target Host</CHLabel>
                <select value={kioskHostId} onChange={e => setKioskHost(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="">Choose target host…</option>
                  {kioskHosts.map(h => <option key={h.id} value={h.id}>{h.hostname || h.name} ({h.ip})</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Execution Override</CHLabel>
                <select value={kioskExecOverride} onChange={e => setKioskExec(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="default">Use catalog default</option>
                  <option value="immediate">Force immediate</option>
                  <option value="shutdown">Force controlled shutdown</option>
                </select>
              </div>
              <div className="md:col-span-3 flex flex-col gap-1">
                <CHLabel>Request Note (optional)</CHLabel>
                <input value={kioskNote} onChange={e => setKioskNote(e.target.value)} placeholder="Reason for this request…" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
            </div>
            {kioskMessage && <div className="text-sm font-bold" style={{ color: kioskMessage.startsWith('✓') ? CH.green : CH.red }}>{kioskMessage}</div>}
          </CHCard>

          {/* Catalog */}
          <CHCard>
            <div className="flex items-center justify-between mb-4">
              <CHLabel>Approved Software Catalog ({catalog.length} items)</CHLabel>
              <div className="flex gap-2">
                <CHBtn variant="ghost" onClick={fetchCatalog}><RefreshCw size={14} className={catalogLoading ? 'animate-spin' : ''} /></CHBtn>
                {isPrivileged && <CHBtn variant="primary" onClick={() => setShowCatForm(v => !v)}><Plus size={14} /> {showCatalogForm ? 'Cancel' : 'Add Item'}</CHBtn>}
              </div>
            </div>

            {showCatalogForm && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={catalogForm.name} onChange={e => setCatalogForm(p => ({ ...p, name: e.target.value }))} placeholder="Display name" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  <input value={catalogForm.package_name} onChange={e => setCatalogForm(p => ({ ...p, package_name: e.target.value }))} placeholder="Package / apt / winget ID" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  <input value={catalogForm.description} onChange={e => setCatalogForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" className="md:col-span-2 rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  <input value={catalogForm.supported_platforms} onChange={e => setCatalogForm(p => ({ ...p, supported_platforms: e.target.value }))} placeholder="Platforms (linux,windows)" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                  <select value={catalogForm.default_execution_mode} onChange={e => setCatalogForm(p => ({ ...p, default_execution_mode: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                    <option value="immediate">Immediate by default</option>
                    <option value="shutdown">Controlled shutdown by default</option>
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={catalogForm.is_enabled} onChange={e => setCatalogForm(p => ({ ...p, is_enabled: e.target.checked }))} />
                    <span className="text-xs" style={{ color: CH.textSub }}>Enable item immediately</span>
                  </label>
                </div>
                {catalogMessage && <div className="text-sm font-bold" style={{ color: catalogMessage.startsWith('✓') ? CH.green : CH.red }}>{catalogMessage}</div>}
                <CHBtn variant="primary" onClick={createCatalogItem}>Add Catalog Item</CHBtn>
              </div>
            )}

            <CHTable headers={['Software', 'Package ID', 'Platforms', 'Mode', 'Status', 'Actions']} emptyMessage={catalogLoading ? 'Loading…' : 'No catalog items configured.'}>
              {catalog.map(item => (
                <CHTR key={item.id} style={{ opacity: item.is_enabled ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{item.name}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{item.description || 'No description'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{item.package_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{(item.supported_platforms || []).join(', ') || 'Any'}</td>
                  <td className="px-4 py-3"><CHBadge color={CH.accent}>{item.default_execution_mode}</CHBadge></td>
                  <td className="px-4 py-3"><CHBadge color={item.is_enabled ? CH.green : CH.textSub}>{item.is_enabled ? 'Active' : 'Disabled'}</CHBadge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {item.is_enabled && (item.allowed_actions || []).includes('install') && <CHBtn variant="primary" onClick={() => submitKioskRequest(item, 'install')}>Install</CHBtn>}
                      {item.is_enabled && (item.allowed_actions || []).includes('remove') && <CHBtn variant="danger" onClick={() => submitKioskRequest(item, 'remove')}>Remove</CHBtn>}
                      {isPrivileged && <CHBtn variant="ghost" onClick={() => toggleCatalogItem(item)}>{item.is_enabled ? 'Disable' : 'Enable'}</CHBtn>}
                    </div>
                  </td>
                </CHTR>
              ))}
            </CHTable>
          </CHCard>

          {/* Request queue */}
          <CHCard>
            <div className="flex items-center justify-between mb-4">
              <CHLabel>Request Queue ({requests.length})</CHLabel>
              <CHBtn variant="ghost" onClick={fetchRequests}><RefreshCw size={14} className={requestsLoading ? 'animate-spin' : ''} /></CHBtn>
            </div>
            <CHTable headers={['#', 'Request', 'Target Host', 'Status', 'Requester', 'Actions']} emptyMessage="No kiosk requests yet.">
              {requests.map(item => (
                <CHTR key={item.id}>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>#{item.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{item.catalog_item?.name}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{item.requested_action} · {item.note || 'No note'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold" style={{ color: CH.text }}>{item.host?.hostname || 'Unknown'}</p>
                    <p className="text-xs font-mono" style={{ color: CH.textSub }}>{item.host?.ip || ''}</p>
                  </td>
                  <td className="px-4 py-3"><CHBadge color={statusColor(item.status)}>{item.status}</CHBadge></td>
                  <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{item.requested_by?.username || '—'}</td>
                  <td className="px-4 py-3">
                    {isPrivileged && item.status === 'submitted' && (
                      <div className="flex gap-1.5">
                        <CHBtn variant="primary" onClick={() => decideRequest(item.id, 'approve')}>Approve</CHBtn>
                        <CHBtn variant="danger" onClick={() => decideRequest(item.id, 'reject')}>Reject</CHBtn>
                      </div>
                    )}
                  </td>
                </CHTR>
              ))}
            </CHTable>
          </CHCard>
        </>
      )}
    </CHPage>
  );
}
