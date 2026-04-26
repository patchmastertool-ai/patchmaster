import React, { useCallback, useEffect, useState } from 'react';
import { AppIcon } from './AppIcons';
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

const SAMPLE_YAML = `name: "Web Server Hardening"
steps:
  - name: "Install Nginx"
    module: package
    state: installed
    package: nginx
  - name: "Ensure Nginx Running"
    module: service
    service: nginx
    state: running
    enable: true
  - name: "Secure SSH"
    module: file
    path: /etc/ssh/sshd_config
    state: present
    content: |
      PermitRootLogin no
      PasswordAuthentication no
`;

export default function PolicyManagerPage({ API, apiFetch }) {
  const [policies, setPolicies]           = useState([]);
  const [hosts, setHosts]                 = useState([]);
  const [revisions, setRevisions]         = useState([]);
  const [executions, setExecutions]       = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [taskExecutions, setTaskExecs]    = useState([]);
  const [selectedPolicyId, setSelPol]     = useState('');
  const [selectedRevisionId, setSelRev]   = useState('');
  const [selectedHosts, setSelHosts]      = useState([]);
  const [showCreate, setShowCreate]       = useState(false);
  const [loading, setLoading]             = useState(false);
  const [notice, setNotice]               = useState('');
  const [tab, setTab]                     = useState('policies');
  const [formData, setFormData]           = useState({ name: '', description: '', yaml_content: SAMPLE_YAML, change_summary: '' });
  const [draftData, setDraftData]         = useState({ name: '', description: '', yaml_content: '', change_summary: '' });
  const [taskForm, setTaskForm]           = useState({ template_id: '', host_id: '', bundle_url: '' });

  const selectedPolicy = policies.find(p => String(p.id) === String(selectedPolicyId)) || null;

  const fetchAll = useCallback(async () => {
    const [pr, hr, tr, ter] = await Promise.all([
      apiFetch(`${API}/api/policies/`),
      apiFetch(`${API}/api/hosts/`),
      apiFetch(`${API}/api/policies/admin-tasks/templates`),
      apiFetch(`${API}/api/policies/admin-tasks/executions`),
    ]);
    const [pd, hd, td, ted] = await Promise.all([pr.json(), hr.json(), tr.json(), ter.json()]);
    setPolicies(Array.isArray(pd) ? pd : []);
    setHosts(Array.isArray(hd) ? hd : []);
    setTaskTemplates(td.items || []);
    setTaskExecs(ted.items || []);
    setSelPol(cur => cur || String(pd?.[0]?.id || ''));
  }, [API, apiFetch]);

  const fetchSelected = useCallback(async id => {
    if (!id) { setRevisions([]); setExecutions([]); return; }
    const [rr, er] = await Promise.all([
      apiFetch(`${API}/api/policies/${id}/revisions`),
      apiFetch(`${API}/api/policies/${id}/executions`),
    ]);
    const [rd, ed] = await Promise.all([rr.json(), er.json()]);
    setRevisions(rd.items || []);
    setExecutions(ed.items || []);
    setSelRev(cur => cur || String(rd.items?.[0]?.id || ''));
    if (!draftData.yaml_content) {
      const active = rd.items?.find(i => i.status === 'active') || rd.items?.[0];
      if (active) setDraftData({ name: active.name || '', description: active.description || '', yaml_content: active.yaml_content || '', change_summary: '' });
    }
  }, [API, apiFetch, draftData.yaml_content]);

  useEffect(() => { fetchAll().catch(e => setNotice(e.message)); }, [fetchAll]);
  useEffect(() => { fetchSelected(selectedPolicyId).catch(e => setNotice(e.message)); }, [selectedPolicyId, fetchSelected]);

  const createPolicy = async () => {
    setLoading(true);
    try {
      await apiFetch(`${API}/api/policies/`, { method: 'POST', body: JSON.stringify(formData) });
      setShowCreate(false);
      setFormData({ name: '', description: '', yaml_content: SAMPLE_YAML, change_summary: '' });
      setNotice('Policy created.'); await fetchAll();
    } catch (e) { setNotice(e.message); }
    setLoading(false);
  };

  const saveDraft = async () => {
    if (!selectedPolicy) return;
    setLoading(true);
    try {
      await apiFetch(`${API}/api/policies/${selectedPolicy.id}`, { method: 'PUT', body: JSON.stringify(draftData) });
      setNotice('Draft saved.'); await fetchAll(); await fetchSelected(selectedPolicy.id);
    } catch (e) { setNotice(e.message); }
    setLoading(false);
  };

  const runRevisionAction = async (action, revId = selectedRevisionId) => {
    if (!selectedPolicy || !revId || selectedHosts.length === 0) return;
    setLoading(true);
    try {
      const path = action === 'activate'
        ? `${API}/api/policies/${selectedPolicy.id}/revisions/${revId}/activate`
        : action === 'rollback'
          ? `${API}/api/policies/${selectedPolicy.id}/rollback/${revId}`
          : `${API}/api/policies/${selectedPolicy.id}/revisions/${revId}/${action}`;
      const body = action === 'activate' ? null : JSON.stringify({ host_ids: selectedHosts, guardrails: { require_dry_run: action === 'apply' } });
      await apiFetch(path, { method: 'POST', ...(body ? { body } : {}) });
      setNotice(`Policy ${action} completed.`); await fetchAll(); await fetchSelected(selectedPolicy.id);
    } catch (e) { setNotice(e.message); }
    setLoading(false);
  };

  const executeAdminTask = async () => {
    if (!taskForm.template_id || !taskForm.host_id) return;
    setLoading(true);
    try {
      await apiFetch(`${API}/api/policies/admin-tasks/execute`, { method: 'POST', body: JSON.stringify({
        template_id: +taskForm.template_id, host_id: +taskForm.host_id,
        parameters: taskForm.bundle_url ? { bundle_url: taskForm.bundle_url } : {},
      }) });
      setNotice('Admin task queued.'); setTaskForm({ template_id: '', host_id: '', bundle_url: '' }); await fetchAll();
    } catch (e) { setNotice(e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#05183c] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <StitchPageHeader
          kicker="Configuration Policy Engine"
          title="Policy Manager"
          description="Manage configuration policies, revisions, and admin task execution across your infrastructure."
          actions={
            <StitchButton
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={fetchAll}
            >
              Refresh
            </StitchButton>
          }
        />

        {/* Notice Banner */}
        {notice && (
          <div
            className={`rounded-xl px-5 py-3 text-sm font-bold ${
              notice.toLowerCase().includes('fail') || notice.toLowerCase().includes('error')
                ? 'bg-[#ee7d77]/20 text-[#ee7d77]'
                : 'bg-[#7bd0ff]/20 text-[#7bd0ff]'
            }`}
          >
            {notice}
          </div>
        )}

        {/* KPIs */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Policies"
            value={policies.length}
            icon="policy"
            color="#7bd0ff"
          />
          <StitchSummaryCard
            label="Active"
            value={policies.filter(p => p.is_active).length}
            subtitle="enforced"
            icon="check_circle"
            color="#10b981"
          />
          <StitchSummaryCard
            label="Task Templates"
            value={taskTemplates.length}
            subtitle="registered"
            icon="description"
            color="#fcc025"
          />
          <StitchSummaryCard
            label="Pending Tasks"
            value={taskExecutions.filter(t => t.status === 'pending').length}
            subtitle="queued"
            icon="schedule"
            color="#ee7d77"
          />
        </StitchMetricGrid>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { k: 'policies', l: `Policies (${policies.length})` },
            { k: 'tasks', l: `Admin Tasks` },
            { k: 'create', l: '+ Create Policy' }
          ].map(t => (
            <StitchButton
              key={t.k}
              variant={tab === t.k ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTab(t.k)}
            >
              {t.l}
            </StitchButton>
          ))}
        </div>

        {/* Policies Tab */}
        {tab === 'policies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Policy List */}
            <div className="bg-[#06122d] rounded-xl p-6 border border-[#2b4680]/20">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#91aaeb] mb-4">
                Policy Registry ({policies.length})
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {policies.length === 0 ? (
                  <p className="text-sm py-4 text-center text-[#91aaeb]">No policies yet.</p>
                ) : null}
                {policies.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelPol(String(p.id))}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      String(p.id) === selectedPolicyId
                        ? 'bg-[#7bd0ff]/15 border-[#7bd0ff]/40'
                        : 'bg-[#031d4b] border-[#2b4680]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#dee5ff]">{p.name}</p>
                        <p className="text-xs mt-0.5 text-[#91aaeb]">
                          {p.description || 'No description'} · {p.revision_count || 0} revisions
                        </p>
                      </div>
                      <StitchBadge 
                        variant={p.is_active ? 'success' : 'info'}
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </StitchBadge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Policy Revisions */}
            <div className="bg-[#06122d] rounded-xl p-6 border border-[#2b4680]/20">
              {selectedPolicy ? (
                <>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#91aaeb] mb-4">
                    {selectedPolicy.name} — Revisions
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto mb-5">
                    {revisions.map(rev => (
                      <div
                        key={rev.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#031d4b] border border-[#2b4680]"
                      >
                        <div>
                          <div className="flex gap-2 items-center mb-1">
                            <StitchBadge variant="info">v{rev.revision ?? rev.version}</StitchBadge>
                            {rev.status === 'active' && <StitchBadge variant="success">Active</StitchBadge>}
                          </div>
                          <p className="text-xs text-[#91aaeb]">
                            {rev.created_by || '—'} · {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <StitchButton
                            variant="primary"
                            size="sm"
                            icon="play_arrow"
                            onClick={() => runRevisionAction('activate', String(rev.id))}
                            disabled={loading}
                          >
                            Apply
                          </StitchButton>
                          <StitchButton
                            variant="secondary"
                            size="sm"
                            icon="restart_alt"
                            onClick={() => runRevisionAction('rollback', String(rev.id))}
                            disabled={loading}
                          />
                        </div>
                      </div>
                    ))}
                    {revisions.length === 0 && (
                      <p className="text-sm py-4 text-center text-[#91aaeb]">No revisions.</p>
                    )}
                  </div>

                  {/* YAML Editor */}
                  <div className="pt-4 space-y-3 border-t border-[#2b4680]">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#91aaeb]">
                      Edit Draft YAML
                    </h3>
                    <textarea
                      value={draftData.yaml_content}
                      onChange={e => setDraftData(d => ({ ...d, yaml_content: e.target.value }))}
                      rows={8}
                      className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y bg-[#000000] border border-[#2b4680] text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none"
                      style={{ lineHeight: 1.6 }}
                    />
                    <StitchFormField label="Change Summary">
                      <StitchInput
                        value={draftData.change_summary}
                        onChange={(e) => setDraftData(d => ({ ...d, change_summary: e.target.value }))}
                        placeholder="Change summary…"
                      />
                    </StitchFormField>
                    <StitchButton
                      variant="primary"
                      icon="save"
                      onClick={saveDraft}
                      disabled={loading}
                    >
                      {loading ? 'Saving…' : 'Save Draft'}
                    </StitchButton>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Icon name="description" size={48} className="text-[#91aaeb] opacity-30" />
                  <p className="text-xs uppercase tracking-widest font-bold mt-4 text-[#91aaeb]">
                    Select a policy to view its revisions
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin Tasks Tab */}
        {tab === 'tasks' && (
          <div className="space-y-6">
            {/* Queue Admin Task Form */}
            <div className="bg-[#06122d] rounded-xl p-6 border border-[#2b4680]/20 space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#91aaeb]">
                Queue Admin Task
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StitchFormField label="Task Template">
                  <StitchSelect
                    value={taskForm.template_id}
                    onChange={(e) => setTaskForm(f => ({ ...f, template_id: e.target.value }))}
                    options={[
                      { value: '', label: '-- Select --' },
                      ...taskTemplates.map(t => ({ value: String(t.id), label: t.name }))
                    ]}
                  />
                </StitchFormField>
                <StitchFormField label="Target Host">
                  <StitchSelect
                    value={taskForm.host_id}
                    onChange={(e) => setTaskForm(f => ({ ...f, host_id: e.target.value }))}
                    options={[
                      { value: '', label: '-- Select --' },
                      ...hosts.map(h => ({ value: String(h.id), label: `${h.hostname || h.name} (${h.ip})` }))
                    ]}
                  />
                </StitchFormField>
                <StitchFormField label="Bundle URL (optional)">
                  <StitchInput
                    value={taskForm.bundle_url}
                    onChange={(e) => setTaskForm(f => ({ ...f, bundle_url: e.target.value }))}
                    placeholder="https://…"
                  />
                </StitchFormField>
              </div>
              <StitchButton
                variant="primary"
                icon="play_arrow"
                onClick={executeAdminTask}
                disabled={loading || !taskForm.template_id || !taskForm.host_id}
              >
                {loading ? 'Queuing…' : 'Queue Task'}
              </StitchButton>
            </div>

            {/* Task Execution History */}
            <div className="bg-[#06122d] rounded-xl p-6 border border-[#2b4680]/20">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#91aaeb] mb-4">
                Task Execution History
              </h3>
              <StitchTable
                columns={[
                  {
                    key: 'task_name',
                    header: 'Task',
                    render: (row) => (
                      <span className="font-bold text-sm text-[#dee5ff]">
                        {row.template_name || row.task_name || `Task #${row.id}`}
                      </span>
                    )
                  },
                  {
                    key: 'hostname',
                    header: 'Host',
                    render: (row) => (
                      <span className="text-xs text-[#91aaeb]">
                        {row.hostname || `Host #${row.host_id}` || '—'}
                      </span>
                    )
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => (
                      <StitchBadge 
                        variant={row.status === 'completed' ? 'success' : row.status === 'failed' ? 'error' : 'warning'}
                      >
                        {row.status}
                      </StitchBadge>
                    )
                  },
                  {
                    key: 'created_at',
                    header: 'Created',
                    render: (row) => (
                      <span className="font-mono text-xs text-[#91aaeb]">
                        {row.created_at ? new Date(row.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    )
                  }
                ]}
                data={taskExecutions}
              />
            </div>
          </div>
        )}

        {/* Create Policy Tab */}
        {tab === 'create' && (
          <div className="bg-[#06122d] rounded-xl p-6 border border-[#2b4680]/20 space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#91aaeb]">
              Create New Policy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StitchFormField label="Policy Name">
                <StitchInput
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. CIS Linux Baseline"
                />
              </StitchFormField>
              <StitchFormField label="Description">
                <StitchInput
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="What this policy enforces…"
                />
              </StitchFormField>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
                  Initial YAML
                </label>
                <textarea
                  value={formData.yaml_content}
                  onChange={e => setFormData(f => ({ ...f, yaml_content: e.target.value }))}
                  rows={10}
                  className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y bg-[#000000] border border-[#2b4680] text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none"
                  style={{ lineHeight: 1.6 }}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <StitchButton
                variant="primary"
                icon="add"
                onClick={createPolicy}
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Create Policy'}
              </StitchButton>
              <StitchButton
                variant="secondary"
                onClick={() => setTab('policies')}
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
