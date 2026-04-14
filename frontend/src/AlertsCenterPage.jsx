import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Bell, BellOff, Ticket, AlertTriangle, CheckCircle } from 'lucide-react';

const alertColor = sev => {
  if (sev === 'critical') return CH.red;
  if (sev === 'warning')  return CH.yellow;
  return CH.accent;
};

export default function AlertsCenterPage({ API, apiFetch, useInterval, toast }) {
  const [payload, setPayload]             = useState(null);
  const [tickets, setTickets]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [actionLoading, setActing]        = useState(false);
  const [error, setError]                 = useState('');
  const [severityFilter, setSevFilter]    = useState('');
  const [ticketFilter, setTicketFilter]   = useState('');
  const [onlyBreached, setOnlyBreached]   = useState(false);
  const [nowTick, setNowTick]             = useState(Date.now());

  if (useInterval) useInterval(() => setNowTick(Date.now()), 10000);

  const loadAlerts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await apiFetch(`${API}/api/monitoring/alerts/active`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || `Failed (${r.status})`);
      setPayload(d);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [API, apiFetch]);

  const loadTickets = useCallback(async () => {
    try {
      const q = new URLSearchParams({ limit: '200' });
      if (ticketFilter) q.set('status', ticketFilter);
      const r = await apiFetch(`${API}/api/monitoring/alerts/tickets?${q}`);
      const d = await r.json().catch(() => []);
      setTickets(Array.isArray(d) ? d : []);
    } catch {}
  }, [API, apiFetch, ticketFilter]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { loadTickets(); }, [loadTickets]);
  if (useInterval) useInterval(() => { loadAlerts(); loadTickets(); }, 10000);

  const doAction = async (path, body, msg) => {
    setActing(true); setError('');
    try {
      const r = await apiFetch(`${API}/api/monitoring${path}`, { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.detail || `Action failed (${r.status})`);
      if (toast) toast(msg, 'success');
      await loadAlerts(); await loadTickets();
    } catch (e) { setError(e.message); if (toast) toast(e.message, 'danger'); }
    setActing(false);
  };

  const acknowledge  = a => doAction('/alerts/ack', { alert_key: a.key, alert_name: a.name, instance: a.instance || '', severity: a.severity || 'warning', note: window.prompt('Note:') || '' }, `Acknowledged: ${a.name}`);
  const snooze       = a => { const m = +window.prompt('Snooze minutes:', '30'); if (!m) return; doAction('/alerts/snooze', { alert_key: a.key, alert_name: a.name, instance: a.instance || '', severity: a.severity || 'warning', minutes: m, note: '' }, `Snoozed: ${a.name}`); };
  const unsnooze     = a => doAction('/alerts/unsnooze', { alert_key: a.key, alert_name: a.name, instance: a.instance || '', severity: a.severity || 'warning', note: '' }, `Unsnoozed: ${a.name}`);
  const createTicket = a => { const t = window.prompt('Title:', `[${(a.severity||'').toUpperCase()}] ${a.name}`); if (!t) return; doAction('/alerts/tickets', { alert_key: a.key, alert_name: a.name, instance: a.instance || '', severity: a.severity || 'warning', title: t, description: a.summary || '' }, `Ticket created`); };
  const updateTicket = (ticket, action) => doAction(`/alerts/tickets/${ticket.id}/${action}`, {}, `Ticket ${ticket.id} ${action}d`);

  const snoozeTxt = a => {
    const untilTs = a?.snoozed_until ? Date.parse(a.snoozed_until) : NaN;
    const rem = Number.isFinite(untilTs) ? Math.max(Math.floor((untilTs - nowTick) / 1000), 0) : Number(a?.snooze_remaining_seconds || 0);
    if (a?.snooze_active && rem > 0) return `snoozed ${Math.floor(rem/60)}m ${rem%60}s`;
    if (a?.snoozed_until) return 'snooze expired';
    return '';
  };

  const alerts = useMemo(() => {
    const rows = Array.isArray(payload?.active_alerts) ? payload.active_alerts : [];
    return severityFilter ? rows.filter(r => String(r.severity||'').toLowerCase() === severityFilter) : rows;
  }, [payload, severityFilter]);

  const hostMatrix = useMemo(() => {
    const rows = Array.isArray(payload?.host_matrix) ? payload.host_matrix : [];
    return onlyBreached ? rows.filter(r => r.cpu_alert || r.memory_alert || r.disk_io_alert || r.offline_alert) : rows;
  }, [payload, onlyBreached]);

  const summary = payload?.summary || {};
  const thresholds = payload?.thresholds || {};

  return (
    <CHPage>
      <CHHeader
        kicker="Response Center"
        title="Telemetry Alerts"
        subtitle={`${summary.active_alerts_total || 0} active · ${summary.critical_alerts || 0} critical · ${summary.offline_hosts || 0} offline`}
        actions={
          <div className="flex gap-2 items-center">
            {summary.critical_alerts > 0 && (
              <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse"
                style={{ background: `${CH.red}20`, color: CH.red, border: `1px solid ${CH.red}40` }}>
                BREACH ACTIVE
              </span>
            )}
            <CHBtn variant="ghost" onClick={loadAlerts} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Ping Prom API
            </CHBtn>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: `${CH.red}15`, color: CH.red, border: `1px solid ${CH.red}30` }}>{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Active"   value={summary.active_alerts_total || 0}  accent={CH.accent} />
        <CHStat label="Critical Scope" value={summary.critical_alerts || 0}       accent={CH.red} />
        <CHStat label="Warning Scope"  value={summary.warning_alerts || 0}        accent={CH.yellow} />
        <CHStat label="Nodes Offline"  value={summary.offline_hosts || 0}         accent={CH.red} />
      </div>

      {/* Two-column: Queue + Tickets */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Alert Queue */}
        <CHCard className="flex flex-col min-h-96">
          <div className="flex items-center justify-between mb-4">
            <CHLabel>Realtime Queue</CHLabel>
            <select value={severityFilter} onChange={e => setSevFilter(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-xs"
              style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
              <option value="">All Rules</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
              <CheckCircle size={40} style={{ color: CH.green, opacity: 0.4 }} />
              <p className="text-xs uppercase tracking-widest font-bold mt-3" style={{ color: CH.textSub }}>Queue Empty — Systems Nominal</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[500px]">
              {alerts.map((alert, idx) => {
                const isCrit    = alert.severity === 'critical';
                const isSnoozed = !!snoozeTxt(alert);
                return (
                  <div key={idx} className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(3,29,75,0.4)',
                      borderLeft: `3px solid ${isSnoozed ? CH.textSub : alertColor(alert.severity)}`,
                    }}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold" style={{ color: CH.text }}>{alert.name}</span>
                          <CHBadge color={isSnoozed ? CH.textSub : alertColor(alert.severity)}>
                            {isSnoozed ? 'SNOOZED' : alert.severity}
                          </CHBadge>
                          {alert.acknowledged && <CHBadge color={CH.green}>ACK</CHBadge>}
                        </div>
                        <p className="text-xs" style={{ color: CH.textSub }}>{alert.summary || alert.description}</p>
                        <p className="text-[10px] font-mono mt-1" style={{ color: CH.textSub }}>
                          TARGET: {alert.instance || 'global'} · {isSnoozed ? snoozeTxt(alert) : alert.starts_at ? new Date(alert.starts_at).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CHBtn variant="ghost" disabled={actionLoading || alert.acknowledged} onClick={() => acknowledge(alert)}>Acknowledge</CHBtn>
                      {isSnoozed
                        ? <CHBtn variant="ghost" disabled={actionLoading} onClick={() => unsnooze(alert)}>Wake Alert</CHBtn>
                        : <CHBtn variant="ghost" disabled={actionLoading} onClick={() => snooze(alert)}><BellOff size={12} /> Snooze 30m</CHBtn>
                      }
                      <CHBtn variant="default" disabled={actionLoading} className="ml-auto" onClick={() => createTicket(alert)}>
                        <Ticket size={12} /> Escalate
                      </CHBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CHCard>

        {/* Incident Tickets */}
        <CHCard className="flex flex-col min-h-96">
          <div className="flex items-center justify-between mb-4">
            <CHLabel>Incident Ledger</CHLabel>
            <select value={ticketFilter} onChange={e => setTicketFilter(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-xs"
              style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
              <option value="">All States</option>
              <option value="open">Open</option>
              <option value="closed">Resolved</option>
            </select>
          </div>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
              <CheckCircle size={40} style={{ color: CH.green, opacity: 0.4 }} />
              <p className="text-xs uppercase tracking-widest font-bold mt-3" style={{ color: CH.textSub }}>No Tickets Escalated</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[500px]">
              {tickets.map(ticket => {
                const isOpen = String(ticket.status).toLowerCase() === 'open';
                return (
                  <div key={ticket.id} className="p-4 rounded-xl" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}`, opacity: isOpen ? 1 : 0.6 }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#d946ef' }}>TK-{String(ticket.id).padStart(4, '0')}</span>
                          <CHBadge color={isOpen ? CH.red : CH.green}>{ticket.status}</CHBadge>
                        </div>
                        <p className="text-sm font-bold truncate max-w-xs" style={{ color: CH.text }}>{ticket.title}</p>
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: CH.textSub }}>
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono truncate mb-3" style={{ color: CH.textSub }}>
                      SRC: {ticket.alert_name} {ticket.instance ? `@ ${ticket.instance}` : ''}
                    </p>
                    <div className="flex justify-end">
                      {isOpen
                        ? <CHBtn variant="default" disabled={actionLoading} onClick={() => updateTicket(ticket, 'close')}>Mark Resolved</CHBtn>
                        : <CHBtn variant="ghost" disabled={actionLoading} onClick={() => updateTicket(ticket, 'reopen')}>Reopen</CHBtn>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CHCard>
      </div>

      {/* Host Saturation Matrix */}
      <CHCard>
        <div className="flex items-center justify-between mb-5">
          <div>
            <CHLabel>Node Saturation Matrix</CHLabel>
            <p className="text-xs mt-1" style={{ color: CH.textSub }}>
              CPU ≥ {thresholds.cpu_percent ?? 80}% · RAM ≥ {thresholds.memory_percent ?? 80}% · I/O ≥ {((thresholds.disk_io_bps ?? 10485760)/1e6).toFixed(0)} MB/s
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-4 rounded-full p-0.5 transition-colors" style={{ background: onlyBreached ? CH.accent : 'rgba(3,29,75,0.5)' }}
              onClick={() => setOnlyBreached(v => !v)}>
              <div className="w-3 h-3 rounded-full bg-white transition-transform" style={{ transform: onlyBreached ? 'translateX(16px)' : 'translateX(0)' }} />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: CH.textSub }}>Only Breaches</span>
          </label>
        </div>
        <CHTable headers={['Host', 'Status', 'CPU', 'RAM', 'Disk I/O', 'Flags']} emptyMessage="No node data — check Prometheus connectivity.">
          {hostMatrix.map(row => {
            const flags = [row.offline_alert && 'offline', row.cpu_alert && 'compute', row.memory_alert && 'mem_leak', row.disk_io_alert && 'io_spike'].filter(Boolean);
            return (
              <CHTR key={row.instance} style={{ background: flags.length ? `rgba(239,68,68,0.03)` : '' }}>
                <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{row.instance}</td>
                <td className="px-6 py-4"><CHBadge color={row.online ? CH.green : CH.red}>{row.online ? 'Online' : 'Lost'}</CHBadge></td>
                <td className="px-6 py-4 font-mono text-sm text-right" style={{ color: row.cpu_alert ? CH.red : CH.textSub }}>{row.cpu_percent}%</td>
                <td className="px-6 py-4 font-mono text-sm text-right" style={{ color: row.memory_alert ? CH.red : CH.textSub }}>{row.memory_percent}%</td>
                <td className="px-6 py-4 font-mono text-sm text-right" style={{ color: row.disk_io_alert ? CH.red : CH.textSub }}>{Math.round(row.disk_io_bps / 1024)} KB/s</td>
                <td className="px-6 py-4 text-right">
                  {flags.length > 0 ? (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {flags.map(f => <CHBadge key={f} color={CH.red}>{f}</CHBadge>)}
                    </div>
                  ) : <span className="text-[10px] font-bold" style={{ color: `${CH.green}60` }}>Clean</span>}
                </td>
              </CHTR>
            );
          })}
        </CHTable>
      </CHCard>
    </CHPage>
  );
}
