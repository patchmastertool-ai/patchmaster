import React, { useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Trash2, Code2, Play } from 'lucide-react';

const triggerColor = t => ({
  pre_patch: CH.accent, post_patch: CH.green, on_failure: CH.red,
  on_success: '#4ade80', pre_snapshot: '#a78bfa', post_snapshot: '#c084fc',
}[t] || CH.textSub);

const BLANK_FORM = { name: '', trigger: 'pre_patch', script_type: 'bash', script_content: '', timeout_seconds: 120, stop_on_failure: true, tags: '', is_enabled: true, order: 0 };

export default function PatchHooksPage({ API, apiFetch, toast }) {
  const [hooks, setHooks]           = useState([]);
  const [executions, setExecs]      = useState([]);
  const [tab, setTab]               = useState('hooks');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(BLANK_FORM);
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    const [h, e] = await Promise.all([
      apiFetch(`${API}/api/hooks/`).then(r => r.json()).catch(() => []),
      apiFetch(`${API}/api/hooks/executions`).then(r => r.json()).catch(() => []),
    ]);
    setHooks(Array.isArray(h) ? h : []);
    setExecs(Array.isArray(e) ? e : []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.script_content) { if (toast) toast('Name and script are required', 'warning'); return; }
    setSaving(true);
    const r = await apiFetch(`${API}/api/hooks/`, { method: 'POST', body: JSON.stringify(form) });
    if (r.ok) {
      if (toast) toast('Hook created', 'success');
      setShowForm(false); setForm(BLANK_FORM); load();
    } else {
      const d = await r.json().catch(() => ({}));
      if (toast) toast(d.detail || 'Failed', 'danger');
    }
    setSaving(false);
  };

  const toggle = async h => {
    await apiFetch(`${API}/api/hooks/${h.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !h.is_active }) });
    load();
  };

  const del = async id => {
    if (!window.confirm('Delete this hook?')) return;
    await apiFetch(`${API}/api/hooks/${id}`, { method: 'DELETE' });
    if (toast) toast('Deleted', 'success'); load();
  };

  const activeHooks = hooks.filter(h => h.is_enabled !== false);

  return (
    <CHPage>
      <CHHeader
        kicker="Patch Lifecycle"
        title="Patch Hooks"
        subtitle={`${activeHooks.length} active hooks · ${executions.length} recent executions`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={load}><RefreshCw size={14} /> Refresh</CHBtn>
            <CHBtn variant="primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={14} /> {showForm ? 'Cancel' : 'Create Hook'}
            </CHBtn>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Hooks"    value={hooks.length}        sub="configured"     accent={CH.accent} />
        <CHStat label="Active"         value={activeHooks.length}  sub="will fire"      accent={CH.green} />
        <CHStat label="Pre-Patch"      value={hooks.filter(h => h.trigger === 'pre_patch').length}  accent={CH.accent} />
        <CHStat label="Post-Patch"     value={hooks.filter(h => h.trigger === 'post_patch').length} accent={CH.green} />
      </div>

      {/* Create Form */}
      {showForm && (
        <CHCard className="space-y-4">
          <CHLabel>Create Lifecycle Hook</CHLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 flex flex-col gap-1">
              <CHLabel>Hook Name</CHLabel>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pre-patch service drain"
                className="rounded-lg px-3 py-2.5 text-sm w-full"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Lifecycle Event</CHLabel>
              <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
                {['pre_patch','post_patch','on_failure','on_success','pre_snapshot','post_snapshot'].map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Script Type</CHLabel>
              <select value={form.script_type} onChange={e => setForm(f => ({ ...f, script_type: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
                {['bash','powershell','python'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Timeout (seconds)</CHLabel>
              <input type="number" value={form.timeout_seconds}
                onChange={e => setForm(f => ({ ...f, timeout_seconds: +e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Execution Order</CHLabel>
              <input type="number" value={form.order}
                onChange={e => setForm(f => ({ ...f, order: +e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="col-span-2 md:col-span-3 flex flex-col gap-1">
              <CHLabel>Script Content</CHLabel>
              <textarea value={form.script_content}
                onChange={e => setForm(f => ({ ...f, script_content: e.target.value }))}
                placeholder={'#!/bin/bash\n# Your hook script here'}
                rows={8}
                className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}`, color: CH.text, lineHeight: 1.6 }}
              />
            </div>
            <div className="col-span-2 md:col-span-3 flex flex-col gap-1">
              <CHLabel>Host Tags (comma-separated, empty = all)</CHLabel>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="prod, site:London"
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.stop_on_failure} onChange={e => setForm(f => ({ ...f, stop_on_failure: e.target.checked }))} />
              <span className="text-xs" style={{ color: CH.textSub }}>Stop on failure</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))} />
              <span className="text-xs" style={{ color: CH.textSub }}>Enable immediately</span>
            </div>
          </div>
          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create Hook'}</CHBtn>
            <CHBtn variant="ghost" onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {['hooks', 'executions'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: tab === t ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
              color: tab === t ? CH.accent : CH.textSub,
              border: `1px solid ${tab === t ? CH.accent + '40' : CH.border}`,
            }}>
            {t === 'hooks' ? `Hooks (${hooks.length})` : `Executions (${executions.length})`}
          </button>
        ))}
      </div>

      {/* Hooks List */}
      {tab === 'hooks' && (
        <div className="space-y-4">
          {hooks.length === 0 ? (
            <CHCard><p className="text-sm text-center py-8" style={{ color: CH.textSub }}>No hooks configured yet.</p></CHCard>
          ) : (
            hooks.map(hook => (
              <CHCard key={hook.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Code2 size={16} style={{ color: triggerColor(hook.trigger || hook.event) }} />
                    <span className="text-sm font-bold" style={{ color: CH.text }}>{hook.name}</span>
                    <CHBadge color={triggerColor(hook.trigger || hook.event)}>{hook.trigger || hook.event}</CHBadge>
                    {hook.is_enabled === false && <CHBadge color={CH.textSub}>Disabled</CHBadge>}
                  </div>
                  <div className="flex gap-2">
                    <CHBtn variant="default" onClick={() => toggle(hook)}>
                      {hook.is_enabled === false ? 'Enable' : 'Disable'}
                    </CHBtn>
                    <CHBtn variant="danger" onClick={() => del(hook.id)}><Trash2 size={12} /></CHBtn>
                  </div>
                </div>
                <p className="text-xs" style={{ color: CH.textSub }}>
                  Order: {hook.order ?? 0} · {hook.tags ? `Tags: ${hook.tags}` : 'All hosts'} · Timeout: {hook.timeout_seconds ?? 120}s
                </p>
                {hook.script_content || hook.script ? (
                  <pre className="text-[11px] font-mono p-3 rounded-lg overflow-hidden max-h-14"
                    style={{ background: 'rgba(0,0,0,0.4)', color: CH.textSub }}>
                    {(hook.script_content || hook.script || '').slice(0, 150)}…
                  </pre>
                ) : null}
              </CHCard>
            ))
          )}
        </div>
      )}

      {/* Executions */}
      {tab === 'executions' && (
        <CHCard>
          <CHTable headers={['Hook', 'Host', 'Trigger', 'Status', 'Duration', 'Time']} emptyMessage="No hook executions recorded yet.">
            {executions.map(ex => (
              <CHTR key={ex.id}>
                <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{ex.hook_name || ex.hook_id}</td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{ex.hostname || '—'}</td>
                <td className="px-6 py-4"><CHBadge color={triggerColor(ex.trigger)}>{ex.trigger}</CHBadge></td>
                <td className="px-6 py-4"><CHBadge color={ex.status === 'success' ? CH.green : CH.red}>{ex.status}</CHBadge></td>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>{ex.duration_ms ? `${ex.duration_ms}ms` : '—'}</td>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>
                  {ex.created_at ? new Date(ex.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}
    </CHPage>
  );
}
