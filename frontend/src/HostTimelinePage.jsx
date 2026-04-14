import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CH } from './CH.jsx';
import { RefreshCw, Plus, X, History, Clock } from 'lucide-react';

const EVENT_TYPES = {
  patch:        { code: 'PT', color: CH.green },
  snapshot:     { code: 'SN', color: '#a78bfa' },
  cve:          { code: 'CV', color: CH.red },
  reboot:       { code: 'RB', color: CH.yellow },
  agent_update: { code: 'AU', color: '#60a5fa' },
  login:        { code: 'LG', color: CH.textSub },
};

export default function HostTimelinePage({ hosts, API, apiFetch }) {
  const hostList = Array.isArray(hosts) ? hosts : [];
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const selectedHost = hostList.find(h => String(h.id) === String(selectedId));

  useEffect(() => {
    if (!selectedId && hostList.length) setSelectedId(String(hostList[0].id));
  }, [hostList, selectedId]);

  const fetchTimeline = useCallback(async () => {
    if (!selectedId) return setEvents([]);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('event_type', typeFilter);
      const r = await apiFetch(`${API}/api/hosts/${selectedId}/timeline${params.toString() ? `?${params}` : ''}`);
      const d = await r.json().catch(() => []);
      setEvents(Array.isArray(d) ? d : []);
    } catch { setEvents([]); }
    setLoading(false);
  }, [selectedId, typeFilter, API, apiFetch]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const sevColor = s => ({ success: CH.green, info: CH.accent, warning: CH.yellow, danger: CH.red }[s] || CH.textSub);

  return (
    <CHPage>
      <CHHeader
        kicker="Audit Trail"
        title="Host Timeline"
        subtitle={selectedHost ? `${selectedHost.hostname || selectedHost.name} · ${selectedHost.ip}` : 'Select a host to view its event ledger'}
        actions={
          selectedHost && (
            <CHBadge color={selectedHost.is_online ? CH.green : CH.red}>
              {selectedHost.is_online ? 'Online' : 'Offline'}
            </CHBadge>
          )
        }
      />

      {/* Controls */}
      <CHCard className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-1">
          <CHLabel>Target Node</CHLabel>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
            <option value="">-- Select host --</option>
            {hostList.map(h => <option key={h.id} value={h.id}>{h.hostname || h.name} ({h.ip})</option>)}
          </select>
        </div>
        <div className="w-full md:w-48 flex flex-col gap-1">
          <CHLabel>Event Class</CHLabel>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
            <option value="all">All Events</option>
            {Object.keys(EVENT_TYPES).map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
          </select>
        </div>
        <CHBtn variant="primary" disabled={loading || !selectedId} onClick={fetchTimeline} className="py-3 px-6">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Logs
        </CHBtn>
      </CHCard>

      {/* Timeline */}
      <CHCard>
        <div className="flex items-center justify-between mb-6">
          <CHLabel>Event Ledger</CHLabel>
          {selectedId && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: 'rgba(3,29,75,0.5)', color: CH.textSub }}>
              {events.length} records
            </span>
          )}
        </div>

        {!selectedId && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
            <p className="text-xs uppercase tracking-widest font-bold mt-3" style={{ color: CH.textSub }}>Select a node to view timeline</p>
          </div>
        )}

        {selectedId && loading && !events.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-pulse">
            <Clock size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
            <p className="text-xs uppercase tracking-widest font-bold mt-3" style={{ color: CH.textSub }}>Loading timeline…</p>
          </div>
        )}

        {selectedId && !loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
            <p className="text-xs uppercase tracking-widest font-bold mt-3" style={{ color: CH.textSub }}>No events match current parameters</p>
          </div>
        )}

        {events.length > 0 && (
          <div className="relative ml-8 md:ml-44 border-l-2 space-y-10 pb-8"
            style={{ borderColor: 'rgba(43,70,128,0.3)' }}>
            {events.map((event, idx) => {
              const meta     = EVENT_TYPES[event.event_type] || { code: 'EV', color: CH.textSub };
              const isError  = event.severity === 'danger';
              const isWarn   = event.severity === 'warning';
              const borderC  = isError ? CH.red : isWarn ? CH.yellow : 'rgba(43,70,128,0.3)';

              return (
                <div key={event.id || idx}
                  className="relative -translate-x-8 md:-translate-x-44 w-[calc(100%+2rem)] md:w-[calc(100%+11rem)] flex flex-col md:flex-row items-start gap-5 group">
                  {/* Date gutter */}
                  <div className="hidden md:block w-32 shrink-0 text-right pt-4">
                    <span className="text-xs font-mono" style={{ color: CH.textSub }}>{new Date(event.created_at).toLocaleDateString()}</span><br />
                    <span className="text-[10px] font-mono" style={{ color: CH.textSub, opacity: 0.5 }}>{new Date(event.created_at).toLocaleTimeString()}</span>
                  </div>
                  {/* Marker */}
                  <div className="w-16 shrink-0 flex justify-center relative">
                    <div className="hidden md:block absolute top-7 w-full h-0.5 right-0" style={{ background: 'rgba(43,70,128,0.3)' }} />
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 relative z-10 shadow-xl transition-transform group-hover:scale-110"
                      style={{ background: `${meta.color}18`, color: meta.color }}>
                      <span className="text-[10px] font-black tracking-widest">{meta.code}</span>
                    </div>
                  </div>
                  {/* Card */}
                  <div className="flex-1 rounded-xl px-5 py-4 border-l-4"
                    style={{
                      background: 'rgba(6,18,45,0.6)',
                      borderLeftColor: borderC,
                      border: `1px solid ${CH.border}`,
                      borderLeftWidth: 4,
                    }}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-sm font-bold" style={{ color: CH.text }}>{event.title}</h4>
                          <CHBadge color={sevColor(event.severity)}>{event.severity}</CHBadge>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: meta.color }}>{event.event_type?.replace('_', ' ')}</span>
                      </div>
                      <span className="text-xs font-mono md:hidden" style={{ color: CH.textSub }}>{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                    {event.ref_id && (
                      <p className="text-[10px] font-mono mb-3" style={{ color: CH.textSub }}>REF: {event.ref_id}</p>
                    )}
                    {event.detail && (
                      <pre className="text-[11px] font-mono p-3 rounded-lg overflow-x-auto max-h-32"
                        style={{ background: 'rgba(0,0,0,0.4)', color: CH.textSub }}>
                        {typeof event.detail === 'object' ? JSON.stringify(event.detail, null, 2) : event.detail}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CHCard>
    </CHPage>
  );
}
