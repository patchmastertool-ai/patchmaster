import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
} from './components/StitchComponents';

const alertColor = sev => {
  if (sev === 'critical') return 'error';
  if (sev === 'warning')  return 'warning';
  return 'primary';
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
    } catch (e) { 
      setError(e.message); 
      if (toast) toast(e.message, 'error'); 
    }
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
    <div className="space-y-8">
      <StitchPageHeader
        kicker="Real-time Operations"
        title="Alerts Center"
        description="Centralized infrastructure health monitoring. Respond to critical system events, hardware failures, and security vulnerabilities across your hybrid-cloud environment."
      />

      {error && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold bg-error/15 text-error border border-error/30">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Critical"
          value={summary.critical_alerts || 0}
          subtitle="active alerts"
          icon="error"
          color="#ee7d77"
        />
        <StitchSummaryCard
          label="Warning"
          value={summary.warning_alerts || 0}
          subtitle="pending review"
          icon="warning"
          color="#ffd16f"
        />
        <StitchSummaryCard
          label="Informational"
          value={(summary.active_alerts_total || 0) - (summary.critical_alerts || 0) - (summary.warning_alerts || 0)}
          subtitle="stable volume"
          icon="info"
          color="#7bd0ff"
        />
        <StitchSummaryCard
          label="Mean Resolve"
          value="14m"
          subtitle="avg across 7d"
          icon="schedule"
          color="#91aaeb"
        />
      </StitchMetricGrid>

      {/* Two-column: Queue + Tickets */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Alert Queue */}
        <div className="bg-surface-container-low p-6 rounded-xl flex flex-col min-h-96">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-on-surface-variant uppercase tracking-widest text-[10px] font-bold mb-1">Live Stream</div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Realtime Queue</h2>
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSevFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-bold uppercase tracking-wider border border-outline-variant/20"
            >
              <option value="">All Rules</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
              <span className="material-symbols-outlined text-primary opacity-40" style={{ fontSize: 40 }}>check_circle</span>
              <p className="text-xs uppercase tracking-widest font-bold mt-3 text-on-surface-variant">Queue Empty - Systems Nominal</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[500px]">
              {alerts.map((alert, idx) => {
                const isSnoozed = !!snoozeTxt(alert);
                const borderColor = isSnoozed ? 'border-on-surface-variant' : alertColor(alert.severity) === 'error' ? 'border-error' : alertColor(alert.severity) === 'warning' ? 'border-tertiary' : 'border-primary';
                
                return (
                  <div key={idx} className={`p-4 rounded-xl bg-surface-container border-l-4 ${borderColor}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-on-surface">{alert.name}</span>
                          <StitchBadge 
                            variant={isSnoozed ? 'info' : alertColor(alert.severity)} 
                            size="sm"
                          >
                            {isSnoozed ? 'SNOOZED' : alert.severity}
                          </StitchBadge>
                          {alert.acknowledged && <StitchBadge variant="success" size="sm">ACK</StitchBadge>}
                        </div>
                        <p className="text-xs text-on-surface-variant">{alert.summary || alert.description}</p>
                        <p className="text-[10px] font-mono mt-1 text-on-surface-variant">
                          TARGET: {alert.instance || 'global'} · {isSnoozed ? snoozeTxt(alert) : alert.starts_at ? new Date(alert.starts_at).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StitchButton 
                        variant="secondary" 
                        size="sm"
                        disabled={actionLoading || alert.acknowledged} 
                        onClick={() => acknowledge(alert)}
                      >
                        Acknowledge
                      </StitchButton>
                      {isSnoozed
                        ? <StitchButton variant="secondary" size="sm" disabled={actionLoading} onClick={() => unsnooze(alert)}>Wake Alert</StitchButton>
                        : <StitchButton variant="secondary" size="sm" disabled={actionLoading} onClick={() => snooze(alert)} icon="schedule">Snooze 30m</StitchButton>
                      }
                      <StitchButton 
                        variant="primary" 
                        size="sm"
                        disabled={actionLoading} 
                        className="ml-auto" 
                        onClick={() => createTicket(alert)}
                        icon="bug_report"
                      >
                        Escalate
                      </StitchButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incident Tickets */}
        <div className="bg-surface-container-low p-6 rounded-xl flex flex-col min-h-96">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-on-surface-variant uppercase tracking-widest text-[10px] font-bold mb-1">Escalations</div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Incident Ledger</h2>
            </div>
            <select
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-bold uppercase tracking-wider border border-outline-variant/20"
            >
              <option value="">All States</option>
              <option value="open">Open</option>
              <option value="closed">Resolved</option>
            </select>
          </div>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
              <span className="material-symbols-outlined text-primary opacity-40" style={{ fontSize: 40 }}>check_circle</span>
              <p className="text-xs uppercase tracking-widest font-bold mt-3 text-on-surface-variant">No Tickets Escalated</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto max-h-[500px]">
              {tickets.map(ticket => {
                const isOpen = String(ticket.status).toLowerCase() === 'open';
                return (
                  <div key={ticket.id} className={`p-4 rounded-xl bg-surface-container border border-outline-variant/20 ${isOpen ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">TK-{String(ticket.id).padStart(4, '0')}</span>
                          <StitchBadge variant={isOpen ? 'error' : 'success'} size="sm">{ticket.status}</StitchBadge>
                        </div>
                        <p className="text-sm font-bold truncate max-w-xs text-on-surface">{ticket.title}</p>
                      </div>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono truncate mb-3 text-on-surface-variant">
                      SRC: {ticket.alert_name} {ticket.instance ? `@ ${ticket.instance}` : ''}
                    </p>
                    <div className="flex justify-end">
                      {isOpen
                        ? <StitchButton variant="primary" size="sm" disabled={actionLoading} onClick={() => updateTicket(ticket, 'close')}>Mark Resolved</StitchButton>
                        : <StitchButton variant="secondary" size="sm" disabled={actionLoading} onClick={() => updateTicket(ticket, 'reopen')}>Reopen</StitchButton>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Host Saturation Matrix */}
      <div className="bg-surface-container-low p-6 rounded-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-on-surface-variant uppercase tracking-widest text-[10px] font-bold mb-1">Infrastructure Health</div>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface">Node Saturation Matrix</h2>
            <p className="text-xs mt-1 text-on-surface-variant">
              CPU ≥ {thresholds.cpu_percent ?? 80}% · RAM ≥ {thresholds.memory_percent ?? 80}% · I/O ≥ {((thresholds.disk_io_bps ?? 10485760)/1e6).toFixed(0)} MB/s
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div 
              className={`w-8 h-4 rounded-full p-0.5 transition-colors ${onlyBreached ? 'bg-primary' : 'bg-surface-container'}`}
              onClick={() => setOnlyBreached(v => !v)}
            >
              <div 
                className="w-3 h-3 rounded-full bg-white transition-transform" 
                style={{ transform: onlyBreached ? 'translateX(16px)' : 'translateX(0)' }} 
              />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Only Breaches</span>
          </label>
        </div>
        <StitchTable
          columns={[
            { key: 'instance', header: 'Host', render: (val) => <span className="font-bold text-sm text-on-surface">{val}</span> },
            { key: 'online', header: 'Status', render: (val) => <StitchBadge variant={val ? 'success' : 'error'} size="sm">{val ? 'Online' : 'Lost'}</StitchBadge> },
            { key: 'cpu_percent', header: 'CPU', render: (val, row) => <span className={`font-mono text-sm ${row.cpu_alert ? 'text-error' : 'text-on-surface-variant'}`}>{val}%</span> },
            { key: 'memory_percent', header: 'RAM', render: (val, row) => <span className={`font-mono text-sm ${row.memory_alert ? 'text-error' : 'text-on-surface-variant'}`}>{val}%</span> },
            { key: 'disk_io_bps', header: 'Disk I/O', render: (val, row) => <span className={`font-mono text-sm ${row.disk_io_alert ? 'text-error' : 'text-on-surface-variant'}`}>{Math.round(val / 1024)} KB/s</span> },
            { 
              key: 'flags', 
              header: 'Flags', 
              render: (val, row) => {
                const flags = [
                  row.offline_alert && 'offline', 
                  row.cpu_alert && 'compute', 
                  row.memory_alert && 'mem_leak', 
                  row.disk_io_alert && 'io_spike'
                ].filter(Boolean);
                
                if (flags.length > 0) {
                  return (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {flags.map(f => <StitchBadge key={f} variant="error" size="sm">{f}</StitchBadge>)}
                    </div>
                  );
                }
                return <span className="text-[10px] font-bold text-primary/60">Clean</span>;
              }
            }
          ]}
          data={hostMatrix.length > 0 ? hostMatrix : []}
        />
        {hostMatrix.length === 0 && (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-on-surface-variant opacity-50" style={{ fontSize: 48 }}>cloud_off</span>
            <p className="text-sm text-on-surface-variant mt-4">No node data — check Prometheus connectivity.</p>
          </div>
        )}
      </div>
    </div>
  );
}
