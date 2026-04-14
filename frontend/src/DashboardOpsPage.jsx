import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHDot, CHBtn, CHLoading, CH } from './CH.jsx';
import { Activity, Shield, AlertTriangle, Package, CheckCircle, Clock, Zap, Server, RefreshCw } from 'lucide-react';

export default function DashboardOpsPage({ health, hosts, jobs, setPage, API, apiFetch, useInterval, AppIcon, RiskGauge, PatchVelocityChart }) {
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);

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
    <CHPage><CHLoading message="Loading dashboard…" /></CHPage>
  );

  if (!hosts.length) return (
    <CHPage>
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: `${CH.accent}15`, color: CH.accent }}>
          <Server size={40} />
        </div>
        <h2 className="text-3xl font-black" style={{ color: CH.text }}>Welcome to PatchMaster</h2>
        <p className="text-base max-w-xl leading-relaxed" style={{ color: CH.textSub }}>
          No agents are registered yet. Once hosts are online, this command center will show live compliance posture, CVE exposure, patch velocity, and remediation workload.
        </p>
        <CHBtn variant="primary" onClick={() => setPage('onboarding')}>
          <Zap size={14} /> Start Setup
        </CHBtn>
      </div>
    </CHPage>
  );

  const s = summary || {};
  const running  = jobs.filter(j => j.status === 'running').length;
  const pending  = jobs.filter(j => ['pending','scheduled'].includes(j.status)).length;
  const totalHosts    = s.total_hosts    ?? hosts.length;
  const onlineHosts   = s.online_hosts   ?? 0;
  const avgCompliance = s.avg_compliance ?? 0;
  const criticalCves  = s.critical_cves  ?? 0;
  const rebootRequired= s.reboot_required?? 0;
  const openVulns     = s.total_cves     ?? 0;
  const upgradable    = s.total_upgradable?? 0;
  const riskScore     = s.risk_score     ?? 0;
  const success30d    = s.success_jobs_30d ?? 0;
  const failed30d     = s.failed_jobs_30d  ?? 0;
  const patchSuccessRate = success30d + failed30d
    ? Math.round((success30d / (success30d + failed30d)) * 100) : 0;
  const onlinePct = totalHosts ? Math.round((onlineHosts / totalHosts) * 100) : 0;

  const recentActivity = Array.isArray(s.recent_activity) ? s.recent_activity.slice(0, 8) : [];
  const attentionItems = Array.isArray(s.needs_attention) ? s.needs_attention : [];

  return (
    <CHPage>
      {/* Header */}
      <CHHeader
        kicker="Infrastructure Overview"
        title="Command Dashboard"
        actions={
          <CHBtn variant="ghost" onClick={fetchSummary}>
            <RefreshCw size={14} /> Refresh
          </CHBtn>
        }
      />

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat
          label="Managed Hosts"
          value={totalHosts}
          sub={`${onlineHosts} reporting live`}
          accent={CH.accent}
          onClick={() => setPage('hosts')}
        />
        <CHStat
          label="Patch Compliance"
          value={`${avgCompliance}%`}
          sub={`${rebootRequired} awaiting reboot`}
          accent={CH.green}
          onClick={() => setPage('compliance')}
        />
        <CHStat
          label="Critical CVEs"
          value={criticalCves}
          sub={`${openVulns} open vulnerabilities`}
          accent={CH.red}
          onClick={() => setPage('cve')}
        />
        <CHStat
          label="Patch Queue"
          value={upgradable}
          sub={`${running} jobs running now`}
          accent="#a78bfa"
          onClick={() => setPage('patches')}
        />
      </div>

      {/* ── Row 2: Chart + Activity Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Velocity Chart */}
        <CHCard className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-end justify-between">
            <div>
              <CHLabel>Live Metrics</CHLabel>
              <h2 className="text-2xl font-bold tracking-tight mt-1" style={{ color: CH.text }}>Execution Velocity</h2>
            </div>
            {RiskGauge && <RiskGauge score={riskScore} />}
          </div>
          <div className="h-56">
            {PatchVelocityChart ? <PatchVelocityChart data={s?.patch_velocity} /> : (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: CH.textSub }}>
                No velocity data available
              </div>
            )}
          </div>
          <div className="flex gap-8 pt-2" style={{ borderTop: `1px solid ${CH.border}` }}>
            <div>
              <CHLabel>Avg Success Rate</CHLabel>
              <span className="text-xl font-bold" style={{ color: CH.text }}>{patchSuccessRate}%</span>
            </div>
            <div>
              <CHLabel>Pending Maintenance</CHLabel>
              <span className="text-xl font-bold" style={{ color: CH.text }}>{pending} Tasks</span>
            </div>
            <div>
              <CHLabel>Execution Quality</CHLabel>
              <span className="text-xl font-bold" style={{ color: CH.text }}>{success30d}✓ / {failed30d}✗</span>
            </div>
          </div>
        </CHCard>

        {/* Recent Operations */}
        <CHCard className="flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div>
              <CHLabel>Log Stream</CHLabel>
              <h2 className="text-xl font-bold tracking-tight mt-1" style={{ color: CH.text }}>Recent Ops</h2>
            </div>
            <button
              onClick={() => setPage('jobs')}
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: CH.accent }}
            >
              View All →
            </button>
          </div>
          {!recentActivity.length ? (
            <p className="text-sm" style={{ color: CH.textSub }}>No recent activity.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1" style={{ maxHeight: 340 }}>
              {recentActivity.map(item => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-xl transition-colors"
                  style={{ cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(3,29,75,0.4)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div
                    className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                    style={{
                      background: item.status === 'success' ? `${CH.green}15` : item.status === 'failed' ? `${CH.red}15` : `${CH.accent}15`,
                      color: item.status === 'success' ? CH.green : item.status === 'failed' ? CH.red : CH.accent,
                    }}
                  >
                    {item.status === 'success' ? <CheckCircle size={16} /> : item.status === 'failed' ? <AlertTriangle size={16} /> : <Activity size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold truncate" style={{ color: CH.text }}>
                        {item.hostname || `host#${item.host_id}`}
                      </p>
                      <span className="text-[10px] font-mono ml-2 shrink-0" style={{ color: CH.textSub }}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <CHBadge
                        color={item.status === 'success' ? CH.green : item.status === 'failed' ? CH.red : CH.accent}
                      >
                        {item.status}
                      </CHBadge>
                      <p className="text-[11px] truncate" style={{ color: CH.textSub }}>{item.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CHCard>
      </div>

      {/* ── Row 3: Fleet status + Quick Actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Fleet health ring */}
        <CHCard className="flex gap-8 items-center">
          <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(43,70,128,0.2)" strokeWidth="8" />
              <circle
                cx="64" cy="64" r="54" fill="none" stroke={CH.accent} strokeWidth="8"
                strokeDasharray="339"
                strokeDashoffset={339 - (339 * onlinePct / 100)}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${CH.accent}60)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black" style={{ color: CH.text }}>{onlinePct}%</span>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: CH.textSub }}>Online</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <CHLabel>License Strategy</CHLabel>
              <h3 className="text-xl font-bold mt-1" style={{ color: CH.text }}>Enterprise Tier</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: CH.textSub }}>
              Unlimited host patching, priority CVE feeds, and dedicated support.
              Database: <span className="font-semibold" style={{ color: CH.text }}>{health ? 'Active' : 'Offline'}</span>
            </p>
            <div className="flex gap-3 mt-3">
              <CHBtn variant="primary" onClick={() => setPage('license')}>Manage License</CHBtn>
              <CHBtn variant="ghost" onClick={() => setPage('hosts')}>View Hosts</CHBtn>
            </div>
          </div>
        </CHCard>

        {/* Quick actions */}
        <CHCard>
          <CHLabel>Quick Actions</CHLabel>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { label: 'Compliance',   page: 'compliance', icon: <Shield size={20} />,      color: CH.green },
              { label: 'Auto Patch',   page: 'patches',    icon: <Package size={20} />,     color: CH.accent },
              { label: 'CVE Tracker',  page: 'cve',        icon: <AlertTriangle size={20} />, color: CH.red },
              { label: 'Onboard Host', page: 'onboarding', icon: <Server size={20} />,      color: CH.textSub },
            ].map(a => (
              <button
                key={a.page}
                onClick={() => setPage(a.page)}
                className="flex flex-col items-center gap-3 p-4 rounded-xl transition-all"
                style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${a.color}60`; e.currentTarget.style.background = `${a.color}0d`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = CH.border; e.currentTarget.style.background = 'rgba(3,29,75,0.4)'; }}
              >
                <span style={{ color: a.color }}>{a.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CH.text }}>{a.label}</span>
              </button>
            ))}
          </div>
        </CHCard>
      </div>

      {/* ── Row 4: Attention items ── */}
      {attentionItems.length > 0 && (
        <CHCard>
          <CHLabel>Needs Attention</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {attentionItems.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CHDot status="error" />
                  <span className="text-xs font-bold" style={{ color: CH.text }}>{item.hostname || item.host}</span>
                </div>
                <p className="text-[11px]" style={{ color: CH.textSub }}>{item.message || item.reason}</p>
              </div>
            ))}
          </div>
        </CHCard>
      )}
    </CHPage>
  );
}
