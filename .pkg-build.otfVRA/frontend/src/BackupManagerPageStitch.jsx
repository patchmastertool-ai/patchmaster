import React, { useCallback, useEffect, useState } from 'react';
import { AppIcon } from './AppIcons';
import {
  StitchWorkspaceContainer,
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchButton,
  StitchAlert,
  StitchTable,
  StitchBadge,
  StitchEmptyState
} from './components/StitchComponents';

const BLANK_FORM = {
  name: '', host_id: '', type: 'file', source: '', db_type: '',
  retention: 5, schedule: '', encryption_key: '', storage_type: 'local',
  storage_path: '', storage_config: '', compression: 6, notes: '',
};

export default function BackupManagerPageStitch({ API, apiFetch, useInterval }) {
  const [hosts, setHosts] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedConfig, setSelCfg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

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
      if (r.ok) { setMsg('Backup job created successfully'); setShowForm(false); fetchAll(); }
      else { const d = await r.json(); setMsg(d.detail || 'Failed'); }
    } catch (e) { setMsg(e.message); }
    setLoading(false);
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

  const viewLogs = async id => {
    setSelCfg(id);
    const r = await apiFetch(`${API}/api/backups/${id}/logs`);
    const d = await r.json().catch(() => []);
    setLogs(Array.isArray(d) ? d : []);
  };

  if (useInterval) useInterval(() => { if (selectedConfig) viewLogs(selectedConfig); }, selectedConfig ? 3000 : null);

  const successCount = configs.filter(c => c.last_run_status === 'success').length;
  const failedCount = configs.filter(c => c.last_run_status === 'failed').length;

  const configColumns = [
    {
      header: 'Name',
      render: (cfg) => (
        <div>
          <div className="text-sm font-bold text-[#dee5ff]">{cfg.name}</div>
          <div className="text-xs text-[#91aaeb]">{cfg.backup_type || 'file'}</div>
        </div>
      )
    },
    {
      header: 'Host',
      render: (cfg) => {
        const host = hosts.find(h => h.id === cfg.host_id);
        return <span className="text-xs text-[#91aaeb]">{host?.hostname || `Host ${cfg.host_id}`}</span>;
      }
    },
    {
      header: 'Schedule',
      render: (cfg) => <span className="text-xs text-[#91aaeb]">{cfg.schedule || 'Manual'}</span>
    },
    {
      header: 'Last Status',
      render: (cfg) => {
        if (!cfg.last_run_status) return <span className="text-xs text-[#91aaeb]">Never run</span>;
        const variant = cfg.last_run_status === 'success' ? 'success' : cfg.last_run_status === 'failed' ? 'error' : 'info';
        return <StitchBadge variant={variant}>{cfg.last_run_status}</StitchBadge>;
      }
    },
    {
      header: 'Actions',
      align: 'right',
      render: (cfg) => (
        <div className="flex gap-2 justify-end">
          <StitchButton variant="secondary" size="sm" onClick={() => viewLogs(cfg.id)}>
            Logs
          </StitchButton>
          <StitchButton variant="primary" size="sm" icon="play_arrow" onClick={() => runBackup(cfg.id)}>
            Run
          </StitchButton>
        </div>
      )
    }
  ];

  const logColumns = [
    {
      header: 'Timestamp',
      render: (log) => (
        <span className="text-xs font-mono text-[#91aaeb]">
          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
        </span>
      )
    },
    {
      header: 'Status',
      render: (log) => {
        const variant = log.status === 'success' ? 'success' : log.status === 'failed' ? 'error' : 'info';
        return <StitchBadge variant={variant}>{log.status}</StitchBadge>;
      }
    },
    {
      header: 'Size',
      render: (log) => <span className="text-xs text-[#91aaeb]">{log.size_bytes ? `${(log.size_bytes / 1024 / 1024).toFixed(1)} MB` : '-'}</span>
    },
    {
      header: 'Duration',
      render: (log) => <span className="text-xs text-[#91aaeb]">{log.duration_seconds ? `${log.duration_seconds}s` : '-'}</span>
    },
    {
      header: 'Message',
      render: (log) => <span className="text-xs text-[#91aaeb] truncate max-w-xs">{log.message || '-'}</span>
    }
  ];

  return (
    <StitchWorkspaceContainer workspace="infrastructure" className="min-h-screen p-8">
      <StitchPageHeader
        workspace="infrastructure"
        title="Backup Management"
        description="Disaster recovery and backup job configuration"
        actions={
          <StitchButton variant="primary" icon="add" onClick={() => setShowForm(true)}>
            Create Backup Job
          </StitchButton>
        }
      />

      {msg && (
        <StitchAlert
          variant={msg.toLowerCase().includes('success') ? 'success' : 'error'}
          message={msg}
          onDismiss={() => setMsg('')}
        />
      )}

      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          workspace="infrastructure"
          label="Total Configs"
          value={configs.length}
          icon="storage"
          subtitle="backup jobs"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Successful"
          value={successCount}
          icon="check_circle"
          subtitle="last run"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Failed"
          value={failedCount}
          icon="error"
          subtitle="requires attention"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Hosts"
          value={hosts.length}
          icon="dns"
          subtitle="available"
        />
      </StitchMetricGrid>

      {/* Backup Configurations */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Backup Configurations</h3>
        <StitchTable
          columns={configColumns}
          data={configs}
          loading={loading}
          emptyState={
            <StitchEmptyState
              icon="storage"
              title="No Backup Jobs Configured"
              description="Create a backup job to start protecting your data."
              actionLabel="Create Backup Job"
              onAction={() => setShowForm(true)}
            />
          }
        />
      </div>

      {/* Backup Logs */}
      {selectedConfig && logs.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#dee5ff]">Backup Logs: Config {selectedConfig}</h3>
            <StitchButton variant="ghost" size="sm" onClick={() => { setSelCfg(null); setLogs([]); }}>
              Close
            </StitchButton>
          </div>
          <StitchTable
            columns={logColumns}
            data={logs}
            emptyState={
              <div className="text-center py-8 text-[#91aaeb]">
                No logs available for this backup configuration
              </div>
            }
          />
        </div>
      )}
    </StitchWorkspaceContainer>
  );
}
