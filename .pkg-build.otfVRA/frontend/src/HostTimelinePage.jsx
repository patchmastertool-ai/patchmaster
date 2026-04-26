import React, { useCallback, useEffect, useState } from 'react';
import { StitchBadge } from './components/StitchComponents';

/* ── event-type metadata ─────────────────────────────────────────────── */
const EVENT_META = {
  patch:        { code: 'PT', color: '#7bd0ff',  label: 'Patch' },
  snapshot:     { code: 'SN', color: '#a78bfa',  label: 'Snapshot' },
  cve:          { code: 'CV', color: '#ee7d77',  label: 'CVE' },
  reboot:       { code: 'RB', color: '#ffd16f',  label: 'Reboot' },
  agent_update: { code: 'AU', color: '#60a5fa',  label: 'Agent Update' },
  login:        { code: 'LG', color: '#939eb5',  label: 'Login' },
  alert:        { code: 'AL', color: '#ffd16f',  label: 'Alert' },
  scan:         { code: 'SC', color: '#939eb5',  label: 'Scan' },
};

/* severity → badge variant */
const sevVariant = s =>
  ({ success: 'success', info: 'info', warning: 'warning', danger: 'error', critical: 'error' }[s] || 'default');

/* severity → status label */
const sevStatus = s =>
  ({ success: 'SUCCESS', info: 'LOGGED', warning: 'WARNING', danger: 'FAILED', critical: 'CRITICAL' }[s] || 'LOGGED');

/* ── filter pill definitions ─────────────────────────────────────────── */
const FILTER_PILLS = [
  { key: 'all',      label: 'ALL EVENTS',    eventType: null },
  { key: 'critical', label: 'CRITICAL ONLY', eventType: null, severityFilter: true },
  { key: 'patch',    label: 'PATCH LOGS',    eventType: 'patch' },
];

