import React, { useCallback, useEffect, useState } from 'react';
import { 
  StitchPageHeader,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchTable,
  StitchBadge,
  StitchSummaryCard,
  StitchMetricGrid
} from './components/StitchComponents';

const severityColor = s => {
  if (s === 'critical') return 'error';
  if (s === 'high') return 'warning';
  if (s === 'medium') return 'info';
  if (s === 'low') return 'success';
  return 'info';
};

const remStatusColor = s => {
  if (s === 'open')         return 'error';
  if (s === 'in_progress')  return 'warning';
  if (s === 'resolved')     return 'success';
  return 'info';
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
    <div className="min-h-screen bg-[#060e20] p-6">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Page Header */}
        <StitchPageHeader
          kicker="Vulnerability Management"
          title="CVE Remediation"
          description={`${items.length} items in view · ${summary?.open ?? 0} open`}
          actions={
            <StitchButton
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={load}
            >
              Refresh
            </StitchButton>
          }
        />

        {/* KPI Summary Cards */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Open"
            value={summary?.open ?? 0}
            subtitle="awaiting action"
            icon="error"
            color="#ee7d77"
          />
          <StitchSummaryCard
            label="In Progress"
            value={summary?.in_progress ?? 0}
            subtitle="being remediated"
            icon="pending"
            color="#ffd16f"
          />
          <StitchSummaryCard
            label="Resolved"
            value={summary?.resolved ?? 0}
            subtitle="cleared successfully"
            icon="check_circle"
            color="#10b981"
          />
          <StitchSummaryCard
            label="Total"
            value={summary?.total ?? 0}
            subtitle="all tracked items"
            icon="list"
            color="#7bd0ff"
          />
        </StitchMetricGrid>

        {/* Filter + Table */}
        <div className="bg-[#05183c] p-8 rounded-xl space-y-6">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <StitchButton
                key={f}
                variant={statusFilter === f ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === 'in_progress' ? 'In Progress' : f === 'accepted_risk' ? 'Accepted Risk' : f === 'false_positive' ? 'False Positive' : f.charAt(0).toUpperCase() + f.slice(1)}
              </StitchButton>
            ))}
          </div>

          <StitchTable
            columns={[
              { 
                key: 'cve_id', 
                header: 'CVE', 
                render: (row) => <span className="font-mono text-sm font-bold text-[#7bd0ff]">{row.cve_id}</span> 
              },
              { 
                key: 'hostname', 
                header: 'Host', 
                render: (row) => <span className="text-sm font-bold text-[#dee5ff]">{row.hostname || '-'}</span> 
              },
              { 
                key: 'severity', 
                header: 'Severity', 
                render: (row) => <StitchBadge variant={severityColor(row.severity)}>{row.severity}</StitchBadge> 
              },
              { 
                key: 'status', 
                header: 'Status', 
                render: (row) => <StitchBadge variant={remStatusColor(row.status)}>{row.status?.replace('_', ' ')}</StitchBadge> 
              },
              { 
                key: 'due_date', 
                header: 'Due Date', 
                render: (row) => (
                  <span className="text-xs text-[#91aaeb]">
                    {row.due_date ? new Date(row.due_date).toLocaleDateString() : '-'}
                  </span>
                )
              },
              { 
                key: 'notes', 
                header: 'Notes', 
                render: (row) => (
                  <span className="text-xs text-[#91aaeb] line-clamp-1 max-w-xs">
                    {row.notes || '-'}
                  </span>
                )
              },
              {
                key: 'id',
                header: '',
                render: (row) => (
                  <StitchButton
                    variant="secondary"
                    size="sm"
                    icon="edit"
                    onClick={() => openEdit(row)}
                  >
                    Edit
                  </StitchButton>
                )
              }
            ]}
            data={items}
          />
        </div>

        {/* Edit Panel */}
        {editing && (
          <div className="bg-[#05183c] p-8 rounded-xl border border-[#2b4680]/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">Edit Remediation Item</div>
                <h3 className="text-2xl font-bold tracking-tight text-[#dee5ff]">{editing.cve_id} on {editing.hostname}</h3>
              </div>
              <StitchButton
                variant="secondary"
                size="sm"
                icon="close"
                onClick={() => setEditing(null)}
              >
                Close
              </StitchButton>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StitchFormField label="Status">
                <StitchSelect
                  value={editForm.status}
                  onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="accepted_risk">Accepted Risk</option>
                  <option value="false_positive">False Positive</option>
                </StitchSelect>
              </StitchFormField>
              <StitchFormField label="Due Date">
                <StitchInput
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </StitchFormField>
              <StitchFormField label="Notes">
                <StitchInput
                  value={editForm.notes}
                  onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Remediation notes"
                />
              </StitchFormField>
            </div>
            <div className="mt-6 flex gap-3 pt-6 border-t border-[#2b4680]/10">
              <StitchButton
                variant="primary"
                icon="save"
                onClick={saveEdit}
              >
                Save Changes
              </StitchButton>
              <StitchButton
                variant="secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </StitchButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
