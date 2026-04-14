import React, { useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CHInput, CH } from './CH.jsx';
import { Search, RefreshCw, FileText, Clock } from 'lucide-react';
import { formatDetailsText, sanitizeDisplayText } from './appRuntime';

const actionColor = a => {
  if (!a) return CH.textSub;
  const s = a.toLowerCase();
  if (s.includes('delete') || s.includes('remove')) return CH.red;
  if (s.includes('create') || s.includes('add'))    return CH.green;
  if (s.includes('update') || s.includes('change')) return CH.yellow;
  return CH.accent;
};

export default function AuditPage({ API, apiFetch }) {
  const [logs, setLogs]             = useState([]);
  const [stats, setStats]           = useState(null);
  const [actionFilter, setFilter]   = useState('');
  const [days, setDays]             = useState(7);
  const [expandedId, setExpanded]   = useState(null);

  const refresh = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    params.set('days', days);
    apiFetch(`${API}/api/audit/?${params}`).then(r => r.json()).then(setLogs).catch(() => {});
    apiFetch(`${API}/api/audit/stats`).then(r => r.json()).then(setStats).catch(() => {});
  };

  useEffect(() => { refresh(); }, [actionFilter, days]);

  return (
    <CHPage>
      <CHHeader
        kicker="Compliance & Security"
        title="Audit Trail"
        subtitle="Full traceability for every privileged action and system event"
        actions={<CHBtn variant="ghost" onClick={refresh}><RefreshCw size={14} /> Refresh</CHBtn>}
      />

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <CHStat label="Today"     value={stats.today     ?? 0} sub="events today"           accent={CH.accent} />
          <CHStat label="This Week" value={stats.this_week ?? 0} sub="in the last 7 days"      accent={CH.green} />
          <CHStat label="This Month" value={stats.this_month ?? 0} sub="in the last 30 days"  accent={CH.textSub} />
          <CHStat label="Unique Users" value={stats.unique_users ?? '—'} sub="operators active" accent="#a78bfa" />
        </div>
      )}

      {/* Filters + Table */}
      <CHCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <CHInput
            placeholder="Filter by action type…"
            value={actionFilter}
            onChange={e => setFilter(e.target.value)}
            icon={<Search size={14} />}
            className="max-w-xs"
          />
          <div className="flex gap-2">
            {[1, 7, 30, 90].map(d => (
              <button key={d}
                onClick={() => setDays(d)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: days === d ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
                  color: days === d ? CH.accent : CH.textSub,
                  border: `1px solid ${days === d ? CH.accent + '50' : CH.border}`,
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          <span className="text-[11px] ml-auto" style={{ color: CH.textSub }}>{logs.length} entries</span>
        </div>

        <CHTable
          headers={['Time', 'User', 'Action', 'Resource', 'Details']}
          emptyMessage="No audit logs found for the selected filters."
        >
          {logs.map(log => {
            const detailText = formatDetailsText(log.details);
            const preview = detailText && detailText.length > 120
              ? detailText.slice(0, 120) + '…' : detailText;
            const isExpanded = expandedId === log.id;

            return (
              <CHTR key={log.id} onClick={() => setExpanded(isExpanded ? null : log.id)}>
                <td className="px-6 py-4 font-mono text-xs whitespace-nowrap" style={{ color: CH.textSub }}>
                  {new Date(log.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4 text-sm font-bold" style={{ color: CH.text }}>
                  {sanitizeDisplayText(log.username || log.user_id || 'system', 'system')}
                </td>
                <td className="px-6 py-4">
                  <CHBadge color={actionColor(log.action)}>
                    {sanitizeDisplayText(log.action, 'UNKNOWN')}
                  </CHBadge>
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>
                  {sanitizeDisplayText(`${log.resource_type || ''} ${log.resource_id ? `#${log.resource_id}` : ''}`.trim(), '—')}
                </td>
                <td className="px-6 py-4 max-w-sm">
                  {isExpanded ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto p-3 rounded-lg"
                      style={{ background: 'rgba(0,0,0,0.3)', color: CH.textSub }}>
                      {detailText}
                    </pre>
                  ) : (
                    <p className="text-xs cursor-pointer" style={{ color: CH.textSub }}>
                      {preview || '—'}
                      {detailText && detailText.length > 120 && (
                        <span className="ml-1 font-bold" style={{ color: CH.accent }}>Show more</span>
                      )}
                    </p>
                  )}
                </td>
              </CHTR>
            );
          })}
        </CHTable>
      </CHCard>
    </CHPage>
  );
}
