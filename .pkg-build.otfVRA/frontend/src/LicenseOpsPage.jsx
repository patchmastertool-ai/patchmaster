import React, { useMemo, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
} from './components/StitchComponents';

export default function LicenseOpsPage({ licenseInfo, onRefresh, API, apiFetch, setPage }) {
  const [key, setKey]     = useState('');
  const [msg, setMsg]     = useState('');
  const [loading, setLoading] = useState(false);
  const li = licenseInfo || {};

  const activate = async () => {
    if (!key.trim()) return setMsg('Please enter a license key.');
    setLoading(true); setMsg('');
    try {
      const r = await apiFetch(`${API}/api/license/activate`, {
        method: 'POST', body: JSON.stringify({ license_key: key.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMsg('License activated successfully.'); setKey(''); onRefresh(); }
      else setMsg(d.detail || 'Activation failed.');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  };

  const deactivate = async () => {
    if (!window.confirm('Deactivate the current license? This will restrict advanced features.')) return;
    setLoading(true); setMsg('');
    try {
      const r = await apiFetch(`${API}/api/license/deactivate`, { method: 'POST' });
      if (r.ok) { setMsg('License deactivated.'); onRefresh(); }
      else setMsg('Deactivation failed.');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  };

  const status = useMemo(() => {
    if (!li.activated) return { label: 'Not Activated', color: '#91aaeb', badgeStatus: 'info' };
    if (!li.valid)     return { label: 'Invalid',       color: '#ee7d77', badgeStatus: 'error' };
    if (li.expired)    return { label: 'Expired',        color: '#ee7d77', badgeStatus: 'error' };
    if ((li.days_remaining || 0) <= 30) return { label: 'Expiring Soon', color: '#ffd16f', badgeStatus: 'warning' };
    return { label: 'Active & Healthy', color: '#7bd0ff', badgeStatus: 'success' };
  }, [li]);

  const features = Array.isArray(li.features) ? li.features : [];
  const isSuccess = msg.startsWith('✓');

  const TIER_COLORS = { 
    basic: '#3b82f6', 
    standard: '#7bd0ff', 
    devops: '#ffd16f', 
    enterprise: '#8b5cf6' 
  };

  const detailRows = [
    ['License ID',        li.license_id || 'legacy'],
    ['Customer',          li.customer || '-'],
    ['Plan',              li.plan_label || li.plan || '-'],
    ['Tier',              li.tier_label || li.tier || '-'],
    ['Issued',            li.issued_at || '-'],
    ['Expires',           li.expires_at || '-'],
    ['Hardware ID',       li.hardware_id || '-'],
    ['Version Target',    li.tool_version ? `v${li.tool_version}` : '-'],
    ['Compatibility',     li.version_compat || '2.x'],
  ];

  return (
    <div className="space-y-8">
      <StitchPageHeader
        kicker="System Governance"
        title="License & Tier Management"
        description="Administer enterprise entitlements, monitor host utilization, and manage security-cleared activation keys for the PatchMaster ecosystem."
      />

      {/* KPIs */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Status"
          value={status.label}
          icon="sensors"
          color={status.color}
        />
        <StitchSummaryCard
          label="Tier"
          value={li.tier_label || li.tier || 'Unlicensed'}
          icon="shield"
          color={TIER_COLORS[li.tier] || '#91aaeb'}
        />
        <StitchSummaryCard
          label="Max Hosts"
          value={li.max_hosts === 0 ? 'Unlimited' : (li.max_hosts ?? '-')}
          icon="dns"
          color="#7bd0ff"
        />
        <StitchSummaryCard
          label="Days Left"
          value={li.days_remaining ?? '-'}
          subtitle={`${features.length} licensed features`}
          icon="schedule"
          color={li.days_remaining <= 30 ? '#ffd16f' : '#7bd0ff'}
        />
      </StitchMetricGrid>

      {/* Message Banner */}
      {msg && (
        <div 
          className="rounded-xl px-5 py-3 text-sm font-bold mb-6"
          style={{
            background: isSuccess ? 'rgba(123, 208, 255, 0.1)' : 'rgba(255, 209, 111, 0.1)',
            color: isSuccess ? '#7bd0ff' : '#ffd16f',
            border: `1px solid ${isSuccess ? 'rgba(123, 208, 255, 0.2)' : 'rgba(255, 209, 111, 0.2)'}`,
          }}
        >
          {msg}
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left Column: Primary Status & Limits */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Hero Status Card (Bento Style) */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-1 overflow-hidden rounded-xl bg-surface-container-low shadow-2xl relative">
            {/* Glass/Gradient Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-primary via-transparent to-transparent"></div>
            {/* Tier Status */}
            <div className="p-8 space-y-6 flex flex-col justify-between border-r border-outline-variant/10">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">Active Entitlement</label>
                <h2 className="text-3xl font-black text-primary">{li.tier_label || li.tier || 'Unlicensed'}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-sm font-medium text-on-primary-container bg-primary-container px-3 py-1 rounded-full">{status.label}</span>
              </div>
            </div>
            {/* Usage Limits */}
            <div className="p-8 space-y-6 md:col-span-2 bg-surface-container relative">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">Host Capacity Utilization</label>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-on-surface">{li.current_hosts ?? 0}</span>
                    <span className="text-secondary text-lg">/ {li.max_hosts === 0 ? 'Unlimited' : (li.max_hosts ?? '-')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-primary">{li.max_hosts ? Math.round(((li.current_hosts ?? 0) / li.max_hosts) * 100) : 0}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${li.max_hosts ? Math.round(((li.current_hosts ?? 0) / li.max_hosts) * 100) : 0}%` }}></div>
              </div>
              <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
                <span>Infrastructure Baseline</span>
                <span className="text-primary">{li.max_hosts ? (li.max_hosts - (li.current_hosts ?? 0)) : 'Unlimited'} Units Remaining</span>
              </div>
            </div>
          </section>

          {/* Feature Matrix */}
          <section className="bg-surface-container rounded-xl p-8 space-y-8 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold tracking-tight">Tier Features &amp; Compliance</h3>
              <button className="text-xs font-bold uppercase tracking-widest text-primary hover:underline decoration-2 underline-offset-4">Compare Tiers</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {features.length > 0 ? (
                features.map((f, i) => (
                  <div key={i} className="flex gap-4 items-start group">
                    <span className="material-symbols-outlined text-primary mt-1" style={{ fontSize: 20 }}>verified_user</span>
                    <div>
                      <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors">{f}</h4>
                      <p className="text-sm text-secondary leading-snug mt-1">Feature enabled for your tier</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant col-span-2">No features available for this tier</p>
              )}
            </div>
          </section>

          {/* Activation Key Management */}
          <section className="space-y-6">
            <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">Activation Key Management</label>
            <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 w-full">
                <div className="bg-surface-container-highest flex items-center px-4 py-3 rounded group focus-within:ring-1 focus-within:ring-primary transition-all">
                  <span className="material-symbols-outlined text-secondary mr-3" style={{ fontSize: 20 }}>vpn_key</span>
                  <input className="bg-transparent border-none focus:ring-0 text-sm font-mono text-on-surface flex-1" readOnly type="password" value={li.license_key ? '****************' : '(no key)'} />
                  <button className="text-on-surface-variant hover:text-primary transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>content_copy</span>
                  </button>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <StitchButton 
                  variant="primary" 
                  onClick={onRefresh}
                >
                  Update Key
                </StitchButton>
                {li.activated && (
                  <StitchButton 
                    variant="secondary" 
                    onClick={deactivate}
                  >
                    Deactivate
                  </StitchButton>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Expiry & CTA */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* Expiry Countdown */}
          <div className="bg-surface-container-high p-8 rounded-xl space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-tertiary"></div>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">License Renewal</label>
                <h3 className="text-xl font-bold tracking-tight">Standard Expiry</h3>
              </div>
              <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 32 }}>timer</span>
            </div>
            <div className="flex justify-between gap-4">
              <div className="text-center flex-1">
                <p className="text-3xl font-black text-on-surface">{Math.floor((li.days_remaining ?? 0) / 1)}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Days</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-3xl font-black text-on-surface">00</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Hrs</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-3xl font-black text-on-surface">00</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Mins</p>
              </div>
            </div>
            <div className="space-y-4 pt-4">
              <p className="text-xs text-secondary leading-relaxed italic">Renewal window closes on {li.expires_at || 'TBD'}. Failure to renew may result in disabled cluster updates.</p>
              <StitchButton 
                variant="primary" 
                onClick={onRefresh}
                className="w-full justify-center py-3"
              >
                Renew Entitlement
              </StitchButton>
            </div>
          </div>

          {/* Upgrade CTA Widget */}
          <div className="bg-gradient-to-br from-surface-container-highest to-surface-container rounded-xl p-8 space-y-6 border border-outline-variant/10">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 24 }}>rocket_launch</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">Need more capacity?</h3>
              <p className="text-sm text-secondary leading-relaxed">Scaling to 10,000+ hosts? Explore our Custom Enterprise architecture with dedicated regional nodes.</p>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>check_circle</span>
                Unlimited Cluster Scaling
              </li>
              <li className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>check_circle</span>
                Air-gapped Deployment Options
              </li>
            </ul>
            <StitchButton 
              variant="secondary" 
              onClick={() => {}}
              className="w-full justify-center py-2"
            >
              Contact Account Architect
            </StitchButton>
          </div>
        </div>
      </div>

      {/* Audit Log / Activity Sub-section */}
      <section className="pt-12 border-t border-outline-variant/10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant">Entitlement Records</label>
            <h3 className="text-2xl font-black tracking-tight">Audit History</h3>
          </div>
          <button className="text-xs font-bold text-secondary hover:text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> Export Logs
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/5">
                <th className="pb-4 px-4 font-bold">Event Type</th>
                <th className="pb-4 px-4 font-bold">Authorized By</th>
                <th className="pb-4 px-4 font-bold text-right">Timestamp</th>
                <th className="pb-4 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              <tr className="group hover:bg-surface-container-low transition-colors">
                <td className="py-4 px-4 text-sm font-medium text-on-surface">Key Rotation Triggered</td>
                <td className="py-4 px-4 text-sm text-secondary">admin_system (10.0.4.22)</td>
                <td className="py-4 px-4 text-sm text-secondary text-right font-mono">{new Date().toLocaleString()}</td>
                <td className="py-4 px-4 text-right">
                  <span className="text-[10px] font-bold bg-primary-container text-on-primary-container px-2 py-0.5 rounded">SUCCESS</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
