import React, { useCallback, useEffect, useState } from 'react';
import { 
  StitchSummaryCard, 
  StitchMetricGrid,
  StitchActivityItem,
  StitchButton,
  StitchEmptyState,
  StitchBadge,
  StitchStatusDot,
  StitchPageHeader
} from './components/StitchComponents';

export default function DashboardOpsPage({ health, hosts, jobs, setPage, API, apiFetch, useInterval, AppIcon, RiskGauge, PatchVelocityChart }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(() => {
    setLoading(true);
    apiFetch(`${API}/api/dashboard/summary`)
      .then(r => r.json())
      .then(d => { setSummary(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [API, apiFetch]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  if (useInterval) useInterval(fetchSummary, 60000);

  if (loading && !summary) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <span className="material-symbols-outlined text-5xl text-[#7bd0ff] animate-spin mx-auto mb-4">refresh</span>
        <p className="text-[#91aaeb]">Loading dashboard…</p>
      </div>
    </div>
  );

  if (!hosts.length) return (
    <StitchEmptyState
      icon="dns"
      title="Welcome to PatchMaster"
      description="No agents are registered yet. Once hosts are online, this command center will show live compliance posture, CVE exposure, patch velocity, and remediation workload."
      actionLabel="Start Setup"
      onAction={() => setPage('onboarding')}
    />
  );

  const s = summary || {};
  const running = jobs.filter(j => j.status === 'running').length;
  const pending = jobs.filter(j => ['pending','scheduled'].includes(j.status)).length;
  const totalHosts = s.total_hosts ?? hosts.length;
  const onlineHosts = s.online_hosts ?? 0;
  const avgCompliance = s.avg_compliance ?? 0;
  const criticalCves = s.critical_cves ?? 0;
  const rebootRequired = s.reboot_required ?? 0;
  const openVulns = s.total_cves ?? 0;
  const upgradable = s.total_upgradable ?? 0;
  const riskScore = s.risk_score ?? 0;
  const success30d = s.success_jobs_30d ?? 0;
  const failed30d = s.failed_jobs_30d ?? 0;
  const patchSuccessRate = success30d + failed30d
    ? Math.round((success30d / (success30d + failed30d)) * 100) : 0;
  const onlinePct = totalHosts ? Math.round((onlineHosts / totalHosts) * 100) : 0;

  const recentActivity = Array.isArray(s.recent_activity) ? s.recent_activity.slice(0, 8) : [];
  const attentionItems = Array.isArray(s.needs_attention) ? s.needs_attention : [];

  return (
    <div className="space-y-8">
      {/* Workspace Distinction Indicator */}
      <div className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30 bg-[#7bd0ff]" />
      
      {/* Page Header */}
      <StitchPageHeader
        kicker="Infrastructure Overview"
        title="Command Dashboard"
        workspace="fleet"
      />

      {/* Bento Grid Summary Stats - matching Stitch exactly */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Total Hosts"
          value={totalHosts.toLocaleString()}
          subtitle="since yesterday"
          trend="+12"
          icon="dns"
          color="#7bd0ff"
          onClick={() => setPage('hosts')}
          workspace="fleet"
        />
        <StitchSummaryCard
          label="Online"
          value={onlineHosts.toLocaleString()}
          subtitle="availability"
          trend={`${onlinePct}%`}
          icon="sensors"
          color="#7bd0ff"
          onClick={() => setPage('hosts')}
          workspace="fleet"
        />
        <StitchSummaryCard
          label="Failed Jobs"
          value={failed30d}
          subtitle="response required"
          trend="Critical"
          icon="warning"
          color="#ee7d77"
          onClick={() => setPage('jobs')}
          workspace="fleet"
        />
        <StitchSummaryCard
          label="Pending Updates"
          value={upgradable}
          subtitle="security patches"
          trend="24"
          icon="system_update_alt"
          color="#ffd16f"
          onClick={() => setPage('patches')}
          workspace="fleet"
        />
      </StitchMetricGrid>

      {/* Heartbeat Activity & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Line Chart: Heartbeat Activity */}
        <div className="lg:col-span-2 bg-[#05183c] p-4 sm:p-6 lg:p-8 rounded-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8 sm:mb-12">
            <div>
              <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">Live Metrics</div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#dee5ff]">Heartbeat Activity</h2>
            </div>
            <div className="flex gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#7bd0ff]"></span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Core Fleet</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#5b74b1]"></span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Edge Nodes</span>
              </div>
            </div>
          </div>
          
          {/* SVG Chart Visualization */}
          <div className="relative h-48 sm:h-64 w-full">
            {PatchVelocityChart ? (
              <PatchVelocityChart data={s?.patch_velocity} />
            ) : (
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
                {/* Background Grid */}
                <line opacity="0.2" stroke="#2b4680" strokeDasharray="4" strokeWidth="0.5" x1="0" x2="1000" y1="50" y2="50"></line>
                <line opacity="0.2" stroke="#2b4680" strokeDasharray="4" strokeWidth="0.5" x1="0" x2="1000" y1="100" y2="100"></line>
                <line opacity="0.2" stroke="#2b4680" strokeDasharray="4" strokeWidth="0.5" x1="0" x2="1000" y1="150" y2="150"></line>
                {/* Primary Path */}
                <path 
                  className="drop-shadow-[0_0_8px_rgba(123,208,255,0.4)]" 
                  d="M0,140 L50,130 L100,150 L150,110 L200,120 L250,90 L300,100 L350,70 L400,85 L450,40 L500,60 L550,55 L600,80 L650,45 L700,50 L750,30 L800,45 L850,20 L900,35 L950,15 L1000,25" 
                  fill="none" 
                  stroke="#7bd0ff" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="3"
                />
                {/* Secondary Path */}
                <path 
                  d="M0,180 L50,175 L100,185 L150,170 L200,175 L250,160 L300,165 L350,150 L400,155 L450,140 L500,145 L550,135 L600,140 L650,125 L700,130 L750,115 L800,120 L850,105 L900,110 L950,95 L1000,100" 
                  fill="none" 
                  opacity="0.5" 
                  stroke="#5b74b1" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2"
                />
              </svg>
            )}
            {/* Chart Labels */}
            <div className="absolute inset-0 flex justify-between items-end pt-4 text-[10px] font-mono text-[#91aaeb]/40">
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>00:00</span>
            </div>
          </div>
          
          <div className="mt-6 sm:mt-8 flex flex-wrap gap-4 sm:gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Avg Latency</span>
              <span className="text-lg sm:text-xl font-bold text-[#dee5ff]">14ms</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Peak Load</span>
              <span className="text-lg sm:text-xl font-bold text-[#dee5ff]">88.4%</span>
            </div>
          </div>
        </div>

        {/* Recent Operations */}
        <div className="bg-[#05183c] p-4 sm:p-6 lg:p-8 rounded-xl flex flex-col">
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <div>
              <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">Log Stream</div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#dee5ff]">Recent Operations</h2>
            </div>
            <button 
              className="text-[#7bd0ff] hover:bg-[#7bd0ff]/10 p-2 rounded-lg transition-colors"
              onClick={() => setPage('jobs')}
            >
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
          
          <div className="space-y-3 sm:space-y-4 overflow-y-auto no-scrollbar max-h-[400px]">
            {!recentActivity.length ? (
              <p className="text-sm text-[#91aaeb]">No recent activity.</p>
            ) : (
              recentActivity.map(item => {
                const badgeVariant = item.status === 'success' ? 'success' : item.status === 'failed' ? 'error' : 'warning';
                const iconName = item.status === 'success' ? 'history' : item.status === 'failed' ? 'error_outline' : 'sync';
                const iconColor = item.status === 'success' ? '#7bd0ff' : item.status === 'failed' ? '#ee7d77' : '#ffd16f';
                const iconBg = item.status === 'success' ? 'rgba(123,208,255,0.3)' : item.status === 'failed' ? 'rgba(238,125,119,0.1)' : 'rgba(255,209,111,0.1)';
                
                return (
                  <StitchActivityItem
                    key={item.id}
                    icon={iconName}
                    iconColor={iconColor}
                    iconBg={iconBg}
                    title={item.hostname || `Job #${item.id}`}
                    subtitle={item.action || 'No details available'}
                    badge={item.status?.toUpperCase()}
                    badgeVariant={badgeVariant}
                    timestamp={item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    onClick={() => setPage('jobs')}
                  />
                );
              })
            )}
          </div>
          
          <button 
            className="mt-auto w-full py-3 text-[10px] font-bold uppercase tracking-widest text-[#91aaeb] hover:text-[#7bd0ff] transition-colors border-t border-[#2b4680]/10"
            onClick={() => setPage('jobs')}
          >
            View Full History
          </button>
        </div>
      </div>

      {/* License & Tier Status Widget + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* License Status */}
        <div className="bg-gradient-to-br from-[#05183c] to-[#031d4b] p-8 rounded-xl border border-[#2b4680]/20 flex gap-8 items-center">
          <div className="w-32 h-32 flex-shrink-0 rounded-full border-4 border-[#7bd0ff]/20 flex items-center justify-center relative">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-[#7bd0ff]/10" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="4"></circle>
              <circle 
                className="text-[#7bd0ff]" 
                cx="64" 
                cy="64" 
                fill="transparent" 
                r="58" 
                stroke="currentColor" 
                strokeDasharray="364.4" 
                strokeDashoffset="40" 
                strokeWidth="4"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-[#dee5ff]">{onlinePct}%</span>
              <span className="text-[8px] uppercase font-bold text-[#91aaeb]">Usage</span>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#7bd0ff] mb-1">License Strategy</div>
              <h3 className="text-2xl font-bold tracking-tight text-[#dee5ff]">Enterprise Tier</h3>
            </div>
            <p className="text-sm text-[#91aaeb] leading-relaxed">
              Your enterprise license includes unlimited host patching, priority CVE updates, and dedicated infrastructure support. Next renewal: <span className="text-[#dee5ff] font-semibold">Jan 12, 2025</span>.
            </p>
            <div className="flex gap-3">
              <StitchButton onClick={() => setPage('license')}>Manage License</StitchButton>
              <StitchButton variant="secondary" onClick={() => setPage('hosts')}>View Limits</StitchButton>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#031d4b] p-8 rounded-xl flex flex-col justify-center gap-6 relative overflow-hidden group">
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[#7bd0ff]/5 rounded-full blur-3xl transition-transform duration-500 group-hover:scale-110"></div>
          <div>
            <div className="text-[#91aaeb] uppercase tracking-widest text-[10px] font-bold mb-4">Quick Actions</div>
            <div className="grid grid-cols-2 gap-4">
              <button 
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#00225a]/60 border border-[#2b4680]/10 hover:border-[#7bd0ff]/40 hover:bg-[#7bd0ff]/5 transition-all group/btn"
                onClick={() => setPage('compliance')}
              >
                <span className="material-symbols-outlined text-[#7bd0ff] group-hover/btn:scale-110 transition-transform">add_moderator</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#dee5ff]">Run Baseline</span>
              </button>
              <button 
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#00225a]/60 border border-[#2b4680]/10 hover:border-[#7bd0ff]/40 hover:bg-[#7bd0ff]/5 transition-all group/btn"
                onClick={() => setPage('patches')}
              >
                <span className="material-symbols-outlined text-[#ffd16f] group-hover/btn:scale-110 transition-transform">security_update_good</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#dee5ff]">Auto Patch</span>
              </button>
              <button 
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#00225a]/60 border border-[#2b4680]/10 hover:border-[#7bd0ff]/40 hover:bg-[#7bd0ff]/5 transition-all group/btn"
                onClick={() => setPage('backups')}
              >
                <span className="material-symbols-outlined text-[#939eb5] group-hover/btn:scale-110 transition-transform">download_for_offline</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#dee5ff]">Backup Host</span>
              </button>
              <button 
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-[#00225a]/60 border border-[#2b4680]/10 hover:border-[#7bd0ff]/40 hover:bg-[#7bd0ff]/5 transition-all group/btn"
                onClick={() => setPage('live-cmd')}
              >
                <span className="material-symbols-outlined text-[#91aaeb] group-hover/btn:scale-110 transition-transform">terminal</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#dee5ff]">Remote SSH</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attention Items */}
      {attentionItems.length > 0 && (
        <div className="bg-[#05183c] p-8 rounded-xl">
          <div className="text-[#91aaeb] uppercase tracking-widest text-[10px] font-bold mb-4">Needs Attention</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attentionItems.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-[#7f2927]/5 border border-[#ee7d77]/20"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#ee7d77]"></span>
                  <span className="text-xs font-bold text-[#dee5ff]">{item.hostname || item.host}</span>
                </div>
                <p className="text-xs text-[#91aaeb]">{item.message || item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}