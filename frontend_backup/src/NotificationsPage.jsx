import React, { useEffect, useState } from 'react';

export default function NotificationsPage({ API, apiFetch, hasRole }) {
  const [channels, setChannels] = useState([]);
  const [form, setForm] = useState({
    name: '',
    channel_type: 'webhook',
    url: '',
    slack_webhook_url: '',
    telegram_bot_token: '',
    telegram_chat_id: '',
    email_to: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    smtp_use_tls: true,
    events: 'job_failed,cve_critical',
    is_enabled: true,
  });
  const [edit, setEdit] = useState(null);
  const [editMsg, setEditMsg] = useState('');

  const refresh = () => {
    apiFetch(`${API}/api/notifications/channels`).then((response) => response.json()).then(setChannels).catch(() => {});
  };

  useEffect(refresh, []);

  const parseEvents = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

  const compactConfig = (config) =>
    Object.fromEntries(
      Object.entries(config).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );

  const buildConfig = (state) => {
    if (state.channel_type === 'webhook') return compactConfig({ url: state.url });
    if (state.channel_type === 'slack') return compactConfig({ webhook_url: state.slack_webhook_url });
    if (state.channel_type === 'telegram') return compactConfig({ bot_token: state.telegram_bot_token, chat_id: state.telegram_chat_id });
    if (state.channel_type === 'email') {
      return compactConfig({
        to: state.email_to,
        smtp_host: state.smtp_host,
        smtp_port: state.smtp_port,
        username: state.smtp_username,
        password: state.smtp_password,
        use_tls: state.smtp_use_tls,
      });
    }
    return {};
  };

  const resetForm = () => {
    setForm({
      name: '',
      channel_type: 'webhook',
      url: '',
      slack_webhook_url: '',
      telegram_bot_token: '',
      telegram_chat_id: '',
      email_to: '',
      smtp_host: '',
      smtp_port: '587',
      smtp_username: '',
      smtp_password: '',
      smtp_use_tls: true,
      events: 'job_failed,cve_critical',
      is_enabled: true,
    });
  };

  const create = () => {
    if (!form.name) {
      alert('Name required');
      return;
    }
    apiFetch(`${API}/api/notifications/channels`, {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        channel_type: form.channel_type,
        config: buildConfig(form),
        events: parseEvents(form.events),
        is_enabled: form.is_enabled,
      }),
    }).then(() => {
      refresh();
      resetForm();
    });
  };

  const del = (id) => {
    if (!window.confirm('Delete channel?')) return;
    apiFetch(`${API}/api/notifications/channels/${id}`, { method: 'DELETE' }).then(refresh);
  };

  const test = async (id) => {
    try {
      await apiFetch(`${API}/api/notifications/test/${id}`, { method: 'POST' });
      alert('Test sent!');
    } catch (error) {
      alert(`Test failed: ${error.message}`);
    }
  };

  const toggleEnabled = async (channel) => {
    try {
      await apiFetch(`${API}/api/notifications/channels/${channel.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: !channel.is_enabled }),
      });
      refresh();
    } catch (error) {
      alert(error.message);
    }
  };

  const openEdit = (channel) => {
    setEdit({
      id: channel.id,
      name: channel.name || '',
      channel_type: channel.channel_type || 'webhook',
      url: channel.config?.url || '',
      slack_webhook_url: channel.config?.webhook_url || '',
      telegram_bot_token: channel.config?.bot_token || '',
      telegram_chat_id: channel.config?.chat_id || '',
      email_to: channel.config?.to || '',
      smtp_host: channel.config?.smtp_host || '',
      smtp_port: String(channel.config?.smtp_port || 587),
      smtp_username: channel.config?.username || '',
      smtp_password: '',
      smtp_use_tls: channel.config?.use_tls !== false,
      events: (channel.events || []).join(','),
      is_enabled: !!channel.is_enabled,
      has_secret_config: !!channel.has_secret_config,
    });
    setEditMsg('');
  };

  const saveEdit = async () => {
    if (!edit) return;
    setEditMsg('');
    try {
      const response = await apiFetch(`${API}/api/notifications/channels/${edit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: edit.name,
          config: buildConfig(edit),
          events: parseEvents(edit.events),
          is_enabled: edit.is_enabled,
        }),
      });
      if (response.ok) {
        setEdit(null);
        refresh();
      } else {
        const payload = await response.json();
        setEditMsg(payload.detail || 'Failed');
      }
    } catch (error) {
      setEditMsg(error.message);
    }
  };

  return (
    <div>
      {hasRole('admin') && (
        <div className="card">
          <h3>Add Notification Channel</h3>
          <div className="form-row">
            <input className="input" placeholder="Channel name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <select className="input" value={form.channel_type} onChange={(e) => setForm((prev) => ({ ...prev, channel_type: e.target.value }))}>
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
              <option value="telegram">Telegram</option>
              <option value="email">Email</option>
            </select>
            {form.channel_type === 'webhook' && <input className="input" placeholder="Webhook URL" value={form.url} onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))} style={{ flex: 1 }} />}
            {form.channel_type === 'slack' && <input className="input" placeholder="Slack Incoming Webhook URL" value={form.slack_webhook_url} onChange={(e) => setForm((prev) => ({ ...prev, slack_webhook_url: e.target.value }))} style={{ flex: 1 }} />}
            {form.channel_type === 'telegram' && (
              <>
                <input className="input" placeholder="bot_token" value={form.telegram_bot_token} onChange={(e) => setForm((prev) => ({ ...prev, telegram_bot_token: e.target.value }))} style={{ flex: 1 }} />
                <input className="input" placeholder="chat_id" value={form.telegram_chat_id} onChange={(e) => setForm((prev) => ({ ...prev, telegram_chat_id: e.target.value }))} style={{ width: 160 }} />
              </>
            )}
            {form.channel_type === 'email' && (
              <>
                <input className="input" placeholder="To email" value={form.email_to} onChange={(e) => setForm((prev) => ({ ...prev, email_to: e.target.value }))} style={{ flex: 1 }} />
                <input className="input" placeholder="SMTP host" value={form.smtp_host} onChange={(e) => setForm((prev) => ({ ...prev, smtp_host: e.target.value }))} style={{ flex: 1 }} />
                <input className="input" type="number" min="1" placeholder="SMTP port" value={form.smtp_port} onChange={(e) => setForm((prev) => ({ ...prev, smtp_port: e.target.value }))} style={{ width: 120 }} />
                <input className="input" placeholder="SMTP username (optional)" value={form.smtp_username} onChange={(e) => setForm((prev) => ({ ...prev, smtp_username: e.target.value }))} style={{ flex: 1 }} />
                <input className="input" type="password" placeholder="SMTP password (optional)" value={form.smtp_password} onChange={(e) => setForm((prev) => ({ ...prev, smtp_password: e.target.value }))} style={{ flex: 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                  <input type="checkbox" checked={form.smtp_use_tls} onChange={(e) => setForm((prev) => ({ ...prev, smtp_use_tls: e.target.checked }))} />
                  Use TLS
                </label>
              </>
            )}
            <button className="btn btn-primary" onClick={create}>Add</button>
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <input className="input" placeholder="Events (comma-separated)" value={form.events} onChange={(e) => setForm((prev) => ({ ...prev, events: e.target.value }))} style={{ flex: 1 }} />
            <span className="text-muted" style={{ fontSize: 11 }}>e.g. job_failed, cve_critical, patch_complete</span>
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
              <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))} />
              Enabled
            </label>
          </div>
        </div>
      )}
      <div className="card">
        <h3>Channels ({channels.length})</h3>
        {channels.length === 0 ? <p className="text-muted">No notification channels configured.</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Events</th><th>Enabled</th><th>Actions</th></tr></thead>
            <tbody>{channels.map((channel) => (
              <tr key={channel.id}>
                <td><strong>{channel.name}</strong></td>
                <td><span className="badge badge-info">{channel.channel_type}</span></td>
                <td style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(channel.events || []).join(', ')}</td>
                <td>
                  <button className={`btn btn-sm ${channel.is_enabled ? 'btn-success' : 'btn-secondary'}`} onClick={() => toggleEnabled(channel)} disabled={!hasRole('admin')}>
                    {channel.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => test(channel.id)}>Test</button>
                  {hasRole('admin') && (
                    <>
                      <button className="btn btn-sm" onClick={() => openEdit(channel)} style={{ marginLeft: 6 }}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(channel.id)} style={{ marginLeft: 6 }}>Del</button>
                    </>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {edit && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <h3>Edit Channel</h3>
            {editMsg && <div className="alert alert-danger">{editMsg}</div>}
            <div className="form-row">
              <label>Name</label>
              <input className="input" value={edit.name} onChange={(e) => setEdit((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="form-row">
              <label>Type</label>
              <select className="input" value={edit.channel_type} onChange={(e) => setEdit((prev) => ({ ...prev, channel_type: e.target.value }))}>
                <option value="webhook">Webhook</option>
                <option value="slack">Slack</option>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="form-row">
              <label>Config</label>
              {edit.channel_type === 'webhook' && <input className="input" placeholder={edit.has_secret_config ? 'Webhook URL configured (enter new URL to replace)' : 'Webhook URL'} value={edit.url} onChange={(e) => setEdit((prev) => ({ ...prev, url: e.target.value }))} />}
              {edit.channel_type === 'slack' && <input className="input" placeholder={edit.has_secret_config ? 'Slack webhook configured (enter new URL to replace)' : 'Slack Incoming Webhook URL'} value={edit.slack_webhook_url} onChange={(e) => setEdit((prev) => ({ ...prev, slack_webhook_url: e.target.value }))} />}
              {edit.channel_type === 'telegram' && (
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <input className="input" placeholder={edit.has_secret_config ? 'bot_token configured (enter new token to replace)' : 'bot_token'} value={edit.telegram_bot_token} onChange={(e) => setEdit((prev) => ({ ...prev, telegram_bot_token: e.target.value }))} style={{ flex: 1 }} />
                  <input className="input" placeholder="chat_id" value={edit.telegram_chat_id} onChange={(e) => setEdit((prev) => ({ ...prev, telegram_chat_id: e.target.value }))} style={{ width: 200 }} />
                </div>
              )}
              {edit.channel_type === 'email' && (
                <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                  <input className="input" placeholder="To email" value={edit.email_to} onChange={(e) => setEdit((prev) => ({ ...prev, email_to: e.target.value }))} />
                  <input className="input" placeholder="SMTP host" value={edit.smtp_host} onChange={(e) => setEdit((prev) => ({ ...prev, smtp_host: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" type="number" min="1" placeholder="SMTP port" value={edit.smtp_port} onChange={(e) => setEdit((prev) => ({ ...prev, smtp_port: e.target.value }))} style={{ width: 140 }} />
                    <input className="input" placeholder="SMTP username (optional)" value={edit.smtp_username} onChange={(e) => setEdit((prev) => ({ ...prev, smtp_username: e.target.value }))} style={{ flex: 1 }} />
                  </div>
                  <input className="input" type="password" placeholder={edit.has_secret_config ? 'SMTP password configured (enter new password to replace)' : 'SMTP password (optional)'} value={edit.smtp_password} onChange={(e) => setEdit((prev) => ({ ...prev, smtp_password: e.target.value }))} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                    <input type="checkbox" checked={edit.smtp_use_tls} onChange={(e) => setEdit((prev) => ({ ...prev, smtp_use_tls: e.target.checked }))} />
                    Use TLS
                  </label>
                </div>
              )}
            </div>
            <div className="form-row">
              <label>Events</label>
              <input className="input" value={edit.events} onChange={(e) => setEdit((prev) => ({ ...prev, events: e.target.value }))} />
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                <input type="checkbox" checked={edit.is_enabled} onChange={(e) => setEdit((prev) => ({ ...prev, is_enabled: e.target.checked }))} />
                Enabled
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
