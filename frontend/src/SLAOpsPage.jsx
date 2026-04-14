import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH, severityColor } from './CH.jsx';
import { RefreshCw, Plus, Trash2, Scan } from 'lucide-react';

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
    <CHPage>
      <CHHeader
        kicker="SLA Compliance"
        title="Service Level Management"
        subtitle={`${slas.length} policies · ${complianceRate}% compliance rate`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={load}><RefreshCw size={14} /> Refresh</CHBtn>
            <CHBtn variant={scanning ? 'ghost' : 'primary'} onClick={scan} disabled={scanning}>
              <Scan size={14} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Scanning…' : 'Scan Now'}
            </CHBtn>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Active Violations" value={summary?.violated ?? 0}       sub="unresolved SLA breaches" accent={CH.red} />
        <CHStat label="Total Tracked"     value={summary?.total ?? 0}          sub="CVE-host pairs" accent={CH.accent} />
        <CHStat label="Resolved"          value={summary?.resolved ?? 0}       sub="cleared within window" accent={CH.green} />
        <CHStat label="Due in 3 Days"     value={summary?.upcoming_deadline ?? 0} sub="approaching deadline" accent={CH.yellow} />
      </div>

      {/* Tab Nav */}
      <div className="flex gap-2">
        {['policies', 'violations'].map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: tab === t ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
              color: tab === t ? CH.accent : CH.textSub,
              border: `1px solid ${tab === t ? CH.accent + '40' : CH.border}`,
            }}
          >
            {t === 'policies' ? `Policies (${slas.length})` : `Violations (${activeVios})`}
          </button>
        ))}
        <CHBtn variant="ghost" className="ml-auto" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> {showForm ? 'Cancel' : 'Add Policy'}
        </CHBtn>
      </div>

      {/* Add Policy Form */}
      {showForm && (
        <CHCard>
          <CHLabel>New SLA Policy</CHLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="col-span-2 flex flex-col gap-1">
              <CHLabel>Policy Name</CHLabel>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Critical Patch SLA"
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Severity</CHLabel>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
                {['critical','high','medium','low'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Days to Patch</CHLabel>
              <input type="number" value={form.days_to_patch}
                onChange={e => setForm(f => ({ ...f, days_to_patch: +e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Notify Before (days)</CHLabel>
              <input type="number" value={form.notify_before_days}
                onChange={e => setForm(f => ({ ...f, notify_before_days: +e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
          </div>
          <div className="mt-4"><CHBtn variant="primary" onClick={createSLA}>Add Policy</CHBtn></div>
        </CHCard>
      )}

      {/* Policies Tab */}
      {tab === 'policies' && (
        <CHCard>
          <CHTable headers={['Policy Name', 'Severity', 'Days to Patch', 'Notify Before', 'Status', 'Actions']}
            emptyMessage="No SLA policies defined. Add one above to begin tracking.">
            {slas.map(s => (
              <CHTR key={s.id}>
                <td className="px-6 py-4 font-bold" style={{ color: CH.text }}>{s.name}</td>
                <td className="px-6 py-4"><CHBadge color={severityColor(s.severity)}>{s.severity}</CHBadge></td>
                <td className="px-6 py-4 text-sm" style={{ color: CH.textSub }}>{s.days_to_patch}d</td>
                <td className="px-6 py-4 text-sm" style={{ color: CH.textSub }}>{s.notify_before_days}d</td>
                <td className="px-6 py-4"><CHBadge color={s.is_active ? CH.green : CH.textSub}>{s.is_active ? 'Active' : 'Inactive'}</CHBadge></td>
                <td className="px-6 py-4 text-right">
                  <CHBtn variant="danger" onClick={() => deleteSLA(s.id)}><Trash2 size={12} /> Delete</CHBtn>
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}

      {/* Violations Tab */}
      {tab === 'violations' && (
        <CHCard>
          <CHTable headers={['Host', 'CVE', 'Severity', 'Deadline', 'Days Overdue', 'Status']}
            emptyMessage="No violations found. Run a scan to detect SLA breaches.">
            {violations.map(v => (
              <CHTR key={v.id}
                style={{ background: v.is_violated && !v.is_resolved ? `rgba(239,68,68,0.04)` : '' }}>
                <td className="px-6 py-4 font-bold" style={{ color: CH.text }}>{v.hostname || '—'}</td>
                <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.accent }}>{v.cve_id}</td>
                <td className="px-6 py-4"><CHBadge color={severityColor(v.severity)}>{v.severity}</CHBadge></td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>
                  {v.deadline ? new Date(v.deadline).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 text-sm font-bold"
                  style={{ color: v.days_overdue > 0 ? CH.red : CH.green }}>
                  {v.days_overdue > 0 ? `+${v.days_overdue}d` : '—'}
                </td>
                <td className="px-6 py-4">
                  <CHBadge color={v.is_resolved ? CH.green : v.is_violated ? CH.red : CH.yellow}>
                    {v.is_resolved ? 'Resolved' : v.is_violated ? 'Violated' : 'Pending'}
                  </CHBadge>
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}
    </CHPage>
  );
}
