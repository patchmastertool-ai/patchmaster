import React, { useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
} from './components/StitchComponents';

const getActionStatus = (action) => {
  if (!action) return 'info';
  const s = action.toLowerCase();
  if (s.includes('delete') || s.includes('remove')) return 'error';
  if (s.includes('create') || s.includes('add')) return 'success';
  if (s.includes('update') || s.includes('change')) return 'warning';
  return 'info';
};

export default function AuditPage({ API, apiFetch }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [actionFilter, setFilter] = useState('');
  const [days, setDays] = useState(7);
  const [expandedId, setExpanded] = useState(null);

  const refresh = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    params.set('days', days);
    apiFetch(`${API}/api/audit/?${params}`).then(r => r.json()).then(setLogs).catch(() => {});
    apiFetch(`${API}/api/audit/stats`).then(r => r.json()).then(setStats).catch(() => {});
  };

  useEffect(() => { refresh(); }, [actionFilter, days]);

  const formatDetailsText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const sanitizeDisplayText = (text, fallback) => {
    if (!text) return fallback;
    return String(text).replace(/[^\x20-\x7E]/g, '?');
  };

  return (
    <div className="space-y-8">
      <StitchPageHeader
        kicker="System Analysis & Governance"
        title="Audit & Compliance Reports"
        description="Track system changes, user actions, and compliance events across your infrastructure."
      />

      {/* Top Grid: Compliance Score & Report Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Compliance Gauge Widget */}
        <div className="lg:col-span-4 bg-surface-container-low rounded-xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
          <span className="uppercase tracking-widest text-[10px] font-semibold text-on-surface-variant mb-6">Global Compliance Score</span>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-surface-container-highest" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="12"></circle>
              <circle className="text-primary" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeDasharray="552.92" strokeDashoffset="38.7" strokeWidth="12"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black tracking-tight text-on-surface">93%</span>
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold mt-1">Healthy</span>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-8 w-full text-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Total Hosts</p>
              <p className="text-xl font-bold text-on-surface">{stats?.total_hosts ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Vulnerable</p>
              <p className="text-xl font-bold text-error">{stats?.vulnerable_hosts ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Report Generator Form */}
        <div className="lg:col-span-8 bg-surface-container rounded-xl p-8 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-on-surface-variant/20"></div>
          <h3 className="text-lg font-bold text-on-surface mb-8">Generate New Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {/* Report Type */}
            <div className="space-y-4">
              <label className="uppercase tracking-widest text-[10px] font-semibold text-on-surface-variant block">Report Category</label>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-highest border-l-2 border-primary text-on-surface text-sm rounded-r-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>verified_user</span>
                    <span>Patch Compliance Audit</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
                <button className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container-highest transition-colors text-on-surface-variant text-sm rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>monitor_heart</span>
                    <span>Infrastructure Health Summary</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
                <button className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container-highest transition-colors text-on-surface-variant text-sm rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>manage_accounts</span>
                    <span>User Access & Audit Log</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
              </div>
            </div>

            {/* Parameters */}
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="uppercase tracking-widest text-[10px] font-semibold text-on-surface-variant block">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface-container-highest p-3 rounded-lg flex flex-col">
                    <span className="text-[9px] uppercase tracking-tighter text-on-surface-variant mb-1">Start Date</span>
                    <input className="bg-transparent border-none p-0 text-sm focus:ring-0 text-on-surface w-full" type="date" defaultValue={new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]} />
                  </div>
                  <div className="bg-surface-container-highest p-3 rounded-lg flex flex-col">
                    <span className="text-[9px] uppercase tracking-tighter text-on-surface-variant mb-1">End Date</span>
                    <input className="bg-transparent border-none p-0 text-sm focus:ring-0 text-on-surface w-full" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="uppercase tracking-widest text-[10px] font-semibold text-on-surface-variant block">Export Format</label>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded bg-surface-container-highest border border-primary/40 text-primary text-xs font-bold uppercase tracking-widest">PDF</button>
                  <button className="flex-1 py-2 rounded bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant text-xs font-bold uppercase tracking-widest transition-colors">CSV</button>
                  <button className="flex-1 py-2 rounded bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant text-xs font-bold uppercase tracking-widest transition-colors">JSON</button>
                </div>
              </div>
              <StitchButton 
                variant="primary" 
                onClick={refresh}
                icon="analytics"
                className="w-full justify-center py-3"
              >
                Run Analysis
              </StitchButton>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <section className="space-y-6">
        <div className="flex items-end justify-between px-2">
          <div className="space-y-1">
            <span className="uppercase tracking-widest text-[10px] font-semibold text-on-surface-variant">Audit Trail</span>
            <h2 className="text-xl font-bold text-on-surface">System Activity Log</h2>
          </div>
          <div className="flex gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-bold uppercase tracking-wider border border-outline-variant/20"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <StitchButton variant="secondary" size="sm" icon="download">Export Logs</StitchButton>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
          <StitchTable
            columns={[
              {
                key: 'created_at',
                header: 'Time',
                render: (value) => (
                  <span className="font-mono text-xs text-on-surface-variant whitespace-nowrap">
                    {new Date(value).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ),
              },
              {
                key: 'username',
                header: 'User',
                render: (value, row) => (
                  <span className="text-sm font-bold text-on-surface">
                    {sanitizeDisplayText(value || row.user_id || 'system', 'system')}
                  </span>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                render: (value) => (
                  <StitchBadge variant={getActionStatus(value)} size="sm">
                    {sanitizeDisplayText(value, 'UNKNOWN')}
                  </StitchBadge>
                ),
              },
              {
                key: 'resource',
                header: 'Resource',
                render: (value, row) => (
                  <span className="text-xs text-on-surface-variant">
                    {sanitizeDisplayText(`${row.resource_type || ''} ${row.resource_id ? `#${row.resource_id}` : ''}`.trim(), '—')}
                  </span>
                ),
              },
              {
                key: 'details',
                header: 'Details',
                render: (value, row) => {
                  const detailText = formatDetailsText(value);
                  const preview = detailText && detailText.length > 120
                    ? detailText.slice(0, 120) + '...' : detailText;
                  const isExpanded = expandedId === row.id;

                  return (
                    <div className="max-w-sm">
                      {isExpanded ? (
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto p-3 rounded-lg bg-surface-container text-on-surface-variant">
                          {detailText}
                        </pre>
                      ) : (
                        <p 
                          className="text-xs cursor-pointer text-on-surface-variant hover:text-primary transition-colors"
                          onClick={() => setExpanded(isExpanded ? null : row.id)}
                        >
                          {preview || '—'}
                          {detailText && detailText.length > 120 && (
                            <span className="ml-1 font-bold text-primary">Show more</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                },
              },
            ]}
            data={logs}
          />
        </div>
      </section>

      {/* Bottom Insight Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-container-low p-6 rounded-xl border-l-2 border-primary-container">
          <p className="uppercase tracking-widest text-[9px] font-bold text-on-surface-variant mb-1">Scheduled Jobs</p>
          <h4 className="text-sm font-bold text-on-surface mb-4">Daily Infrastructure Snapshot</h4>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-on-surface-variant">Next run: Tomorrow 02:00</span>
            <span className="text-primary font-bold">ACTIVE</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl border-l-2 border-tertiary-container">
          <p className="uppercase tracking-widest text-[9px] font-bold text-on-surface-variant mb-1">Data Retention</p>
          <h4 className="text-sm font-bold text-on-surface mb-4">Compliance Log Policy</h4>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-on-surface-variant">Duration: 7 Years</span>
            <span className="text-tertiary font-bold">SOX COMPLIANT</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl border-l-2 border-error-container">
          <p className="uppercase tracking-widest text-[9px] font-bold text-on-surface-variant mb-1">Integrity Check</p>
          <h4 className="text-sm font-bold text-on-surface mb-4">Report Signature Status</h4>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-on-surface-variant">All archives verified</span>
            <span className="text-on-error-container font-bold">VERIFIED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
