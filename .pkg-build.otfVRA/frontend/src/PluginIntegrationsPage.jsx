import React, { useCallback, useEffect, useState } from 'react';
import { hasRole } from './appRuntime';
import { 
  StitchPageHeader,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchBadge,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchActivityItem
} from './components/StitchComponents';

const PLUGIN_TYPES = ['webhook', 'jira', 'servicenow', 'cmdb'];
const typeColor = t => ({ webhook: '#7bd0ff', jira: '#0052cc', servicenow: '#61ac1f', cmdb: '#a78bfa' }[t] || '#91aaeb');

function endpointKeyForType(type) {
  if (type === 'jira' || type === 'servicenow') return 'webhook_url';
  if (type === 'cmdb') return 'endpoint_url';
  return 'url';
}

const BLANK_FORM = { name: '', plugin_type: 'webhook', is_enabled: true, endpoint: '', configText: '{}', secret: '', max_attempts: 3, retry_backoff_seconds: '5,20,60' };

export default function PluginIntegrationsPage({ API, apiFetch, useInterval, toast }) {
  const isAdmin = hasRole('admin');
  const [plugins, setPlugins] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActing] = useState(false);
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [dispatchForm, setDispForm] = useState({ event_type: 'plugin_test', payloadText: '{}' });

  const selected = plugins.find(p => p.id === selectedId) || null;

  const parseErr = async (r, fb) => {
    let d = '';
    try { const p = await r.clone().json(); d = p?.error?.message || p?.detail || p?.message || ''; } catch {}
    return d ? `${fb}: ${d}` : `${fb} (${r.status})`;
  };

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/api/plugins/`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(await parseErr(r, 'Failed to load plugins'));
      const rows = Array.isArray(d) ? d : [];
      setPlugins(rows);
      if (rows.length && !rows.find(p => p.id === selectedId)) setSelectedId(rows[0].id);
    } catch (e) { setNotice(e.message); }
    setLoading(false);
  }, [API, apiFetch, selectedId]);

  const loadDeliveries = useCallback(async () => {
    if (!selectedId) { setDeliveries([]); return; }
    try {
      const r = await apiFetch(`${API}/api/plugins/${selectedId}/deliveries?limit=200`);
      const d = await r.json().catch(() => []);
      if (!r.ok) throw new Error(await parseErr(r, 'Failed to load deliveries'));
      setDeliveries(Array.isArray(d) ? d : []);
    } catch (e) { setNotice(e.message); }
  }, [API, apiFetch, selectedId]);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);
  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);
  if (useInterval) useInterval(() => { loadPlugins(); loadDeliveries(); }, 5000);

  const toQueue = job => { const id = String(job?.id || '').trim(); if (id) window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: id } })); };

  const createPlugin = async () => {
    setActing(true);
    try {
      let cfg = {};
      if (form.configText.trim()) cfg = JSON.parse(form.configText);
      const epKey = endpointKeyForType(form.plugin_type);
      if (form.endpoint.trim()) cfg[epKey] = form.endpoint.trim();
      const backoff = form.retry_backoff_seconds.split(',').map(x => +x.trim()).filter(x => x > 0);
      const r = await apiFetch(`${API}/api/plugins/`, { method: 'POST', body: JSON.stringify({ name: form.name.trim(), plugin_type: form.plugin_type, is_enabled: Boolean(form.is_enabled), config: cfg, secret: form.secret, max_attempts: +form.max_attempts || 3, retry_backoff_seconds: backoff.length ? backoff : [5, 20, 60] }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Create failed'));
      setNotice(`Plugin created: ${d.name}`); setSelectedId(d.id); setShowForm(false); setForm(BLANK_FORM); await loadPlugins();
    } catch (e) { setNotice(e.message); if (toast) toast(e.message, 'danger'); }
    setActing(false);
  };

  const togglePlugin = async plugin => {
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/plugins/${plugin.id}`, { method: 'PUT', body: JSON.stringify({ is_enabled: !plugin.is_enabled }) });
      if (!r.ok) throw new Error(await parseErr(r, 'Update failed'));
      await loadPlugins();
    } catch (e) { setNotice(e.message); }
    setActing(false);
  };

  const testPlugin = async () => {
    if (!selected) return;
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/plugins/${selected.id}/test`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Test failed'));
      setNotice(`Test queued for ${selected.name}`); toQueue(d.queue_job); await loadDeliveries(); await loadPlugins();
    } catch (e) { setNotice(e.message); }
    setActing(false);
  };

  const dispatchEvent = async () => {
    setActing(true);
    try {
      const payload = dispatchForm.payloadText.trim() ? JSON.parse(dispatchForm.payloadText) : {};
      const r = await apiFetch(`${API}/api/plugins/dispatch`, { method: 'POST', body: JSON.stringify({ event_type: dispatchForm.event_type.trim(), payload, plugin_ids: selected ? [selected.id] : undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Dispatch failed'));
      setNotice(`Dispatched to ${d.queued || 0} plugin(s)`); toQueue(d?.items?.[0]?.queue_job); await loadDeliveries();
    } catch (e) { setNotice(e.message); }
    setActing(false);
  };

  const deletePlugin = async plugin => {
    if (!window.confirm(`Delete plugin "${plugin.name}"?`)) return;
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/plugins/${plugin.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await parseErr(r, 'Delete failed'));
      setNotice(`Plugin "${plugin.name}" deleted`); if (selectedId === plugin.id) setSelectedId(null); await loadPlugins();
    } catch (e) { setNotice(e.message); }
    setActing(false);
  };

  const replayDelivery = async delivery => {
    if (!selected) return;
    setActing(true);
    try {
      const r = await apiFetch(`${API}/api/plugins/${selected.id}/deliveries/${delivery.id}/replay`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Replay failed'));
      setNotice(`Replay queued`); toQueue(d.queue_job); await loadDeliveries();
    } catch (e) { setNotice(e.message); }
    setActing(false);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const deliveryStatusVariant = (status) => {
    if (status === 'success') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'running') return 'warning';
    return 'default';
  };

  const deliveryStatusIcon = (status) => {
    if (status === 'success') return 'check_circle';
    if (status === 'failed') return 'error_outline';
    if (status === 'running') return 'sync';
    return 'schedule';
  };

  return (
    <div className="min-h-screen bg-[#060e20] p-6">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Page Header */}
        <StitchPageHeader
          kicker="Infrastructure Management"
          title="Plugin Integrations"
          description={`${plugins.filter(p => p.is_enabled).length} active integrations${selected ? ` · ${deliveries.length} deliveries for ${selected.name}` : ''}`}
          actions={
            <div className="flex gap-3">
              <StitchButton
                variant="secondary"
                size="sm"
                icon="refresh"
                onClick={loadPlugins}
                disabled={loading}
              >
                Refresh
              </StitchButton>
              <StitchButton
                variant="primary"
                size="sm"
                icon="add"
                onClick={() => setShowForm(v => !v)}
              >
                {showForm ? 'Cancel' : 'Register Plugin'}
              </StitchButton>
            </div>
          }
        />

        {/* Notice Banner */}
        {notice && (
          <div className={`rounded-xl px-6 py-4 text-sm font-bold ${
            notice.toLowerCase().includes('fail') || notice.toLowerCase().includes('error')
              ? 'bg-[#7f2927]/20 text-[#ff9993] border-l-4 border-[#ee7d77]' 
              : 'bg-[#004c69]/20 text-[#7bd0ff] border-l-4 border-[#7bd0ff]'
          }`}>
            {notice}
          </div>
        )}

        {/* KPI Summary Cards */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Total Plugins"
            value={plugins.length}
            icon="extension"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Active"
            value={plugins.filter(p => p.is_enabled).length}
            subtitle="enabled"
            icon="check_circle"
            color="#10b981"
          />
          <StitchSummaryCard
            label="Plugin Types"
            value={[...new Set(plugins.map(p => p.plugin_type))].length}
            subtitle="distinct"
            icon="category"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Deliveries"
            value={deliveries.length}
            subtitle="in log"
            icon="send"
            color="#ffd16f"
          />
        </StitchMetricGrid>

        {/* Create Plugin Form */}
        {showForm && (
          <div className="bg-[#05183c] p-8 rounded-xl border border-[#2b4680]/20 space-y-6">
            <div>
              <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">New Integration</div>
              <h3 className="text-2xl font-bold tracking-tight text-[#dee5ff]">Register Plugin</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StitchFormField label="Plugin Name" required>
                <StitchInput
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jira Alerts"
                />
              </StitchFormField>
              <StitchFormField label="Plugin Type" required>
                <StitchSelect
                  value={form.plugin_type}
                  onChange={(e) => setForm(f => ({ ...f, plugin_type: e.target.value }))}
                >
                  {PLUGIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </StitchSelect>
              </StitchFormField>
              <div className="md:col-span-2">
                <StitchFormField label="Endpoint URL" required>
                  <StitchInput
                    value={form.endpoint}
                    onChange={(e) => setForm(f => ({ ...f, endpoint: e.target.value }))}
                    placeholder="https://..."
                  />
                </StitchFormField>
              </div>
              <StitchFormField label="Secret (optional)" hint="HMAC signature secret">
                <StitchInput
                  value={form.secret}
                  onChange={(e) => setForm(f => ({ ...f, secret: e.target.value }))}
                  placeholder="Secret key"
                  type="password"
                />
              </StitchFormField>
              <StitchFormField label="Max Attempts">
                <StitchInput
                  value={String(form.max_attempts)}
                  onChange={(e) => setForm(f => ({ ...f, max_attempts: +e.target.value }))}
                  type="number"
                />
              </StitchFormField>
              <div className="md:col-span-2">
                <StitchFormField label="Extra Config JSON" hint="Additional configuration as JSON object">
                  <StitchInput
                    value={form.configText}
                    onChange={(e) => setForm(f => ({ ...f, configText: e.target.value }))}
                    placeholder="{}"
                  />
                </StitchFormField>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={form.is_enabled} 
                  onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded bg-[#00225a] border-[#2b4680] text-[#7bd0ff] focus:ring-[#7bd0ff]"
                />
                <span className="text-sm text-[#dee5ff]">Enable immediately</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-[#2b4680]/10">
              <StitchButton
                variant="primary"
                onClick={createPlugin}
                disabled={actionLoading}
              >
                {actionLoading ? 'Creating...' : 'Register Plugin'}
              </StitchButton>
              <StitchButton
                variant="secondary"
                onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}
              >
                Cancel
              </StitchButton>
            </div>
          </div>
        )}

        {/* Plugin Registry & Delivery Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Plugin Registry */}
          <div className="lg:col-span-2 bg-[#05183c] p-8 rounded-xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">Integration Registry</div>
                <h2 className="text-2xl font-bold tracking-tight text-[#dee5ff]">Registered Plugins</h2>
              </div>
              <div className="text-sm text-[#91aaeb]">
                <span className="font-bold text-[#dee5ff]">{plugins.length}</span> total
              </div>
            </div>
            
            <div className="space-y-3">
              {plugins.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#00225a]/40 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-4xl text-[#91aaeb]">extension</span>
                  </div>
                  <p className="text-sm text-[#91aaeb]">No plugins registered yet</p>
                  <p className="text-xs text-[#4d556b] mt-1">Click "Register Plugin" to add your first integration</p>
                </div>
              ) : plugins.map(p => (
                <div 
                  key={p.id} 
                  className={`p-4 rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-all ${
                    p.id === selectedId 
                      ? 'bg-[#004c69]/20 border-2 border-[#7bd0ff]/40' 
                      : 'bg-[#031d4b] border-2 border-[#2b4680]/20 hover:border-[#2b4680]/40'
                  }`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${typeColor(p.plugin_type)}20`, color: typeColor(p.plugin_type) }}
                    >
                      <span className="material-symbols-outlined text-xl">bolt</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#dee5ff] truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StitchBadge variant="info" size="sm">{p.plugin_type}</StitchBadge>
                        <StitchBadge variant={p.is_enabled ? 'success' : 'default'} size="sm">
                          {p.is_enabled ? 'Active' : 'Disabled'}
                        </StitchBadge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    <StitchButton
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); togglePlugin(p); }}
                      disabled={actionLoading}
                    >
                      {p.is_enabled ? 'Disable' : 'Enable'}
                    </StitchButton>
                    {isAdmin && (
                      <StitchButton
                        variant="danger"
                        size="sm"
                        icon="delete"
                        onClick={(e) => { e.stopPropagation(); deletePlugin(p); }}
                        disabled={actionLoading}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Dispatch Controls */}
            {selected && (
              <div className="mt-8 pt-8 border-t border-[#2b4680]/20 space-y-6">
                <div>
                  <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">Test & Dispatch</div>
                  <h3 className="text-lg font-bold tracking-tight text-[#dee5ff]">{selected.name}</h3>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <StitchButton
                    variant="secondary"
                    size="sm"
                    icon="science"
                    onClick={testPlugin}
                    disabled={actionLoading}
                  >
                    Test Plugin
                  </StitchButton>
                  <StitchButton
                    variant="primary"
                    size="sm"
                    icon="bolt"
                    onClick={dispatchEvent}
                    disabled={actionLoading}
                  >
                    Dispatch Event
                  </StitchButton>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <StitchFormField label="Event Type">
                    <StitchInput
                      value={dispatchForm.event_type}
                      onChange={(e) => setDispForm(f => ({ ...f, event_type: e.target.value }))}
                      placeholder="e.g. plugin_test"
                    />
                  </StitchFormField>
                  <StitchFormField label="Payload JSON">
                    <StitchInput
                      value={dispatchForm.payloadText}
                      onChange={(e) => setDispForm(f => ({ ...f, payloadText: e.target.value }))}
                      placeholder="{}"
                    />
                  </StitchFormField>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Log */}
          <div className="bg-[#05183c] p-8 rounded-xl flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">Delivery History</div>
                <h2 className="text-2xl font-bold tracking-tight text-[#dee5ff]">Delivery Log</h2>
              </div>
            </div>
            
            {!selected ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#00225a]/40 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-4xl text-[#91aaeb]">history</span>
                  </div>
                  <p className="text-sm text-[#91aaeb]">Select a plugin</p>
                  <p className="text-xs text-[#4d556b] mt-1">View delivery history and replay events</p>
                </div>
              </div>
            ) : deliveries.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#00225a]/40 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-4xl text-[#91aaeb]">inbox</span>
                  </div>
                  <p className="text-sm text-[#91aaeb]">No deliveries yet</p>
                  <p className="text-xs text-[#4d556b] mt-1">Test or dispatch events to see delivery logs</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px]">
                {deliveries.map(delivery => (
                  <StitchActivityItem
                    key={delivery.id}
                    icon={deliveryStatusIcon(delivery.status)}
                    iconColor={delivery.status === 'success' ? '#7bd0ff' : delivery.status === 'failed' ? '#ee7d77' : '#ffd16f'}
                    iconBg={delivery.status === 'success' ? 'rgba(123,208,255,0.2)' : delivery.status === 'failed' ? 'rgba(238,125,119,0.2)' : 'rgba(255,209,111,0.2)'}
                    title={delivery.event_type || 'Unknown Event'}
                    subtitle={`${delivery.attempt_count || 0} attempt(s)`}
                    badge={delivery.status}
                    badgeVariant={deliveryStatusVariant(delivery.status)}
                    timestamp={formatTimestamp(delivery.created_at)}
                    onClick={() => {
                      if (delivery.status === 'failed' || delivery.status === 'success') {
                        replayDelivery(delivery);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
