import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchBadge,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchTable,
  StitchAlert
} from './components/StitchComponents';

const statusColor = s => {
  const statusMap = {
    success: 'success',
    failed: 'error',
    running: 'info',
    pending: 'warning'
  };
  return statusMap[String(s).toLowerCase()] || 'info';
};

export default function RestoreDrillPage({ API, apiFetch, useInterval, toast }) {
  const [configs, setConfigs]             = useState([]);
  const [runs, setRuns]                   = useState([]);
  const [insights, setInsights]           = useState(null);
  const [selectedConfigId, setSelConfig]  = useState('');
  const [loading, setLoading]             = useState(false);
  const [actionLoading, setActing]        = useState(false);
  const [notice, setNotice]               = useState({ msg: '', type: 'info' });
  const [selectedRun, setSelectedRun]     = useState(null);
  const [form, setForm]                   = useState({
    backup_log_id: '', target_path: '', target_rto_minutes: '30', target_rpo_minutes: '60',
  });

  const selectedConfig = configs.find(c => String(c.id) === String(selectedConfigId)) || null;

  const parseErr = async (r, fb) => {
    let d = '';
    try { const p = await r.clone().json(); d = p?.error?.message || p?.detail || p?.message || ''; } catch {}
    return d ? `${fb}: ${d}` : `${fb} (${r.status})`;
  };

  const loadConfigs = useCallback(async () => {
    const r = await apiFetch(`${API}/api/restore-drills/configs`);
    const d = await r.json().catch(() => []);
    if (!r.ok) throw new Error(await parseErr(r, 'Failed to load configs'));
    const rows = Array.isArray(d) ? d : [];
    setConfigs(rows);
    if (rows.length && !rows.find(c => String(c.id) === String(selectedConfigId))) setSelConfig(String(rows[0].id));
  }, [API, apiFetch, selectedConfigId]);

  const loadRuns = useCallback(async () => {
    const q = new URLSearchParams({ limit: '200' });
    if (selectedConfigId) q.set('config_id', String(selectedConfigId));
    const r = await apiFetch(`${API}/api/restore-drills/runs?${q}`);
    const d = await r.json().catch(() => []);
    if (!r.ok) throw new Error(await parseErr(r, 'Failed to load runs'));
    setRuns(Array.isArray(d) ? d : []);
  }, [API, apiFetch, selectedConfigId]);

  const loadInsights = useCallback(async () => {
    const r = await apiFetch(`${API}/api/restore-drills/insights`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(await parseErr(r, 'Failed to load insights'));
    setInsights(d || {});
  }, [API, apiFetch]);

  const loadAll = useCallback(async () => {
    setLoading(true); setNotice({ msg: '', type: 'info' });
    try { await Promise.all([loadConfigs(), loadRuns(), loadInsights()]); }
    catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setLoading(false);
  }, [loadConfigs, loadInsights, loadRuns]);

  useEffect(() => { loadAll(); }, [loadAll]);
  if (useInterval) useInterval(() => { loadRuns(); loadInsights(); }, 5000);

  const toQueue = job => { const id = String(job?.id || '').trim(); if (id) window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: id } })); };

  const launchDrill = async () => {
    if (!selectedConfigId) return;
    setActing(true); setNotice({ msg: '', type: 'info' });
    try {
      const r = await apiFetch(`${API}/api/restore-drills/run`, {
        method: 'POST',
        body: JSON.stringify({
          config_id: Number(selectedConfigId),
          backup_log_id: form.backup_log_id ? Number(form.backup_log_id) : undefined,
          target_path: form.target_path || undefined,
          target_rto_minutes: form.target_rto_minutes ? Number(form.target_rto_minutes) : undefined,
          target_rpo_minutes: form.target_rpo_minutes ? Number(form.target_rpo_minutes) : undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(await parseErr(r, 'Drill launch failed'));
      setNotice({ msg: `Drill queued for ${selectedConfig?.name || 'config'} — run #${d?.run?.id || '-'}`, type: 'success' });
      if (toast) toast('Restore drill queued', 'success');
      toQueue(d?.job); await loadRuns(); await loadInsights();
    } catch (e) { setNotice({ msg: e.message, type: 'error' }); }
    setActing(false);
  };

  const passCount = runs.filter(r => r.status === 'success').length;
  const failCount = runs.filter(r => r.status === 'failed').length;
  const runCount  = runs.filter(r => r.status === 'running').length;

  return (
    <div className="flex h-full bg-[#060e20] text-[#dee5ff] overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 sm:px-12 py-6 sm:py-8">
        {/* Page Header */}
        <StitchPageHeader
          kicker="Disaster Recovery Validation"
          title="Restore Drills"
          description={`${configs.length} configs · ${passCount} passed · ${failCount} failed · ${runCount} in-flight`}
          workspace="infrastructure"
          actions={
            <StitchButton
              variant="ghost"
              icon="refresh"
              onClick={loadAll}
              disabled={loading}
            >
              Refresh
            </StitchButton>
          }
        />

        {/* Notice */}
        {notice.msg && (
          <StitchAlert
            variant={notice.type === 'error' ? 'error' : 'info'}
            icon={notice.type === 'error' ? 'error' : 'info'}
            message={notice.msg}
            onDismiss={() => setNotice({ msg: '', type: 'info' })}
          />
        )}

        {/* KPI Cards */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Drill Configs"
            value={configs.length}
            icon="settings"
            subtitle="registered"
            workspace="infrastructure"
          />
          <StitchSummaryCard
            label="Passed"
            value={passCount}
            icon="check_circle"
            subtitle="succeeded"
            color="#7bd0ff"
            workspace="infrastructure"
          />
          <StitchSummaryCard
            label="Failed"
            value={failCount}
            icon="error"
            subtitle="need review"
            color="#ee7d77"
            workspace="infrastructure"
          />
          <StitchSummaryCard
            label="RTO Target"
            value={insights?.avg_rto_minutes != null ? `${insights.avg_rto_minutes}m` : '—'}
            icon="schedule"
            subtitle="avg actual"
            color="#ffd16f"
            workspace="infrastructure"
          />
        </StitchMetricGrid>

        {/* Launch panel and Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
          {/* Launch panel */}
          <div className="bg-[#05183c] p-6 rounded-xl flex flex-col gap-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Launch Restore Drill</p>
            <StitchFormField label="Drill Config">
              <StitchSelect
                value={selectedConfigId}
                onChange={(e) => setSelConfig(e.target.value)}
                options={[
                  { value: '', label: '-- Select config --' },
                  ...configs.map(c => ({ value: String(c.id), label: c.name || `Config #${c.id}` }))
                ]}
              />
            </StitchFormField>
            <div className="grid grid-cols-2 gap-3">
              <StitchFormField label="Target RTO (min)">
                <StitchInput
                  type="number"
                  value={form.target_rto_minutes}
                  onChange={(e) => setForm(f => ({ ...f, target_rto_minutes: e.target.value }))}
                />
              </StitchFormField>
              <StitchFormField label="Target RPO (min)">
                <StitchInput
                  type="number"
                  value={form.target_rpo_minutes}
                  onChange={(e) => setForm(f => ({ ...f, target_rpo_minutes: e.target.value }))}
                />
              </StitchFormField>
            </div>
            <StitchFormField label="Override Target Path (optional)">
              <StitchInput
                value={form.target_path}
                onChange={(e) => setForm(f => ({ ...f, target_path: e.target.value }))}
                placeholder="/tmp/restore-drill"
              />
            </StitchFormField>
            <StitchFormField label="Backup Log ID (optional)">
              <StitchInput
                type="number"
                value={form.backup_log_id}
                onChange={(e) => setForm(f => ({ ...f, backup_log_id: e.target.value }))}
                placeholder="Leave blank for latest"
              />
            </StitchFormField>
            <StitchButton
              variant="primary"
              icon="play_arrow"
              onClick={launchDrill}
              disabled={actionLoading || !selectedConfigId}
            >
              {actionLoading ? 'Launching…' : 'Launch Drill'}
            </StitchButton>
          </div>

          {/* Insights */}
          <div className="bg-[#05183c] p-6 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">DR Insights</p>
            {insights ? (
              <div className="space-y-3">
                {Object.entries(insights).map(([k, v]) => (
                  <div 
                    key={k} 
                    className="flex items-center justify-between p-3 rounded-lg bg-[#031d4b]/30 border border-[#2b4680]"
                  >
                    <span className="text-xs text-[#91aaeb]">{k.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-bold font-mono text-[#dee5ff]">{String(v ?? '—')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <span className="material-symbols-outlined text-[48px] text-[#91aaeb] opacity-30">shield_with_heart</span>
                <p className="text-xs mt-4 uppercase tracking-widest font-bold text-[#91aaeb]">No insights available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Run history */}
        <div className="bg-[#05183c] p-6 rounded-xl mb-8">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">Drill Run History</p>
          <StitchTable
            columns={[
              { 
                key: 'config_name', 
                header: 'Config', 
                render: (row) => <span className="font-bold text-sm text-[#dee5ff]">{row.config_name || `Config #${row.config_id}`}</span> 
              },
              { 
                key: 'status', 
                header: 'Status', 
                render: (row) => <StitchBadge variant={statusColor(row.status)}>{row.status}</StitchBadge> 
              },
              { 
                key: 'actual_rto_minutes', 
                header: 'RTO', 
                render: (row) => <span className="text-xs text-[#91aaeb]">{row.actual_rto_minutes != null ? `${row.actual_rto_minutes}m` : '—'}</span> 
              },
              { 
                key: 'actual_rpo_minutes', 
                header: 'RPO', 
                render: (row) => <span className="text-xs text-[#91aaeb]">{row.actual_rpo_minutes != null ? `${row.actual_rpo_minutes}m` : '—'}</span> 
              },
              { 
                key: 'duration_seconds', 
                header: 'Duration', 
                render: (row) => <span className="text-xs font-mono text-[#91aaeb]">{row.duration_seconds != null ? `${Math.round(row.duration_seconds)}s` : '—'}</span>
              },
              { 
                key: 'started_at', 
                header: 'Started', 
                render: (row) => (
                  <span className="text-xs font-mono text-[#91aaeb]">
                    {row.started_at ? new Date(row.started_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                )
              },
              { 
                key: 'id', 
                header: '', 
                render: (row) => (
                  <StitchButton 
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRun(row)}
                  >
                    Report
                  </StitchButton>
                )
              },
            ]}
            data={runs}
          />
        </div>

        {/* Run detail */}
        {selectedRun && (
          <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Drill Report — Run #{selectedRun.id}</p>
              <StitchButton 
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRun(null)}
              >
                Close
              </StitchButton>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l: 'Status',           v: selectedRun.status },
                { l: 'Duration',         v: selectedRun.duration_seconds ? `${Math.round(selectedRun.duration_seconds)}s` : '—' },
                { l: 'Restore Path',     v: selectedRun.target_path || '—' },
                { l: 'Validation',       v: selectedRun.validation_result === true ? '✓ Passed' : selectedRun.validation_result === false ? '✗ Failed' : '—' },
              ].map(item => (
                <div key={item.l} className="p-3 rounded-lg bg-[#031d4b]/30 border border-[#2b4680]">
                  <p className="text-xs uppercase tracking-wider font-bold text-[#91aaeb]">{item.l}</p>
                  <p className="text-sm font-bold mt-1 font-mono text-[#dee5ff]">{item.v}</p>
                </div>
              ))}
            </div>
            {selectedRun.output && (
              <pre className="rounded-xl p-4 text-xs font-mono max-h-64 overflow-y-auto bg-black/50 text-[#e2e8f0] whitespace-pre-wrap">
                {selectedRun.output}
              </pre>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
