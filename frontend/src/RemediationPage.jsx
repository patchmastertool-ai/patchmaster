import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH, severityColor } from './CH.jsx';
import { RefreshCw, X, Wrench } from 'lucide-react';

const remStatusColor = s => {
  if (s === 'open')         return CH.red;
  if (s === 'in_progress')  return CH.yellow;
  if (s === 'resolved')     return CH.green;
  return CH.textSub;
};

export default function RemediationPage({ API, apiFetch, toast }) {
  const [items, setItems]         = useState([]);
  const [summary, setSummary]     = useState(null);
  const [statusFilter, setFilter] = useState('all');
  const [editing, setEditing]     = useState(null);
  const [editForm, setEditForm]   = useState({});

  const load = useCallback(async () => {
    const url = statusFilter === 'all' ? `${API}/api/remediation/` : `${API}/api/remediation/?status=${statusFilter}`;
    const [its, sum] = await Promise.all([
      apiFetch(url).then(r => r.json()).catch(() => []),
      apiFetch(`${API}/api/remediation/summary`).then(r => r.json()).catch(() => null),
    ]);
    setItems(Array.isArray(its) ? its : []);
    setSummary(sum);
  }, [API, apiFetch, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = item => {
    setEditing(item);
    setEditForm({ status: item.status, notes: item.notes || '', due_date: item.due_date ? item.due_date.slice(0, 10) : '' });
  };

  const saveEdit = async () => {
    const r = await apiFetch(`${API}/api/remediation/${editing.id}`, {
      method: 'PUT', body: JSON.stringify(editForm),
    });
    if (r.ok) {
      if (toast) toast('Updated successfully', 'success');
      setEditing(null); load();
    } else {
      const d = await r.json().catch(() => ({}));
      if (toast) toast(d.detail || 'Update failed', 'danger');
    }
  };

  const FILTERS = ['all', 'open', 'in_progress', 'resolved', 'accepted_risk', 'false_positive'];

  return (
    <CHPage>
      <CHHeader
        kicker="Vulnerability Remediation"
        title="Remediation Engine"
        subtitle={`${items.length} items in view · ${summary?.open ?? 0} open`}
        actions={<CHBtn variant="ghost" onClick={load}><RefreshCw size={14} /> Refresh</CHBtn>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Open"       value={summary?.open        ?? 0} sub="awaiting action"     accent={CH.red} />
        <CHStat label="In Progress" value={summary?.in_progress ?? 0} sub="being remediated"   accent={CH.yellow} />
        <CHStat label="Resolved"   value={summary?.resolved    ?? 0} sub="cleared successfully" accent={CH.green} />
        <CHStat label="Total"      value={summary?.total       ?? 0} sub="all tracked items"   accent={CH.accent} />
      </div>

      {/* Filter + Table */}
      <CHCard className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: statusFilter === f ? `${remStatusColor(f) || CH.accent}20` : 'rgba(3,29,75,0.4)',
                color: statusFilter === f ? (remStatusColor(f) || CH.accent) : CH.textSub,
                border: `1px solid ${statusFilter === f ? (remStatusColor(f) || CH.accent) + '50' : CH.border}`,
              }}
            >
              {f === 'in_progress' ? 'In Progress' : f === 'accepted_risk' ? 'Accepted Risk' : f === 'false_positive' ? 'False Positive' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <CHTable headers={['CVE', 'Host', 'Severity', 'Status', 'Due Date', 'Notes', 'Actions']}
          emptyMessage="No remediation items match current filters.">
          {items.map(item => (
            <CHTR key={item.id} selected={editing?.id === item.id}>
              <td className="px-6 py-4 font-mono text-xs font-bold" style={{ color: CH.accent }}>{item.cve_id}</td>
              <td className="px-6 py-4 text-sm font-bold" style={{ color: CH.text }}>{item.hostname || '—'}</td>
              <td className="px-6 py-4"><CHBadge color={severityColor(item.severity)}>{item.severity}</CHBadge></td>
              <td className="px-6 py-4"><CHBadge color={remStatusColor(item.status)}>{item.status?.replace('_', ' ')}</CHBadge></td>
              <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>
                {item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}
              </td>
              <td className="px-6 py-4 text-xs max-w-xs" style={{ color: CH.textSub }}>
                <span className="line-clamp-1">{item.notes || '—'}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <CHBtn variant="default" onClick={() => openEdit(item)}>
                  <Wrench size={12} /> Edit
                </CHBtn>
              </td>
            </CHTR>
          ))}
        </CHTable>
      </CHCard>

      {/* Edit Panel */}
      {editing && (
        <CHCard>
          <div className="flex items-center justify-between mb-5">
            <div>
              <CHLabel>Edit Remediation Item</CHLabel>
              <h3 className="text-lg font-bold mt-1" style={{ color: CH.text }}>{editing.cve_id} — {editing.hostname}</h3>
            </div>
            <CHBtn variant="ghost" onClick={() => setEditing(null)}><X size={14} /></CHBtn>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <CHLabel>Status</CHLabel>
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
                {['open','in_progress','resolved','accepted_risk','false_positive'].map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Due Date</CHLabel>
              <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Notes</CHLabel>
              <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Remediation notes…"
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <CHBtn variant="primary" onClick={saveEdit}>Save Changes</CHBtn>
            <CHBtn variant="ghost" onClick={() => setEditing(null)}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}
    </CHPage>
  );
}
