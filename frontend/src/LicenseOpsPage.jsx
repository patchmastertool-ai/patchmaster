import React, { useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CH } from './CH.jsx';
import { Key, RefreshCw, CheckCircle, AlertTriangle, Clock, Shield } from 'lucide-react';

export default function LicenseOpsPage({ licenseInfo, onRefresh, API, apiFetch }) {
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
      if (r.ok) { setMsg('✓ License activated successfully.'); setKey(''); onRefresh(); }
      else setMsg(d.detail || 'Activation failed.');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  };

  const deactivate = async () => {
    if (!window.confirm('Deactivate the current license? This will restrict advanced features.')) return;
    setLoading(true); setMsg('');
    try {
      const r = await apiFetch(`${API}/api/license/deactivate`, { method: 'POST' });
      if (r.ok) { setMsg('✓ License deactivated.'); onRefresh(); }
      else setMsg('Deactivation failed.');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  };

  const status = useMemo(() => {
    if (!li.activated) return { label: 'Not Activated', color: CH.textSub };
    if (!li.valid)     return { label: 'Invalid',       color: CH.red };
    if (li.expired)    return { label: 'Expired',        color: CH.red };
    if ((li.days_remaining || 0) <= 30) return { label: 'Expiring Soon', color: CH.yellow };
    return { label: 'Active & Healthy', color: CH.green };
  }, [li]);

  const features = Array.isArray(li.features) ? li.features : [];
  const isSuccess = msg.startsWith('✓');

  const TIER_COLORS = { basic: '#3b82f6', standard: CH.green, devops: CH.yellow, enterprise: '#8b5cf6' };

  const detailRows = [
    ['License ID',        li.license_id || 'legacy'],
    ['Customer',          li.customer || '—'],
    ['Plan',              li.plan_label || li.plan || '—'],
    ['Tier',              li.tier_label || li.tier || '—'],
    ['Issued',            li.issued_at || '—'],
    ['Expires',           li.expires_at || '—'],
    ['Hardware ID',       li.hardware_id || '—'],
    ['Version Target',    li.tool_version ? `v${li.tool_version}` : '—'],
    ['Compatibility',     li.version_compat || '2.x'],
  ];

  return (
    <CHPage>
      <CHHeader
        kicker="License Operations"
        title="License Management"
        subtitle="Entitlement posture and activation control"
        actions={<CHBtn variant="ghost" onClick={onRefresh}><RefreshCw size={14} /> Refresh</CHBtn>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Status"        value={status.label}                                               accent={status.color} />
        <CHStat label="Tier"          value={li.tier_label || li.tier || 'Unlicensed'}                  accent={TIER_COLORS[li.tier] || CH.textSub} />
        <CHStat label="Max Hosts"     value={li.max_hosts === 0 ? 'Unlimited' : (li.max_hosts ?? '—')} accent={CH.accent} />
        <CHStat label="Days Left"     value={li.days_remaining ?? '—'} sub={`${features.length} licensed features`} accent={li.days_remaining <= 30 ? CH.yellow : CH.green} />
      </div>

      {/* Message Banner */}
      {msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{
            background: isSuccess ? `${CH.green}12` : `${CH.yellow}15`,
            color: isSuccess ? CH.green : CH.yellow,
            border: `1px solid ${isSuccess ? CH.green : CH.yellow}30`,
          }}>
          {msg}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Entitlement Details */}
        <CHCard>
          <CHLabel>Entitlement Details</CHLabel>
          <div className="mt-4 space-y-2">
            {detailRows.map(([label, val]) => (
              <div key={label} className="flex justify-between items-center py-2.5"
                style={{ borderBottom: `1px solid rgba(43,70,128,0.1)` }}>
                <span className="text-xs uppercase tracking-wider" style={{ color: CH.textSub }}>{label}</span>
                <span className="text-sm font-bold font-mono" style={{ color: CH.text }}>{val}</span>
              </div>
            ))}
          </div>
          {features.length > 0 && (
            <div className="mt-5">
              <CHLabel>Licensed Features</CHLabel>
              <div className="flex flex-wrap gap-2 mt-3">
                {features.map(f => (
                  <CHBadge key={f} color={CH.green}>{f}</CHBadge>
                ))}
              </div>
            </div>
          )}
        </CHCard>

        {/* Activate / Renew */}
        <CHCard className="flex flex-col gap-5">
          <div>
            <CHLabel>Activate or Renew</CHLabel>
            <p className="text-sm mt-1" style={{ color: CH.textSub }}>
              Paste the vendor-issued key exactly as received. Legacy PM1 format is also supported.
            </p>
          </div>

          {/* Hardware ID */}
          {li.hardware_id && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
              <CHLabel>Hardware Binding ID</CHLabel>
              <p className="text-xs font-mono mt-1 break-all" style={{ color: CH.text }}>{li.hardware_id}</p>
              <p className="text-[10px] mt-1" style={{ color: CH.textSub }}>Share with your vendor for device-bound licenses</p>
            </div>
          )}

          {/* Key Input */}
          <div>
            <CHLabel>License Key</CHLabel>
            <textarea
              value={key} onChange={e => setKey(e.target.value)}
              placeholder="PM2-xxxxxxxxx.xxxxxxxx"
              rows={6}
              className="w-full mt-2 rounded-xl px-4 py-3 text-xs font-mono resize-none focus:outline-none"
              style={{
                background: 'rgba(3,29,75,0.5)',
                border: `1px solid ${CH.border}`,
                color: CH.text,
              }}
            />
          </div>

          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={activate} disabled={loading} className="flex-1 justify-center py-3">
              <Key size={14} /> {loading ? 'Processing…' : (li.activated && li.valid && !li.expired ? 'Renew / Change' : 'Activate License')}
            </CHBtn>
            {li.activated && (
              <CHBtn variant="danger" onClick={deactivate} disabled={loading}>Deactivate</CHBtn>
            )}
          </div>
        </CHCard>
      </div>
    </CHPage>
  );
}
