import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Play, ShieldAlert } from 'lucide-react';

const statusColor = s => ({ success: CH.green, failed: CH.red, running: CH.accent, pending: CH.yellow }[String(s).toLowerCase()] || CH.textSub);

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

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Disaster Recovery Validation"
        title="Restore Drills"
        subtitle={`${configs.length} configs · ${passCount} passed · ${failCount} failed · ${runCount} in-flight`}
        actions={<CHBtn variant="ghost" onClick={loadAll}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></CHBtn>}
      />

      {notice.msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: notice.type === 'error' ? `${CH.red}12` : `${CH.green}12`, color: notice.type === 'error' ? CH.red : CH.green }}>
          {notice.msg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Drill Configs"   value={configs.length}  sub="registered"    accent={CH.accent} />
        <CHStat label="Passed"          value={passCount}       sub="succeeded"     accent={CH.green} />
        <CHStat label="Failed"          value={failCount}       sub="need review"   accent={CH.red} />
        <CHStat label="RTO Target"      value={insights?.avg_rto_minutes != null ? `${insights.avg_rto_minutes}m` : '—'} sub="avg actual" accent={CH.yellow} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Launch panel */}
        <CHCard className="flex flex-col gap-4">
          <CHLabel>Launch Restore Drill</CHLabel>
          <div className="flex flex-col gap-1">
            <CHLabel>Drill Config</CHLabel>
            <select value={selectedConfigId} onChange={e => setSelConfig(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
              <option value="">-- Select config --</option>
              {configs.map(c => <option key={c.id} value={String(c.id)}>{c.name || `Config #${c.id}`}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <CHLabel>Target RTO (min)</CHLabel>
              <input type="number" value={form.target_rto_minutes} onChange={e => setForm(f => ({ ...f, target_rto_minutes: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Target RPO (min)</CHLabel>
              <input type="number" value={form.target_rpo_minutes} onChange={e => setForm(f => ({ ...f, target_rpo_minutes: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Override Target Path (optional)</CHLabel>
            <input value={form.target_path} onChange={e => setForm(f => ({ ...f, target_path: e.target.value }))}
              placeholder="/tmp/restore-drill" className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Backup Log ID (optional)</CHLabel>
            <input type="number" value={form.backup_log_id} onChange={e => setForm(f => ({ ...f, backup_log_id: e.target.value }))}
              placeholder="Leave blank for latest" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
          </div>
          <CHBtn variant="primary" onClick={launchDrill} disabled={actionLoading || !selectedConfigId}>
            <Play size={14} /> {actionLoading ? 'Launching…' : 'Launch Drill'}
          </CHBtn>
        </CHCard>

        {/* Insights */}
        <CHCard>
          <CHLabel>DR Insights</CHLabel>
          {insights ? (
            <div className="mt-4 space-y-3">
              {Object.entries(insights).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                  <span className="text-xs" style={{ color: CH.textSub }}>{k.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-bold font-mono" style={{ color: CH.text }}>{String(v ?? '—')}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <ShieldAlert size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
              <p className="text-xs mt-4 uppercase tracking-widest font-bold" style={{ color: CH.textSub }}>No insights available yet</p>
            </div>
          )}
        </CHCard>
      </div>

      {/* Run history */}
      <CHCard>
        <CHLabel>Drill Run History</CHLabel>
        <CHTable headers={['Config', 'Status', 'RTO', 'RPO', 'Duration', 'Started', '']} emptyMessage="No drill runs yet." className="mt-4">
          {runs.map(run => (
            <CHTR key={run.id}>
              <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{run.config_name || `Config #${run.config_id}`}</td>
              <td className="px-6 py-4"><CHBadge color={statusColor(run.status)}>{run.status}</CHBadge></td>
              <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{run.actual_rto_minutes != null ? `${run.actual_rto_minutes}m` : '—'}</td>
              <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{run.actual_rpo_minutes != null ? `${run.actual_rpo_minutes}m` : '—'}</td>
              <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>
                {run.duration_seconds != null ? `${Math.round(run.duration_seconds)}s` : '—'}
              </td>
              <td className="px-6 py-4 text-xs font-mono" style={{ color: CH.textSub }}>
                {run.started_at ? new Date(run.started_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
              <td className="px-6 py-4">
                <CHBtn variant="ghost" onClick={() => setSelectedRun(run)}>Report</CHBtn>
              </td>
            </CHTR>
          ))}
        </CHTable>
      </CHCard>

      {/* Run detail */}
      {selectedRun && (
        <CHCard className="space-y-4">
          <div className="flex items-center justify-between">
            <CHLabel>Drill Report — Run #{selectedRun.id}</CHLabel>
            <CHBtn variant="ghost" onClick={() => setSelectedRun(null)}>Close</CHBtn>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: 'Status',           v: selectedRun.status },
              { l: 'Duration',         v: selectedRun.duration_seconds ? `${Math.round(selectedRun.duration_seconds)}s` : '—' },
              { l: 'Restore Path',     v: selectedRun.target_path || '—' },
              { l: 'Validation',       v: selectedRun.validation_result === true ? '✓ Passed' : selectedRun.validation_result === false ? '✗ Failed' : '—' },
            ].map(item => (
              <div key={item.l} className="p-3 rounded-lg" style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                <p className="text-xs uppercase tracking-wider font-bold" style={{ color: CH.textSub }}>{item.l}</p>
                <p className="text-sm font-bold mt-1 font-mono" style={{ color: CH.text }}>{item.v}</p>
              </div>
            ))}
          </div>
          {selectedRun.output && (
            <pre className="rounded-xl p-4 text-xs font-mono max-h-64 overflow-y-auto"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
              {selectedRun.output}
            </pre>
          )}
        </CHCard>
      )}
    </CHPage>
  );
}
