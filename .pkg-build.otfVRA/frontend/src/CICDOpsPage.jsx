import React, { useCallback, useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
  StitchFormField,
  StitchInput,
  StitchSelect,
} from './components/StitchComponents';

const getStatusVariant = (status) => {
  const statusMap = {
    success: 'success',
    failed: 'error',
    running: 'info',
    pending: 'warning',
    active: 'success',
    paused: 'warning'
  };
  return statusMap[String(status).toLowerCase()] || 'info';
};

const STAGE_ICONS = {
  build: 'package',
  test: 'fact_check',
  approval: 'verified_user',
  deploy: 'rocket_launch',
  scan: 'gpp_maybe'
};

export default function CICDOpsPage({ API, apiFetch, hasPerm }) {
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
      <div className="space-y-8">
        <StitchPageHeader
          kicker="Infrastructure Logic"
          title="CI/CD Pipelines"
          description="Access denied - CI/CD capability requires appropriate roles"
        />
        <div className="bg-surface-container-low p-8 rounded-xl text-center">
          <p className="text-sm font-bold text-on-surface-variant">
            CI/CD capability requires appropriate roles. Ensure you are an Admin or Operator.
          </p>
        </div>
      </div>
    );
  }

  const successRate = builds.length > 0 
    ? Math.round((builds.filter(b => b.status === 'success').length / builds.length) * 100)
    : 0;
  const pendingApprovals = builds.filter(b => b.status === 'pending').length;
  const activeBuilds = builds.filter(b => ['running', 'pending'].includes(b.status)).length;

  const PipelineStageFlow = ({ stages }) => {
    const defaultStages = [
      { name: 'build', status: 'success' },
      { name: 'test', status: 'success' },
      { name: 'approval', status: 'success' },
      { name: 'deploy', status: 'success' }
    ];
    const stageList = stages || defaultStages;

    const getStageStyle = (status) => {
      if (status === 'success') return 'bg-[#004c69] text-[#7bd0ff]';
      if (status === 'failed') return 'bg-[#7f2927] text-[#ff9993]';
      if (status === 'running') return 'bg-[#fcc025] text-[#3d2b00] animate-pulse ring-4 ring-[#ffd16f]/10';
      return 'bg-[#00225a] border border-[#2b4680] text-[#91aaeb]/40';
    };

    return (
      <div className="flex items-center">
        {stageList.map((stage, idx) => (
          <div key={idx} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStageStyle(stage.status)}`} title={`${stage.name}: ${stage.status}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{STAGE_ICONS[stage.name] || 'circle'}</span>
            </div>
            {idx < stageList.length - 1 && (
              <div className={`w-12 h-px ${
                stage.status === 'success' ? 'bg-[#7bd0ff]/40' : 
                stage.status === 'failed' ? 'bg-[#ee7d77]/40' : 
                stage.status === 'running' ? 'bg-[#ffd16f]/60' : 
                'bg-[#2b4680]/30'
              }`}></div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Workspace Distinction Indicator */}
      <div className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30 bg-[#91aaeb]" />
      
      <StitchPageHeader
        kicker="Infrastructure Logic"
        title="CI/CD Pipelines"
        description={`${pipelines.length} active pipelines | ${successRate}% success rate | ${activeBuilds} builds in progress`}
        workspace="governance"
      />

      {msg && (
        <div className={`rounded-xl px-5 py-3 text-sm font-bold ${
          msg.includes('triggered') || msg.includes('created') ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-error/15 text-error border border-error/30'
        }`}>
          {msg}
        </div>
      )}

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Total Pipelines"
          value={pipelines.length}
          icon="terminal"
          color="#91aaeb"
          workspace="governance"
        />
        <StitchSummaryCard
          label="Success Rate"
          value={`${successRate}%`}
          subtitle={`${builds.filter(b => b.status === 'success').length} of ${builds.length}`}
          icon="check_circle"
          color={successRate >= 90 ? '#10b981' : successRate >= 70 ? '#ffd16f' : '#ee7d77'}
          workspace="governance"
        />
        <StitchSummaryCard
          label="Pending Approvals"
          value={pendingApprovals}
          subtitle="awaiting action"
          icon="verified_user"
          color={pendingApprovals > 0 ? '#ffd16f' : '#10b981'}
          workspace="governance"
        />
        <StitchSummaryCard
          label="Active Builds"
          value={activeBuilds}
          subtitle="in progress"
          icon="analytics"
          color="#91aaeb"
          workspace="governance"
        />
      </StitchMetricGrid>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'pipelines', l: `Pipelines (${pipelines.length})` },
          { k: 'builds', l: `Build Logs (${builds.length})` }
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              tab === t.k
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* Pipeline Creation Form */}
      {showPipelineForm && (
        <div className="bg-[#06122d] p-6 rounded-xl border-l-4 border-[#7bd0ff] space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#dee5ff]">Create CI/CD Pipeline</h3>
            <span className="text-[10px] uppercase tracking-widest text-[#91aaeb] font-bold">New Pipeline Configuration</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StitchFormField label="Pipeline Name">
              <StitchInput
                value={pipelineForm.name}
                onChange={(e) => setPipelineForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Core-Engine-Main"
              />
            </StitchFormField>
            <StitchFormField label="Integration Tool">
              <StitchSelect
                value={pipelineForm.tool}
                onChange={(e) => setPipelineForm(f => ({ ...f, tool: e.target.value }))}
              >
                <option value="internal">PatchMaster Internal</option>
                <option value="jenkins">Jenkins API</option>
                <option value="gitlab">GitLab Webhook</option>
              </StitchSelect>
            </StitchFormField>
            {pipelineForm.tool !== 'internal' && (
              <>
                <StitchFormField label="Endpoint URL">
                  <StitchInput
                    value={pipelineForm.server_url}
                    onChange={(e) => setPipelineForm(f => ({ ...f, server_url: e.target.value }))}
                    placeholder="https://jenkins.example.com"
                  />
                </StitchFormField>
                <StitchFormField label="Job / Project Path">
                  <StitchInput
                    value={pipelineForm.job_path}
                    onChange={(e) => setPipelineForm(f => ({ ...f, job_path: e.target.value }))}
                    placeholder="/job/my-pipeline"
                  />
                </StitchFormField>
              </>
            )}
            <div className="md:col-span-2">
              <StitchFormField label="Pipeline Configuration (JSON)">
                <textarea
                  className="w-full bg-[#031d4b] border border-[#2b4680]/20 text-[#dee5ff] px-4 py-3 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#7bd0ff]/50 placeholder:text-[#91aaeb]/50"
                  value={pipelineForm.script_content}
                  onChange={(e) => setPipelineForm(f => ({ ...f, script_content: e.target.value }))}
                  placeholder='{"stages": [{"name": "Build", "command": "npm run build"}]}'
                  rows={4}
                />
              </StitchFormField>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <StitchButton variant="primary" onClick={createPipeline} icon="save">Save Pipeline</StitchButton>
            <StitchButton variant="secondary" onClick={() => setShowPipelineForm(false)} icon="close">Cancel</StitchButton>
          </div>
        </div>
      )}

      {/* Pipelines Tab */}
      {tab === 'pipelines' && (
        <div className="bg-[#06122d] rounded-xl border border-[#2b4680]/20 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#2b4680]/20">
            <div>
              <h2 className="text-lg font-bold text-[#dee5ff]">Active Pipelines</h2>
              <p className="text-xs text-[#91aaeb] mt-1">Execution flow and deployment status</p>
            </div>
            <StitchButton variant="primary" size="sm" onClick={() => setShowPipelineForm(true)} icon="add">New Pipeline</StitchButton>
          </div>
          {pipelines.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-[#2b4680] mb-4">terminal</span>
              <p className="text-sm font-bold text-[#dee5ff]">No pipelines configured</p>
              <p className="text-xs text-[#91aaeb] mt-2">Create your first CI/CD pipeline to get started</p>
            </div>
          ) : (
            <div className="p-6">
              <StitchTable
                columns={[
                  {
                    key: 'name',
                    header: 'Pipeline Name & ID',
                    render: (val, row) => (
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          row.status === 'active' ? 'bg-[#7bd0ff] shadow-[0_0_8px_#7bd0ff]' : 
                          row.status === 'failed' ? 'bg-[#ee7d77] shadow-[0_0_8px_#ee7d77]' : 
                          'bg-[#91aaeb]'
                        }`}></div>
                        <div>
                          <p className="text-sm font-bold text-[#dee5ff]">{val}</p>
                          <p className="text-[10px] text-[#91aaeb] font-mono">PID: {row.id} | {row.tool}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'server_url',
                    header: 'Env',
                    render: (val) => (
                      <StitchBadge 
                        variant={val?.includes('prod') ? 'error' : 'info'} 
                        size="sm"
                      >
                        {val?.includes('prod') ? 'PROD' : 'STG'}
                      </StitchBadge>
                    ),
                  },
                  {
                    key: 'stages',
                    header: 'Execution Flow',
                    render: (val, row) => <PipelineStageFlow stages={val} />,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (val) => <StitchBadge variant={getStatusVariant(val)} size="sm">{val}</StitchBadge>,
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (val, row) => (
                      <div className="flex justify-end">
                        <StitchButton 
                          variant="primary" 
                          size="sm" 
                          onClick={() => triggerBuild(row.id)}
                          disabled={row.status !== 'active'}
                          icon="play_arrow"
                        >
                          Trigger
                        </StitchButton>
                      </div>
                    ),
                  }
                ]}
                data={pipelines}
              />
            </div>
          )}
        </div>
      )}

      {/* Build Logs Tab */}
      {tab === 'builds' && (
        <div className="bg-[#06122d] rounded-xl border border-[#2b4680]/20 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#2b4680]/20">
            <h2 className="text-lg font-bold text-[#dee5ff]">Build Execution Logs</h2>
            <p className="text-xs text-[#91aaeb] mt-1">Recent pipeline execution history</p>
          </div>
          {builds.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-[#2b4680] mb-4">history</span>
              <p className="text-sm font-bold text-[#dee5ff]">No build logs available</p>
              <p className="text-xs text-[#91aaeb] mt-2">Trigger a pipeline to see execution logs</p>
            </div>
          ) : (
            <div className="p-6">
              <StitchTable
                columns={[
                  {
                    key: 'id',
                    header: 'Build ID',
                    render: (val) => <span className="text-xs font-mono font-bold text-[#7bd0ff]">#{val}</span>,
                  },
                  {
                    key: 'pipeline_id',
                    header: 'Pipeline',
                    render: (val, row) => (
                      <span className="text-sm font-bold text-[#dee5ff]">
                        {pipelines.find(p => p.id === val)?.name || `Pipeline ${val}`}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (val) => <StitchBadge variant={getStatusVariant(val)} size="sm">{val}</StitchBadge>,
                  },
                  {
                    key: 'started_at',
                    header: 'Started',
                    render: (val) => (
                      <span className="text-xs text-[#91aaeb] font-mono">
                        {val ? new Date(val).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    ),
                  },
                  {
                    key: 'trigger_source',
                    header: 'Trigger',
                    render: (val) => <span className="text-xs font-mono text-[#91aaeb]">{val || 'manual'}</span>,
                  }
                ]}
                data={builds}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
