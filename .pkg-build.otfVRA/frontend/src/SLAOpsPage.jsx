import React, { useCallback, useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
} from './components/StitchComponents';

const severityColor = s => {
  if (s === 'critical') return 'error';
  if (s === 'high') return 'warning';
  if (s === 'medium') return 'info';
  if (s === 'low') return 'success';
  return 'info';
};

export default function SLAOpsPage({ API, apiFetch, toast }) {
  const [slas, setSlas]           = useState([]);
  const [violations, setVios]     = useState([]);
  const [summary, setSummary]     = useState(null);
  const [tab, setTab]             = useState('policies');
  const [scanning, setScanning]   = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: '', severity: 'critical', days_to_patch: 7, notify_before_days: 1 });

  const load = useCallback(async () => {
    const [s, v, sum] = await Promise.all([
      apiFetch(`${API}/api/sla/`).then(r => r.json()).catch(() => []),
      apiFetch(`${API}/api/sla/violations`).then(r => r.json()).catch(() => []),
      apiFetch(`${API}/api/sla/violations/summary`).then(r => r.json()).catch(() => null),
    ]);
    setSlas(Array.isArray(s) ? s : []);
    setVios(Array.isArray(v) ? v : []);
    setSummary(sum);
  }, [API, apiFetch]);

  useEffect(() => { load(); }, [load]);

  const createSLA = async () => {
    const r = await apiFetch(`${API}/api/sla/`, { method: 'POST', body: JSON.stringify(form) });
    if (r.ok) {
      if (toast) toast('SLA policy created', 'success');
      setForm({ name: '', severity: 'critical', days_to_patch: 7, notify_before_days: 1 });
      setShowForm(false);
      load();
    } else {
      const d = await r.json().catch(() => ({}));
      if (toast) toast(d.detail || 'Failed to create', 'danger');
    }
  };

  const deleteSLA = async id => {
    if (!window.confirm('Delete this SLA policy?')) return;
    await apiFetch(`${API}/api/sla/${id}`, { method: 'DELETE' });
    if (toast) toast('Deleted', 'success');
    load();
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await apiFetch(`${API}/api/sla/scan`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (toast) toast(`Scanned ${d.scanned ?? 0} CVEs, ${d.created ?? 0} violations created`, 'success');
      load();
    } catch (e) { if (toast) toast(e.message || 'Scan failed', 'danger'); }
    setScanning(false);
  };

  const activeVios = violations.filter(v => v.is_violated && !v.is_resolved).length;
  const complianceRate = summary?.total
    ? Math.round(((summary.total - (summary.violated || 0)) / summary.total) * 100) : 100;

  return (
    <div className="space-y-8">
      <StitchPageHeader
        kicker="SLA Compliance"
        title="Service Level Management"
        description={`${slas.length} policies · ${complianceRate}% compliance rate`}
        actions={
          <div className="flex gap-2">
            <StitchButton variant="secondary" size="sm" onClick={load} icon="refresh">Refresh</StitchButton>
            <StitchButton 
              variant="primary" 
              size="sm" 
              onClick={scan} 
              disabled={scanning}
              icon="search"
            >
              {scanning ? 'Scanning…' : 'Scan Now'}
            </StitchButton>
          </div>
        }
      />

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Active Violations"
          value={summary?.violated ?? 0}
          subtitle="unresolved SLA breaches"
          icon="error"
          color="#ee7d77"
        />
        <StitchSummaryCard
          label="Total Tracked"
          value={summary?.total ?? 0}
          subtitle="CVE-host pairs"
          icon="list"
          color="#7bd0ff"
        />
        <StitchSummaryCard
          label="Resolved"
          value={summary?.resolved ?? 0}
          subtitle="cleared within window"
          icon="check_circle"
          color="#10b981"
        />
        <StitchSummaryCard
          label="Due in 3 Days"
          value={summary?.upcoming_deadline ?? 0}
          subtitle="approaching deadline"
          icon="schedule"
          color="#ffd16f"
        />
      </StitchMetricGrid>

      {/* Tab Nav */}
      <div className="flex gap-2 flex-wrap">
        {['policies', 'violations'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              tab === t
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high'
            }`}
          >
            {t === 'policies' ? `Policies (${slas.length})` : `Violations (${activeVios})`}
          </button>
        ))}
        <StitchButton
          variant="secondary"
          size="sm"
          onClick={() => setShowForm(v => !v)}
          icon="add"
          className="ml-auto"
        >
          {showForm ? 'Cancel' : 'Add Policy'}
        </StitchButton>
      </div>

      {/* Add Policy Form */}
      {showForm && (
        <div className="bg-surface-container-low p-6 rounded-xl space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">New SLA Policy</p>
            <h3 className="text-xl font-bold text-on-surface">Configure Policy</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Policy Name</label>
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Critical Patch SLA"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Severity</label>
              <select
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                value={form.severity}
                onChange={(e) => setForm(f => ({ ...f, severity: e.target.value }))}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Days to Patch</label>
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                type="number"
                value={form.days_to_patch}
                onChange={(e) => setForm(f => ({ ...f, days_to_patch: +e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Notify Before (days)</label>
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                type="number"
                value={form.notify_before_days}
                onChange={(e) => setForm(f => ({ ...f, notify_before_days: +e.target.value }))}
              />
            </div>
          </div>
          <StitchButton variant="primary" onClick={createSLA} icon="add">Add Policy</StitchButton>
        </div>
      )}

      {/* Policies Tab */}
      {tab === 'policies' && (
        <div className="bg-surface-container-low p-6 rounded-xl">
          <h2 className="text-lg font-bold text-on-surface mb-6">SLA Policies</h2>
          <StitchTable
            columns={[
              { 
                key: 'name', 
                header: 'Policy Name', 
                render: (val) => <span className="font-bold text-on-surface">{val}</span> 
              },
              { 
                key: 'severity', 
                header: 'Severity', 
                render: (val) => <StitchBadge variant={severityColor(val)} size="sm">{val}</StitchBadge> 
              },
              { 
                key: 'days_to_patch', 
                header: 'Days to Patch', 
                render: (val) => <span className="text-sm text-on-surface-variant">{val}d</span> 
              },
              { 
                key: 'notify_before_days', 
                header: 'Notify Before', 
                render: (val) => <span className="text-sm text-on-surface-variant">{val}d</span> 
              },
              { 
                key: 'is_active', 
                header: 'Status', 
                render: (val) => <StitchBadge variant={val ? 'success' : 'info'} size="sm">{val ? 'Active' : 'Inactive'}</StitchBadge> 
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (val, row) => (
                  <StitchButton variant="secondary" size="sm" onClick={() => deleteSLA(row.id)} icon="delete">Delete</StitchButton>
                )
              }
            ]}
            data={slas}
          />
        </div>
      )}

      {/* Violations Tab */}
      {tab === 'violations' && (
        <div className="bg-surface-container-low p-6 rounded-xl">
          <h2 className="text-lg font-bold text-on-surface mb-6">SLA Violations</h2>
          <StitchTable
            columns={[
              { 
                key: 'hostname', 
                header: 'Host', 
                render: (val) => <span className="font-bold text-on-surface">{val || '—'}</span> 
              },
              { 
                key: 'cve_id', 
                header: 'CVE', 
                render: (val) => <span className="font-mono text-xs text-primary">{val}</span> 
              },
              { 
                key: 'severity', 
                header: 'Severity', 
                render: (val) => <StitchBadge variant={severityColor(val)} size="sm">{val}</StitchBadge> 
              },
              { 
                key: 'deadline', 
                header: 'Deadline', 
                render: (val) => (
                  <span className="text-xs text-on-surface-variant">
                    {val ? new Date(val).toLocaleDateString() : '—'}
                  </span>
                )
              },
              { 
                key: 'days_overdue', 
                header: 'Days Overdue', 
                render: (val) => (
                  <span className={`text-sm font-bold ${val > 0 ? 'text-error' : 'text-primary'}`}>
                    {val > 0 ? `+${val}d` : '—'}
                  </span>
                )
              },
              { 
                key: 'is_resolved', 
                header: 'Status', 
                render: (val, row) => {
                  const variant = val ? 'success' : row.is_violated ? 'error' : 'warning';
                  const label = val ? 'Resolved' : row.is_violated ? 'Violated' : 'Pending';
                  return <StitchBadge variant={variant} size="sm">{label}</StitchBadge>;
                }
              },
            ]}
            data={violations}
          />
        </div>
      )}
    </div>
  );
}
