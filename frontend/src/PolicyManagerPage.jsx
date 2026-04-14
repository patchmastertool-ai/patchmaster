import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, FileCode, Play, RotateCcw } from 'lucide-react';

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

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  return (
    <CHPage>
      <CHHeader
        kicker="Configuration Policy Engine"
        title="Policy Manager"
        subtitle={`${policies.length} policies · ${taskExecutions.filter(t => t.status === 'pending').length} pending tasks`}
        actions={<CHBtn variant="ghost" onClick={fetchAll}><RefreshCw size={14} /></CHBtn>}
      />

      {notice && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: notice.toLowerCase().includes('fail') || notice.toLowerCase().includes('error') ? `${CH.red}12` : `${CH.green}12`, color: notice.toLowerCase().includes('fail') ? CH.red : CH.green }}>
          {notice}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Policies"       value={policies.length}                                                   accent={CH.accent} />
        <CHStat label="Active"         value={policies.filter(p => p.is_active).length}   sub="enforced"         accent={CH.green} />
        <CHStat label="Task Templates" value={taskTemplates.length}                        sub="registered"       accent="#a78bfa" />
        <CHStat label="Pending Tasks"  value={taskExecutions.filter(t => t.status === 'pending').length} sub="queued" accent={CH.yellow} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ k: 'policies', l: `Policies (${policies.length})` }, { k: 'tasks', l: `Admin Tasks` }, { k: 'create', l: '+ Create Policy' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: tab === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
              color: tab === t.k ? CH.accent : CH.textSub,
              border: `1px solid ${tab === t.k ? CH.accent + '40' : CH.border}`,
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Policies */}
      {tab === 'policies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Policy list */}
          <CHCard>
            <CHLabel>Policy Registry ({policies.length})</CHLabel>
            <div className="mt-4 space-y-2">
              {policies.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No policies yet.</p> : null}
              {policies.map(p => (
                <button key={p.id} onClick={() => setSelPol(String(p.id))}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  style={{ background: String(p.id) === selectedPolicyId ? `${CH.accent}15` : 'rgba(3,29,75,0.3)', border: `1px solid ${String(p.id) === selectedPolicyId ? CH.accent + '40' : CH.border}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{p.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: CH.textSub }}>{p.description || 'No description'} · {p.revision_count || 0} revisions</p>
                    </div>
                    <CHBadge color={p.is_active ? CH.green : CH.textSub}>{p.is_active ? 'Active' : 'Inactive'}</CHBadge>
                  </div>
                </button>
              ))}
            </div>
          </CHCard>

          {/* Selected policy revisions */}
          <CHCard>
            {selectedPolicy ? (
              <>
                <CHLabel>{selectedPolicy.name} — Revisions</CHLabel>
                <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
                  {revisions.map(rev => (
                    <div key={rev.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                      <div>
                        <div className="flex gap-2 items-center">
                          <CHBadge color={CH.accent}>v{rev.revision ?? rev.version}</CHBadge>
                          {rev.status === 'active' && <CHBadge color={CH.green}>Active</CHBadge>}
                        </div>
                        <p className="text-xs mt-1" style={{ color: CH.textSub }}>
                          {rev.created_by || '—'} · {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <CHBtn variant="default" onClick={() => runRevisionAction('activate', String(rev.id))} disabled={loading}>
                          <Play size={10} /> Apply
                        </CHBtn>
                        <CHBtn variant="ghost" onClick={() => runRevisionAction('rollback', String(rev.id))} disabled={loading}>
                          <RotateCcw size={10} />
                        </CHBtn>
                      </div>
                    </div>
                  ))}
                  {revisions.length === 0 && <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No revisions.</p>}
                </div>
                <div className="mt-5 pt-4 space-y-3" style={{ borderTop: `1px solid ${CH.border}` }}>
                  <CHLabel>Edit Draft YAML</CHLabel>
                  <textarea value={draftData.yaml_content}
                    onChange={e => setDraftData(d => ({ ...d, yaml_content: e.target.value }))}
                    rows={8}
                    className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y"
                    style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}`, color: CH.text, lineHeight: 1.6 }}
                  />
                  <input value={draftData.change_summary}
                    onChange={e => setDraftData(d => ({ ...d, change_summary: e.target.value }))}
                    placeholder="Change summary…"
                    className="w-full rounded-lg px-3 py-2.5 text-sm"
                    style={inputStyle}
                  />
                  <CHBtn variant="primary" onClick={saveDraft} disabled={loading}>Save Draft</CHBtn>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileCode size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
                <p className="text-xs uppercase tracking-widest font-bold mt-4" style={{ color: CH.textSub }}>Select a policy to view its revisions</p>
              </div>
            )}
          </CHCard>
        </div>
      )}

      {/* Admin Tasks */}
      {tab === 'tasks' && (
        <div className="space-y-6">
          <CHCard className="space-y-4">
            <CHLabel>Queue Admin Task</CHLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <CHLabel>Task Template</CHLabel>
                <select value={taskForm.template_id} onChange={e => setTaskForm(f => ({ ...f, template_id: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="">-- Select --</option>
                  {taskTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Target Host</CHLabel>
                <select value={taskForm.host_id} onChange={e => setTaskForm(f => ({ ...f, host_id: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="">-- Select --</option>
                  {hosts.map(h => <option key={h.id} value={h.id}>{h.hostname || h.name} ({h.ip})</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <CHLabel>Bundle URL (optional)</CHLabel>
                <input value={taskForm.bundle_url} onChange={e => setTaskForm(f => ({ ...f, bundle_url: e.target.value }))}
                  placeholder="https://…"
                  className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
                />
              </div>
            </div>
            <CHBtn variant="primary" onClick={executeAdminTask} disabled={loading || !taskForm.template_id || !taskForm.host_id}>
              <Play size={14} /> Queue Task
            </CHBtn>
          </CHCard>

          <CHCard>
            <CHLabel>Task Execution History</CHLabel>
            <CHTable headers={['Task', 'Host', 'Status', 'Created']} emptyMessage="No task executions yet." className="mt-4">
              {taskExecutions.map(t => (
                <CHTR key={t.id}>
                  <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{t.template_name || t.task_name || `Task #${t.id}`}</td>
                  <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{t.hostname || `Host #${t.host_id}` || '—'}</td>
                  <td className="px-6 py-4">
                    <CHBadge color={t.status === 'completed' ? CH.green : t.status === 'failed' ? CH.red : CH.yellow}>{t.status}</CHBadge>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>
                    {t.created_at ? new Date(t.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </CHTR>
              ))}
            </CHTable>
          </CHCard>
        </div>
      )}

      {/* Create Policy Form */}
      {tab === 'create' && (
        <CHCard className="space-y-4">
          <CHLabel>Create New Policy</CHLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <CHLabel>Policy Name</CHLabel>
              <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. CIS Linux Baseline"
                className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Description</CHLabel>
              <input value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="What this policy enforces…"
                className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Initial YAML</CHLabel>
              <textarea value={formData.yaml_content}
                onChange={e => setFormData(f => ({ ...f, yaml_content: e.target.value }))}
                rows={10}
                className="w-full rounded-xl px-4 py-3 text-xs font-mono resize-y"
                style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}`, color: CH.text, lineHeight: 1.6 }}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <CHBtn variant="primary" onClick={createPolicy} disabled={loading}>{loading ? 'Creating…' : 'Create Policy'}</CHBtn>
            <CHBtn variant="ghost" onClick={() => setTab('policies')}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}
    </CHPage>
  );
}
