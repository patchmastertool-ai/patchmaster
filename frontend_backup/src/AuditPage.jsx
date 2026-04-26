import React, { useEffect, useState } from 'react';
import { formatDetailsText, sanitizeDisplayText } from './appRuntime';

export default function AuditPage({ API, apiFetch }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [days, setDays] = useState(7);

  const refresh = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    params.set('days', days);
    apiFetch(`${API}/api/audit/?${params}`).then((response) => response.json()).then(setLogs).catch(() => {});
    apiFetch(`${API}/api/audit/stats`).then((response) => response.json()).then(setStats).catch(() => {});
  };

  useEffect(refresh, [actionFilter, days]);

  return (
    <div>
      {stats && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-info"><span className="stat-number">{stats.today}</span><span className="stat-label">Today</span></div></div>
          <div className="stat-card info"><div className="stat-info"><span className="stat-number">{stats.this_week}</span><span className="stat-label">This Week</span></div></div>
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <h3>Audit Logs</h3>
          <div className="form-row">
            <input className="input" placeholder="Filter by action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
            <select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value={1}>Last 1 day</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
        {logs.length === 0 ? <p className="text-muted">No audit logs found.</p> : (
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>Details</th></tr></thead>
            <tbody>{logs.map((log) => {
              const detailText = formatDetailsText(log.details);
              const detailPreview = detailText ? (detailText.length > 140 ? `${detailText.slice(0, 140)}...` : detailText) : '';
              return (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{sanitizeDisplayText(log.username || log.user_id || 'system', 'system')}</td>
                  <td><span className="badge badge-info">{sanitizeDisplayText(log.action, 'UNKNOWN')}</span></td>
                  <td>{sanitizeDisplayText(`${log.resource_type || ''} ${log.resource_id ? `#${log.resource_id}` : ''}`.trim(), '-')}</td>
                  <td style={{ minWidth: 320, maxWidth: 560 }}>
                    {detailText ? (
                      <details>
                        <summary style={{ cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {detailPreview}
                        </summary>
                        <pre className="code-block" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto', marginTop: 8 }}>
                          {detailText}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
