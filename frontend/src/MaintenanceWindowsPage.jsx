import React, { useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Calendar, Clock, Trash2 } from 'lucide-react';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLANK_FORM = { name: '', description: '', day_of_week: [], start_hour: 2, end_hour: 6, timezone: 'UTC', block_outside: true };

export default function MaintenanceWindowsPage({ API, apiFetch, toast }) {
  const [windows, setWindows]         = useState([]);
  const [currentStatus, setStatus]    = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(BLANK_FORM);
  const [loading, setLoading]         = useState(false);

  const load = async () => {
    const [w, s] = await Promise.all([
      apiFetch(`${API}/api/maintenance/`).then(r => r.json()).catch(() => []),
      apiFetch(`${API}/api/maintenance/check`).then(r => r.json()).catch(() => null),
    ]);
    setWindows(Array.isArray(w) ? w : []);
    setStatus(s);
  };

  useEffect(() => { load(); }, []);

  const toggleDay = d => setForm(f => ({
    ...f,
    day_of_week: f.day_of_week.includes(d) ? f.day_of_week.filter(x => x !== d) : [...f.day_of_week, d],
  }));

  const save = async () => {
    setLoading(true);
    const r = await apiFetch(`${API}/api/maintenance/`, { method: 'POST', body: JSON.stringify(form) });
    setLoading(false);
    if (r.ok) {
      if (toast) toast('Window created', 'success');
      setShowForm(false); setForm(BLANK_FORM); load();
    } else {
      const d = await r.json().catch(() => ({}));
      if (toast) toast(d.detail || 'Failed', 'danger');
    }
  };

  const toggle = async w => {
    await apiFetch(`${API}/api/maintenance/${w.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !w.is_active }) });
    load();
  };

  const del = async id => {
    if (!window.confirm('Delete this window?')) return;
    await apiFetch(`${API}/api/maintenance/${id}`, { method: 'DELETE' });
    if (toast) toast('Deleted', 'success'); load();
  };

  const active = windows.filter(w => w.is_active !== false).length;
  const isInWindow = currentStatus?.in_maintenance_window;

  return (
    <CHPage>
      <CHHeader
        kicker="Maintenance Scheduler"
        title="Maintenance Windows"
        subtitle={`${active} active windows · ${windows.filter(w => w.recurring).length} recurring`}
        actions={
          <div className="flex gap-2 items-center">
            {isInWindow !== undefined && (
              <CHBadge color={isInWindow ? CH.green : CH.textSub}>
                {isInWindow ? 'IN WINDOW' : 'OUT OF WINDOW'}
              </CHBadge>
            )}
            <CHBtn variant="ghost" onClick={load}><RefreshCw size={14} /></CHBtn>
            <CHBtn variant="primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={14} /> {showForm ? 'Cancel' : 'New Window'}
            </CHBtn>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Windows" value={windows.length}                                          sub="configured"  accent={CH.accent} />
        <CHStat label="Active"        value={active}                                                  sub="enforced"    accent={CH.green} />
        <CHStat label="Recurring"     value={windows.filter(w => w.recurring).length}                 sub="repeating"   accent="#a78bfa" />
        <CHStat label="One-Time"      value={windows.filter(w => !w.recurring).length}                sub="scheduled"   accent={CH.yellow} />
      </div>

      {/* Create Form */}
      {showForm && (
        <CHCard className="space-y-5">
          <CHLabel>Configure New Window</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <CHLabel>Window Name</CHLabel>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Weekly Prod Maintenance"
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Timezone</CHLabel>
              <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                placeholder="UTC"
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Start Hour (0–23)</CHLabel>
              <input type="number" min={0} max={23} value={form.start_hour}
                onChange={e => setForm(f => ({ ...f, start_hour: +e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>End Hour (0–23)</CHLabel>
              <input type="number" min={0} max={23} value={form.end_hour}
                onChange={e => setForm(f => ({ ...f, end_hour: +e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Description (optional)</CHLabel>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Notes…"
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
          </div>
          <div>
            <CHLabel>Active Days</CHLabel>
            <div className="flex gap-2 mt-2 flex-wrap">
              {DAY_NAMES.map(d => (
                <button key={d} onClick={() => toggleDay(d)}
                  className="w-10 h-10 rounded-xl text-xs font-black transition-all"
                  style={{
                    background: form.day_of_week.includes(d) ? `${CH.accent}25` : 'rgba(3,29,75,0.4)',
                    color: form.day_of_week.includes(d) ? CH.accent : CH.textSub,
                    border: `1px solid ${form.day_of_week.includes(d) ? CH.accent + '60' : CH.border}`,
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.block_outside} onChange={e => setForm(f => ({ ...f, block_outside: e.target.checked }))} />
            <span className="text-xs" style={{ color: CH.textSub }}>Block patching outside window hours</span>
          </div>
          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Create Window'}</CHBtn>
            <CHBtn variant="ghost" onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}

      {/* Windows List */}
      {windows.length === 0 ? (
        <CHCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
            <p className="text-xs uppercase tracking-widest font-bold mt-4" style={{ color: CH.textSub }}>No maintenance windows configured yet.</p>
          </div>
        </CHCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {windows.map(w => (
            <CHCard key={w.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: CH.text }}>{w.name}</p>
                  <p className="text-xs mt-1" style={{ color: CH.textSub }}>{w.description || 'No description'}</p>
                </div>
                <CHBadge color={w.is_active !== false ? CH.green : CH.textSub}>
                  {w.is_active !== false ? 'Active' : 'Inactive'}
                </CHBadge>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: CH.textSub }}>
                  <Clock size={12} />
                  {w.start_hour}:00 – {w.end_hour}:00 {w.timezone || 'UTC'}
                </div>
                {Array.isArray(w.day_of_week) && w.day_of_week.length > 0 && (
                  <div className="flex gap-1">
                    {w.day_of_week.map(d => (
                      <span key={d} className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                        style={{ background: `${CH.accent}15`, color: CH.accent }}>{d}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <CHBtn variant="default" onClick={() => toggle(w)}>
                  {w.is_active !== false ? 'Deactivate' : 'Activate'}
                </CHBtn>
                <CHBtn variant="danger" onClick={() => del(w.id)}><Trash2 size={12} /></CHBtn>
              </div>
            </CHCard>
          ))}
        </div>
      )}
    </CHPage>
  );
}
