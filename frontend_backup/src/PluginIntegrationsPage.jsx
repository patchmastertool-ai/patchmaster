import React, { useCallback, useEffect, useMemo, useState } from 'react';

const pluginTypes = ['webhook', 'jira', 'servicenow', 'cmdb'];

function endpointKeyForType(type) {
  if (type === 'jira' || type === 'servicenow') return 'webhook_url';
  if (type === 'cmdb') return 'endpoint_url';
  return 'url';
}

export default function PluginIntegrationsPage({ API, apiFetch, useInterval, toast }) {
  const [plugins, setPlugins] = useState([]);
  const [selectedPluginId, setSelectedPluginId] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dispatchForm, setDispatchForm] = useState({ event_type: 'plugin_test', payloadText: '{}' });
  const [form, setForm] = useState({
    name: '',
    plugin_type: 'webhook',
    is_enabled: true,
    endpoint: '',
    configText: '{}',
    secret: '',
    max_attempts: 3,
    retry_backoff_seconds: '5,20,60',
  });

  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === selectedPluginId) || null,
    [plugins, selectedPluginId],
  );

  const parseApiError = async (response, fallback) => {
    let detail = '';
    try {
      const payload = await response.clone().json();
      detail = payload?.error?.message || payload?.detail || payload?.message || '';
      if (!detail && payload && typeof payload === 'object') detail = JSON.stringify(payload);
    } catch {
      try {
        detail = await response.clone().text();
      } catch {
        detail = '';
      }
    }
    return detail ? `${fallback}: ${detail}` : `${fallback} (${response.status})`;
  };

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/plugins/`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load plugins'));
      const rows = Array.isArray(payload) ? payload : [];
      setPlugins(rows);
      if (rows.length && !rows.find((row) => row.id === selectedPluginId)) {
        setSelectedPluginId(rows[0].id);
      }
      if (!rows.length) setSelectedPluginId(null);
    } catch (err) {
      setError(err.message || 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }, [API, apiFetch, selectedPluginId]);

  const loadDeliveries = useCallback(async () => {
    if (!selectedPluginId) {
      setDeliveries([]);
      return;
    }
    try {
      const response = await apiFetch(`${API}/api/plugins/${selectedPluginId}/deliveries?limit=200`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(await parseApiError(response, 'Failed to load delivery logs'));
      setDeliveries(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.message || 'Failed to load delivery logs');
    }
  }, [API, apiFetch, selectedPluginId]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  useInterval(() => {
    loadPlugins();
    loadDeliveries();
  }, 5000);

  const toQueue = (queueJob) => {
    const jobId = String(queueJob?.id || '').trim();
    if (!jobId) return;
    window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId } }));
  };

  const parseConfig = () => {
    let configObj = {};
    if (form.configText.trim()) configObj = JSON.parse(form.configText);
    const endpointKey = endpointKeyForType(form.plugin_type);
    if (form.endpoint.trim()) configObj[endpointKey] = form.endpoint.trim();
    const backoff = form.retry_backoff_seconds
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0);
    return { configObj, backoff: backoff.length ? backoff : [5, 20, 60] };
  };

  const createPlugin = async () => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const { configObj, backoff } = parseConfig();
      const response = await apiFetch(`${API}/api/plugins/`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          plugin_type: form.plugin_type,
          is_enabled: Boolean(form.is_enabled),
          config: configObj,
          secret: form.secret,
          max_attempts: Number(form.max_attempts || 3),
          retry_backoff_seconds: backoff,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Create plugin failed'));
      setMessage(`Plugin created: ${payload.name}`);
      setSelectedPluginId(payload.id);
      await loadPlugins();
    } catch (err) {
      setError(err.message || 'Create plugin failed');
      if (toast) toast(err.message || 'Create plugin failed', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePlugin = async (plugin) => {
    setActionLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/plugins/${plugin.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: !plugin.is_enabled }),
      });
      if (!response.ok) throw new Error(await parseApiError(response, 'Update plugin failed'));
      await loadPlugins();
    } catch (err) {
      setError(err.message || 'Update plugin failed');
    } finally {
      setActionLoading(false);
    }
  };

  const testPlugin = async () => {
    if (!selectedPlugin) return;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch(`${API}/api/plugins/${selectedPlugin.id}/test`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Plugin test failed'));
      setMessage(`Plugin test queued for ${selectedPlugin.name}`);
      toQueue(payload.queue_job);
      await loadDeliveries();
      await loadPlugins();
    } catch (err) {
      setError(err.message || 'Plugin test failed');
    } finally {
      setActionLoading(false);
    }
  };

  const dispatchEvent = async () => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const parsed = dispatchForm.payloadText.trim() ? JSON.parse(dispatchForm.payloadText) : {};
      const response = await apiFetch(`${API}/api/plugins/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: dispatchForm.event_type.trim(),
          payload: parsed,
          plugin_ids: selectedPlugin ? [selectedPlugin.id] : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Event dispatch failed'));
      setMessage(`Dispatch queued for ${payload.queued || 0} plugin(s).`);
      const firstQueueJob = payload?.items?.[0]?.queue_job;
      toQueue(firstQueueJob);
      await loadDeliveries();
    } catch (err) {
      setError(err.message || 'Event dispatch failed');
    } finally {
      setActionLoading(false);
    }
  };

  const deletePlugin = async (plugin) => {
    if (!window.confirm(`Delete plugin "${plugin.name}"? This will also remove all delivery logs.`)) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/plugins/${plugin.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await parseApiError(response, 'Delete plugin failed'));
      setMessage(`Plugin "${plugin.name}" deleted.`);
      if (selectedPluginId === plugin.id) setSelectedPluginId(null);
      await loadPlugins();
    } catch (err) {
      setError(err.message || 'Delete plugin failed');
    } finally {
      setActionLoading(false);
    }
  };

  const [expandedLog, setExpandedLog] = useState(null);

  const replayDelivery = async (delivery) => {
    if (!selectedPlugin) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/plugins/${selectedPlugin.id}/deliveries/${delivery.id}/replay`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(await parseApiError(response, 'Replay failed'));
      setMessage(`Replay queued for delivery ${delivery.id}.`);
      toQueue(payload.queue_job);
      await loadDeliveries();
    } catch (err) {
      setError(err.message || 'Replay failed');
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'success') return 'badge-success';
    if (s === 'failed') return 'badge-danger';
    if (s === 'running') return 'badge-info';
    if (s === 'pending') return 'badge-warning';
    return 'badge-secondary';
  };

  return (
    <div>
      <div className="card highlight-card">
        <h3>Plugin Integrations</h3>
        <p>Manage webhooks and connector integrations, run signed dispatches, and replay delivery logs through the Operations Queue.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Create Plugin</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" placeholder="Plugin name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className="input" value={form.plugin_type} onChange={(e) => setForm((f) => ({ ...f, plugin_type: e.target.value }))}>
              {pluginTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <input className="input" placeholder="Endpoint URL" value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} />
            <textarea className="input" rows={3} placeholder="Extra config JSON" value={form.configText} onChange={(e) => setForm((f) => ({ ...f, configText: e.target.value }))} />
            <input className="input" placeholder="Secret (optional, for signature)" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} />
            <input className="input" type="number" min="1" placeholder="Max attempts" value={form.max_attempts} onChange={(e) => setForm((f) => ({ ...f, max_attempts: e.target.value }))} />
            <input className="input" placeholder="Retry backoff seconds (comma separated)" value={form.retry_backoff_seconds} onChange={(e) => setForm((f) => ({ ...f, retry_backoff_seconds: e.target.value }))} />
            <label className="toggle-option"><input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))} /> Enabled</label>
            <button className="btn btn-primary" onClick={createPlugin} disabled={actionLoading || loading}>Create Plugin</button>
          </div>
        </div>

        <div className="card">
          <h3>Dispatch Event</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" placeholder="Event type" value={dispatchForm.event_type} onChange={(e) => setDispatchForm((f) => ({ ...f, event_type: e.target.value }))} />
            <textarea className="input" rows={6} placeholder="Payload JSON" value={dispatchForm.payloadText} onChange={(e) => setDispatchForm((f) => ({ ...f, payloadText: e.target.value }))} />
            <button className="btn btn-success" onClick={dispatchEvent} disabled={actionLoading || loading}>Dispatch Event</button>
            <div className="ops-subtle">Dispatch targets selected plugin if one is selected, otherwise all enabled plugins.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Registered Plugins</h3>
          <button className="btn btn-sm" onClick={loadPlugins} disabled={loading || actionLoading}>Refresh</button>
        </div>
        {error && <div className="ops-command-card" style={{ marginBottom: 10 }}>{error}</div>}
        {message && <div className="ops-command-card" style={{ marginBottom: 10 }}>{message}</div>}
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Attempts</th><th>Actions</th></tr></thead>
          <tbody>
            {plugins.map((plugin) => (
              <tr key={plugin.id} className={selectedPluginId === plugin.id ? 'row-selected' : ''}>
                <td>
                  <button className="btn btn-sm" onClick={() => setSelectedPluginId(plugin.id)}>{plugin.name}</button>
                </td>
                <td><span className="badge badge-info">{plugin.plugin_type}</span></td>
                <td><span className={`badge ${plugin.is_enabled ? 'badge-success' : 'badge-secondary'}`}>{plugin.is_enabled ? 'enabled' : 'disabled'}</span></td>
                <td>{plugin.max_attempts}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => togglePlugin(plugin)} disabled={actionLoading}>{plugin.is_enabled ? 'Disable' : 'Enable'}</button>
                  <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={testPlugin} disabled={actionLoading || selectedPluginId !== plugin.id}>Test</button>
                  <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }} onClick={() => deletePlugin(plugin)} disabled={actionLoading}>Delete</button>
                </td>
              </tr>
            ))}
            {!plugins.length && (
              <tr><td colSpan={5} className="text-muted">{loading ? 'Loading plugins...' : 'No plugins configured yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Delivery Logs {selectedPlugin ? `— ${selectedPlugin.name}` : ''}</h3>
          <button className="btn btn-sm" onClick={loadDeliveries} disabled={actionLoading || !selectedPluginId}>Refresh Logs</button>
        </div>
        <table className="table">
          <thead><tr><th>ID</th><th>Event</th><th>Status</th><th>Attempts</th><th>Response</th><th>Actions</th></tr></thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                <td>{delivery.id}</td>
                <td>{delivery.event_type}</td>
                <td><span className={`badge ${statusBadge(delivery.status)}`}>{delivery.status}</span></td>
                <td>{delivery.attempt_count}/{delivery.max_attempts}</td>
                <td>
                  <div>{delivery.response_status || '-'}</div>
                  <div
                    className="ops-subtle"
                    style={{ maxWidth: 360, cursor: 'pointer' }}
                    onClick={() => setExpandedLog(expandedLog === delivery.id ? null : delivery.id)}
                    title="Click to expand"
                  >
                    {expandedLog === delivery.id ? (
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontSize: 11 }}>
                        {delivery.error || delivery.response_body || '-'}
                      </pre>
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {delivery.error || delivery.response_body || '-'}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => replayDelivery(delivery)} disabled={actionLoading || !selectedPluginId}>Replay</button>
                </td>
              </tr>
            ))}
            {!deliveries.length && (
              <tr><td colSpan={6} className="text-muted">{selectedPluginId ? 'No delivery logs yet.' : 'Select a plugin to view logs.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
