import React, { useCallback, useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable
} from './components/StitchComponents';

function ProgressBar({ label, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  
  let color = '#7bd0ff';
  if (label === 'Offline' || label === 'Failed') {
    color = '#ee7d77';
  } else if (label === 'Reboot Required') {
    color = '#ffd16f';
  }
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-[#91aaeb]">{label}</span>
        <span className="font-bold text-[#dee5ff]">{value} <span className="text-[#91aaeb]">/ {max}</span></span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-[#031d4b]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function AnalyticsOpsPage({ API, apiFetch, useInterval, PatchVelocityChart }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setRange] = useState('30d');

  const fetchData = useCallback(() => {
    setLoading(true);
    apiFetch(`${API}/api/dashboard/summary`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [API, apiFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  if (useInterval) useInterval(fetchData, 60000);

  const d = data || {};
  const totalHosts = d.total_hosts ?? d.hosts?.total ?? 0;
  const onlineHosts = d.online_hosts ?? d.hosts?.online ?? 0;
  const offlineHosts = d.offline_hosts ?? Math.max(0, totalHosts - onlineHosts);
  const rebootRequired = d.reboot_required ?? d.hosts?.reboot_required ?? 0;
  const successJobs30d = d.success_jobs_30d ?? d.jobs?.success_30d ?? 0;
  const failedJobs30d = d.failed_jobs_30d ?? d.jobs?.failed_30d ?? 0;
  const totalJobs30d = d.total_jobs_30d ?? (successJobs30d + failedJobs30d);
  const criticalCves = d.critical_cves ?? d.cves?.critical ?? 0;
  const totalCves = d.total_cves ?? d.cves?.total_active ?? 0;
  const riskScore = d.risk_score ?? 0;
  const healthPct = totalHosts > 0 ? Math.round((onlineHosts / totalHosts) * 100) : 0;
  const patchSuccessRate = totalJobs30d > 0 ? Math.round((successJobs30d / totalJobs30d) * 100) : 0;
  const avgPerDay = timeRange === '7d' ? Math.round(totalJobs30d / 7) : timeRange === '90d' ? Math.round(totalJobs30d / 90) : Math.round(totalJobs30d / 30);

  const topVulnerable = Array.isArray(d.top_vulnerable) ? d.top_vulnerable : [];
  const recentActivity = Array.isArray(d.recent_activity) ? d.recent_activity : [];

  return (
    <div className="space-y-8">
      <StitchPageHeader
        kicker="Operational Analytics"
        title="Fleet Analytics & SLA"
        description={`Risk score: ${riskScore} | ${healthPct}% fleet availability | ${patchSuccessRate}% patch success`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-[#05183c] rounded-xl">
              {['7d', '30d', '90d'].map(r => (
                <StitchButton
                  key={r}
                  variant={timeRange === r ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setRange(r)}
                >
                  {r}
                </StitchButton>
              ))}
            </div>
            <StitchButton variant="secondary" size="sm" icon="refresh" onClick={fetchData} />
          </div>
        }
      />

      {loading && !data && (
        <div className="py-10 text-center text-sm text-[#91aaeb]">Loading analytics...</div>
      )}

      {/* KPI Cards */}
      <StitchMetricGrid cols={6}>
        <StitchSummaryCard
          label="Fleet Health"
          value={`${healthPct}%`}
          subtitle={`${onlineHosts} online`}
          icon="dns"
          color="#10b981"
        />
        <StitchSummaryCard
          label="Risk Score"
          value={riskScore}
          subtitle="0=safe 100=critical"
          icon="warning"
          color={riskScore >= 80 ? '#ee7d77' : riskScore >= 55 ? '#ffd16f' : '#7bd0ff'}
        />
        <StitchSummaryCard
          label="Patch Success"
          value={`${patchSuccessRate}%`}
          subtitle={`${successJobs30d} of ${totalJobs30d}`}
          icon="check_circle"
          color="#10b981"
        />
        <StitchSummaryCard
          label="Critical CVEs"
          value={criticalCves}
          subtitle={`${totalCves} total active`}
          icon="security"
          color={criticalCves > 0 ? '#ee7d77' : '#10b981'}
        />
        <StitchSummaryCard
          label="Reboot Queue"
          value={rebootRequired}
          subtitle="awaiting restart"
          icon="restart_alt"
          color={rebootRequired > 0 ? '#ffd16f' : '#10b981'}
        />
        <StitchSummaryCard
          label="Failed Jobs"
          value={failedJobs30d}
          subtitle={`${avgPerDay}/day avg`}
          icon="error"
          color={failedJobs30d > 0 ? '#ee7d77' : '#10b981'}
        />
      </StitchMetricGrid>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#05183c] p-8 rounded-xl">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-6">Fleet Breakdown</h3>
          <div className="space-y-4">
            <ProgressBar label="Online" value={onlineHosts} max={totalHosts} />
            <ProgressBar label="Offline" value={offlineHosts} max={totalHosts} />
            <ProgressBar label="Reboot Required" value={rebootRequired} max={totalHosts || 1} />
          </div>
        </div>
        <div className="bg-[#05183c] p-8 rounded-xl">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-6">Patch Operations ({timeRange})</h3>
          <div className="space-y-4">
            <ProgressBar label="Successful" value={successJobs30d} max={totalJobs30d || 1} />
            <ProgressBar label="Failed" value={failedJobs30d} max={totalJobs30d || 1} />
            <div className="flex gap-3 mt-4">
              <div className="rounded-xl px-4 py-3 flex-1 bg-[#031d4b] border border-[#2b4680]">
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Total Jobs</p>
                <p className="text-xl font-black mt-1 text-[#dee5ff]">{totalJobs30d}</p>
              </div>
              <div className="rounded-xl px-4 py-3 flex-1 bg-[#031d4b] border border-[#2b4680]">
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Success Rate</p>
                <p className={`text-xl font-black mt-1 ${patchSuccessRate >= 90 ? 'text-[#7bd0ff]' : patchSuccessRate >= 70 ? 'text-[#ffd16f]' : 'text-[#ee7d77]'}`}>{patchSuccessRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Velocity Chart + CVE Mix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#05183c] p-8 rounded-xl">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-6">Patch Velocity (7-day)</h3>
          {PatchVelocityChart ? <PatchVelocityChart data={d.patch_velocity} /> : (
            <p className="text-xs py-4 text-center text-[#91aaeb]">Chart component not available</p>
          )}
        </div>
        <div className="bg-[#05183c] p-8 rounded-xl">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-6">CVE Exposure Mix</h3>
          <div className="space-y-4">
            {[
              { label: 'Critical', value: criticalCves, color: '#ee7d77' },
              { label: 'High', value: Math.max(0, totalCves - criticalCves * 2), color: '#ffd16f' },
              { label: 'Medium', value: Math.max(0, totalCves - criticalCves * 3), color: '#7bd0ff' },
              { label: 'Total Active', value: totalCves, color: '#91aaeb' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-[#031d4b] border border-[#2b4680]">
                <span className="text-sm text-[#91aaeb]">{item.label}</span>
                <span className="font-black text-lg" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Vulnerable + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#05183c] p-8 rounded-xl">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-6">Top Vulnerable Hosts</h3>
          <StitchTable
            columns={[
              { key: 'hostname', header: 'Hostname' },
              { key: 'os', header: 'OS', render: (row) => row.os || '-' },
              { key: 'cve_count', header: 'CVEs', render: (row) => <StitchBadge variant="error" size="sm">{row.cve_count}</StitchBadge> },
              { key: 'is_online', header: 'Status', render: (row) => <StitchBadge variant={row.is_online ? 'success' : 'error'} size="sm">{row.is_online ? 'Online' : 'Offline'}</StitchBadge> },
            ]}
            data={topVulnerable}
          />
        </div>
        <div className="bg-[#05183c] p-8 rounded-xl">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-6">Recent Activity Feed</h3>
          <StitchTable
            columns={[
              { key: 'hostname', header: 'Host', render: (row) => row.hostname || 'System' },
              { key: 'action', header: 'Action' },
              { key: 'status', header: 'Status', render: (row) => <StitchBadge variant={row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : 'warning'} size="sm">{row.status}</StitchBadge> },
              { key: 'created_at', header: 'Time', render: (row) => row.created_at ? new Date(row.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' },
            ]}
            data={recentActivity}
          />
        </div>
      </div>
    </div>
  );
}
