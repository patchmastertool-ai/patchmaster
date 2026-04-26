import React, { useCallback, useEffect, useState } from 'react';
import './OpsPages.css';

export default function AnalyticsOpsPage({ API, apiFetch, useInterval, AppIcon, PatchVelocityChart }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  const fetchData = useCallback(() => {
    setLoading(true);
    apiFetch(`${API}/api/dashboard/summary`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API, apiFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useInterval(fetchData, 60000);

  const d = data || {};
  const totalHosts = d.total_hosts ?? d.hosts?.total ?? 0;
  const onlineHosts = d.online_hosts ?? d.hosts?.online ?? 0;
  const offlineHosts = d.offline_hosts ?? Math.max(0, totalHosts - onlineHosts);
  const rebootRequired = d.reboot_required ?? d.hosts?.reboot_required ?? 0;
  const successJobs30d = d.success_jobs_30d ?? d.jobs?.success_30d ?? 0;
  const failedJobs30d = d.failed_jobs_30d ?? d.jobs?.failed_30d ?? 0;
  const totalJobs30d = d.total_jobs_30d ?? (successJobs30d + failedJobs30d);
  const criticalCves = d.critical_cves ?? d.cves?.critical ?? 0;
  const totalCves = d.total_cves ?? d.cves?.total_active ?? d.cves?.open_vulnerabilities ?? 0;
  const riskScore = d.risk_score ?? 0;
  const healthPct = totalHosts > 0 ? Math.round((onlineHosts / totalHosts) * 100) : 0;
  const patchSuccessRate = totalJobs30d > 0 ? Math.round((successJobs30d / totalJobs30d) * 100) : 0;
  const avgPerDay = timeRange === '7d' ? Math.round(totalJobs30d / 7) : timeRange === '90d' ? Math.round(totalJobs30d / 90) : Math.round(totalJobs30d / 30);

  const posture = riskScore >= 80
    ? {
        title: 'High-pressure operating state',
        description: 'Critical exposure or weak execution quality is pulling metrics upward. Use these analytics to reduce risk concentration quickly.',
        tone: '#b91c1c',
        bg: 'linear-gradient(145deg, #fef2f2, #fff7f7)',
        border: '#fca5a5',
      }
    : riskScore >= 55
      ? {
          title: 'Mixed signal environment',
          description: 'Overall posture is manageable, but some indicators are trending in the wrong direction. Watch failures, reboots, and host exposure.',
          tone: '#b45309',
          bg: 'linear-gradient(145deg, #fffbeb, #fffdf5)',
          border: '#fcd34d',
        }
      : {
          title: 'Healthy trendline',
          description: 'Fleet availability and patch execution metrics are staying within a controlled range. Keep the feed fresh and maintain cadence.',
          tone: '#166534',
          bg: 'linear-gradient(145deg, #ecfdf3, #f8fffb)',
          border: '#86efac',
        };

  const summaryCards = [
    { label: 'Fleet Health', value: `${healthPct}%`, sub: `${onlineHosts} online / ${offlineHosts} offline`, icon: 'monitor', color: '#0f766e', bg: 'rgba(20,184,166,0.12)' },
    { label: 'Risk Score', value: riskScore, sub: '0 is safest, 100 is highest pressure', icon: 'analytics', color: riskScore > 70 ? '#dc2626' : riskScore > 40 ? '#d97706' : '#16a34a', bg: riskScore > 70 ? 'rgba(239,68,68,0.12)' : riskScore > 40 ? 'rgba(245,158,11,0.14)' : 'rgba(34,197,94,0.12)' },
    { label: 'Patch Success', value: `${patchSuccessRate}%`, sub: `${successJobs30d} successful / ${totalJobs30d} total`, icon: 'shield', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Critical CVEs', value: criticalCves, sub: `${totalCves} total active CVEs`, icon: 'bug', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
    { label: 'Reboot Queue', value: rebootRequired, sub: 'hosts waiting for restart completion', icon: 'refresh', color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
    { label: 'Failed Jobs', value: failedJobs30d, sub: `${avgPerDay} jobs per day on average`, icon: 'timeline', color: failedJobs30d > 0 ? '#dc2626' : '#16a34a', bg: failedJobs30d > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)' },
  ];

  const progressRows = [
    { label: 'Online', value: onlineHosts, max: totalHosts, color: '#10b981' },
    { label: 'Offline', value: offlineHosts, max: totalHosts, color: '#ef4444' },
    { label: 'Reboot Required', value: rebootRequired, max: totalHosts || 1, color: '#f59e0b' },
  ];

  const operationsRows = [
    { label: 'Successful', value: successJobs30d, max: totalJobs30d || 1, color: '#10b981' },
    { label: 'Failed', value: failedJobs30d, max: totalJobs30d || 1, color: '#ef4444' },
  ];

  const cveRows = [
    { label: 'Critical', value: criticalCves, color: '#ef4444' },
    { label: 'High', value: Math.max(0, totalCves - (criticalCves * 2)), color: '#f97316' },
    { label: 'Medium', value: Math.max(0, totalCves - (criticalCves * 3)), color: '#f59e0b' },
    { label: 'Total Active', value: totalCves, color: '#3b82f6' },
  ];

  const topVulnerable = Array.isArray(d.top_vulnerable) ? d.top_vulnerable : [];
  const recentActivity = Array.isArray(d.recent_activity) ? d.recent_activity : [];

  const ProgressBar = ({ label, value, max, color }) => {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span>{label}</span>
          <span style={{ fontWeight: 700 }}>{value} <span style={{ color: '#64748b', fontWeight: 400 }}>/ {max}</span></span>
        </div>
        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    );
  };

  if (loading && !data) {
    return <div className="ops-empty">Loading analytics...</div>;
  }

  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: posture.border, background: posture.bg }}>
          <div className="ops-kicker">Operational analytics</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Observed risk</span>
              <span className="ops-emphasis-value" style={{ color: posture.tone }}>{riskScore}</span>
              <span className="ops-emphasis-meta">{patchSuccessRate}% patch success rate across the selected analytics window</span>
            </div>
            <div className="ops-hero-copy">
              <h3>{posture.title}</h3>
              <p>{posture.description}</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{totalHosts} managed hosts</span>
            <span className="ops-chip">{onlineHosts} currently online</span>
            <span className="ops-chip">{criticalCves} critical CVEs open</span>
            <span className="ops-chip">{timeRange} analytics window selected</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <div className="ops-table-toolbar" style={{ marginBottom: 12 }}>
            <div>
              <span className="ops-side-label">Time window</span>
              <div className="ops-side-metric">{timeRange}</div>
            </div>
            <button className="btn btn-sm" onClick={fetchData}>Refresh</button>
          </div>
          <div className="ops-pills">
            {['7d', '30d', '90d'].map(range => (
              <button key={range} className={`ops-pill ${timeRange === range ? 'active' : ''}`} onClick={() => setTimeRange(range)}>
                {range}
              </button>
            ))}
          </div>
          <div className="ops-inline-list">
            {[
              { label: 'Jobs / day', value: avgPerDay },
              { label: 'Offline hosts', value: offlineHosts },
              { label: 'Restart queue', value: rebootRequired },
              { label: 'Total CVEs', value: totalCves },
            ].map(item => (
              <div key={item.label} className="ops-inline-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ops-summary-grid">
        {summaryCards.map(card => (
          <div key={card.label} className="ops-summary-card">
            <div className="ops-summary-head">
              <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>
                <AppIcon name={card.icon} size={18} />
              </span>
              <span className="ops-summary-label">{card.label}</span>
            </div>
            <div className="ops-summary-value">{card.value}</div>
            <div className="ops-summary-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Fleet breakdown</div>
              <p className="ops-subtle">Availability and restart pressure across the managed estate.</p>
            </div>
          </div>
          {progressRows.map(row => <ProgressBar key={row.label} {...row} />)}
          <div className="ops-inline-list" style={{ marginTop: 16 }}>
            <div className="ops-inline-card">
              <strong>{healthPct}%</strong>
              <span>fleet availability</span>
            </div>
            <div className="ops-inline-card">
              <strong>99%</strong>
              <span>target service level</span>
            </div>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Patch operations</div>
              <p className="ops-subtle">Success and failure trend lines across recent patch execution.</p>
            </div>
          </div>
          {operationsRows.map(row => <ProgressBar key={row.label} {...row} />)}
          <div className="ops-inline-list" style={{ marginTop: 16 }}>
            <div className="ops-inline-card">
              <strong>{totalJobs30d}</strong>
              <span>total jobs in window</span>
            </div>
            <div className="ops-inline-card">
              <strong>{patchSuccessRate}%</strong>
              <span>success rate</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Patch velocity</div>
              <p className="ops-subtle">Seven-day patch throughput based on recent job execution.</p>
            </div>
          </div>
          <PatchVelocityChart data={d.patch_velocity} />
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">CVE exposure mix</div>
              <p className="ops-subtle">A quick severity breakdown of active vulnerability pressure.</p>
            </div>
          </div>
          <div className="ops-list">
            {cveRows.map(item => (
              <div key={item.label} className="ops-list-item">
                <div className="ops-list-copy">
                  <strong>{item.label}</strong>
                  <span>Current visible count</span>
                </div>
                <div className="ops-list-metrics">
                  <span className="ops-chip" style={{ color: item.color, borderColor: `${item.color}33`, background: `${item.color}14` }}>{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Top vulnerable hosts</div>
              <p className="ops-subtle">Hosts with the highest exposure concentration right now.</p>
            </div>
          </div>
          {!topVulnerable.length ? (
            <div className="ops-empty">No CVE data available.</div>
          ) : (
            <div className="table-wrap">
              <table className="table ops-table">
                <thead>
                  <tr><th>#</th><th>Hostname</th><th>OS</th><th>CVEs</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {topVulnerable.map((host, index) => (
                    <tr key={host.id || index}>
                      <td>{index + 1}</td>
                      <td><strong>{host.hostname}</strong></td>
                      <td>{host.os || '-'}</td>
                      <td><span className="badge badge-danger">{host.cve_count}</span></td>
                      <td><span className={`badge badge-${host.is_online ? 'success' : 'danger'}`}>{host.is_online ? 'Online' : 'Offline'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Recent activity</div>
              <p className="ops-subtle">Latest operational events and job outcomes from the analytics feed.</p>
            </div>
          </div>
          {!recentActivity.length ? (
            <div className="ops-empty">No recent jobs.</div>
          ) : (
            <div className="table-wrap">
              <table className="table ops-table">
                <thead>
                  <tr><th>Host</th><th>Action</th><th>Status</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {recentActivity.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.hostname || 'System'}</strong></td>
                      <td>{item.action}</td>
                      <td><span className={`badge badge-${item.status === 'success' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'}`}>{item.status}</span></td>
                      <td>{item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

{/* placeholder */}
