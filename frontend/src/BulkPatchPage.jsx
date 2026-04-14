import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Patch Orchestration — dedicated Linux / Windows channels.
 * Only one channel can be active at a time; host lists are pre-filtered
 * so a Linux job can never accidentally include Windows hosts and vice-versa.
 */

// Debounce hook for search input to improve performance
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const handler = setTimeout(() => {
      if (mountedRef.current) {
        setDebouncedValue(value);
      }
    }, delay);
    return () => {
      mountedRef.current = false;
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function BulkPatchPage({ hosts = [], linuxHosts = [], windowsHosts = [], API, apiFetch, toast }) {
  const [channel, setChannel] = useState('linux'); // 'linux' | 'windows'
  const [jobs, setJobs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState({
    name: '',
    packages: '',
    action: 'server_patch',
    dry_run: false,
    auto_snapshot: true,
    auto_rollback: true,
  });
  const [detail, setDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Hosts available for the active channel
  const channelHosts = channel === 'linux' ? linuxHosts : windowsHosts;

  // Reset selection when channel switches
  const switchChannel = (ch) => {
    setChannel(ch);
    setSelectedIds([]);
  };

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const r = await apiFetch(`${API}/api/bulk-patch/`);
      if (r.ok) setJobs(await r.json());
      else { const d = await r.json().catch(() => ({})); toast(d.detail || 'Failed to load jobs', 'danger'); }
    } catch (e) { toast(e.message || 'Failed to load jobs', 'danger'); }
    setJobsLoading(false);
  }, [API, apiFetch]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const toggleHost = (id) =>
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const toggleAll = () =>
    setSelectedIds(s => s.length === channelHosts.length && channelHosts.length > 0
      ? []
      : channelHosts.map(h => h.id));

  const submit = async () => {
    if (!form.name.trim()) { toast('Enter a job name', 'warning'); return; }
    if (!selectedIds.length) { toast('Select at least one host', 'warning'); return; }
    // Guard: ensure all selected IDs belong to the active channel
    const channelIdSet = new Set(channelHosts.map(h => h.id));
    const safe = selectedIds.filter(id => channelIdSet.has(id));
    if (!safe.length) { toast('No valid hosts for this channel', 'danger'); return; }

    setSubmitting(true);
    const body = {
      name: form.name.trim(),
      host_ids: safe,
      packages: form.packages ? form.packages.split(/[\s,]+/).filter(Boolean) : [],
      action: form.action,
      dry_run: form.dry_run,
      auto_snapshot: form.auto_snapshot,
      auto_rollback: form.auto_rollback,
    };
    try {
      const r = await apiFetch(`${API}/api/bulk-patch/`, { method: 'POST', body: JSON.stringify(body) });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (d?.job?.id) {
          toast(`Bulk patch queued — ${safe.length} host(s)`, 'success');
          window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: d.job.id } }));
        } else {
          toast('Bulk job started', 'success');
        }
        setSelectedIds([]);
        setForm(f => ({ ...f, name: '' }));
        loadJobs();
      } else {
        const d = await r.json().catch(() => ({}));
        toast(d.detail || d.error || 'Failed to start job', 'danger');
      }
    } catch (e) {
      toast(e.message || 'Network error', 'danger');
    }
    setSubmitting(false);
  };

  const loadDetail = async (id) => {
    try {
      const r = await apiFetch(`${API}/api/bulk-patch/${id}`);
      if (r.ok) setDetail(await r.json());
      else toast('Failed to load job details', 'danger');
    } catch (e) { toast(e.message || 'Failed to load job details', 'danger'); }
  };

  const statusColor = s => ({ jobs_created: 'success', completed: 'success', running: 'info', failed: 'danger', pending: 'warning' }[s] || 'info');

  const allSelected = channelHosts.length > 0 && selectedIds.length === channelHosts.length;

  return (
    <div>
      {/* Channel selector */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#64748b' }}>Active channel:</span>
          <button
            className={`btn btn-sm ${channel === 'linux' ? 'btn-primary' : ''}`}
            onClick={() => switchChannel('linux')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Linux <span className="badge badge-info" style={{ marginLeft: 4 }}>{linuxHosts.length}</span>
          </button>
          <button
            className={`btn btn-sm ${channel === 'windows' ? 'btn-primary' : ''}`}
            onClick={() => switchChannel('windows')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Windows <span className="badge badge-info" style={{ marginLeft: 4 }}>{windowsHosts.length}</span>
          </button>
          <span className="ops-subtle" style={{ marginLeft: 'auto' }}>
            {channel === 'linux'
              ? 'Linux channel — supports all Linux/Unix distributions (Ubuntu, Debian, RHEL, Rocky, Alma, Fedora, Arch, Manjaro, openSUSE, Alpine, FreeBSD). Windows hosts are excluded.'
              : 'Windows channel — only Windows hosts are shown. Linux hosts are excluded.'}
          </span>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        {/* Host selector */}
        <div className="card">
          <div className="card-header">
            <h3>
              {channel === 'linux' ? 'Linux Hosts' : 'Windows Hosts'}
              <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                ({selectedIds.length} of {channelHosts.length} selected)
              </span>
            </h3>
            <button className="btn btn-sm" onClick={toggleAll}>
              {allSelected ? 'Clear All' : 'Select All'}
            </button>
          </div>
          {channelHosts.length === 0 ? (
            <p className="ops-subtle" style={{ padding: '16px 0' }}>
              No {channel === 'linux' ? 'Linux' : 'Windows'} hosts registered.
            </p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    <th>Host</th>
                    <th>OS</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {channelHosts.map(h => (
                    <tr
                      key={h.id}
                      className={selectedIds.includes(h.id) ? 'row-selected' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleHost(h.id)}
                    >
                      <td><input type="checkbox" checked={selectedIds.includes(h.id)} onChange={() => {}} /></td>
                      <td><strong>{h.hostname}</strong></td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{h.os || '—'}</td>
                      <td>
                        <span className={`status-dot ${h.is_online ? 'online' : 'offline'}`} />
                        <span style={{ fontSize: 11, marginLeft: 4, color: h.is_online ? '#22c55e' : '#94a3b8' }}>
                          {h.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Job config */}
        <div className="card">
          <h3>Configure Bulk Job</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="input"
              placeholder="Job name — e.g. Monthly Security Patch"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <select className="input" value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
              <option value="server_patch">Full Server Patch</option>
              <option value="upgrade">Upgrade All Packages</option>
              <option value="install">Install Specific Packages</option>
            </select>
            <textarea
              className="input"
              rows={3}
              placeholder="Specific packages (optional, space/comma separated)"
              value={form.packages}
              onChange={e => setForm(f => ({ ...f, packages: e.target.value }))}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['dry_run', 'Dry Run (simulate only, no changes)'],
                ['auto_snapshot', 'Auto Snapshot before patching'],
                ['auto_rollback', 'Auto Rollback on failure'],
              ].map(([k, label]) => (
                <label key={k} className="toggle-option">
                  <input type="checkbox" checked={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="ops-chip">{channel === 'linux' ? 'Linux' : 'Windows'} channel</span>
              <span className="ops-chip">{selectedIds.length} host{selectedIds.length !== 1 ? 's' : ''} selected</span>
              {form.dry_run && <span className="ops-chip" style={{ background: '#fef3c7', color: '#92400e' }}>Dry run</span>}
              {form.auto_snapshot && <span className="ops-chip" style={{ background: '#dcfce7', color: '#166534' }}>Snapshot</span>}
              {form.auto_rollback && <span className="ops-chip" style={{ background: '#dbeafe', color: '#1e40af' }}>Rollback</span>}
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={submit}
              disabled={submitting || !selectedIds.length || !form.name.trim()}
            >
              {submitting
                ? <span className="spinner" />
                : `${form.dry_run ? 'Simulate' : 'Run'} on ${selectedIds.length} Host${selectedIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Job history */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>Bulk Job History</h3>
          <button className="btn btn-sm" onClick={loadJobs} disabled={jobsLoading}>
            {jobsLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Action</th>
                <th>Hosts</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Status</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td><strong>{j.name}</strong></td>
                  <td><code style={{ fontSize: 11 }}>{j.action}</code></td>
                  <td>{j.total_hosts}</td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>{j.success_count ?? '—'}</td>
                  <td style={{ color: j.failed_count > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>{j.failed_count ?? '—'}</td>
                  <td><span className={`badge badge-${statusColor(j.status)}`}>{j.status}</span></td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>
                    {j.started_at ? new Date(j.started_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-info" onClick={() => loadDetail(j.id)}>Details</button>
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No bulk jobs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-card" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <h3>Bulk Job: {detail.name}</h3>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              {[['Total', detail.total_hosts, ''], ['Success', detail.success_count, 'success'], ['Failed', detail.failed_count, 'danger']].map(([l, v, c]) => (
                <div key={l} className={`mini-stat ${c}`}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{v ?? '—'}</span>
                  <span style={{ fontSize: 11 }}>{l}</span>
                </div>
              ))}
              <div className="mini-stat">
                <span style={{ fontSize: 14, fontWeight: 600 }}>{detail.action}</span>
                <span style={{ fontSize: 11 }}>Action</span>
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Host</th><th>Job ID</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(detail.jobs || []).map(j => (
                    <tr key={j.job_id}>
                      <td>{j.hostname}</td>
                      <td>#{j.job_id}</td>
                      <td><span className={`badge badge-${statusColor(j.status)}`}>{j.status}</span></td>
                    </tr>
                  ))}
                  {!(detail.jobs || []).length && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No per-host jobs yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
