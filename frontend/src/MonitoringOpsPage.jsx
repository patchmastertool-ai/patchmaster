import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CHLoading, CH } from './CH.jsx';
import { Activity, RefreshCw, ExternalLink, Play, Settings } from 'lucide-react';

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
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [enforcing, setEnforcing]   = useState(false);
  const [booting, setBooting]       = useState(false);
  const [actionMsg, setActionMsg]   = useState('');
  const [metricsStatus, setMetrics] = useState(null);
  const [activeTab, setActiveTab]   = useState('overview');
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
    setEnforcing(true); setActionMsg('');
    apiFetch(`${API}/api/monitoring/enforce`, { method: 'POST' })
      .then(r => r.json()).then(d => {
        setActionMsg(d.action === 'started' ? '✓ Monitoring services started.' : '✓ Monitoring services stopped.');
        fetchStatus();
      })
      .catch(() => setActionMsg('✗ Enforcement failed.'))
      .finally(() => setEnforcing(false));
  };

  const handleBootstrap = () => {
    setBooting(true); setActionMsg('Applying configuration…');
    apiFetch(`${API}/api/monitoring/bootstrap`, { method: 'POST' })
      .then(() => { setActionMsg('✓ Monitoring stack refreshed.'); fetchStatus(); })
      .catch(() => setActionMsg('✗ Bootstrap failed.'))
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
      icon: key === 'grafana' ? <GrafanaBadge /> : <PromBadge />,
      running: Boolean(svc.running),
      installed: Boolean(svc.installed),
      port: svc.port || (key === 'grafana' ? 3001 : 9090),
      url: `http://${masterIp}:${svc.port || (key === 'grafana' ? 3001 : 9090)}`,
    };
  });

  const TABS = ['overview', 'hosts', 'grafana', 'prometheus'];

  return (
    <CHPage>
      <CHHeader
        kicker="Infrastructure Observability"
        title="Monitoring Operations"
        subtitle={`${hosts.length} endpoints in scope · ${licensed ? 'Licensed' : 'Unlicensed'}`}
        actions={<CHBtn variant="ghost" onClick={fetchStatus}><RefreshCw size={14} /> Refresh</CHBtn>}
      />

      {/* Service Status KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Hosts Monitored" value={hosts.length} sub="in fleet scope" accent={CH.accent} />
        {stackItems.map(s => (
          <CHStat key={s.key} label={s.name}
            value={s.running ? 'Running' : s.installed ? 'Stopped' : 'Offline'}
            sub={`Port ${s.port}`}
            accent={s.running ? CH.green : s.installed ? CH.yellow : CH.red}
          />
        ))}
        <CHStat label="License"
          value={licensed ? 'Active' : 'Gated'}
          sub={data?.tier_label || licenseInfo?.tier_label || 'Unknown tier'}
          accent={licensed ? CH.green : CH.red}
        />
      </div>

      {/* Tab Nav */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t}
            onClick={() => setActiveTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: activeTab === t ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
              color: activeTab === t ? CH.accent : CH.textSub,
              border: `1px solid ${activeTab === t ? CH.accent + '40' : CH.border}`,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading && <CHLoading message="Loading monitoring data…" />}

      {/* Overview Tab */}
      {!loading && activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-5">
            <div>
              <CHLabel>Service Health</CHLabel>
              <h3 className="text-lg font-bold mt-1" style={{ color: CH.text }}>Stack Components</h3>
            </div>
            <div className="space-y-3">
              {stackItems.map(s => (
                <div key={s.key} className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                  <div className="flex items-center gap-3">
                    {s.icon}
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{s.name}</p>
                      <p className="text-xs" style={{ color: CH.textSub }}>Port {s.port}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CHBadge color={s.running ? CH.green : s.installed ? CH.yellow : CH.red}>
                      {s.running ? 'Running' : s.installed ? 'Stopped' : 'Offline'}
                    </CHBadge>
                    <a href={s.url} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded transition-all"
                      style={{ color: CH.textSub }}
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CHCard>

          <CHCard className="space-y-5">
            <div>
              <CHLabel>Stack Control</CHLabel>
              <h3 className="text-lg font-bold mt-1" style={{ color: CH.text }}>Actions</h3>
            </div>
            <div className="space-y-3">
              <CHBtn variant="primary" onClick={handleBootstrap} disabled={booting} className="w-full justify-center py-3">
                <Play size={14} /> {booting ? 'Deploying…' : 'Deploy Monitoring Stack'}
              </CHBtn>
              <CHBtn variant="default" onClick={handleEnforce} disabled={enforcing} className="w-full justify-center py-3">
                <Settings size={14} /> {enforcing ? 'Enforcing…' : 'Enforce Configuration'}
              </CHBtn>
            </div>
            {actionMsg && (
              <div className="rounded-xl px-4 py-3 text-sm font-bold"
                style={{ background: actionMsg.startsWith('✓') ? `${CH.green}12` : `${CH.red}12`,
                         color: actionMsg.startsWith('✓') ? CH.green : CH.red,
                         border: `1px solid ${actionMsg.startsWith('✓') ? CH.green : CH.red}30` }}>
                {actionMsg}
              </div>
            )}

            {!licensed && (
              <div className="rounded-xl px-4 py-3 mt-3" style={{ background: `${CH.red}10`, border: `1px solid ${CH.red}30` }}>
                <p className="text-xs font-bold" style={{ color: CH.red }}>⚠ Monitoring requires a higher license tier</p>
                <p className="text-xs mt-1" style={{ color: CH.textSub }}>Current: {data?.tier_label || 'Unknown'}</p>
              </div>
            )}
          </CHCard>
        </div>
      )}

      {/* Hosts Tab */}
      {!loading && activeTab === 'hosts' && (
        <CHCard>
          <CHLabel>Per-Host Monitoring Status</CHLabel>
          <div className="mt-4">
            <CHTable headers={['Hostname', 'IP', 'OS', 'Exporter', 'Monitoring', 'Last Seen']}
              emptyMessage="No hosts registered.">
              {hosts.map(host => (
                <CHTR key={host.id}>
                  <td className="px-6 py-4 font-bold text-sm" style={{ color: CH.text }}>{host.hostname || host.name}</td>
                  <td className="px-6 py-4 font-mono text-xs" style={{ color: CH.textSub }}>{host.ip}</td>
                  <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>{host.os || '—'}</td>
                  <td className="px-6 py-4">
                    <CHBadge color={host.node_exporter_enabled ? CH.green : CH.yellow}>
                      {host.node_exporter_enabled ? 'Enabled' : 'Disabled'}
                    </CHBadge>
                  </td>
                  <td className="px-6 py-4">
                    <CHBadge color={host.is_monitored || host.monitoring_enabled ? CH.green : CH.textSub}>
                      {host.is_monitored || host.monitoring_enabled ? 'Monitored' : 'Basic'}
                    </CHBadge>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: CH.textSub }}>
                    {host.last_seen ? new Date(host.last_seen).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </CHTR>
              ))}
            </CHTable>
          </div>
        </CHCard>
      )}

      {/* Grafana Embed Tab */}
      {!loading && activeTab === 'grafana' && (
        <CHCard>
          <div className="flex items-center gap-3 mb-4">
            <GrafanaBadge size={28} />
            <div>
              <CHLabel>Grafana Dashboards</CHLabel>
              <a href={`http://${masterIp}:3001`} target="_blank" rel="noreferrer"
                className="text-sm font-bold hover:underline" style={{ color: CH.accent }}>
                http://{masterIp}:3001 ↗
              </a>
            </div>
          </div>
          <iframe src={`http://${masterIp}:3001`} title="Grafana"
            className="w-full rounded-xl" style={{ height: 560, background: '#0d1117' }} />
        </CHCard>
      )}

      {/* Prometheus Embed Tab */}
      {!loading && activeTab === 'prometheus' && (
        <CHCard>
          <div className="flex items-center gap-3 mb-4">
            <PromBadge size={28} />
            <div>
              <CHLabel>Prometheus Metrics</CHLabel>
              <a href={`http://${masterIp}:9090`} target="_blank" rel="noreferrer"
                className="text-sm font-bold hover:underline" style={{ color: CH.accent }}>
                http://{masterIp}:9090 ↗
              </a>
            </div>
          </div>
          <iframe src={`http://${masterIp}:9090`} title="Prometheus"
            className="w-full rounded-xl" style={{ height: 560, background: '#0d1117' }} />
        </CHCard>
      )}
    </CHPage>
  );
}
