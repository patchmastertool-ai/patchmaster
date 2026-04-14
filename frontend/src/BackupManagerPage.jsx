import React, { useCallback, useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Play, Database, X } from 'lucide-react';

const statusColor = s => ({ success: CH.green, failed: CH.red, running: CH.accent, pending: CH.yellow }[String(s).toLowerCase()] || CH.textSub);
const typeColor   = t => ({ file: CH.green, database: '#a78bfa', vm: '#60a5fa', live: CH.yellow, full_system: CH.red }[t] || CH.textSub);

const BLANK_FORM = {
  name: '', host_id: '', type: 'file', source: '', db_type: '',
  retention: 5, schedule: '', encryption_key: '', storage_type: 'local',
  storage_path: '', storage_config: '', compression: 6, notes: '',
};

export default function BackupManagerPage({ API, apiFetch, useInterval }) {
  const [hosts, setHosts]             = useState([]);
  const [configs, setConfigs]         = useState([]);
  const [logs, setLogs]               = useState([]);
  const [selectedConfig, setSelCfg]   = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [formData, setFormData]       = useState(BLANK_FORM);
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState('');
  const [testMsg, setTestMsg]         = useState('');

  const fetchAll = useCallback(() => {
    apiFetch(`${API}/api/hosts/`).then(r => r.json()).then(setHosts).catch(() => {});
    apiFetch(`${API}/api/backups/configs`).then(r => r.json()).then(setConfigs).catch(() => {});
  }, [API, apiFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createConfig = async () => {
    setLoading(true); setMsg('');
    try {
      let parsedConfig = {};
      if (formData.storage_config) {
        try { parsedConfig = JSON.parse(formData.storage_config); }
        catch { setMsg('Storage config JSON invalid'); setLoading(false); return; }
      }
      const body = {
        host_id: parseInt(formData.host_id), name: formData.name,
        backup_type: formData.type, source_path: formData.source || null,
        db_type: formData.type === 'database' ? (formData.db_type || null) : null,
        retention_count: parseInt(formData.retention), schedule: formData.schedule || null,
        encryption_key: formData.encryption_key || null, storage_type: formData.storage_type,
        storage_path: formData.storage_path || null, storage_config: parsedConfig,
        compression_level: parseInt(formData.compression) || 6,
      };
      ['source_path', 'db_type', 'encryption_key', 'schedule'].forEach(k => { if (!body[k]) delete body[k]; });
      const r = await apiFetch(`${API}/api/backups/configs`, { method: 'POST', body: JSON.stringify(body) });
      if (r.ok) { setMsg('✓ Backup job created!'); setShowForm(false); fetchAll(); }
      else { const d = await r.json(); setMsg(d.detail || 'Failed'); }
    } catch (e) { setMsg(e.message); }
    setLoading(false);
  };

  const testStorage = async () => {
    setTestMsg('');
    try {
      let parsedConfig = {};
      if (formData.storage_config) parsedConfig = JSON.parse(formData.storage_config);
      const r = await apiFetch(`${API}/api/backups/storage/test`, { method: 'POST', body: JSON.stringify({ storage_type: formData.storage_type, storage_path: formData.storage_path || null, storage_config: parsedConfig }) });
      const d = await r.json();
      setTestMsg(d.ok ? `✓ ${d.message}` : `✗ ${d.message}`);
    } catch (e) { setTestMsg(`✗ ${e.message}`); }
  };

  const runBackup = async id => {
    if (!window.confirm('Trigger backup now?')) return;
    try {
      const r = await apiFetch(`${API}/api/backups/${id}/run`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (d?.job?.id) window.dispatchEvent(new CustomEvent('pm-open-ops-queue', { detail: { jobId: d.job.id } }));
        viewLogs(id);
      }
    } catch {}
  };

  const runRestore = async logId => {
    if (!selectedConfig) return;
    if (!window.confirm('Restore this backup?')) return;
    try {
      const r = await apiFetch(`${API}/api/backups/${selectedConfig}/restore`, { method: 'POST', body: JSON.stringify({ backup_log_id: logId }) });
      const d = await r.json();
      alert(d.ok ? 'Restore triggered' : (d.message || 'Restore failed'));
    } catch (e) { alert(e.message); }
  };

  const viewLogs = async id => {
    setSelCfg(id);
    const r = await apiFetch(`${API}/api/backups/${id}/logs`);
    const d = await r.json().catch(() => []);
    setLogs(Array.isArray(d) ? d : []);
  };

  if (useInterval) useInterval(() => { if (selectedConfig) viewLogs(selectedConfig); }, selectedConfig ? 3000 : null);

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };
  const successCount = configs.filter(c => c.last_run_status === 'success').length;
  const failedCount  = configs.filter(c => c.last_run_status === 'failed').length;

  return (
    <CHPage>
      <CHHeader
        kicker="Backup & Disaster Recovery"
        title="Backup Manager"
        subtitle={`${configs.length} jobs · ${successCount} last-run OK · ${failedCount} last-run failed`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={fetchAll}><RefreshCw size={14} /></CHBtn>
            <CHBtn variant="primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={14} /> {showForm ? 'Cancel' : 'New Backup Job'}
            </CHBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Jobs"    value={configs.length}  sub="configured"         accent={CH.accent} />
        <CHStat label="Last Succeeded" value={successCount}   sub="most recent run"   accent={CH.green} />
        <CHStat label="Last Failed"   value={failedCount}    sub="needs attention"    accent={CH.red} />
        <CHStat label="Hosts Covered" value={[...new Set(configs.map(c => c.host_id))].length} sub="distinct" accent={CH.yellow} />
      </div>

      {/* Create form */}
      {showForm && (
        <CHCard className="space-y-4">
          <CHLabel>Create Backup Job</CHLabel>
          {msg && <div className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: msg.startsWith('✓') ? `${CH.green}12` : `${CH.red}12`, color: msg.startsWith('✓') ? CH.green : CH.red }}>{msg}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Job Name</CHLabel>
              <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Daily DB Backup" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Host</CHLabel>
              <select value={formData.host_id} onChange={e => setFormData(f => ({ ...f, host_id: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="">Select Host</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.hostname} ({h.ip})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Backup Type</CHLabel>
              <select value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="file">File / Folder</option>
                <option value="database">Database Dump</option>
                <option value="vm">VM Snapshot</option>
                <option value="live">Live Sync</option>
                <option value="full_system">Full System Image</option>
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <CHLabel>Source Path / Connection String</CHLabel>
              <input value={formData.source} onChange={e => setFormData(f => ({ ...f, source: e.target.value }))}
                placeholder={formData.type === 'database' ? 'postgresql://user:pass@local/db' : '/var/www/html'}
                className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
            </div>
            {formData.type === 'database' && (
              <div className="md:col-span-2 flex flex-col gap-1">
                <CHLabel>Database Type</CHLabel>
                <select value={formData.db_type} onChange={e => setFormData(f => ({ ...f, db_type: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                  <option value="">Auto-detect</option>
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL / MariaDB</option>
                  <option value="mongodb">MongoDB</option>
                  <option value="redis">Redis</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <CHLabel>Cron Schedule (optional)</CHLabel>
              <input value={formData.schedule} onChange={e => setFormData(f => ({ ...f, schedule: e.target.value }))} placeholder="0 2 * * *" className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Retention (copies)</CHLabel>
              <input type="number" value={formData.retention} onChange={e => setFormData(f => ({ ...f, retention: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Storage Type</CHLabel>
              <select value={formData.storage_type} onChange={e => setFormData(f => ({ ...f, storage_type: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="local">Local / Mounted</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Storage Path</CHLabel>
              <input value={formData.storage_path} onChange={e => setFormData(f => ({ ...f, storage_path: e.target.value }))} placeholder="/mnt/backup" className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Compression (0–9)</CHLabel>
              <input type="number" min={0} max={9} value={formData.compression} onChange={e => setFormData(f => ({ ...f, compression: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Encryption Key (optional)</CHLabel>
              <input type="password" value={formData.encryption_key} onChange={e => setFormData(f => ({ ...f, encryption_key: e.target.value }))} placeholder="AES-256 key" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
            </div>
          </div>
          {testMsg && <div className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: testMsg.startsWith('✓') ? `${CH.green}12` : `${CH.red}12`, color: testMsg.startsWith('✓') ? CH.green : CH.red }}>{testMsg}</div>}
          <div className="flex gap-3 flex-wrap">
            <CHBtn variant="primary" onClick={createConfig} disabled={loading}>{loading ? 'Creating…' : 'Create Backup Job'}</CHBtn>
            <CHBtn variant="default" onClick={testStorage}>Test Storage</CHBtn>
            <CHBtn variant="ghost" onClick={() => { setShowForm(false); setFormData(BLANK_FORM); setMsg(''); }}>Cancel</CHBtn>
          </div>
        </CHCard>
      )}

      {/* Config table */}
      <CHCard>
        <CHLabel>Backup Jobs ({configs.length})</CHLabel>
        <CHTable headers={['Job Name', 'Host', 'Type', 'Storage', 'Schedule', 'Retention', 'Last Run', 'Actions']} emptyMessage="No backup jobs configured yet." className="mt-4">
          {configs.map(c => {
            const h = hosts.find(x => x.id === c.host_id);
            return (
              <CHTR key={c.id} style={selectedConfig === c.id ? { background: `${CH.accent}10` } : {}}>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: CH.text }}>{c.name}</td>
                <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{h ? h.hostname : c.host_id}</td>
                <td className="px-4 py-3"><CHBadge color={typeColor(c.backup_type)}>{c.backup_type}</CHBadge></td>
                <td className="px-4 py-3">
                  <p className="text-xs font-bold" style={{ color: CH.textSub }}>{c.storage_type || 'local'}</p>
                  <p className="text-xs font-mono" style={{ color: CH.textSub }}>{c.storage_path || '—'}</p>
                </td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{c.schedule || 'Manual'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{c.retention_count} copies</td>
                <td className="px-4 py-3">
                  {c.last_run_status && <CHBadge color={statusColor(c.last_run_status)}>{c.last_run_status}</CHBadge>}
                  <p className="text-xs mt-1" style={{ color: CH.textSub }}>{c.last_run_at ? new Date(c.last_run_at).toLocaleDateString() : '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <CHBtn variant="primary" onClick={() => runBackup(c.id)}><Play size={12} /></CHBtn>
                    <CHBtn variant="default" onClick={() => viewLogs(c.id)}>Logs</CHBtn>
                  </div>
                </td>
              </CHTR>
            );
          })}
        </CHTable>
      </CHCard>

      {/* Log panel */}
      {selectedConfig && (
        <CHCard>
          <div className="flex items-center justify-between mb-4">
            <CHLabel>Execution Log — {configs.find(c => c.id === selectedConfig)?.name}</CHLabel>
            <CHBtn variant="ghost" onClick={() => setSelCfg(null)}><X size={14} /> Close</CHBtn>
          </div>
          <CHTable headers={['Status', 'Started', 'Completed', 'Size', 'Duration', 'Output', 'Restore']} emptyMessage="No runs yet.">
            {logs.map(l => (
              <CHTR key={l.id}>
                <td className="px-4 py-3"><CHBadge color={statusColor(l.status)}>{l.status}</CHBadge></td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{new Date(l.started_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{l.completed_at ? new Date(l.completed_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{l.file_size_bytes ? `${l.file_size_bytes}B` : '—'}</td>
                <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{l.duration_seconds ? `${Math.round(l.duration_seconds)}s` : '—'}</td>
                <td className="px-4 py-3">
                  {l.output && (
                    <details>
                      <summary className="text-xs cursor-pointer" style={{ color: CH.accent }}>View</summary>
                      <pre className="mt-2 rounded-xl p-3 text-xs font-mono max-h-40 overflow-y-auto"
                        style={{ background: 'rgba(0,0,0,0.5)', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                        {l.output}
                      </pre>
                    </details>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.status === 'success' && <CHBtn variant="default" onClick={() => runRestore(l.id)}>Restore</CHBtn>}
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}
    </CHPage>
  );
}
