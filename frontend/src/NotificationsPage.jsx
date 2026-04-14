import React, { useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Trash2, Send, Edit2, X, Bell } from 'lucide-react';

const TYPE_COLORS = {
  webhook: CH.accent,
  slack: '#4ade80',
  telegram: '#60a5fa',
  email: '#fbbf24',
};

function ChannelForm({ form, setForm, onSubmit, onCancel, title }) {
  const inp = (key, ph, opts = {}) => (
    <input {...opts}
      placeholder={ph} value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      className="rounded-lg px-3 py-2.5 text-sm w-full"
      style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
    />
  );

  return (
    <CHCard>
      <div className="flex items-center justify-between mb-5">
        <CHLabel>{title}</CHLabel>
        {onCancel && <CHBtn variant="ghost" onClick={onCancel}><X size={14} /></CHBtn>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <CHLabel>Channel Name</CHLabel>
          {inp('name', 'e.g. Slack Ops Alerts')}
        </div>
        <div className="flex flex-col gap-1">
          <CHLabel>Type</CHLabel>
          <select value={form.channel_type} onChange={e => setForm(f => ({ ...f, channel_type: e.target.value }))}
            className="rounded-lg px-3 py-2.5 text-sm"
            style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
            {['webhook','slack','telegram','email'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        {form.channel_type === 'webhook' && (
          <div className="col-span-2 flex flex-col gap-1"><CHLabel>Webhook URL</CHLabel>{inp('url', 'https://…')}</div>
        )}
        {form.channel_type === 'slack' && (
          <div className="col-span-2 flex flex-col gap-1"><CHLabel>Slack Webhook URL</CHLabel>{inp('slack_webhook_url', 'https://hooks.slack.com/…')}</div>
        )}
        {form.channel_type === 'telegram' && (<>
          <div className="flex flex-col gap-1"><CHLabel>Bot Token</CHLabel>{inp('telegram_bot_token', 'bot_token')}</div>
          <div className="flex flex-col gap-1"><CHLabel>Chat ID</CHLabel>{inp('telegram_chat_id', 'chat_id')}</div>
        </>)}
        {form.channel_type === 'email' && (<>
          <div className="flex flex-col gap-1"><CHLabel>To Email</CHLabel>{inp('email_to', 'ops@company.com')}</div>
          <div className="flex flex-col gap-1"><CHLabel>SMTP Host</CHLabel>{inp('smtp_host', 'smtp.gmail.com')}</div>
          <div className="flex flex-col gap-1"><CHLabel>Port</CHLabel>{inp('smtp_port', '587', { type: 'number' })}</div>
          <div className="flex flex-col gap-1"><CHLabel>Username</CHLabel>{inp('smtp_username', 'optional')}</div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={form.smtp_use_tls} onChange={e => setForm(f => ({ ...f, smtp_use_tls: e.target.checked }))} />
            <span className="text-xs" style={{ color: CH.textSub }}>Use TLS</span>
          </div>
        </>)}
        <div className="col-span-2 flex flex-col gap-1">
          <CHLabel>Subscribed Events (comma-separated)</CHLabel>
          {inp('events', 'job_failed, cve_critical, patch_complete')}
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))} />
          <span className="text-xs" style={{ color: CH.textSub }}>Enable channel immediately</span>
        </div>
      </div>
      <div className="mt-5">
        <CHBtn variant="primary" onClick={onSubmit}>
          {title.includes('Edit') ? 'Save Changes' : 'Add Channel'}
        </CHBtn>
      </div>
    </CHCard>
  );
}

export default function NotificationsPage({ API, apiFetch, hasRole }) {
  const [channels, setChannels]   = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [edit, setEdit]           = useState(null);
  const [editMsg, setEditMsg]     = useState('');
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
    <CHPage>
      <CHHeader
        kicker="Event Routing & Alerting"
        title="Notification Channels"
        subtitle={`${active} active of ${channels.length} configured channels`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={refresh}><RefreshCw size={14} /> Refresh</CHBtn>
            {hasRole('admin') && (
              <CHBtn variant="primary" onClick={() => setShowForm(v => !v)}>
                <Plus size={14} /> Add Channel
              </CHBtn>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Channels" value={channels.length}          accent={CH.accent} />
        <CHStat label="Active"         value={active}      sub="receiving events" accent={CH.green} />
        <CHStat label="Webhook"        value={channels.filter(c => c.channel_type === 'webhook').length}  accent={CH.accent} />
        <CHStat label="Email/Chat"     value={channels.filter(c => c.channel_type !== 'webhook').length} accent="#a78bfa" />
      </div>

      {/* Add Form */}
      {showForm && hasRole('admin') && (
        <ChannelForm form={form} setForm={setForm} onSubmit={create} onCancel={() => setShowForm(false)} title="Add Notification Channel" />
      )}

      {/* Edit Form */}
      {edit && (
        <ChannelForm form={edit} setForm={setEdit} onSubmit={saveEdit} onCancel={() => setEdit(null)} title="Edit Channel" />
      )}
      {editMsg && <p className="text-sm" style={{ color: CH.red }}>{editMsg}</p>}

      {/* Channel Table */}
      <CHCard>
        <CHTable headers={['Name', 'Type', 'Events', 'Status', 'Actions']}
          emptyMessage="No notification channels configured yet.">
          {channels.map(ch => (
            <CHTR key={ch.id}>
              <td className="px-6 py-4 font-bold" style={{ color: CH.text }}>{ch.name}</td>
              <td className="px-6 py-4">
                <CHBadge color={TYPE_COLORS[ch.channel_type] || CH.textSub}>{ch.channel_type}</CHBadge>
              </td>
              <td className="px-6 py-4 text-xs max-w-xs" style={{ color: CH.textSub }}>
                {(ch.events || []).join(', ') || '—'}
              </td>
              <td className="px-6 py-4">
                <button onClick={() => hasRole('admin') && toggleEnabled(ch)}
                  className="rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: ch.is_enabled ? `${CH.green}20` : `${CH.textSub}15`,
                    color: ch.is_enabled ? CH.green : CH.textSub,
                    border: `1px solid ${ch.is_enabled ? CH.green + '40' : CH.border}`,
                    cursor: hasRole('admin') ? 'pointer' : 'default',
                  }}>
                  {ch.is_enabled ? 'Enabled' : 'Disabled'}
                </button>
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2 justify-end">
                  <CHBtn variant="ghost" onClick={() => testChannel(ch.id)}><Send size={12} /> Test</CHBtn>
                  {hasRole('admin') && <>
                    <CHBtn variant="ghost" onClick={() => openEdit(ch)}><Edit2 size={12} /> Edit</CHBtn>
                    <CHBtn variant="danger" onClick={() => del(ch.id)}><Trash2 size={12} /></CHBtn>
                  </>}
                </div>
              </td>
            </CHTR>
          ))}
        </CHTable>
      </CHCard>
    </CHPage>
  );
}
