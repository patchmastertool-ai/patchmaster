import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function AlertsCenterPage({ API, apiFetch, useInterval, toast }) {
  const [payload, setPayload] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [onlyBreachedHosts, setOnlyBreachedHosts] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  // Update snooze countdown every 10s instead of every 1s — avoids 1 re-render/sec
  useInterval(() => {
    setNowTick(Date.now());
  }, 10000);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/monitoring/alerts/active`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || data?.detail || `Failed to load alerts (${response.status})`;
        throw new Error(message);
      }
      setPayload(data);
    } catch (err) {
      setError(err.message || 'Failed to load active alerts');
    } finally {
      setLoading(false);
    }
  }, [API, apiFetch]);

  const loadTickets = useCallback(async () => {
    try {
      const q = new URLSearchParams({ limit: '200' });
      if (ticketStatusFilter) q.set('status', ticketStatusFilter);
      const response = await apiFetch(`${API}/api/monitoring/alerts/tickets?${q.toString()}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        const message = data?.error?.message || data?.detail || `Failed to load tickets (${response.status})`;
        throw new Error(message);
      }
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load alert tickets');
    }
  }, [API, apiFetch, ticketStatusFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useInterval(() => {
    loadAlerts();
    loadTickets();
  }, 10000);

  const alerts = useMemo(() => {
    const rows = Array.isArray(payload?.active_alerts) ? payload.active_alerts : [];
    if (!severityFilter) return rows;
    return rows.filter((row) => String(row.severity || '').toLowerCase() === severityFilter);
  }, [payload, severityFilter]);

  const hostMatrix = useMemo(() => {
    const rows = Array.isArray(payload?.host_matrix) ? payload.host_matrix : [];
    if (!onlyBreachedHosts) return rows;
    return rows.filter((row) => row.cpu_alert || row.memory_alert || row.disk_io_alert || row.offline_alert);
  }, [payload, onlyBreachedHosts]);

  const summary = payload?.summary || {};
  const thresholds = payload?.thresholds || {};

  const alertSeverityBadge = (severity) => {
    const s = String(severity || '').toLowerCase();
    if (s === 'critical') return 'badge-danger';
    if (s === 'warning') return 'badge-warning';
    return 'badge-info';
  };

  const performAlertAction = async (path, body, successMessage) => {
    setActionLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API}/api/monitoring${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || data?.detail || `Action failed (${response.status})`;
        throw new Error(message);
      }
      if (toast) toast(successMessage, 'success');
      await loadAlerts();
      await loadTickets();
    } catch (err) {
      const message = err.message || 'Action failed';
      setError(message);
      if (toast) toast(message, 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const acknowledgeAlert = async (alert) => {
    const note = window.prompt('Acknowledgment note (optional):', '') || '';
    await performAlertAction('/alerts/ack', {
      alert_key: alert.key,
      alert_name: alert.name,
      instance: alert.instance || '',
      severity: alert.severity || 'warning',
      note,
    }, `Acknowledged ${alert.name}`);
  };

  const snoozeAlert = async (alert) => {
    const minutesText = window.prompt('Snooze minutes:', '30');
    if (minutesText === null) return;
    const minutes = Number(minutesText);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError('Snooze minutes must be a positive number.');
      return;
    }
    const note = window.prompt('Snooze note (optional):', '') || '';
    await performAlertAction('/alerts/snooze', {
      alert_key: alert.key,
      alert_name: alert.name,
      instance: alert.instance || '',
      severity: alert.severity || 'warning',
      minutes,
      note,
    }, `Snoozed ${alert.name} for ${minutes} minute(s)`);
  };

  const unsnoozeAlert = async (alert) => {
    await performAlertAction('/alerts/unsnooze', {
      alert_key: alert.key,
      alert_name: alert.name,
      instance: alert.instance || '',
      severity: alert.severity || 'warning',
      note: '',
    }, `Unsnoozed ${alert.name}`);
  };

  const createTicket = async (alert) => {
    const titleDefault = `[${String(alert.severity || 'warning').toUpperCase()}] ${alert.name} @ ${alert.instance || 'global'}`;
    const title = window.prompt('Ticket title:', titleDefault);
    if (title === null) return;
    const description = window.prompt('Ticket description:', alert.summary || alert.description || '') || '';
    await performAlertAction('/alerts/tickets', {
      alert_key: alert.key,
      alert_name: alert.name,
      instance: alert.instance || '',
      severity: alert.severity || 'warning',
      title,
      description,
    }, `Ticket created for ${alert.name}`);
  };

  const updateTicketStatus = async (ticket, action) => {
    await performAlertAction(`/alerts/tickets/${ticket.id}/${action}`, {}, `Ticket ${ticket.id} ${action}d`);
  };

  const snoozeBadgeText = (alert) => {
    const untilTs = alert?.snoozed_until ? Date.parse(alert.snoozed_until) : NaN;
    const remaining = Number.isFinite(untilTs) ? Math.max(Math.floor((untilTs - nowTick) / 1000), 0) : Number(alert?.snooze_remaining_seconds || 0);
    if (alert?.snooze_active && remaining > 0) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      return `snoozed ${mins}m ${secs}s left`;
    }
    if (alert?.snoozed_until) return 'snooze expired';
    return '';
  };

  return (
    <div>
      <div className="card highlight-card">
        <h3>Alerts Center</h3>
        <p>Dedicated in-app Prometheus alerting center for active alerts and host performance breach matrix.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="stat-info"><span className="stat-number">{summary.active_alerts_total || 0}</span><span className="stat-label">Active Alerts</span></div></div>
        <div className="stat-card danger"><div className="stat-info"><span className="stat-number">{summary.critical_alerts || 0}</span><span className="stat-label">Critical</span></div></div>
        <div className="stat-card warning"><div className="stat-info"><span className="stat-number">{summary.warning_alerts || 0}</span><span className="stat-label">Warning</span></div></div>
        <div className="stat-card info"><div className="stat-info"><span className="stat-number">{summary.offline_hosts || 0}</span><span className="stat-label">Offline Hosts</span></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Active Prometheus Alerts</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
            <button className="btn btn-sm" onClick={loadAlerts} disabled={loading}>Refresh</button>
          </div>
        </div>
        {error && <div className="ops-command-card" style={{ marginBottom: 10 }}>{error}</div>}
        <table className="table">
          <thead><tr><th>Alert</th><th>Severity</th><th>Instance</th><th>Summary</th><th>State</th><th>Tickets</th><th>Actions</th></tr></thead>
          <tbody>
            {alerts.map((alert, idx) => (
              <tr key={`alert-${idx}`}>
                <td>{alert.name || '-'}</td>
                <td><span className={`badge ${alertSeverityBadge(alert.severity)}`}>{alert.severity || 'unknown'}</span></td>
                <td>{alert.instance || '-'}</td>
                <td>{alert.summary || alert.description || '-'}</td>
                <td>
                  <div>{alert.acknowledged ? 'acknowledged' : 'active'}</div>
                  <div className="ops-subtle">
                    {snoozeBadgeText(alert) || (alert.starts_at ? new Date(alert.starts_at).toLocaleString() : '-')}
                  </div>
                </td>
                <td>{alert.ticket_count || 0}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => acknowledgeAlert(alert)} disabled={actionLoading}>Ack</button>
                  <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => snoozeAlert(alert)} disabled={actionLoading}>Snooze</button>
                  <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => unsnoozeAlert(alert)} disabled={actionLoading}>Unsnooze</button>
                  <button className="btn btn-sm btn-primary" style={{ marginLeft: 6 }} onClick={() => createTicket(alert)} disabled={actionLoading}>Create Ticket</button>
                </td>
              </tr>
            ))}
            {!alerts.length && (
              <tr><td colSpan={7} className="text-muted">{loading ? 'Loading alerts...' : 'No active alerts for selected filter.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Alert Tickets</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={ticketStatusFilter} onChange={(e) => setTicketStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <button className="btn btn-sm" onClick={loadTickets} disabled={loading || actionLoading}>Refresh</button>
          </div>
        </div>
        <table className="table">
          <thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Alert</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={`ticket-${ticket.id}`}>
                <td>{ticket.id}</td>
                <td>{ticket.title}</td>
                <td><span className={`badge ${alertSeverityBadge(ticket.severity)}`}>{ticket.severity}</span></td>
                <td>{ticket.alert_name} {ticket.instance ? `@ ${ticket.instance}` : ''}</td>
                <td>{ticket.status}</td>
                <td>{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '-'}</td>
                <td>
                  {String(ticket.status).toLowerCase() === 'open' ? (
                    <button className="btn btn-sm" onClick={() => updateTicketStatus(ticket, 'close')} disabled={actionLoading}>Close</button>
                  ) : (
                    <button className="btn btn-sm" onClick={() => updateTicketStatus(ticket, 'reopen')} disabled={actionLoading}>Reopen</button>
                  )}
                </td>
              </tr>
            ))}
            {!tickets.length && (
              <tr><td colSpan={7} className="text-muted">No alert tickets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Host Performance Alert Matrix</h3>
          <label className="toggle-option">
            <input type="checkbox" checked={onlyBreachedHosts} onChange={(e) => setOnlyBreachedHosts(e.target.checked)} />
            Show only breached hosts
          </label>
        </div>
        <div className="ops-subtle" style={{ marginBottom: 8 }}>
          Thresholds: CPU ≥ {thresholds.cpu_percent ?? 80}% · RAM ≥ {thresholds.memory_percent ?? 80}% · Disk I/O ≥ {thresholds.disk_io_bps ?? 10485760} B/s
        </div>
        <table className="table">
          <thead><tr><th>Host</th><th>Online</th><th>CPU %</th><th>RAM %</th><th>Disk I/O B/s</th><th>Breach Flags</th></tr></thead>
          <tbody>
            {hostMatrix.map((row) => {
              const flags = [
                row.offline_alert ? 'offline' : null,
                row.cpu_alert ? 'cpu_high' : null,
                row.memory_alert ? 'ram_high' : null,
                row.disk_io_alert ? 'io_high' : null,
              ].filter(Boolean);
              return (
                <tr key={row.instance}>
                  <td>{row.instance}</td>
                  <td><span className={`badge ${row.online ? 'badge-success' : 'badge-danger'}`}>{row.online ? 'online' : 'offline'}</span></td>
                  <td>{row.cpu_percent}</td>
                  <td>{row.memory_percent}</td>
                  <td>{row.disk_io_bps}</td>
                  <td>{flags.length ? flags.join(', ') : 'none'}</td>
                </tr>
              );
            })}
            {!hostMatrix.length && (
              <tr><td colSpan={6} className="text-muted">{loading ? 'Loading host matrix...' : 'No hosts in matrix.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
