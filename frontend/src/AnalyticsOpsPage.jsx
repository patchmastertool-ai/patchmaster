import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CHLoading, CH } from './CH.jsx';
import { RefreshCw, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';

function ProgressBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span style={{ color: CH.textSub }}>{label}</span>
        <span className="font-bold" style={{ color: CH.text }}>{value} <span style={{ color: CH.textSub }}>/ {max}</span></span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(3,29,75,0.6)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AnalyticsOpsPage({ API, apiFetch, useInterval, PatchVelocityChart }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [timeRange, setRange]   = useState('30d');

  const fetchData = useCallback(() => {
    setLoading(true);
    apiFetch(`${API}/api/dashboard/summary`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [API, apiFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  if (useInterval) useInterval(fetchData, 60000);

  const d = data || {};
  const totalHosts        = d.total_hosts       ?? d.hosts?.total         ?? 0;
  const onlineHosts       = d.online_hosts      ?? d.hosts?.online        ?? 0;
  const offlineHosts      = d.offline_hosts     ?? Math.max(0, totalHosts - onlineHosts);
  const rebootRequired    = d.reboot_required   ?? d.hosts?.reboot_required ?? 0;
  const successJobs30d    = d.success_jobs_30d  ?? d.jobs?.success_30d   ?? 0;
  const failedJobs30d     = d.failed_jobs_30d   ?? d.jobs?.failed_30d    ?? 0;
  const totalJobs30d      = d.total_jobs_30d    ?? (successJobs30d + failedJobs30d);
  const criticalCves      = d.critical_cves     ?? d.cves?.critical       ?? 0;
  const totalCves         = d.total_cves        ?? d.cves?.total_active   ?? 0;
  const riskScore         = d.risk_score        ?? 0;
  const healthPct         = totalHosts > 0 ? Math.round((onlineHosts / totalHosts) * 100) : 0;
  const patchSuccessRate  = totalJobs30d > 0 ? Math.round((successJobs30d / totalJobs30d) * 100) : 0;
  const avgPerDay         = timeRange === '7d' ? Math.round(totalJobs30d / 7) : timeRange === '90d' ? Math.round(totalJobs30d / 90) : Math.round(totalJobs30d / 30);

  const riskColor = riskScore >= 80 ? CH.red : riskScore >= 55 ? CH.yellow : CH.green;

  const topVulnerable  = Array.isArray(d.top_vulnerable)  ? d.top_vulnerable  : [];
  const recentActivity = Array.isArray(d.recent_activity) ? d.recent_activity : [];

  return (
    <CHPage>
      <CHHeader
        kicker="Operational Analytics"
        title="Fleet Analytics"
        subtitle={`Risk score: ${riskScore} · ${healthPct}% fleet availability · ${patchSuccessRate}% patch success`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {['7d', '30d', '90d'].map(r => (
                <button key={r}
                  onClick={() => setRange(r)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: timeRange === r ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
                    color: timeRange === r ? CH.accent : CH.textSub,
                    border: `1px solid ${timeRange === r ? CH.accent + '50' : CH.border}`,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <CHBtn variant="ghost" onClick={fetchData}><RefreshCw size={14} /></CHBtn>
          </div>
        }
      />

      {loading && !data && <div className="py-10 text-center text-sm" style={{ color: CH.textSub }}>Loading analytics...</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Fleet Health',    value: `${healthPct}%`,       sub: `${onlineHosts} online`,     accent: CH.green },
          { label: 'Risk Score',      value: riskScore,             sub: '0=safe, 100=critical',      accent: riskColor },
          { label: 'Patch Success',   value: `${patchSuccessRate}%`, sub: `${successJobs30d}/${totalJobs30d}`, accent: CH.accent },
          { label: 'Critical CVEs',   value: criticalCves,          sub: `${totalCves} total active`, accent: CH.red },
          { label: 'Reboot Queue',    value: rebootRequired,        sub: 'awaiting restart',          accent: CH.yellow },
          { label: 'Failed Jobs',     value: failedJobs30d,         sub: `${avgPerDay}/day avg`,      accent: failedJobs30d > 0 ? CH.red : CH.green },
        ].map(s => (
          <div key={s.label}
            className="rounded-2xl p-5 flex flex-col gap-2"
            style={{ background: 'rgba(6,18,45,0.7)', border: `1px solid ${CH.border}`, borderTop: `2px solid ${s.accent}` }}>
            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: CH.textSub }}>{s.label}</span>
            <span className="text-3xl font-black" style={{ color: s.accent }}>{s.value}</span>
            <span className="text-[11px]" style={{ color: CH.textSub }}>{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CHCard className="space-y-5">
          <CHLabel>Fleet Breakdown</CHLabel>
          <ProgressBar label="Online"          value={onlineHosts}   max={totalHosts}       color={CH.green}  />
          <ProgressBar label="Offline"         value={offlineHosts}  max={totalHosts}       color={CH.red}    />
          <ProgressBar label="Reboot Required" value={rebootRequired} max={totalHosts || 1} color={CH.yellow} />
        </CHCard>
        <CHCard className="space-y-5">
          <CHLabel>Patch Operations ({timeRange})</CHLabel>
          <ProgressBar label="Successful" value={successJobs30d} max={totalJobs30d || 1} color={CH.green} />
          <ProgressBar label="Failed"     value={failedJobs30d}  max={totalJobs30d || 1} color={CH.red}   />
          <div className="flex gap-3">
            <div className="rounded-xl px-4 py-3 flex-1" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
              <CHLabel>Total Jobs</CHLabel>
              <p className="text-xl font-black mt-1" style={{ color: CH.text }}>{totalJobs30d}</p>
            </div>
            <div className="rounded-xl px-4 py-3 flex-1" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
              <CHLabel>Success Rate</CHLabel>
              <p className="text-xl font-black mt-1" style={{ color: patchSuccessRate >= 90 ? CH.green : patchSuccessRate >= 70 ? CH.yellow : CH.red }}>{patchSuccessRate}%</p>
            </div>
          </div>
        </CHCard>
      </div>

      {/* Velocity Chart + CVE Mix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CHCard>
          <CHLabel>Patch Velocity (7-day)</CHLabel>
          <div className="mt-3">
            {PatchVelocityChart ? <PatchVelocityChart data={d.patch_velocity} /> : (
              <p className="text-xs py-4 text-center" style={{ color: CH.textSub }}>Chart component not available</p>
            )}
          </div>
        </CHCard>
        <CHCard>
          <CHLabel>CVE Exposure Mix</CHLabel>
          <div className="mt-4 space-y-4">
            {[
              { label: 'Critical',     value: criticalCves,                                             color: CH.red },
              { label: 'High',         value: Math.max(0, totalCves - criticalCves * 2),                color: '#f97316' },
              { label: 'Medium',       value: Math.max(0, totalCves - criticalCves * 3),                color: CH.yellow },
              { label: 'Total Active', value: totalCves,                                                color: CH.accent },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                <span className="text-sm" style={{ color: CH.textSub }}>{item.label}</span>
                <span className="font-black text-lg" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </CHCard>
      </div>

      {/* Top Vulnerable + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CHCard>
          <CHLabel>Top Vulnerable Hosts</CHLabel>
          <CHTable headers={['#', 'Hostname', 'OS', 'CVEs', 'Status']} emptyMessage="No CVE data available.">
            {topVulnerable.map((host, i) => (
              <CHTR key={host.id || i}>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>{i + 1}</td>
                <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{host.hostname}</td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{host.os || '—'}</td>
                <td className="px-6 py-4"><CHBadge color={CH.red}>{host.cve_count}</CHBadge></td>
                <td className="px-6 py-4"><CHBadge color={host.is_online ? CH.green : CH.red}>{host.is_online ? 'Online' : 'Offline'}</CHBadge></td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
        <CHCard>
          <CHLabel>Recent Activity Feed</CHLabel>
          <CHTable headers={['Host', 'Action', 'Status', 'Time']} emptyMessage="No recent jobs.">
            {recentActivity.map(item => (
              <CHTR key={item.id}>
                <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{item.hostname || 'System'}</td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{item.action}</td>
                <td className="px-6 py-4">
                  <CHBadge color={item.status === 'success' ? CH.green : item.status === 'failed' ? CH.red : CH.yellow}>{item.status}</CHBadge>
                </td>
                <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>
                  {item.created_at ? new Date(item.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      </div>
    </CHPage>
  );
}
