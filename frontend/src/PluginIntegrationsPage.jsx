import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Zap, Trash2, RotateCcw } from 'lucide-react';

const PLUGIN_TYPES = ['webhook', 'jira', 'servicenow', 'cmdb'];
const typeColor = t => ({ webhook: CH.accent, jira: '#0052cc', servicenow: '#61ac1f', cmdb: '#a78bfa' }[t] || CH.textSub);

function endpointKeyForType(type) {
  if (type === 'jira' || type === 'servicenow') return 'webhook_url';
  if (type === 'cmdb') return 'endpoint_url';
  return 'url';
}

const BLANK_FORM = { name: '', plugin_type: 'webhook', is_enabled: true, endpoint: '', configText: '{}', secret: '', max_attempts: 3, retry_backoff_seconds: '5,20,60' };

export default function PluginIntegrationsPage({ API, apiFetch, useInterval, toast }) {
  const [plugins, setPlugins]               = useState([]);
  const [selectedId, setSelectedId]         = useState(null);
  const [deliveries, setDeliveries]         = useState([]);
  const [loading, setLoading]               = useState(false);
  const [actionLoading, setActing]          = useState(false);
  const [notice, setNotice]                 = useState('');
  const [showForm, setShowForm]             = useState(false);
  const [form, setForm]                     = useState(BLANK_FORM);
  const [dispatchForm, setDispForm]         = useState({ event_type: 'plugin_test', payloadText: '{}' });

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

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Integration Ecosystem"
        title="Plugin Integrations"
        subtitle={`${plugins.filter(p => p.is_enabled).length} active · ${plugins.length} total · ${deliveries.length} deliveries in logs`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={loadPlugins}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></CHBtn>
            <CHBtn variant="primary" onClick={() => setShowForm(v => !v)}><Plus size={14} /> {showForm ? 'Cancel' : 'Register Plugin'}</CHBtn>
          </div>
        }
      />

      {notice && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: notice.toLowerCase().includes('fail') || notice.toLowerCase().includes('error') ? `${CH.red}12` : `${CH.green}12`, color: notice.toLowerCase().includes('fail') ? CH.red : CH.green }}>
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Plugins"  value={plugins.length}                         accent={CH.accent} />
        <CHStat label="Active"         value={plugins.filter(p => p.is_enabled).length} sub="enabled"  accent={CH.green} />
        <CHStat label="Types"          value={[...new Set(plugins.map(p => p.plugin_type))].length} sub="distinct" accent="#a78bfa" />
        <CHStat label="Deliveries"     value={deliveries.length}                      sub="in log"      accent={CH.yellow} />
      </div>

      {/* Create Plugin */}
      {showForm && (
        <CHCard className="space-y-4">
          <CHLabel>Register New Plugin</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <CHLabel>Plugin Name</CHLabel>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jira Alerts" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Plugin Type</CHLabel>
              <select value={form.plugin_type} onChange={e => setForm(f => ({ ...f, plugin_type: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                {PLUGIN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Endpoint URL</CHLabel>
              <input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} placeholder="https://…" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Secret (optional)</CHLabel>
              <input type="password" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="HMAC secret…" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Max Attempts</CHLabel>
              <input type="number" value={form.max_attempts} onChange={e => setForm(f => ({ ...f, max_attempts: +e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Extra Config JSON</CHLabel>
              <input value={form.configText} onChange={e => setForm(f => ({ ...f, configText: e.target.value }))} placeholder='{}' className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))} />
              <span className="text-xs" style={{ color: CH.textSub }}>Enable immediately</span>
            </div>
          </div>
          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={createPlugin} disabled={actionLoading}>{actionLoading ? 'Creating…' : 'Register Plugin'}</CHBtn>
            <CHBtn variant="ghost" onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}

      {/* Plugin List + Delivery Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CHCard>
          <CHLabel>Plugin Registry ({plugins.length})</CHLabel>
          <div className="mt-4 space-y-2">
            {plugins.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No plugins registered yet.</p> : null}
            {plugins.map(p => (
              <div key={p.id} className="p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setSelectedId(p.id)}
                style={{ background: p.id === selectedId ? `${CH.accent}10` : 'rgba(3,29,75,0.3)', border: `1px solid ${p.id === selectedId ? CH.accent + '30' : CH.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${typeColor(p.plugin_type)}15`, color: typeColor(p.plugin_type) }}>
                    <Zap size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{p.name}</p>
                    <CHBadge color={typeColor(p.plugin_type)}>{p.plugin_type}</CHBadge>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <CHBadge color={p.is_enabled ? CH.green : CH.textSub}>{p.is_enabled ? 'Active' : 'Off'}</CHBadge>
                  <CHBtn variant="ghost" onClick={e => { e.stopPropagation(); togglePlugin(p); }} disabled={actionLoading}>
                    {p.is_enabled ? 'Disable' : 'Enable'}
                  </CHBtn>
                  <CHBtn variant="danger" onClick={e => { e.stopPropagation(); deletePlugin(p); }} disabled={actionLoading}>
                    <Trash2 size={12} />
                  </CHBtn>
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div className="mt-5 pt-4 space-y-4" style={{ borderTop: `1px solid ${CH.border}` }}>
              <CHLabel>Dispatch / Test — {selected.name}</CHLabel>
              <div className="flex gap-3 flex-wrap">
                <CHBtn variant="default" onClick={testPlugin} disabled={actionLoading}>Test Plugin</CHBtn>
                <CHBtn variant="primary" onClick={dispatchEvent} disabled={actionLoading}><Zap size={12} /> Dispatch Event</CHBtn>
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Event Type</CHLabel>
                <input value={dispatchForm.event_type} onChange={e => setDispForm(f => ({ ...f, event_type: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Payload JSON</CHLabel>
                <input value={dispatchForm.payloadText} onChange={e => setDispForm(f => ({ ...f, payloadText: e.target.value }))}
                  placeholder='{}'  className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
              </div>
            </div>
          )}
        </CHCard>

        <CHCard>
          <CHLabel>Delivery Log</CHLabel>
          {!selected ? (
            <p className="text-sm py-6 text-center" style={{ color: CH.textSub }}>Select a plugin to view its delivery history.</p>
          ) : (
            <CHTable headers={['Event', 'Status', 'Attempts', 'Time', '']} emptyMessage="No deliveries yet." className="mt-4">
              {deliveries.map(d => (
                <CHTR key={d.id}>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{d.event_type || '—'}</td>
                  <td className="px-4 py-3">
                    <CHBadge color={d.status === 'success' ? CH.green : d.status === 'failed' ? CH.red : CH.yellow}>{d.status}</CHBadge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{d.attempts ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: CH.textSub }}>
                    {d.created_at ? new Date(d.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <CHBtn variant="ghost" onClick={() => replayDelivery(d)} disabled={actionLoading}><RotateCcw size={12} /></CHBtn>
                  </td>
                </CHTR>
              ))}
            </CHTable>
          )}
        </CHCard>
      </div>
    </CHPage>
  );
}
