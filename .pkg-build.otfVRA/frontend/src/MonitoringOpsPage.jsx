import React, { useCallback, useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
} from './components/StitchComponents';

function GrafanaBadge({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <circle cx="12" cy="12" r="9" fill="#F97316" opacity="0.18" />
      <circle cx="12" cy="12" r="4.5" fill="#F97316" />
      <circle cx="8" cy="8" r="2.2" fill="#FBBF24" />
      <circle cx="15.8" cy="7.2" r="1.8" fill="#FB923C" />
    </svg>
  );
}

function PromBadge({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <circle cx="12" cy="12" r="10" fill="#E6522C" opacity="0.16" />
      <path d="M8 16.5h8M9.5 7.8h5l1.8 3.3-3.4 5.4H10.7L7.3 11l2.2-3.2Z" fill="#E6522C" />
      <circle cx="12" cy="11.8" r="2.1" fill="#fff" opacity="0.95" />
    </svg>
  );
}

export default function MonitoringOpsPage({ licenseInfo, hosts = [], API, apiFetch, hasRole }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enforcing, setEnforcing] = useState(false);
  const [booting, setBooting] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [metricsStatus, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const masterIp = window.location.hostname;

  const normalize = useCallback((svcObj = {}) => {
    const blocked = ['zabbix', 'zabbix-server', 'zabbix_proxy', 'zabbix-agent'];
    const out = {};
    for (const [k, v] of Object.entries(svcObj)) {
      const key = k.toLowerCase().replace(/\.service$/, '').replace(/_/g, '-');
      if (blocked.some(b => key.startsWith(b))) continue;
      const norm = key.startsWith('grafana') ? 'grafana' : key.startsWith('prometheus') ? 'prometheus' : key;
      const prev = out[norm] || {};
      out[norm] = {
        name: norm === 'grafana' ? 'Grafana' : norm === 'prometheus' ? 'Prometheus' : (v.name || prev.name || k),
        installed: Boolean(v.installed || v.running || prev.installed),
        running: Boolean(v.running),
        port: v.port || prev.port,
      };
    }
    return out;
  }, []);

  const fetchStatus = useCallback(() => {
    setLoading(true);
    apiFetch(`${API}/api/monitoring/status`)
      .then(r => r.json()).then(d => setData({ ...d, services: normalize(d.services || {}) }))
      .finally(() => setLoading(false));
    apiFetch(`${API}/api/monitoring/health`)
      .then(r => r.json()).then(d => setMetrics(normalize(d.services || {}))).catch(() => {});
  }, [API, apiFetch, normalize]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleEnforce = () => {
    setEnforcing(true);
    setActionMsg('');
    apiFetch(`${API}/api/monitoring/enforce`, { method: 'POST' })
      .then(r => r.json()).then(d => {
        setActionMsg(d.action === 'started' ? 'Monitoring services started.' : 'Monitoring services stopped.');
        fetchStatus();
      })
      .catch(() => setActionMsg('Enforcement failed.'))
      .finally(() => setEnforcing(false));
  };

  const handleBootstrap = () => {
    setBooting(true);
    setActionMsg('Applying configuration...');
    apiFetch(`${API}/api/monitoring/bootstrap`, { method: 'POST' })
      .then(() => { setActionMsg('Monitoring stack refreshed.'); fetchStatus(); })
      .catch(() => setActionMsg('Bootstrap failed.'))
      .finally(() => setBooting(false));
  };

  const licensed = (data?.licensed ?? false) || (
    Array.isArray(licenseInfo?.features) && licenseInfo.features.includes('monitoring') && !licenseInfo?.expired
  );
  const services = data?.services || {};

  const stackItems = ['prometheus', 'grafana'].map(key => {
    const svc = { ...(services[key] || {}), ...(metricsStatus?.[key] || {}) };
    return {
      key,
      name: key === 'grafana' ? 'Grafana' : 'Prometheus',
      running: Boolean(svc.running),
      installed: Boolean(svc.installed),
      port: svc.port || (key === 'grafana' ? 3001 : 9090),
      url: `http://${masterIp}:${svc.port || (key === 'grafana' ? 3001 : 9090)}`,
    };
  });

  if (loading) {
    return (
      <div className="space-y-8">
        <StitchPageHeader
          kicker="Infrastructure Observability"
          title="Monitoring Operations"
          description="Loading monitoring data..."
        />
        <div className="flex items-center justify-center py-12">
          <p className="text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Workspace Distinction Indicator */}
      <div className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30 bg-[#91aaeb]" />
      
      <StitchPageHeader
        kicker="Infrastructure Observability"
        title="Monitoring Operations"
        description={`${hosts.length} endpoints in scope · ${licensed ? 'Licensed' : 'Unlicensed'}`}
        workspace="governance"
      />

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Hosts Monitored"
          value={hosts.length}
          icon="dns"
          color="#7bd0ff"
        />
        {stackItems.map(s => (
          <StitchSummaryCard
            key={s.key}
            label={s.name}
            value={s.running ? 'Running' : s.installed ? 'Stopped' : 'Offline'}
            icon={s.key === 'grafana' ? 'monitoring' : 'analytics'}
            color={s.running ? '#10b981' : s.installed ? '#ffd16f' : '#ee7d77'}
          />
        ))}
        <StitchSummaryCard
          label="License"
          value={licensed ? 'Active' : 'Gated'}
          icon="security"
          color={licensed ? '#10b981' : '#ee7d77'}
        />
      </StitchMetricGrid>

      {actionMsg && (
        <div className={`rounded-xl px-5 py-3 text-sm font-bold ${
          actionMsg.includes('started') || actionMsg.includes('refreshed') ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-error/15 text-error border border-error/30'
        }`}>
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['overview', 'hosts', 'grafana', 'prometheus'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === t
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Infrastructure Health */}
          <div className="lg:col-span-2 bg-surface-container-low p-6 rounded-xl">
            <h2 className="text-lg font-bold text-on-surface mb-6">Infrastructure Health</h2>
            <div className="space-y-4">
              {stackItems.map(s => (
                <div
                  key={s.key}
                  className="bg-surface-container p-4 rounded-lg flex items-center justify-between border border-outline-variant/20"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{s.name}</p>
                    <p className="text-xs text-on-surface-variant">Port {s.port}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StitchBadge
                      variant={s.running ? 'success' : s.installed ? 'warning' : 'error'}
                      size="sm"
                    >
                      {s.running ? 'Running' : s.installed ? 'Stopped' : 'Offline'}
                    </StitchBadge>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:text-primary/80 text-xs font-bold"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack Control */}
          <div className="bg-surface-container-low p-6 rounded-xl">
            <h2 className="text-lg font-bold text-on-surface mb-6">Stack Control</h2>
            <div className="space-y-3">
              <StitchButton
                variant="primary"
                onClick={handleBootstrap}
                disabled={booting}
                icon="play_arrow"
                className="w-full justify-center"
              >
                {booting ? 'Deploying...' : 'Deploy Stack'}
              </StitchButton>
              <StitchButton
                variant="secondary"
                onClick={handleEnforce}
                disabled={enforcing}
                icon="settings"
                className="w-full justify-center"
              >
                {enforcing ? 'Enforcing...' : 'Enforce Config'}
              </StitchButton>
            </div>

            {!licensed && (
              <div className="rounded-xl px-4 py-3 mt-4 bg-error/15 text-error border border-error/30 text-xs font-bold">
                Monitoring requires a higher license tier
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hosts Tab */}
      {activeTab === 'hosts' && (
        <div className="bg-surface-container-low p-6 rounded-xl">
          <h2 className="text-lg font-bold text-on-surface mb-6">Per-Host Monitoring Status</h2>
          {hosts.length === 0 ? (
            <div className="py-12 text-center text-sm text-on-surface-variant">
              No hosts in scope.
            </div>
          ) : (
            <StitchTable
              columns={[
                {
                  key: 'hostname',
                  header: 'Hostname',
                  render: (val, row) => (
                    <span className="font-bold text-sm text-on-surface">{val || row.name}</span>
                  ),
                },
                {
                  key: 'ip',
                  header: 'IP Address',
                  render: (val) => <span className="font-mono text-xs text-on-surface-variant">{val}</span>,
                },
                {
                  key: 'os',
                  header: 'OS',
                  render: (val) => <span className="text-xs text-on-surface-variant">{val || 'Unknown'}</span>,
                },
                {
                  key: 'node_exporter_enabled',
                  header: 'Exporter',
                  render: (val) => (
                    <StitchBadge variant={val ? 'success' : 'warning'} size="sm">
                      {val ? 'Enabled' : 'Disabled'}
                    </StitchBadge>
                  ),
                },
                {
                  key: 'is_monitored',
                  header: 'Monitoring',
                  render: (val, row) => (
                    <StitchBadge
                      variant={(val || row.monitoring_enabled) ? 'success' : 'info'}
                      size="sm"
                    >
                      {(val || row.monitoring_enabled) ? 'Monitored' : 'Basic'}
                    </StitchBadge>
                  ),
                },
                {
                  key: 'last_seen',
                  header: 'Last Seen',
                  render: (val) => (
                    <span className="text-xs text-on-surface-variant">
                      {val ? new Date(val).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </span>
                  ),
                }
              ]}
              data={hosts}
            />
          )}
        </div>
      )}

      {/* Grafana Tab */}
      {activeTab === 'grafana' && (
        <div className="bg-surface-container-low p-6 rounded-xl">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">Grafana Dashboards</p>
            <a
              href={`http://${masterIp}:3001`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-primary hover:text-primary/80"
            >
              http://{masterIp}:3001
            </a>
          </div>
          <iframe
            src={`http://${masterIp}:3001`}
            title="Grafana"
            className="w-full rounded-xl border border-outline-variant/20"
            style={{ height: 560, background: '#0d1117' }}
          />
        </div>
      )}

      {/* Prometheus Tab */}
      {activeTab === 'prometheus' && (
        <div className="bg-surface-container-low p-6 rounded-xl">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">Prometheus Metrics</p>
            <a
              href={`http://${masterIp}:9090`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-primary hover:text-primary/80"
            >
              http://{masterIp}:9090
            </a>
          </div>
          <iframe
            src={`http://${masterIp}:9090`}
            title="Prometheus"
            className="w-full rounded-xl border border-outline-variant/20"
            style={{ height: 560, background: '#0d1117' }}
          />
        </div>
      )}
    </div>
  );
}