export default function HostTimelinePage({ hosts, API, apiFetch }) {
  const hostList = Array.isArray(hosts) ? hosts : [];

  const [selectedId, setSelectedId]   = useState('');
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [activePill, setActivePill]   = useState('all');

  /* auto-select first host */
  useEffect(() => {
    if (!selectedId && hostList.length) setSelectedId(String(hostList[0].id));
  }, [hostList, selectedId]);

  const selectedHost = hostList.find(h => String(h.id) === String(selectedId));

  /* fetch timeline from backend */
  const fetchTimeline = useCallback(async () => {
    if (!selectedId) return setEvents([]);
    setLoading(true);
    try {
      const pill = FILTER_PILLS.find(p => p.key === activePill);
      const params = new URLSearchParams();
      if (pill?.eventType) params.set('event_type', pill.eventType);
      const url = `${API}/api/hosts/${selectedId}/timeline${params.toString() ? `?${params}` : ''}`;
      const r = await apiFetch(url);
      const d = await r.json().catch(() => []);
      let rows = Array.isArray(d) ? d : [];
      /* client-side severity filter for "CRITICAL ONLY" pill */
      if (pill?.severityFilter) {
        rows = rows.filter(e => e.severity === 'danger' || e.severity === 'critical');
      }
      setEvents(rows);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }, [selectedId, activePill, API, apiFetch]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  /* ── host identity fields from real host props ───────────────────── */
  const hostKernel = selectedHost?.kernel_version || selectedHost?.kernel || null;
  const hostOS     = selectedHost?.os || selectedHost?.os_name || null;
  const hostUptime = selectedHost?.uptime || null;
  const hostIP     = selectedHost?.ip || selectedHost?.ip_address || null;

  /* ── render ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#060e20] p-0">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <section className="px-10 pt-10 pb-6 flex justify-between items-end">
        <div>
          {/* breadcrumb */}
          <nav className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-medium">
            <span>Infrastructure</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span>Nodes</span>
            {selectedHost && (
              <>
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                <span className="text-[#7bd0ff]">{selectedHost.hostname || selectedHost.name}</span>
              </>
            )}
          </nav>

          {/* title + status */}
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-3xl font-black tracking-tight text-[#dee5ff]">
              {selectedHost
                ? `NODE: ${(selectedHost.hostname || selectedHost.name || '').toUpperCase()}`
                : 'HOST TIMELINE'}
            </h2>
            {selectedHost && (
              <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 ${
                selectedHost.is_online
                  ? 'bg-[#004c69] text-[#7bd0ff]'
                  : 'bg-[#7f2927] text-[#ff9993]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedHost.is_online ? 'bg-[#7bd0ff] animate-pulse' : 'bg-[#ff9993]'}`} />
                {selectedHost.is_online ? 'Online' : 'Offline'}
              </span>
            )}
          </div>
        </div>

        {/* right: IP + host selector */}
        <div className="flex gap-4 items-center">
          {hostIP && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-widest text-[#91aaeb] mb-1">Node IP</span>
                <span className="text-lg font-mono font-medium text-[#dee5ff]">{hostIP}</span>
              </div>
              <div className="w-[1px] h-10 bg-[#2b4680]/40 mx-2" />
            </>
          )}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-widest text-[#91aaeb]">Target Node</span>
            <select
              className="bg-[#00225a] border-none rounded-lg text-sm text-[#dee5ff] py-2 pl-3 pr-8 focus:ring-1 focus:ring-[#7bd0ff] outline-none"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              <option value="">-- Select host --</option>
              {hostList.map(h => (
                <option key={h.id} value={String(h.id)}>
                  {h.hostname || h.name} ({h.ip})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Bento Grid ──────────────────────────────────────────────── */}
      <section className="px-10 pb-10 grid grid-cols-12 gap-6">

        {/* ── Event Ledger (8 cols) ──────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-8 bg-[#05183c] rounded-xl flex flex-col shadow-lg"
          style={{ minHeight: 560 }}>

          {/* ledger header + filter pills */}
          <div className="p-6 border-b border-[#2b4680]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight uppercase text-[#dee5ff]">Event Ledger</h3>
              <p className="text-[10px] text-[#939eb5] tracking-widest uppercase mt-0.5">
                {selectedHost
                  ? `Filtered by Node ${selectedHost.hostname || selectedHost.name}`
                  : 'Select a node above'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {FILTER_PILLS.map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setActivePill(pill.key)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors ${
                    activePill === pill.key
                      ? 'bg-[#00225a] text-[#7bd0ff] border border-[#7bd0ff]/20'
                      : 'bg-[#06122d] text-[#939eb5] border border-[#2b4680]/20 hover:bg-[#00225a]/50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
              <button
                onClick={fetchTimeline}
                disabled={loading || !selectedId}
                className="px-3 py-1 text-[10px] font-bold rounded-full bg-[#06122d] text-[#939eb5] border border-[#2b4680]/20 hover:bg-[#00225a]/50 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[12px]">refresh</span>
                SYNC
              </button>
            </div>
          </div>

          {/* legend */}
          <div className="px-6 py-3 border-b border-[#2b4680]/10 flex gap-4 flex-wrap">
            <span className="text-[10px] flex items-center gap-1.5 text-[#91aaeb]">
              <span className="w-2 h-2 bg-[#7bd0ff] rounded-full" /> Patches
            </span>
            <span className="text-[10px] flex items-center gap-1.5 text-[#91aaeb]">
              <span className="w-2 h-2 bg-[#ffd16f] rounded-full" /> Alerts
            </span>
            <span className="text-[10px] flex items-center gap-1.5 text-[#91aaeb]">
              <span className="w-2 h-2 bg-[#939eb5] rounded-full" /> Ops
            </span>
          </div>

          {/* table */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 460 }}>
            {!selectedId && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="material-symbols-outlined text-5xl text-[#91aaeb] opacity-30">schedule</span>
                <p className="text-xs uppercase tracking-widest font-bold mt-3 text-[#91aaeb]">Select a node to view timeline</p>
              </div>
            )}

            {selectedId && loading && events.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
                <span className="material-symbols-outlined text-5xl text-[#91aaeb] opacity-30">schedule</span>
                <p className="text-xs uppercase tracking-widest font-bold mt-3 text-[#91aaeb]">Loading timeline...</p>
              </div>
            )}

            {selectedId && !loading && events.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="material-symbols-outlined text-5xl text-[#91aaeb] opacity-30">schedule</span>
                <p className="text-xs uppercase tracking-widest font-bold mt-3 text-[#91aaeb]">No events match current parameters</p>
              </div>
            )}

            {events.length > 0 && (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[#05183c]/95 backdrop-blur-sm z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#91aaeb]">Timestamp</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#91aaeb]">Event Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#91aaeb]">Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#91aaeb] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b4680]/5">
                  {events.map((event, idx) => {
                    const meta    = EVENT_META[event.event_type] || { code: 'EV', color: '#939eb5', label: event.event_type };
                    const variant = sevVariant(event.severity);
                    const status  = sevStatus(event.severity);
                    const ts      = event.created_at ? new Date(event.created_at) : null;
                    const tsStr   = ts && !isNaN(ts)
                      ? `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}`
                      : '—';

                    return (
                      <tr key={event.id || idx}
                        className="hover:bg-[#06122d] transition-colors cursor-default group">
                        <td className="px-6 py-4 text-xs font-mono text-[#939eb5] whitespace-nowrap">{tsStr}</td>
                        <td className="px-6 py-4">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border"
                            style={{
                              background: `${meta.color}18`,
                              color: meta.color,
                              borderColor: `${meta.color}33`,
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-[#dee5ff] max-w-xs">
                          <div className="font-medium mb-0.5">{event.title}</div>
                          {event.ref_id && (
                            <div className="text-[10px] font-mono text-[#91aaeb]">REF: {event.ref_id}</div>
                          )}
                          {event.detail && (
                            <div className="text-[10px] text-[#91aaeb] mt-1 truncate max-w-[260px]">
                              {typeof event.detail === 'object'
                                ? JSON.stringify(event.detail)
                                : event.detail}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[10px] font-bold ${
                            variant === 'error'   ? 'text-[#ff9993]' :
                            variant === 'warning' ? 'text-[#ffd16f]' :
                            variant === 'success' ? 'text-[#7bd0ff]' :
                                                    'text-[#91aaeb]'
                          }`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* footer */}
          <div className="p-4 border-t border-[#2b4680]/10 flex items-center justify-between">
            <span className="text-[10px] text-[#91aaeb] uppercase tracking-widest">
              {events.length} record{events.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={fetchTimeline}
              disabled={loading || !selectedId}
              className="text-[10px] font-bold uppercase tracking-widest text-[#7bd0ff] hover:text-sky-300 transition-colors disabled:opacity-40"
            >
              Refresh History
            </button>
          </div>
        </div>

        {/* ── Side Cards (4 cols) ────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

          {/* Host Identity */}
          <div className="bg-[#05183c] rounded-xl p-6 shadow-lg border-t-2 border-[#7bd0ff] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#7bd0ff]/5 blur-3xl rounded-full" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#91aaeb] mb-4">Host Identity</h3>
            {selectedHost ? (
              <div className="space-y-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#939eb5] font-bold uppercase tracking-widest">Hostname</span>
                  <span className="text-[#dee5ff] font-mono">{selectedHost.hostname || selectedHost.name || '—'}</span>
                </div>
                {hostIP && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#939eb5] font-bold uppercase tracking-widest">IP</span>
                    <span className="text-[#dee5ff] font-mono">{hostIP}</span>
                  </div>
                )}
                {hostOS && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#939eb5] font-bold uppercase tracking-widest">OS</span>
                    <span className="text-[#dee5ff] font-mono truncate max-w-[160px] text-right">{hostOS}</span>
                  </div>
                )}
                {hostKernel && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#939eb5] font-bold uppercase tracking-widest">Kernel</span>
                    <span className="text-[#dee5ff] font-mono truncate max-w-[160px] text-right">{hostKernel}</span>
                  </div>
                )}
                {hostUptime && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#939eb5] font-bold uppercase tracking-widest">Uptime</span>
                    <span className="text-[#dee5ff] font-mono">{hostUptime}</span>
                  </div>
                )}
                {selectedHost.group_name && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#939eb5] font-bold uppercase tracking-widest">Group</span>
                    <span className="text-[#dee5ff] font-mono">{selectedHost.group_name}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#91aaeb]">No host selected</p>
            )}
          </div>

          {/* Event Summary */}
          <div className="bg-[#05183c] rounded-xl p-6 shadow-lg border-t-2 border-[#ffd16f]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#91aaeb] mb-4">Event Summary</h3>
            {events.length > 0 ? (
              <div className="space-y-3">
                {Object.entries(
                  events.reduce((acc, e) => {
                    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => {
                    const meta = EVENT_META[type] || { code: 'EV', color: '#939eb5', label: type };
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[9px] font-black px-1.5 py-0.5 rounded"
                            style={{ background: `${meta.color}18`, color: meta.color }}
                          >
                            {meta.code}
                          </span>
                          <span className="text-[11px] text-[#dee5ff] capitalize">{meta.label}</span>
                        </div>
                        <span className="text-[11px] font-bold font-mono text-[#91aaeb]">{count}</span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-[11px] text-[#91aaeb]">
                {selectedId ? 'No events loaded' : 'Select a node to see summary'}
              </p>
            )}
          </div>

          {/* Severity Breakdown */}
          <div className="bg-[#05183c] rounded-xl p-6 shadow-lg flex-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#91aaeb] mb-4">Severity Breakdown</h3>
            {events.length > 0 ? (
              <div className="space-y-3">
                {['danger', 'warning', 'info', 'success'].map(sev => {
                  const count = events.filter(e => e.severity === sev).length;
                  if (!count) return null;
                  const variant = sevVariant(sev);
                  return (
                    <div key={sev} className="flex items-center justify-between">
                      <StitchBadge variant={variant}>{sev}</StitchBadge>
                      <span className="text-[11px] font-bold font-mono text-[#91aaeb]">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-[#91aaeb]">
                {selectedId ? 'No events loaded' : 'Select a node'}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
