import React, { useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
} from './components/StitchComponents';

const getChannelTypeVariant = (type) => {
  if (type === 'webhook') return 'primary';
  if (type === 'slack') return 'success';
  if (type === 'telegram') return 'info';
  if (type === 'email') return 'warning';
  return 'info';
};

function ChannelForm({ form, setForm, onSubmit, onCancel, title }) {
  return (
    <div className="bg-surface-container-low p-6 rounded-xl mb-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Channel Configuration</p>
          <h3 className="text-xl font-bold text-on-surface">{title}</h3>
        </div>
        {onCancel && (
          <StitchButton
            variant="secondary"
            size="sm"
            onClick={onCancel}
            icon="close"
          >
            Close
          </StitchButton>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Channel Name</label>
          <input
            className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Slack Ops Alerts"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Type</label>
          <select
            className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
            value={form.channel_type}
            onChange={(e) => setForm(f => ({ ...f, channel_type: e.target.value }))}
          >
            <option value="webhook">Webhook</option>
            <option value="slack">Slack</option>
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
          </select>
        </div>
        {form.channel_type === 'webhook' && (
          <div className="col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Webhook URL</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              value={form.url}
              onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
        )}
        {form.channel_type === 'slack' && (
          <div className="col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Slack Webhook URL</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              value={form.slack_webhook_url}
              onChange={(e) => setForm(f => ({ ...f, slack_webhook_url: e.target.value }))}
              placeholder="https://hooks.slack.com/..."
            />
          </div>
        )}
        {form.channel_type === 'telegram' && (<>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Bot Token</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              value={form.telegram_bot_token}
              onChange={(e) => setForm(f => ({ ...f, telegram_bot_token: e.target.value }))}
              placeholder="bot_token"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Chat ID</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              value={form.telegram_chat_id}
              onChange={(e) => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
              placeholder="chat_id"
            />
          </div>
        </>)}
        {form.channel_type === 'email' && (<>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">To Email</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              type="email"
              value={form.email_to}
              onChange={(e) => setForm(f => ({ ...f, email_to: e.target.value }))}
              placeholder="ops@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">SMTP Host</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              value={form.smtp_host}
              onChange={(e) => setForm(f => ({ ...f, smtp_host: e.target.value }))}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Port</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              type="number"
              value={form.smtp_port}
              onChange={(e) => setForm(f => ({ ...f, smtp_port: e.target.value }))}
              placeholder="587"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Username</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
              value={form.smtp_username}
              onChange={(e) => setForm(f => ({ ...f, smtp_username: e.target.value }))}
              placeholder="optional"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={form.smtp_use_tls} 
              onChange={e => setForm(f => ({ ...f, smtp_use_tls: e.target.checked }))}
              className="rounded"
            />
            <span className="text-xs text-on-surface-variant">Use TLS</span>
          </div>
        </>)}
        <div className="col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Subscribed Events (comma-separated)</label>
          <input
            className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
            value={form.events}
            onChange={(e) => setForm(f => ({ ...f, events: e.target.value }))}
            placeholder="job_failed, cve_critical, patch_complete"
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={form.is_enabled} 
            onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
            className="rounded"
          />
          <span className="text-xs text-on-surface-variant">Enable channel immediately</span>
        </div>
      </div>
      <StitchButton
        variant="primary"
        onClick={onSubmit}
        icon={title.includes('Edit') ? 'save' : 'add'}
        className="w-full justify-center"
      >
        {title.includes('Edit') ? 'Save Changes' : 'Add Channel'}
      </StitchButton>
    </div>
  );
}

export default function NotificationsPage({ API, apiFetch, hasRole }) {
  const [channels, setChannels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editMsg, setEditMsg] = useState('');
  
  const BLANK = {
    name: '', channel_type: 'webhook', url: '', slack_webhook_url: '',
    telegram_bot_token: '', telegram_chat_id: '', email_to: '',
    smtp_host: '', smtp_port: '587', smtp_username: '', smtp_use_tls: true,
    events: 'job_failed,cve_critical', is_enabled: true,
  };
  const [form, setForm] = useState(BLANK);

  const refresh = () => apiFetch(`${API}/api/notifications/channels`)
    .then(r => r.json()).then(setChannels).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const compactConfig = cfg => Object.fromEntries(Object.entries(cfg).filter(([, v]) => v !== '' && v != null));
  const buildConfig = s => {
    if (s.channel_type === 'webhook')  return compactConfig({ url: s.url });
    if (s.channel_type === 'slack')    return compactConfig({ webhook_url: s.slack_webhook_url });
    if (s.channel_type === 'telegram') return compactConfig({ bot_token: s.telegram_bot_token, chat_id: s.telegram_chat_id });
    if (s.channel_type === 'email')    return compactConfig({ to: s.email_to, smtp_host: s.smtp_host, smtp_port: s.smtp_port, use_tls: s.smtp_use_tls });
    return {};
  };
  const parseEvents = v => v.split(',').map(s => s.trim()).filter(Boolean);

  const create = () => {
    if (!form.name) return alert('Name required');
    apiFetch(`${API}/api/notifications/channels`, {
      method: 'POST',
      body: JSON.stringify({ name: form.name, channel_type: form.channel_type, config: buildConfig(form), events: parseEvents(form.events), is_enabled: form.is_enabled }),
    }).then(() => { refresh(); setForm(BLANK); setShowForm(false); });
  };

  const del = id => {
    if (!window.confirm('Delete channel?')) return;
    apiFetch(`${API}/api/notifications/channels/${id}`, { method: 'DELETE' }).then(refresh);
  };

  const testChannel = async id => {
    try {
      await apiFetch(`${API}/api/notifications/test/${id}`, { method: 'POST' });
      alert('Test notification sent!');
    } catch (e) { alert(`Failed: ${e.message}`); }
  };

  const toggleEnabled = async channel => {
    await apiFetch(`${API}/api/notifications/channels/${channel.id}`, {
      method: 'PUT', body: JSON.stringify({ is_enabled: !channel.is_enabled }),
    });
    refresh();
  };

  const openEdit = ch => {
    setEdit({
      id: ch.id, name: ch.name || '', channel_type: ch.channel_type || 'webhook',
      url: ch.config?.url || '', slack_webhook_url: ch.config?.webhook_url || '',
      telegram_bot_token: ch.config?.bot_token || '', telegram_chat_id: ch.config?.chat_id || '',
      email_to: ch.config?.to || '', smtp_host: ch.config?.smtp_host || '',
      smtp_port: String(ch.config?.smtp_port || 587), smtp_use_tls: ch.config?.use_tls !== false,
      events: (ch.events || []).join(','), is_enabled: !!ch.is_enabled,
    });
    setEditMsg('');
  };

  const saveEdit = async () => {
    if (!edit) return; setEditMsg('');
    try {
      const r = await apiFetch(`${API}/api/notifications/channels/${edit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: edit.name, config: buildConfig(edit), events: parseEvents(edit.events), is_enabled: edit.is_enabled }),
      });
      if (r.ok) { setEdit(null); refresh(); }
      else { const d = await r.json().catch(() => ({})); setEditMsg(d.detail || 'Failed'); }
    } catch (e) { setEditMsg(e.message); }
  };

  const active = channels.filter(c => c.is_enabled).length;

  return (
    <div className="space-y-8">
      <StitchPageHeader
        kicker="Event Routing & Alerting"
        title="Notification Channels"
        description={`${active} active of ${channels.length} configured channels`}
      />

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard 
          label="Total Channels" 
          value={channels.length} 
          icon="notifications"
          color="#7bd0ff"
        />
        <StitchSummaryCard 
          label="Active" 
          value={active} 
          subtitle="receiving events"
          icon="check_circle"
          color="#10b981"
        />
        <StitchSummaryCard 
          label="Webhook" 
          value={channels.filter(c => c.channel_type === 'webhook').length} 
          icon="webhook"
          color="#7bd0ff"
        />
        <StitchSummaryCard 
          label="Email/Chat" 
          value={channels.filter(c => c.channel_type !== 'webhook').length} 
          icon="mail"
          color="#ffd16f"
        />
      </StitchMetricGrid>

      {/* Add Form */}
      {showForm && (
        <ChannelForm form={form} setForm={setForm} onSubmit={create} onCancel={() => setShowForm(false)} title="Add Notification Channel" />
      )}

      {/* Edit Form */}
      {edit && (
        <ChannelForm form={edit} setForm={setEdit} onSubmit={saveEdit} onCancel={() => setEdit(null)} title="Edit Channel" />
      )}
      {editMsg && (
        <div className="mb-6 p-4 rounded-lg bg-error/15 text-error text-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {editMsg}
        </div>
      )}

      {/* Channel Table */}
      <div className="bg-surface-container-low p-6 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-on-surface">Configured Channels</h3>
          <StitchButton
            variant="primary"
            size="sm"
            onClick={() => setShowForm(v => !v)}
            icon="add"
          >
            Add Channel
          </StitchButton>
        </div>
        <StitchTable
          columns={[
            { key: 'name', header: 'Name', render: (val) => <span className="font-bold text-on-surface">{val}</span> },
            { key: 'channel_type', header: 'Type', render: (val) => <StitchBadge variant={getChannelTypeVariant(val)} size="sm">{val}</StitchBadge> },
            { key: 'events', header: 'Events', render: (val) => <span className="text-xs text-on-surface-variant max-w-xs block truncate">{(val || []).join(', ') || '—'}</span> },
            { 
              key: 'is_enabled', 
              header: 'Status', 
              render: (val, row) => (
                <button 
                  onClick={() => toggleEnabled(row)}
                  className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                    val 
                      ? 'bg-primary/20 text-primary border border-primary/40' 
                      : 'bg-on-surface-variant/15 text-on-surface-variant border border-on-surface-variant/20'
                  }`}
                >
                  {val ? 'Enabled' : 'Disabled'}
                </button>
              )
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (val, row) => (
                <div className="flex gap-2">
                  <StitchButton variant="secondary" size="sm" onClick={() => testChannel(row.id)} icon="send">Test</StitchButton>
                  <StitchButton variant="secondary" size="sm" onClick={() => openEdit(row)} icon="edit">Edit</StitchButton>
                  <StitchButton variant="secondary" size="sm" onClick={() => del(row.id)} icon="delete">Delete</StitchButton>
                </div>
              )
            }
          ]}
          data={channels}
        />
      </div>
    </div>
  );
}
