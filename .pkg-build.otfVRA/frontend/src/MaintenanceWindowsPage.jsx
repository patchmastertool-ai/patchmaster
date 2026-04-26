import { useEffect, useState } from 'react';
import { 
  StitchPageHeader,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchBadge,
  StitchEmptyState
} from './components/StitchComponents';

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
    <div className="min-h-screen bg-[#05183c] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <StitchPageHeader
          kicker="Operations / Scheduling"
          title="Maintenance Windows"
          description="Schedule and manage maintenance windows for controlled patching operations across your infrastructure."
          actions={
            <div className="flex gap-3">
              {isInWindow !== undefined && (
                <StitchBadge 
                  variant={isInWindow ? 'success' : 'info'}
                  size="md"
                >
                  {isInWindow ? 'IN WINDOW' : 'OUT OF WINDOW'}
                </StitchBadge>
              )}
              <StitchButton
                variant="secondary"
                size="sm"
                icon="refresh"
                onClick={load}
              />
              <StitchButton
                variant="primary"
                size="sm"
                icon={showForm ? 'close' : 'add'}
                onClick={() => setShowForm(v => !v)}
              >
                {showForm ? 'Cancel' : 'Schedule Window'}
              </StitchButton>
            </div>
          }
        />

        {/* KPIs */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Total Windows"
            value={windows.length}
            subtitle="configured"
            icon="schedule"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Active"
            value={active}
            subtitle="enforced"
            icon="check_circle"
            color="#10b981"
          />
          <StitchSummaryCard
            label="Recurring"
            value={windows.filter(w => w.recurring).length}
            subtitle="repeating"
            icon="restart_alt"
            color="#fcc025"
          />
          <StitchSummaryCard
            label="One-Time"
            value={windows.filter(w => !w.recurring).length}
            subtitle="scheduled"
            icon="event"
            color="#91aaeb"
          />
        </StitchMetricGrid>

        {/* Create Form */}
        {showForm && (
          <div className="bg-[#06122d] rounded-xl p-8 border border-[#2b4680]/20">
            <h3 className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold mb-6">
              Configure New Window
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <StitchFormField label="Window Name">
                <StitchInput
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Weekly Prod Maintenance"
                />
              </StitchFormField>
              <StitchFormField label="Timezone">
                <StitchInput
                  value={form.timezone}
                  onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))}
                  placeholder="UTC"
                />
              </StitchFormField>
              <StitchFormField label="Start Hour (0–23)">
                <StitchInput
                  type="number"
                  value={String(form.start_hour)}
                  onChange={(e) => setForm(f => ({ ...f, start_hour: +e.target.value }))}
                />
              </StitchFormField>
              <StitchFormField label="End Hour (0–23)">
                <StitchInput
                  type="number"
                  value={String(form.end_hour)}
                  onChange={(e) => setForm(f => ({ ...f, end_hour: +e.target.value }))}
                />
              </StitchFormField>
              <div className="md:col-span-2">
                <StitchFormField label="Description (optional)">
                  <StitchInput
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Notes…"
                  />
                </StitchFormField>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-[#91aaeb] text-[11px] font-bold uppercase tracking-widest mb-3">
                Active Days
              </label>
              <div className="flex gap-2 flex-wrap">
                {DAY_NAMES.map(d => (
                  <button 
                    key={d} 
                    onClick={() => toggleDay(d)}
                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                      form.day_of_week.includes(d)
                        ? 'bg-[#7bd0ff]/25 text-[#7bd0ff] border border-[#7bd0ff]/60'
                        : 'bg-[#031d4b]/40 text-[#91aaeb] border border-[#2b4680]/20'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <input 
                type="checkbox" 
                id="block-outside"
                checked={form.block_outside} 
                onChange={e => setForm(f => ({ ...f, block_outside: e.target.checked }))}
                className="w-4 h-4 rounded border-[#2b4680] bg-[#05183c] text-[#7bd0ff] focus:ring-[#7bd0ff]"
              />
              <label htmlFor="block-outside" className="text-xs text-[#91aaeb]">
                Block patching outside window hours
              </label>
            </div>
            <div className="flex gap-3">
              <StitchButton 
                variant="primary" 
                onClick={save} 
                disabled={loading}
                icon="save"
              >
                {loading ? 'Saving…' : 'Create Window'}
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

      {/* Windows List */}
      {windows.length === 0 ? (
        <div className="bg-[#06122d] p-8 rounded-xl border border-[#2b4680]/20">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="schedule" size={48} className="text-[#91aaeb] opacity-30" />
            <p className="text-xs uppercase tracking-widest font-bold mt-4 text-[#91aaeb]">
              No maintenance windows configured yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {windows.map(w => (
            <div key={w.id} className="bg-[#06122d] p-6 rounded-xl border border-[#2b4680]/20 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#dee5ff]">{w.name}</p>
                  <p className="text-xs mt-1 text-[#91aaeb]">{w.description || 'No description'}</p>
                </div>
                <StitchBadge 
                  variant={w.is_active !== false ? 'success' : 'info'}
                >
                  {w.is_active !== false ? 'Active' : 'Inactive'}
                </StitchBadge>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-[#91aaeb]">
                  <Icon name="schedule" size={12} />
                  {w.start_hour}:00 – {w.end_hour}:00 {w.timezone || 'UTC'}
                </div>
                {Array.isArray(w.day_of_week) && w.day_of_week.length > 0 && (
                  <div className="flex gap-1">
                    {w.day_of_week.map(d => (
                      <span 
                        key={d} 
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#7bd0ff]/15 text-[#7bd0ff]"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                  <StitchButton 
                    variant="secondary" 
                    size="sm"
                    onClick={() => toggle(w)}
                  >
                    {w.is_active !== false ? 'Deactivate' : 'Activate'}
                  </StitchButton>
                  <StitchButton 
                    variant="danger" 
                    size="sm"
                    icon="delete"
                    onClick={() => del(w.id)}
                  />
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
