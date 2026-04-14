import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Play, Settings, Database, Code, Globe, Shield, Activity, Plus, Trash2, GitBranch, Archive } from 'lucide-react';

const SColor = s => ({ success: CH.green, failed: CH.red, running: CH.accent, pending: CH.yellow, active: CH.green, paused: CH.yellow }[String(s).toLowerCase()] || CH.textSub);

export default function CICDOpsPage({ API, apiFetch, hasPerm, getToken }) {
  const canCICD = hasPerm('cicd');
  const [tab, setTab] = useState('pipelines');
  const [pipelines, setPipelines] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  
  const [showPipelineForm, setShowPipelineForm] = useState(false);
  const [pipelineForm, setPipelineForm] = useState({ name: '', tool: 'internal', server_url: '', job_path: '', script_type: 'internal_v2', script_content: '' });

  const loadData = useCallback(async () => {
    if (!canCICD) return;
    setLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        apiFetch(`${API}/api/cicd/pipelines`).then(r => r.json()),
        apiFetch(`${API}/api/cicd/builds`).then(r => r.json())
      ]);
      setPipelines(Array.isArray(pRes) ? pRes : []);
      setBuilds(Array.isArray(bRes) ? bRes : []);
    } catch {}
    setLoading(false);
  }, [API, apiFetch, canCICD]);

  useEffect(() => { loadData(); }, [loadData]);

  const createPipeline = async () => {
    if (!pipelineForm.name.trim()) return setMsg('Name is required');
    try {
      const r = await apiFetch(`${API}/api/cicd/pipelines`, { method: 'POST', body: JSON.stringify(pipelineForm) });
      if (!r.ok) { const d = await r.json(); setMsg(d.detail || 'Save failed'); return; }
      setMsg('Pipeline created!'); setShowPipelineForm(false); loadData();
    } catch { setMsg('Error creating pipeline'); }
  };

  const triggerBuild = async id => {
    try {
      const r = await apiFetch(`${API}/api/cicd/pipelines/${id}/trigger`, { method: 'POST', body: JSON.stringify({ parameters: {} }) });
      if (r.ok) { setMsg('Build triggered'); loadData(); } else { const d = await r.json(); setMsg(d.detail || 'Trigger failed'); }
    } catch { setMsg('Error triggering build'); }
  };

  if (!canCICD) {
    return (
      <CHPage>
        <CHCard><div className="py-12 text-center text-sm font-bold" style={{ color: CH.textSub }}>CI/CD capability requires appropriate roles. Ensure you are an Admin or Operator.</div></CHCard>
      </CHPage>
    );
  }

  const TABS = [
    { k: 'pipelines', l: `Pipelines (${pipelines.length})`, i: <Code size={14} /> },
    { k: 'builds',    l: `Build Logs (${builds.length})`,  i: <Activity size={14} /> }
  ];

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Release Engineering"
        title="CI/CD Operations Workspace"
        subtitle={`${pipelines.length} configured pipelines · ${builds.filter(b => b.status === 'running').length} active builds`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={loadData}><RefreshCw size={14} /> Refresh</CHBtn>
            <CHBtn variant="primary" onClick={() => setShowPipelineForm(v => !v)}><Plus size={14} /> {showPipelineForm ? 'Cancel' : 'New Pipeline'}</CHBtn>
          </div>
        }
      />

      {msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold mb-4" style={{ background: `${CH.accent}12`, color: CH.accent }}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Pipelines" value={pipelines.length} sub="orchestrations" accent={CH.accent} />
        <CHStat label="Active Builds" value={builds.filter(b => ['running', 'pending'].includes(b.status)).length} sub="in progress" accent={CH.yellow} />
        <CHStat label="Successful Deployments" value={builds.filter(b => b.status === 'success').length} sub="historical" accent={CH.green} />
        <CHStat label="Git Handlers" value="2" sub="active webhooks" accent="#a78bfa" />
      </div>

      {showPipelineForm && (
        <CHCard className="space-y-4 mb-6" style={{ borderTop: `4px solid ${CH.accent}` }}>
          <CHLabel>Create CI/CD Pipeline</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <CHLabel>Pipeline Name</CHLabel>
              <input value={pipelineForm.name} onChange={e => setPipelineForm(f => ({ ...f, name: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} placeholder="Prod Nightly Deploy" />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Engine Tool</CHLabel>
              <select value={pipelineForm.tool} onChange={e => setPipelineForm(f => ({ ...f, tool: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="internal">PatchMaster Internal (Standalone)</option>
                <option value="jenkins">Jenkins API</option>
                <option value="gitlab">GitLab Webhook</option>
              </select>
            </div>
            {pipelineForm.tool !== 'internal' && (
              <>
                <div className="flex flex-col gap-1">
                  <CHLabel>Endpoint URL</CHLabel>
                  <input value={pipelineForm.server_url} onChange={e => setPipelineForm(f => ({ ...f, server_url: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} placeholder="https://" />
                </div>
                <div className="flex flex-col gap-1">
                  <CHLabel>Job / Project Path</CHLabel>
                  <input value={pipelineForm.job_path} onChange={e => setPipelineForm(f => ({ ...f, job_path: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} placeholder="namespace/repo" />
                </div>
              </>
            )}
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Script Snippet ({pipelineForm.script_type})</CHLabel>
              <textarea value={pipelineForm.script_content} onChange={e => setPipelineForm(f => ({ ...f, script_content: e.target.value }))} className="rounded-lg px-3 py-2.5 text-xs font-mono min-h-[120px]" style={inputStyle} placeholder='{"stages": [{"name": "Build", "command": "npm run build"}]}' />
            </div>
          </div>
          <CHBtn variant="primary" onClick={createPipeline}>Save Pipeline</CHBtn>
        </CHCard>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap mb-4">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: tab === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', color: tab === t.k ? CH.accent : CH.textSub, border: `1px solid ${tab === t.k ? CH.accent + '40' : CH.border}` }}>
            {t.i} {t.l}
          </button>
        ))}
      </div>

      {tab === 'pipelines' && (
        <div className="space-y-4">
          {pipelines.length === 0 ? (
            <CHCard><div className="py-12 text-center text-sm font-bold" style={{ color: CH.textSub }}>No pipelines configured.</div></CHCard>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {pipelines.map(p => (
                <CHCard key={p.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CHBadge color={CH.accent}>{p.tool}</CHBadge>
                        <p className="text-sm font-bold" style={{ color: CH.text }}>{p.name}</p>
                      </div>
                      <p className="text-xs mt-1 font-mono" style={{ color: CH.textSub }}>{p.server_url || 'Internal Runtime Engine'} · {p.job_path || 'No constraints'}</p>
                    </div>
                    <CHBadge color={SColor(p.status)}>{p.status}</CHBadge>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: CH.border }}>
                    <CHBtn variant="primary" onClick={() => triggerBuild(p.id)} disabled={p.status !== 'active'}><Play size={12} /> Trigger</CHBtn>
                  </div>
                </CHCard>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'builds' && (
        <CHCard>
          <CHLabel>Build Execution Logs</CHLabel>
          <CHTable headers={['Build ID', 'Pipeline', 'Status', 'Started / Duration', 'Trigger']} emptyMessage="No build logs available." className="mt-4">
            {builds.map(b => (
              <CHTR key={b.id}>
                <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: CH.text }}>#{b.id}</td>
                <td className="px-4 py-3 text-sm font-bold" style={{ color: CH.accent }}>{b.pipeline?.name || `Pipeline ${b.pipeline_id}`}</td>
                <td className="px-4 py-3"><CHBadge color={SColor(b.status)}>{b.status}</CHBadge></td>
                <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{b.started_at ? new Date(b.started_at).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{b.trigger_source || 'manual'}</td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}
    </CHPage>
  );
}
