import React, { useMemo, useState } from 'react';
import './OpsPages.css';

export default function LicenseOpsPage({ licenseInfo, onRefresh, API, apiFetch, AppIcon }) {
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const li = licenseInfo || {};

  const activate = async () => {
    if (!key.trim()) {
      setMsg('Please enter a license key.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const response = await apiFetch(`${API}/api/license/activate`, {
        method: 'POST',
        body: JSON.stringify({ license_key: key.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setMsg('License activated successfully.');
        setKey('');
        onRefresh();
      } else {
        setMsg(payload.detail || 'Activation failed.');
      }
    } catch (error) {
      setMsg(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate the current license? This will restrict advanced features.')) return;
    setLoading(true);
    setMsg('');
    try {
      const response = await apiFetch(`${API}/api/license/deactivate`, { method: 'POST' });
      if (response.ok) {
        setMsg('License deactivated.');
        onRefresh();
      } else {
        setMsg('Deactivation failed.');
      }
    } catch (error) {
      setMsg(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const status = useMemo(() => {
    if (!li.activated) {
      return {
        label: 'Not activated',
        color: '#64748b',
        bg: 'linear-gradient(145deg, #f8fafc, #ffffff)',
        border: '#cbd5e1',
        description: 'No active license is loaded. Activate a vendor-issued key to unlock licensed features.',
      };
    }
    if (!li.valid) {
      return {
        label: 'Invalid',
        color: '#b91c1c',
        bg: 'linear-gradient(145deg, #fef2f2, #fff7f7)',
        border: '#fca5a5',
        description: li.error || 'The current key failed validation and should be replaced.',
      };
    }
    if (li.expired) {
      return {
        label: 'Expired',
        color: '#b45309',
        bg: 'linear-gradient(145deg, #fffbeb, #fffdf5)',
        border: '#fcd34d',
        description: 'The subscription term has ended. Renew the license to restore full feature access.',
      };
    }
    if ((li.days_remaining || 0) <= 30) {
      return {
        label: 'Expiring soon',
        color: '#b45309',
        bg: 'linear-gradient(145deg, #fffbeb, #fffdf5)',
        border: '#fcd34d',
        description: `${li.days_remaining} days remaining on the current entitlement.`,
      };
    }
    return {
      label: 'Healthy',
      color: '#166534',
      bg: 'linear-gradient(145deg, #ecfdf3, #f8fffb)',
      border: '#86efac',
      description: `${li.days_remaining ?? '--'} days remaining on the active license.`,
    };
  }, [li]);

  const tierColors = { basic:'#3b82f6', standard:'#10b981', devops:'#f59e0b', enterprise:'#06b6d4' };
  const features = Array.isArray(li.features) ? li.features : [];
  const featurePreview = features.slice(0, 8);

  const summaryCards = [
    { label: 'License state', value: status.label, sub: status.description, icon: 'key', color: status.color, bg: status.bg.includes('fef2f2') ? 'rgba(239,68,68,0.12)' : status.bg.includes('fffbeb') ? 'rgba(245,158,11,0.14)' : status.bg.includes('ecfdf3') ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.14)' },
    { label: 'Tier', value: li.tier_label || li.tier || 'Unlicensed', sub: li.plan_label || 'No plan loaded', icon: 'shield', color: tierColors[li.tier] || '#475569', bg: 'rgba(59,130,246,0.10)' },
    { label: 'Max hosts', value: li.max_hosts === 0 ? 'Unlimited' : li.max_hosts ?? '--', sub: 'licensed fleet coverage', icon: 'users', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Feature count', value: features.length, sub: 'entitlements loaded from the current key', icon: 'sliders', color: '#06b6d4', bg: 'rgba(139,92,246,0.12)' },
  ];

  const detailRows = [
    ['License ID', li.license_id || 'legacy'],
    ['Customer', li.customer || '--'],
    ['Plan', li.plan_label || li.plan || '--'],
    ['Tier', li.tier_label || li.tier || '--'],
    ['Issued', li.issued_at || '--'],
    ['Expires', li.expires_at || '--'],
    ['Hardware ID', li.hardware_id || '--'],
    ['Version target', li.tool_version ? `v${li.tool_version}` : '--'],
    ['Compatibility', li.version_compat || '2.x'],
  ];

  const isSuccessMsg = msg.toLowerCase().includes('success') || msg.toLowerCase().includes('activated') || msg.toLowerCase().includes('deactivated');

  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: status.border, background: status.bg }}>
          <div className="ops-kicker">License operations</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Current state</span>
              <span className="ops-emphasis-value" style={{ color: status.color, fontSize: 28 }}>{status.label}</span>
              <span className="ops-emphasis-meta">{status.description}</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Keep licensing clear, auditable, and easy for operators to act on.</h3>
              <p>
                This page now presents license posture the way an admin tool should: clear status at the top, entitlement detail in one place, and a dedicated activation workflow so teams know exactly what is licensed, what is at risk, and what needs renewal.
              </p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{li.tier_label || li.tier || 'No tier'}</span>
            <span className="ops-chip">{li.plan_label || li.plan || 'No plan'}</span>
            <span className="ops-chip">{li.max_hosts === 0 ? 'Unlimited hosts' : `${li.max_hosts ?? 0} hosts`}</span>
            <span className="ops-chip">{features.length} features</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Binding info</span>
          <div className="ops-side-metric">{li.hardware_id ? 'Bound' : 'Open'}</div>
          <p className="ops-side-note">
            Share the hardware ID below with your vendor if your plan uses device binding. Invalid or expired keys are blocked clearly so operators do not continue in a broken state.
          </p>
          <div className="ops-inline-list">
            <div className="ops-inline-card">
              <strong>{li.days_remaining ?? '--'}</strong>
              <span>days remaining</span>
            </div>
            <div className="ops-inline-card">
              <strong>{li.max_hosts === 0 ? 'All' : li.max_hosts ?? '--'}</strong>
              <span>host entitlement</span>
            </div>
            <div className="ops-inline-card">
              <strong>{features.length}</strong>
              <span>licensed features</span>
            </div>
            <div className="ops-inline-card">
              <strong>{li.tool_version || '2.x'}</strong>
              <span>target release</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ops-summary-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className="ops-summary-card">
            <div className="ops-summary-head">
              <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>
                <AppIcon name={card.icon} size={18} />
              </span>
              <span className="ops-summary-label">{card.label}</span>
            </div>
            <div className="ops-summary-value" style={{ fontSize: typeof card.value === 'string' && card.value.length > 14 ? 20 : 28 }}>{card.value}</div>
            <div className="ops-summary-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div
          className="ops-command-card"
          style={{
            borderColor: isSuccessMsg ? '#86efac' : '#fecaca',
            background: isSuccessMsg ? 'linear-gradient(145deg, #ecfdf3, #f8fffb)' : 'linear-gradient(145deg, #fff7ed, #fffdf8)',
          }}
        >
          <div style={{ color: isSuccessMsg ? '#166534' : '#b45309', fontWeight: 700 }}>{msg}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Entitlement details</div>
              <p className="ops-subtle">The currently loaded license metadata and binding context.</p>
            </div>
          </div>
          <div className="ops-detail-grid">
            {detailRows.map(([label, value]) => (
              <div key={label} className="ops-detail-item">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {!!featurePreview.length && (
            <>
              <div className="ops-panel-title" style={{ fontSize: 16, marginTop: 8 }}>Licensed features</div>
              <div className="ops-badge-stack" style={{ marginTop: 12 }}>
                {featurePreview.map((feature) => (
                  <span key={feature} className="badge badge-success">{feature}</span>
                ))}
                {features.length > featurePreview.length && <span className="badge badge-info">+{features.length - featurePreview.length} more</span>}
              </div>
            </>
          )}
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Activate or renew</div>
              <p className="ops-subtle">Paste the vendor-issued key exactly as received. Wrapped text and normalized license formats are supported.</p>
            </div>
            {li.activated && <button className="btn btn-sm btn-danger" onClick={deactivate} disabled={loading}>Deactivate</button>}
          </div>
          <div className="ops-list">
            <div className="ops-list-item">
              <div className="ops-list-copy">
                <strong>Hardware ID</strong>
                <span>{li.hardware_id || 'Unavailable'}</span>
              </div>
              <div className="ops-list-metrics">
                <span className="badge badge-info">Vendor binding</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="ops-side-label">License key</label>
            <textarea
              className="input"
              style={{ minHeight: 180, fontFamily: 'Consolas, SFMono-Regular, monospace', fontSize: 12 }}
              placeholder="PM2-xxxxxxxxx.xxxxxxxx (legacy PM1 also accepted)"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="ops-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={activate} disabled={loading}>
              {loading ? 'Processing...' : li.activated && li.valid && !li.expired ? 'Renew / Change license' : 'Activate license'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
