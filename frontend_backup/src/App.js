import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API, useInterval, getToken, setToken, clearToken, getLicenseCache, setLicenseCache, getUser, setUser, authHeaders, apiFetch, hasRole, hasPerm, hasFeature, sanitizeDisplayText, websocketUrl } from './appRuntime';
import { ToastContext, useToast, useToastCtx, ToastContainer } from './ToastSystem';
import { BellIcon, AppIcon, CodeIcon } from './AppIcons';
import './App.css';

const TestingPage = React.lazy(() => import('./TestingPage'));
const AnalyticsOpsPage = React.lazy(() => import('./AnalyticsOpsPage'));
const DashboardOpsPage = React.lazy(() => import('./DashboardOpsPage'));
const HostsOpsPage = React.lazy(() => import('./HostsOpsPage'));
const PatchManagerOpsPage = React.lazy(() => import('./PatchManagerOpsPage'));
const CVEOpsPage = React.lazy(() => import('./CVEOpsPage'));
const ReportsOpsPage = React.lazy(() => import('./ReportsOpsPage'));
const MonitoringOpsPage = React.lazy(() => import('./MonitoringOpsPage'));
const OnboardingOpsPage = React.lazy(() => import('./OnboardingOpsPage'));
const SettingsOpsPage = React.lazy(() => import('./SettingsOpsPage'));
const LocalRepoOpsPage = React.lazy(() => import('./LocalRepoOpsPage'));
const MirrorRepoOpsPage = React.lazy(() => import('./MirrorRepoOpsPage'));
const UsersOpsPage = React.lazy(() => import('./UsersOpsPage'));
const LicenseOpsPage = React.lazy(() => import('./LicenseOpsPage'));
const CICDOpsPage = React.lazy(() => import('./CICDOpsPage'));
const BackupManagerPageView = React.lazy(() => import('./BackupManagerPage'));
const ProvisioningPageView = React.lazy(() => import('./ProvisioningPage'));
const NetworkBootPageView = React.lazy(() => import('./NetworkBootPage'));
const PolicyManagerPageView = React.lazy(() => import('./PolicyManagerPage'));
const SLAOpsPage = React.lazy(() => import('./SLAOpsPage'));
const RemediationPageView = React.lazy(() => import('./RemediationPage'));
const MaintenanceWindowsPageView = React.lazy(() => import('./MaintenanceWindowsPage'));
const PatchHooksPageView = React.lazy(() => import('./PatchHooksPage'));
const BulkPatchPageView = React.lazy(() => import('./BulkPatchPage'));
const HostTimelinePageView = React.lazy(() => import('./HostTimelinePage'));
const LiveCommandPageView = React.lazy(() => import('./LiveCommandPage'));
const AgentUpdatePageView = React.lazy(() => import('./AgentUpdatePage'));
const SoftwarePageView = React.lazy(() => import('./SoftwarePage'));
const JobsPageView = React.lazy(() => import('./JobsPage'));
const OpsQueuePageView = React.lazy(() => import('./OpsQueuePage'));
const PluginIntegrationsPageView = React.lazy(() => import('./PluginIntegrationsPage'));
const RingRolloutPageView = React.lazy(() => import('./RingRolloutPage'));
const RestoreDrillPageView = React.lazy(() => import('./RestoreDrillPage'));
const AlertsCenterPageView = React.lazy(() => import('./AlertsCenterPage'));
const AuditPageView = React.lazy(() => import('./AuditPage'));
const NotificationsPageView = React.lazy(() => import('./NotificationsPage'));

/* Global Search */
function GlobalSearch({ setPage }) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef(null);
  const shortcutLabel = 'Ctrl+K';

  React.useEffect(() => {
    if (query.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiFetch(`${API}/api/search/?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setResults(d.results);
      } catch {
        setResults({ hosts: [], cves: [], jobs: [] });
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Ctrl+K shortcut
  React.useEffect(() => {
    const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); ref.current?.querySelector('input')?.focus(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigate = (type) => { setPage(type === 'host' ? 'hosts' : type === 'cve' ? 'cve' : 'jobs'); setQuery(''); setResults(null); setOpen(false); };

  return (
    <div ref={ref} className="top-search">
      <div className="top-search-shell">
        <span className="top-search-icon" aria-hidden="true"><AppIcon name="search" size={17} /></span>
        <input
          className="input top-search-input"
          placeholder="Search hosts, CVEs, jobs... (Ctrl+K)"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
        />
        <span className="top-search-shortcut" aria-hidden="true">{shortcutLabel}</span>
      </div>
      {open && results && (
        <div className="top-search-results">
          {loading && <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>Searching...</div>}
          {!loading && results.hosts?.length === 0 && results.cves?.length === 0 && results.jobs?.length === 0 && (
            <div style={{ padding: 16, color: '#64748b', textAlign: 'center', fontSize: 13 }}>No results for "{query}"</div>
          )}
          {results.hosts?.length > 0 && (
            <div>
              <div className="top-search-group">Hosts</div>
              {results.hosts.map(h => (
                <div key={h.id} className="top-search-item" onClick={() => navigate('host')}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: h.is_online ? '#22c55e' : '#ef4444', boxShadow: `0 0 0 3px ${h.is_online ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)'}`, flex: '0 0 auto', marginTop: 4 }} />
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{h.hostname}</div><div style={{ fontSize: 11, color: '#64748b' }}>{h.ip} - {h.os}</div></div>
                </div>
              ))}
            </div>
          )}
          {results.cves?.length > 0 && (
            <div>
              <div className="top-search-group">CVEs</div>
              {results.cves.map(c => (
                <div key={c.id} className="top-search-item" onClick={() => navigate('cve')}>
                  <span className={`badge badge-${c.severity === 'critical' ? 'danger' : c.severity === 'high' ? 'warning' : 'info'}`} style={{ fontSize: 10 }}>{c.severity}</span>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{c.id}</div><div style={{ fontSize: 11, color: '#64748b' }}>{c.description}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
/* --- Notification Center --- */
function NotificationCenter({ setPage, toast }) {
  const [notes, setNotes] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const normalizeNotes = (payload) => {
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    return items.map((n, idx) => ({
      id: n?.id ?? `note-${idx}`,
      type: typeof n?.type === 'string' ? n.type : '',
      title: typeof n?.title === 'string' && n.title.trim() ? n.title : 'Notification',
      message: typeof n?.message === 'string' ? n.message : '',
      link: typeof n?.link === 'string' ? n.link : '',
      is_read: Boolean(n?.is_read),
      created_at: typeof n?.created_at === 'string' ? n.created_at : '',
    }));
  };

  const navigateNotification = (link) => {
    const raw = (link || '').trim();
    if (!raw) return;
    const cleaned = raw.replace(/^#\/?/, '').replace(/^\/+/, '');
    const key = cleaned.split(/[/?#]/)[0];
    const routeMap = {
      dashboard: 'dashboard',
      hosts: 'hosts',
      host: 'hosts',
      cve: 'cve',
      cves: 'cve',
      jobs: 'jobs',
      job: 'jobs',
      notifications: 'notifications',
      reports: 'reports',
      license: 'license',
      monitoring: 'monitoring',
      settings: 'settings',
      onboarding: 'onboarding',
      backups: 'backups',
      software: 'software',
      policies: 'policies',
      users: 'users',
      testing: 'testing',
    };
    if (setPage && routeMap[key]) {
      setPage(routeMap[key]);
      return;
    }
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      window.open(raw, '_blank', 'noopener,noreferrer');
    }
  };

  const fetchNotes = () => {
    apiFetch(`${API}/api/notifications/me`).then(r=>r.json()).then(d=>{
      const normalized = normalizeNotes(d);
      setNotes(normalized);
      setUnreadCount(normalized.filter(n => !n.is_read).length);
    }).catch(()=>{
      setNotes([]);
      setUnreadCount(0);
    });
  };

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 30000);
    let ws;
    const token = getToken();
    if (token) {
      try {
        ws = new WebSocket(websocketUrl('/api/notifications/ws', token));
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type !== 'snapshot') return;
            const normalized = normalizeNotes(payload);
            setNotes(normalized);
            setUnreadCount(
              typeof payload.unread_count === 'number'
                ? payload.unread_count
                : normalized.filter(n => !n.is_read).length
            );
          } catch {
            // Keep polling fallback if a push payload is malformed.
          }
        };
      } catch {
        // Polling remains the fallback path.
      }
    }
    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  const markRead = async (id, link) => {
    try {
      await apiFetch(`${API}/api/notifications/${id}/read`, {method:'POST'});
    } catch (e) {
      toast?.(`Could not mark notification as read: ${e.message}`, 'warning');
    }
    fetchNotes();
    setIsOpen(false);
    navigateNotification(link);
  };

  const markAllRead = async () => {
    try {
      await apiFetch(`${API}/api/notifications/read-all`, {method:'POST'});
      fetchNotes();
    } catch (e) {
      toast?.(`Could not mark notifications as read: ${e.message}`, 'warning');
    }
  };

  return (
    <div className="notification-center">
      <div className="notification-trigger" onClick={()=>setIsOpen(!isOpen)}>
        <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#0f172a'}}><BellIcon size={18} /></span>
        {unreadCount > 0 && (
          <span style={{
            position:'absolute', top:-5, right:-8, background:'red', color:'white',
            borderRadius:'50%', padding:'2px 6px', fontSize:10, fontWeight:'bold'
          }}>{unreadCount}</span>
        )}
      </div>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-header">
            <h4 style={{margin:0, fontSize:14}}>Notifications</h4>
            <button className="btn btn-sm btn-link" style={{fontSize:11, padding:0}} onClick={(e)=>{ e.stopPropagation(); markAllRead(); }}>Mark all read</button>
          </div>
          {notes.length === 0 ? <div className="notification-empty">No notifications</div> : (
            <div>
              {notes.map(n => {
                const timestamp = n.created_at ? new Date(n.created_at) : null;
                const timeLabel = timestamp && !Number.isNaN(timestamp.getTime())
                  ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--';
                return (
                  <div key={n.id} className={`notification-item ${n.is_read ? 'is-read' : 'is-unread'}`} onClick={()=>markRead(n.id, n.link)}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                      <strong style={{fontSize:13, color: n.type.includes('fail') ? '#ef4444' : n.type.includes('success') ? '#16a34a' : 'inherit'}}>
                        {n.title}
                      </strong>
                      <span className="notification-time">{timeLabel}</span>
                    </div>
                    <p className="notification-message">{(n.message || 'No details available.').replace(/\n/g, ' ')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const { toasts, add: toast } = useToast();
  const [token, setTokenState] = useState(getToken());
  const [user, setUserState] = useState(getUser());
  const [page, setPage] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [jobs, setJobs] = useState([]);
  // Initialize from localStorage cache so nav renders instantly on page load
  const [licenseInfo, setLicenseInfo] = useState(() => getLicenseCache());
  const [licenseLoaded, setLicenseLoaded] = useState(false); // true after first fetch
  const [showLicensePopup, setShowLicensePopup] = useState(false);
  const [opsQueueFocusJobId, setOpsQueueFocusJobId] = useState('');
  const [opsQueueFocusSeq, setOpsQueueFocusSeq] = useState(0);

  const handleLogin = (t, u) => {
    setToken(t); setUser(u); setTokenState(t); setUserState(u);
    // Fetch license immediately after login so features appear right away
    fetch(`${API}/api/license/status`).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || typeof d.valid !== 'boolean') throw new Error('license status unavailable');
      setLicenseCache(d); setLicenseInfo(d); setLicenseLoaded(true);
      if (!d.valid || !d.activated || d.expired) setPage('license');
    }).catch(() => {
      setLicenseLoaded(true);
      const cached = getLicenseCache();
      if (cached && cached.valid && cached.activated && !cached.expired) {
        setLicenseInfo(cached);
        return;
      }
      setPage('license');
    });
  };
  const handleLogout = () => { clearToken(); setTokenState(null); setUserState(null); setLicenseLoaded(false); localStorage.removeItem('pm_license'); };

  const fetchAll = useCallback(() => {
    if (!getToken()) return;
    fetch(`${API}/api/health`).then(r => r.json()).then(setHealth).catch(() => setHealth(null));
    fetch(`${API}/api/license/status`).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || typeof d.valid !== 'boolean') throw new Error('license status unavailable');
      setLicenseCache(d);
      setLicenseInfo(d);
      setLicenseLoaded(true);
      if (!d.valid || !d.activated || d.expired) {
        setHosts([]);
        setJobs([]);
        setPage('license');
        return;
      }
      apiFetch(`${API}/api/hosts/`).then(r => r.json()).then(d => { if (Array.isArray(d)) setHosts(d); }).catch(() => {});
      apiFetch(`${API}/api/jobs/`).then(r => r.json()).then(d => { if (Array.isArray(d)) setJobs(d); }).catch(() => {});
    }).catch(() => {
      setLicenseLoaded(true);
      const cached = getLicenseCache();
      if (cached && cached.valid && cached.activated && !cached.expired) {
        setLicenseInfo(cached);
        return;
      }
      setPage('license');
    });
    // Re-fetch user so permissions reflect any license changes without re-login
    apiFetch(`${API}/api/auth/me`).then(r => r.ok ? r.json() : null).then(u => { if (u) { setUser(u); setUserState(u); } }).catch(() => {});
  }, []);

  useEffect(() => { if (token) { fetchAll(); const t = setInterval(fetchAll, 15000); return () => clearInterval(t); } }, [token, fetchAll]);
  useEffect(() => {
    const handler = (event) => {
      const jobId = String(event?.detail?.jobId || '').trim();
      if (!jobId) return;
      setOpsQueueFocusJobId(jobId);
      setOpsQueueFocusSeq((v) => v + 1);
      setPage('ops-queue');
    };
    window.addEventListener('pm-open-ops-queue', handler);
    return () => window.removeEventListener('pm-open-ops-queue', handler);
  }, []);

  // Auto-show license popup only after we've confirmed license status from server
  // (prevents false popup flash on page load before fetch completes)
  useEffect(() => {
    if (licenseLoaded && licenseInfo && (!licenseInfo.valid || !licenseInfo.activated || licenseInfo.expired)) {
      setShowLicensePopup(true);
      setPage('license');
    } else if (licenseLoaded) {
      setShowLicensePopup(false);
    }
  }, [licenseInfo, licenseLoaded]);

  if (!token) return <LoginPage onLogin={handleLogin} />;

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'analytics', label: 'Analytics', icon: 'analytics' },
    ...(hasFeature('compliance', licenseInfo) ? [{ key: 'compliance', label: 'Compliance', icon: 'shield' }] : []),
    ...(hasFeature('hosts', licenseInfo) ? [{ key: 'hosts', label: 'Hosts', icon: 'server' }] : []),
    ...(hasFeature('groups', licenseInfo) ? [{ key: 'groups', label: 'Groups & Tags', icon: 'layers' }] : []),
    ...((hasFeature('patches', licenseInfo) || hasFeature('offline', licenseInfo) || hasFeature('local-repo', licenseInfo))
      ? [{ key: 'patch-fabric', label: 'Patch Management', icon: 'layers' }]
      : []),
    ...(hasFeature('compare', licenseInfo) ? [{ key: 'compare', label: 'Compare Packages', icon: 'compare' }] : []),
    ...(hasFeature('schedules', licenseInfo) ? [{ key: 'schedules', label: 'Schedules', icon: 'clock' }] : []),
    ...(hasFeature('cve', licenseInfo) ? [{ key: 'cve', label: 'CVE Tracker', icon: 'bug' }] : []),
    ...(hasFeature('jobs', licenseInfo) ? [{ key: 'jobs', label: 'Job History', icon: 'timeline' }] : []),
    ...(hasFeature('jobs', licenseInfo) ? [{ key: 'ops-queue', label: 'Operations Queue', icon: 'timeline' }] : []),
    ...(hasFeature('jobs', licenseInfo) ? [{ key: 'plugins', label: 'Plugin Integrations', icon: 'pipeline' }] : []),
    ...(hasFeature('audit', licenseInfo) ? [{ key: 'audit', label: 'Audit Trail', icon: 'list' }] : []),
    ...(hasFeature('notifications', licenseInfo) ? [{ key: 'notifications', label: 'Notifications', icon: 'bell' }] : []),
    ...(hasFeature('users', licenseInfo) ? [{ key: 'users', label: 'User Management', icon: 'users' }] : []),
    { key: 'license', label: 'License', icon: 'key' },
    ...((hasFeature('cicd', licenseInfo) || hasFeature('git', licenseInfo) || hasPerm('testing')) ? [{ key: 'cicd', label: 'CI/CD Pipelines', icon: 'pipeline' }] : []),
    ...(hasFeature('software', licenseInfo) ? [{ key: 'software', label: 'Software Manager', icon: 'box' }] : []),
    ...(hasFeature('backups', licenseInfo) ? [{ key: 'backups', label: 'Backup & Recovery', icon: 'database' }] : []),
    ...(hasFeature('backups', licenseInfo) ? [{ key: 'provisioning', label: 'Provisioning Center', icon: 'rocket' }] : []),
    ...(hasFeature('onboarding', licenseInfo) ? [{ key: 'network-boot', label: 'Network Boot', icon: 'server' }] : []),
    ...(hasFeature('backups', licenseInfo) ? [{ key: 'restore-drills', label: 'Restore Drills', icon: 'clock' }] : []),
    ...(hasFeature('policies', licenseInfo) ? [{ key: 'policies', label: 'Config Policies', icon: 'sliders' }] : []),
    ...(hasFeature('policies', licenseInfo) ? [{ key: 'ring-rollout', label: 'Ring Rollout', icon: 'clock' }] : []),
    ...(hasFeature('reports', licenseInfo) ? [{ key: 'reports', label: 'Reports', icon: 'reports' }] : []),
    ...(hasFeature('monitoring', licenseInfo) ? [{ key: 'monitoring', label: 'Monitoring Tools', icon: 'monitor' }] : []),
    ...(hasFeature('monitoring', licenseInfo) ? [{ key: 'alerts-center', label: 'Alerts Center', icon: 'bell' }] : []),
    ...(hasPerm('testing') ? [{ key: 'testing', label: 'Testing Center', icon: 'monitor' }] : []),
    ...(hasFeature('onboarding', licenseInfo) ? [{ key: 'onboarding', label: 'Onboarding', icon: 'users' }] : []),
    ...(hasFeature('settings', licenseInfo) ? [{ key: 'settings', label: 'Settings', icon: 'settings' }] : []),
    { key: 'sla', label: 'SLA Tracking', icon: 'clock' },
    { key: 'remediation', label: 'Remediation', icon: 'shield' },
    { key: 'maintenance', label: 'Maintenance Windows', icon: 'calendar' },
    { key: 'host-timeline', label: 'Host Timeline', icon: 'timeline' },
    { key: 'live-cmd', label: 'Live Commands', icon: 'terminal' },
    { key: 'agent-updates', label: 'Agent Updates', icon: 'refresh' },
  ];
  const effectivePage = (page === 'patch-hooks' || page === 'bulk-patch' || page === 'patch-orchestration') ? 'patch-fabric' : page;
  const currentPageMeta = navItems.find(n => n.key === effectivePage) || navItems[0];

  return (
    <ToastContext.Provider value={toast}>
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>
            <span className="brand-badge live-logo">
              <img src="/logo-pm.svg" alt="PatchMaster" className="brand-logo" />
            </span>
            PatchMaster
          </h2>
          <span className="sidebar-subtitle">by YVGROUP - Enterprise Patch Management</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(n => (
            <button key={n.key} className={`nav-btn ${page === n.key ? 'active' : ''}`} onClick={() => setPage(n.key)}>
              <span className="nav-icon" aria-hidden="true"><AppIcon name={n.icon} size={17} /></span> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          {/* License status indicator */}
          {licenseInfo && (
            <div style={{marginBottom:8,padding:'6px 10px',borderRadius:6,fontSize:11,cursor:'pointer',
              background: !licenseInfo.valid ? '#7f1d1d' : !licenseInfo.activated ? '#374151' : licenseInfo.expired ? '#7f1d1d' : licenseInfo.days_remaining<=30 ? '#78350f' : '#064e3b',
              color: !licenseInfo.valid ? '#fecaca' : !licenseInfo.activated ? '#9ca3af' : licenseInfo.expired ? '#fca5a5' : licenseInfo.days_remaining<=30 ? '#fcd34d' : '#6ee7b7',
              border: `1px solid ${!licenseInfo.valid ? '#dc2626' : !licenseInfo.activated ? '#4b5563' : licenseInfo.expired ? '#dc2626' : licenseInfo.days_remaining<=30 ? '#f59e0b' : '#10b981'}`
            }} onClick={()=>setPage('license')}>
              <div style={{fontWeight:600}}>
                {!licenseInfo.valid ? 'License Invalid' : !licenseInfo.activated ? 'No License' : licenseInfo.expired ? 'License Expired' : (licenseInfo.tier_label || 'Licensed')}
              </div>
              {licenseInfo.valid && licenseInfo.activated && !licenseInfo.expired && (
                <div style={{marginTop:2,opacity:0.85}}>{licenseInfo.days_remaining} days remaining</div>
              )}
              {licenseInfo.valid && licenseInfo.activated && licenseInfo.expired && (
                <div style={{marginTop:2,opacity:0.85}}>Expired - click to renew</div>
              )}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8,width:'100%'}}>
            <span className={`status-dot ${health ? 'online' : 'offline'}`}></span>
            <span style={{flex:1}}>{user?.username} <span className="badge badge-info" style={{fontSize:9}}>{user?.role}</span></span>
            <button className="btn btn-sm btn-danger" onClick={handleLogout} style={{padding:'3px 8px',fontSize:11}}>Logout</button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        {/* License expired/not-activated popup modal */}
        {showLicensePopup && <LicensePopup licenseInfo={licenseInfo} onSuccess={() => { setShowLicensePopup(false); fetchAll(); }} />}
        {/* Expiring soon warning banner */}
        {licenseInfo && licenseInfo.valid && !licenseInfo.expired && licenseInfo.days_remaining <= 30 && (
          <div style={{background:'#ffc107',color:'#000',padding:'8px 20px',textAlign:'center',fontWeight:600,cursor:'pointer'}} onClick={()=>setPage('license')}>
            License expires in {licenseInfo.days_remaining} day{licenseInfo.days_remaining!==1?'s':''} ({licenseInfo.expires_at}). Click here to manage.
          </div>
        )}
        <header className="top-bar">
          <h1 className="page-title"><span className="page-title-badge" aria-hidden="true"><AppIcon name={currentPageMeta.icon} size={18} /></span>{currentPageMeta.label}</h1>
          <div className="top-bar-search">
            <GlobalSearch setPage={setPage} />
          </div>
          <div className="top-bar-actions" style={{display:'flex',alignItems:'center',gap:10,justifyContent:'flex-end'}}>
            <NotificationCenter setPage={setPage} toast={toast} />
            <button className="btn btn-sm" onClick={fetchAll} title="Refresh data">Refresh</button>
          </div>
        </header>
        <div className="content-area">
          <PageErrorBoundary title="Page render error">
          <React.Suspense fallback={<div className="card" style={{ maxWidth: 520 }}>Loading workspace...</div>}>
            {page === 'dashboard' && <DashboardPage health={health} hosts={hosts} jobs={jobs} setPage={setPage} />}
            {page === 'analytics' && <AnalyticsDashboardPage />}
            {page === 'compliance' && hasPerm('compliance') && <CompliancePage />}
            {page === 'hosts' && hasPerm('hosts') && <HostsPage hosts={hosts} setHosts={setHosts} />}
            {page === 'groups' && hasPerm('groups') && <GroupsPage hosts={hosts} />}
            {page === 'patches' && hasPerm('patches') && <PatchManagerPage hosts={hosts} />}
            {page === 'patch-fabric' && (hasPerm('patches') || hasPerm('offline') || hasPerm('local-repo')) && <PatchFabricPage hosts={hosts} jobs={jobs} toast={toast} />}
            {page === 'wsus' && hasPerm('wsus') && <WsusPage hosts={hosts} />}
            {page === 'snapshots' && hasPerm('snapshots') && <SnapshotsPage hosts={hosts} />}
            {page === 'compare' && hasPerm('compare') && <ComparePackagesPage hosts={hosts} />}
            {page === 'offline' && hasPerm('offline') && <OfflinePatchPage hosts={hosts} />}
            {page === 'local-repo' && hasPerm('local-repo') && <LocalRepoPage />}
            {page === 'mirror-repos' && hasPerm('local-repo') && <MirrorReposPage />}
            {page === 'schedules' && hasPerm('schedules') && <SchedulesPage />}
            {page === 'cve' && hasPerm('cve') && <CVEPage />}
            {page === 'jobs' && hasPerm('jobs') && <JobsPage jobs={jobs} setJobs={setJobs} />}
            {page === 'ops-queue' && hasPerm('jobs') && <OpsQueuePage focusJobId={opsQueueFocusJobId} focusJobSeq={opsQueueFocusSeq} />}
            {page === 'plugins' && hasPerm('jobs') && <PluginIntegrationsPage />}
            {page === 'audit' && hasPerm('audit') && <AuditPage />}
            {page === 'notifications' && hasPerm('notifications') && <NotificationsPage />}
            {page === 'users' && hasPerm('users') && <UsersPage />}
            {page === 'license' && <LicensePage licenseInfo={licenseInfo} onRefresh={fetchAll} />}
            {page === 'cicd' && (hasPerm('cicd') || hasPerm('git') || hasPerm('testing')) && <CICDPage />}
            {page === 'software' && hasPerm('software') && <SoftwarePage hosts={hosts} />}
            {page === 'backups' && hasPerm('backups') && <BackupManagerPage />}
            {page === 'provisioning' && hasPerm('backups') && <ProvisioningPage hosts={hosts} />}
            {page === 'network-boot' && hasPerm('onboarding') && <NetworkBootPage hosts={hosts} />}
            {page === 'restore-drills' && hasPerm('backups') && <RestoreDrillPage />}
            {page === 'policies' && hasPerm('policies') && <PolicyManagerPage />}
            {page === 'ring-rollout' && hasPerm('policies') && <RingRolloutPage />}
            {page === 'reports' && hasPerm('reports') && <ReportsPage />}
            {page === 'monitoring' && (hasPerm('monitoring') || hasFeature('monitoring', licenseInfo)) && <MonitoringToolsPage licenseInfo={licenseInfo} hosts={hosts} />}
            {page === 'alerts-center' && (hasPerm('monitoring') || hasFeature('monitoring', licenseInfo)) && <AlertsCenterPage />}
            {page === 'testing' && hasPerm('testing') && <TestingPage apiBase={API} apiFetch={apiFetch} toast={toast} />}
            {page === 'onboarding' && hasPerm('onboarding') && <OnboardingPage />}
            {page === 'settings' && hasPerm('settings') && <SettingsPage health={health} hosts={hosts} jobs={jobs} />}
            {page === 'sla' && <SLAPage />}
            {page === 'remediation' && <RemediationPage />}
            {page === 'maintenance' && <MaintenanceWindowsPage />}
            {(page === 'patch-orchestration' || page === 'patch-hooks' || page === 'bulk-patch') && <PatchOrchestrationPage hosts={hosts} />}
            {page === 'host-timeline' && <HostTimelinePage hosts={hosts} />}
            {page === 'live-cmd' && hasRole('admin','operator') && <LiveCommandPage hosts={hosts} />}
            {page === 'agent-updates' && <AgentUpdatePage hosts={hosts} />}
          </React.Suspense>
          </PageErrorBoundary>
        </div>
      </main>
      <ToastContainer toasts={toasts} />
    </div>
    </ToastContext.Provider>
  );
}

/* --- AD / LDAP Login Button --- */
function LdapLoginButton({ onLogin }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/api/auth/ldap/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) {
        // If LDAP not configured, show a clear message instead of a generic error
        const msg = d?.detail || d?.error?.message || 'AD login failed';
        setError(msg);
        setLoading(false);
        return;
      }
      let me = d.user;
      try {
        const meRes = await fetch(`${API}/api/auth/me`, { headers: { 'Authorization': `Bearer ${d.access_token}` } });
        if (meRes.ok) me = await meRes.json();
      } catch {}
      onLogin(d.access_token, me);
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        style={{ width: '100%', padding: 11, background: '#1e3a5f', border: '1px solid #2563eb', color: '#93c5fd', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        onClick={() => setOpen(true)}
      >
        Sign in with Active Directory
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ padding: 12, border: '1px solid #2563eb', borderRadius: 8, background: '#0f172a' }}>
      <div style={{ color: '#93c5fd', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Active Directory Login</div>
      <input
        className="input"
        style={{ width: '100%', background: '#111827', border: '1px solid #334155', color: '#fff', padding: 9, borderRadius: 7, marginBottom: 8 }}
        placeholder="Domain username (e.g. jsmith)"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        style={{ width: '100%', background: '#111827', border: '1px solid #334155', color: '#fff', padding: 9, borderRadius: 7, marginBottom: 10 }}
        placeholder="Domain password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {error && <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={{ flex: 1, padding: 9, background: '#2563eb', border: 'none', color: '#fff', borderRadius: 7, fontWeight: 600, cursor: 'pointer' }} disabled={loading}>
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
        <button type="button" style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 7, cursor: 'pointer' }} onClick={() => { setOpen(false); setError(''); }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* --- Login Page --- */
function LoginPage({ onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSetup, setIsSetup] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [resetMode, setResetMode] = React.useState(false);
  const [fpUser, setFpUser] = React.useState('');
  const [fpToken, setFpToken] = React.useState('');
  const [fpNewPwd, setFpNewPwd] = React.useState('');
  const [fpMsg, setFpMsg] = React.useState('');
  const [fpBusy, setFpBusy] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API}/api/auth/setup/check`)
      .then(r => r.json())
      .then(d => setIsSetup(d.setup_required))
      .catch(() => setIsSetup(false));

    // Handle SSO callback token in URL fragment
    const hash = window.location.hash;
    if (hash && hash.includes('sso_token=')) {
      const p = new URLSearchParams(hash.replace('#', '?'));
      const t = p.get('sso_token');
      if (t) {
        window.location.hash = ''; // clear fragment
        onLogin(t, { username: 'SSO User' }); 
      }
    }
  }, [onLogin]);

  const validatePassword = (pw) => {
    if (pw.length < 12 || pw.length > 128) return "Password must be 12-128 characters.";
    if (!/[A-Z]/.test(pw)) return "Password needs an uppercase letter.";
    if (!/[a-z]/.test(pw)) return "Password needs a lowercase letter.";
    if (!/[0-9]/.test(pw)) return "Password needs a number.";
    if (!/[!@#$%^&*()\-_=+[\]{}|;:,.<>?/\\~`]/.test(pw)) return "Password needs a special character.";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSetup) {
      const pwErr = validatePassword(password);
      if (pwErr) { setError(pwErr); return; }
    }

    setLoading(true);
    try {
      if (isSetup) {
        const r = await fetch(`${API}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, email, full_name: fullName })
        });
        const d = await r.json();
        if (!r.ok) { setError(d.detail || 'Setup failed'); setLoading(false); return; }
        setIsSetup(false);
        setError('');
        alert('Admin account created! Please login now.');
      } else {
        const r = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const d = await r.json();
        if (!r.ok) { setError(d.detail || 'Login failed'); setLoading(false); return; }

        let me = d.user;
        try {
          const meRes = await fetch(`${API}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${d.access_token}` }
          });
          if (meRes.ok) me = await meRes.json();
        } catch {}
        onLogin(d.access_token, me);
      }
    } catch (e) {
      setError('Connection to PatchMaster API failed');
    }
    setLoading(false);
  };

  const requestReset = async () => {
    if (!fpUser) { setFpMsg('Enter username or email'); return; }
    setFpBusy(true); setFpMsg('');
    try {
      const r = await fetch(`${API}/api/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: fpUser })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Reset request failed');
      setFpToken(d.reset_token || '');
      setFpMsg('Reset token generated (valid 1 hour). Copy it below and set your new password.');
    } catch (e) { setFpMsg(e.message); }
    setFpBusy(false);
  };

  const performReset = async () => {
    const pwErr = validatePassword(fpNewPwd);
    if (pwErr) { setFpMsg(pwErr); return; }
    if (!fpToken) { setFpMsg('Request a reset token first.'); return; }
    setFpBusy(true); setFpMsg('');
    try {
      const r = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fpToken, new_password: fpNewPwd })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Reset failed');
      setFpMsg('Password reset! You can now log in with the new password.');
      setResetMode(false);
      setPassword('');
    } catch (e) { setFpMsg(e.message); }
    setFpBusy(false);
  };

  return (
    <div className="login-container" style={{background:'#0f172a', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="login-card" style={{background:'#1e293b', padding:'2.5rem', borderRadius:16, width:400, border:'1px solid #334155', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.3)'}}>
        <h2 style={{color:'#fff', textAlign:'center', marginBottom:8}}>PatchMaster</h2>
        <p style={{textAlign:'center', color:'#94a3b8', fontSize:14, marginBottom:24}}>
          {isSetup ? 'Welcome! Create the primary Administrator account.' : 'Sign in to your account'}
        </p>

        <form onSubmit={submit}>
          <div style={{marginBottom:16}}>
            <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>Username</label>
            <input className="input" style={{width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8}}
              placeholder="e.g. admin" value={username} onChange={e=>setUsername(e.target.value)} required />
          </div>

          {isSetup && (
             <>
              <div style={{marginBottom:16}}>
                <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>Email Address</label>
                <input className="input" type="email" style={{width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8}}
                  placeholder="admin@company.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>Full Name (Optional)</label>
                <input className="input" style={{width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8}}
                  placeholder="Administrator" value={fullName} onChange={e=>setFullName(e.target.value)} />
              </div>
            </>
          )}

          <div style={{marginBottom:24}}>
            <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>Password</label>
            <input className="input" type="password" style={{width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8}}
              placeholder="********" value={password} onChange={e=>setPassword(e.target.value)} required />
            {isSetup && <small style={{color:'#64748b', fontSize:11, marginTop:4, display:'block'}}>12-128 chars, mix of upper, lower, numbers & symbols</small>}
          </div>

          {error && <div style={{background:'#7f1d1d', color:'#fca5a5', padding:10, borderRadius:8, fontSize:13, marginBottom:16, border:'1px solid #dc2626'}}>{error}</div>}

          <button className="btn btn-primary btn-lg" style={{width:'100%', padding:12, fontWeight:600}} disabled={loading}>
            {loading ? 'Processing...' : isSetup ? 'Initialize System' : 'Sign In'}
          </button>
        </form>

        {!isSetup && (
          <div style={{marginTop:20}}>
            <div style={{display:'flex', alignItems:'center', gap:8, margin:'12px 0'}}>
              <div style={{flex:1, height:1, background:'#334155'}} />
              <span style={{color:'#475569', fontSize:12}}>OR</span>
              <div style={{flex:1, height:1, background:'#334155'}} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                type="button" 
                onClick={() => window.location.href = `${API}/api/auth/oidc/login`}
                style={{ width: '100%', padding: 11, background: '#0ea5e9', border: '1px solid #0284c7', color: '#0f172a', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Enterprise SSO Login
              </button>
              <LdapLoginButton onLogin={onLogin} />
            </div>

            <div style={{marginTop:16, color:'#cbd5e1', fontSize:13}}>
              <button type="button" className="btn btn-sm" style={{width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#cbd5e1'}} onClick={()=>setResetMode(!resetMode)}>
                {resetMode ? 'Cancel password reset' : 'Forgot password?'}
              </button>
              {resetMode && (
                <div style={{marginTop:12, padding:12, border:'1px solid #334155', borderRadius:8, background:'#0f172a'}}>
                  <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>Username or Email</label>
                  <input className="input" style={{width:'100%', background:'#111827', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8, marginBottom:8}} value={fpUser} onChange={e=>setFpUser(e.target.value)} />
                  <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>Reset Token</label>
                  <input className="input" style={{width:'100%', background:'#111827', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8, marginBottom:8}} value={fpToken} onChange={e=>setFpToken(e.target.value)} placeholder="Click 'Send reset token' to generate" />
                  <label style={{display:'block', color:'#94a3b8', fontSize:12, marginBottom:6}}>New Password</label>
                  <input className="input" type="password" style={{width:'100%', background:'#111827', border:'1px solid #334155', color:'#fff', padding:10, borderRadius:8, marginBottom:12}} value={fpNewPwd} onChange={e=>setFpNewPwd(e.target.value)} />
                  {fpMsg && <div style={{background:'#0ea5e9', color:'#0b1224', padding:8, borderRadius:6, fontSize:12, marginBottom:10}}>{fpMsg}</div>}
                  <div className="btn-group" style={{display:'flex', gap:8}}>
                    <button type="button" className="btn btn-sm btn-primary" style={{flex:1}} disabled={fpBusy} onClick={requestReset}>Send reset token</button>
                    <button type="button" className="btn btn-sm btn-success" style={{flex:1}} disabled={fpBusy} onClick={performReset}>Reset password</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- License Expired / Not Activated Popup --- */
function LicensePopup({ licenseInfo, onSuccess }) {
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const li = licenseInfo || {};
  const isInvalid = li.activated && li.valid === false;
  const isExpired = li.activated && li.expired;

  const activate = async () => {
    if (!key.trim()) { setMsg('Please enter a license key'); return; }
    setLoading(true); setMsg('');
    try {
      const r = await apiFetch(`${API}/api/license/activate`, { method:'POST', body: JSON.stringify({ license_key: key.trim() }) });
      const d = await r.json();
      if (r.ok) { setMsg(''); onSuccess(); }
      else { setMsg(d.detail || 'Activation failed'); }
    } catch(e) { setMsg('Error: ' + e.message); }
    setLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') activate(); };

  return (
    <div style={{
      position:'fixed',top:0,left:0,right:0,bottom:0,
      background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:10000,
    }}>
      <div style={{
        background:'#1a1a2e',border:'1px solid #374151',borderRadius:16,
        padding:40,maxWidth:520,width:'90%',textAlign:'center',
        boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{fontSize:32,marginBottom:16,fontWeight:800,color:'#cbd5e1'}}>{isExpired ? 'Expired' : isInvalid ? 'Invalid' : 'License'}</div>
        <h2 style={{color:'#f9fafb',marginBottom:8,fontSize:22}}>
          {isExpired ? 'License Expired' : isInvalid ? 'License Invalid' : 'License Required'}
        </h2>
        <p style={{color:'#9ca3af',marginBottom:8,fontSize:14,lineHeight:1.6}}>
          {isExpired
            ? `Your PatchMaster license expired on ${li.expires_at}. All services are paused until a valid license is activated.`
            : isInvalid
              ? `The current PatchMaster license is invalid${li.error ? `: ${li.error}` : '.'} Please activate a valid license to continue.`
              : 'PatchMaster requires a valid license to operate. Please enter your license key to activate all services.'}
        </p>
        {(isExpired || isInvalid) && li.customer && (
          <p style={{color:'#6b7280',fontSize:12,marginBottom:16}}>
            Customer: {li.customer} | Plan: {li.plan_label} | Tier: {li.tier_label}
          </p>
        )}
        <p style={{color:'#d1d5db',fontSize:13,marginBottom:20}}>
          Contact your PatchMaster vendor to obtain a new license key.
        </p>
        <div style={{display:'flex',gap:10,marginBottom:12}}>
          <input
            className="input"
            style={{flex:1,fontFamily:'monospace',fontSize:12,padding:'10px 14px',background:'#111827',border:'1px solid #374151',color:'#f9fafb',borderRadius:8}}
            placeholder="PM2-xxxxxxxxx.xxxxxxxx (legacy PM1 also accepted)"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={activate}
            disabled={loading}
            style={{padding:'10px 24px',borderRadius:8,fontWeight:600}}
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </div>
        {msg && <p style={{color:'#dc3545',fontWeight:500,fontSize:13,marginTop:8}}>{msg}</p>}
      </div>
    </div>
  );
}

/* --- Dashboard --- */
function RiskGauge({ score }) {
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981';
  const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk';
  const pct = score / 100;
  // SVG arc gauge
  const r = 54, cx = 64, cy = 64;
  const startAngle = -210, endAngle = 30; // 240 degree sweep
  const toRad = d => (d * Math.PI) / 180;
  const arcX = (a) => cx + r * Math.cos(toRad(a));
  const arcY = (a) => cy + r * Math.sin(toRad(a));
  const fillEnd = startAngle + pct * (endAngle - startAngle);
  const largeArc = (endAngle - startAngle) * pct > 180 ? 1 : 0;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width="128" height="100" viewBox="0 0 128 100">
        <path d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 1 1 ${arcX(endAngle)} ${arcY(endAngle)}`}
          fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        {score > 0 && <path d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 ${largeArc} 1 ${arcX(fillEnd)} ${arcY(fillEnd)}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}</text>
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize="10" fill="#64748b">/ 100</text>
      </svg>
      <span style={{fontSize:12,fontWeight:600,color}}>{label}</span>
    </div>
  );
}

function PatchVelocityChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.jobs), 1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height:80,marginTop:8}}>
      {data.map((d, i) => (
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          <div style={{
            width:'100%', background:'#4361ee', borderRadius:'4px 4px 0 0',
            height: `${(d.jobs / max) * 64}px`, minHeight: d.jobs > 0 ? 4 : 0,
            transition:'height 0.3s ease',
          }} title={`${d.jobs} jobs`} />
          <span style={{fontSize:9,color:'#64748b',whiteSpace:'nowrap'}}>{d.date}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsDashboardPage() {
  return (
    <AnalyticsOpsPage
      API={API}
      apiFetch={apiFetch}
      useInterval={useInterval}
      AppIcon={AppIcon}
      PatchVelocityChart={PatchVelocityChart}
    />
  );
}
function DashboardPage({ health, hosts, jobs, setPage }) {
  return (
    <DashboardOpsPage
      health={health}
      hosts={hosts}
      jobs={jobs}
      setPage={setPage}
      API={API}
      apiFetch={apiFetch}
      useInterval={useInterval}
      AppIcon={AppIcon}
      RiskGauge={RiskGauge}
      PatchVelocityChart={PatchVelocityChart}
    />
  );
}
/* --- Hosts --- */
function HostsPage({ hosts, setHosts }) {
  return (
    <HostsOpsPage
      hosts={hosts}
      setHosts={setHosts}
      API={API}
      apiFetch={apiFetch}
      hasRole={hasRole}
      AppIcon={AppIcon}
      useInterval={useInterval}
    />
  );
}
/* --- Compliance --- */
function CompliancePage() {
  const [overview, setOverview] = useState(null);
  const [byGroup, setByGroup] = useState([]);
  const [hostDetail, setHostDetail] = useState([]);
  const [view, setView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [hostQuery, setHostQuery] = useState('');
  const [hostFilter, setHostFilter] = useState('all');

  const refreshCompliance = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`${API}/api/compliance/overview`).then(r => r.json()).catch(() => null),
      apiFetch(`${API}/api/compliance/by-group`).then(r => r.json()).catch(() => []),
      apiFetch(`${API}/api/compliance/hosts-detail`).then(r => r.json()).catch(() => []),
    ]).then(([overviewData, byGroupData, hostData]) => {
      setOverview(overviewData);
      setByGroup(Array.isArray(byGroupData) ? byGroupData : []);
      setHostDetail(Array.isArray(hostData) ? hostData : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshCompliance();
  }, [refreshCompliance]);

  const safeOverview = overview || {
    total_hosts: 0,
    online_hosts: 0,
    avg_compliance: 0,
    reboot_required: 0,
    total_upgradable: 0,
    cves: { critical: 0, high: 0, medium: 0 },
    jobs_30d: { success: 0, failed: 0 },
    compliance_distribution: { fully_patched: 0, mostly_patched: 0, needs_attention: 0 },
  };

  const totalHosts = safeOverview.total_hosts || 0;
  const onlineHosts = safeOverview.online_hosts || 0;
  const avgCompliance = Number(safeOverview.avg_compliance || 0);
  const rebootRequired = safeOverview.reboot_required || 0;
  const totalUpgradable = safeOverview.total_upgradable || 0;
  const criticalCves = safeOverview.cves?.critical || 0;
  const highCves = safeOverview.cves?.high || 0;
  const jobsSuccess = safeOverview.jobs_30d?.success || 0;
  const jobsFailed = safeOverview.jobs_30d?.failed || 0;
  const fullyPatched = safeOverview.compliance_distribution?.fully_patched || 0;
  const mostlyPatched = safeOverview.compliance_distribution?.mostly_patched || 0;
  const needsAttention = safeOverview.compliance_distribution?.needs_attention || 0;
  const coveragePct = totalHosts ? Math.round((onlineHosts / totalHosts) * 100) : 0;
  const jobTotal = jobsSuccess + jobsFailed;
  const successRate = jobTotal ? Math.round((jobsSuccess / jobTotal) * 100) : 0;

  const posture = avgCompliance >= 95
    ? {
        title: 'Strong posture',
        description: 'Most systems are fully patched and active risk is tightly controlled.',
        tone: '#166534',
        bg: '#ecfdf3',
        border: '#86efac',
      }
    : avgCompliance >= 85
      ? {
          title: 'Controlled posture',
          description: 'Patch compliance is healthy, but there is still a visible remediation queue.',
          tone: '#1d4ed8',
          bg: '#eff6ff',
          border: '#93c5fd',
        }
      : avgCompliance >= 70
        ? {
            title: 'Watch posture',
            description: 'Fleet health is mixed. Prioritize hosts below target and reduce open backlog.',
            tone: '#b45309',
            bg: '#fffbeb',
            border: '#fcd34d',
          }
        : {
            title: 'At-risk posture',
            description: 'Compliance is below target and needs immediate remediation planning.',
            tone: '#b91c1c',
            bg: '#fef2f2',
            border: '#fca5a5',
          };

  const distributionRows = [
    {
      key: 'fully',
      label: 'Fully Patched',
      hint: '100%',
      count: fullyPatched,
      percent: totalHosts ? Math.round((fullyPatched / totalHosts) * 100) : 0,
      color: '#16a34a',
      bg: 'rgba(34,197,94,0.14)',
    },
    {
      key: 'mostly',
      label: 'Mostly Patched',
      hint: '80-99%',
      count: mostlyPatched,
      percent: totalHosts ? Math.round((mostlyPatched / totalHosts) * 100) : 0,
      color: '#d97706',
      bg: 'rgba(245,158,11,0.14)',
    },
    {
      key: 'attention',
      label: 'Needs Attention',
      hint: '<80%',
      count: needsAttention,
      percent: totalHosts ? Math.round((needsAttention / totalHosts) * 100) : 0,
      color: '#dc2626',
      bg: 'rgba(239,68,68,0.14)',
    },
  ];

  const summaryCards = [
    {
      label: 'Fleet Coverage',
      value: `${coveragePct}%`,
      sub: `${onlineHosts} of ${totalHosts} hosts reporting`,
      icon: 'server',
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.12)',
    },
    {
      label: 'Patch Compliance',
      value: `${avgCompliance}%`,
      sub: `${fullyPatched} hosts fully patched`,
      icon: 'shield',
      color: '#0f766e',
      bg: 'rgba(20,184,166,0.12)',
    },
    {
      label: 'Critical Exposure',
      value: criticalCves,
      sub: `${highCves} additional high CVEs`,
      icon: 'bug',
      color: '#dc2626',
      bg: 'rgba(239,68,68,0.12)',
    },
    {
      label: 'Reboot Queue',
      value: rebootRequired,
      sub: 'pending restart to complete patching',
      icon: 'refresh',
      color: '#b45309',
      bg: 'rgba(245,158,11,0.14)',
    },
    {
      label: 'Patch Backlog',
      value: totalUpgradable,
      sub: 'remaining package updates',
      icon: 'package',
      color: '#7c3aed',
      bg: 'rgba(139,92,246,0.12)',
    },
    {
      label: '30-Day Success',
      value: `${successRate}%`,
      sub: `${jobsSuccess} successful / ${jobsFailed} failed`,
      icon: 'timeline',
      color: '#0f766e',
      bg: 'rgba(16,185,129,0.12)',
    },
  ];

  const priorityItems = [
    {
      label: 'Hosts below target',
      detail: `${needsAttention} host${needsAttention === 1 ? '' : 's'} need remediation to get back above 80% compliance.`,
      tone: needsAttention > 0 ? '#dc2626' : '#16a34a',
      bg: needsAttention > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
    },
    {
      label: 'Restart backlog',
      detail: `${rebootRequired} host${rebootRequired === 1 ? '' : 's'} still need a reboot to finalize updates.`,
      tone: rebootRequired > 0 ? '#d97706' : '#16a34a',
      bg: rebootRequired > 0 ? 'rgba(245,158,11,0.14)' : 'rgba(34,197,94,0.12)',
    },
    {
      label: 'Patch execution quality',
      detail: jobTotal ? `${jobsSuccess} successful and ${jobsFailed} failed jobs were recorded in the last 30 days.` : 'No recent patch execution data has been recorded yet.',
      tone: jobsFailed > 0 ? '#b45309' : '#1d4ed8',
      bg: jobsFailed > 0 ? 'rgba(245,158,11,0.14)' : 'rgba(37,99,235,0.12)',
    },
  ];

  const groupHealth = useMemo(() => [...byGroup].sort((a, b) => {
    if (a.avg_compliance !== b.avg_compliance) return a.avg_compliance - b.avg_compliance;
    return b.total_cves - a.total_cves;
  }), [byGroup]);

  const riskiestGroup = groupHealth[0] || null;

  const riskiestHosts = useMemo(() => [...hostDetail].sort((a, b) => {
    if ((a.compliance_score || 0) !== (b.compliance_score || 0)) return (a.compliance_score || 0) - (b.compliance_score || 0);
    if ((b.cve_count || 0) !== (a.cve_count || 0)) return (b.cve_count || 0) - (a.cve_count || 0);
    return (b.upgradable_count || 0) - (a.upgradable_count || 0);
  }).slice(0, 5), [hostDetail]);

  const filteredHosts = useMemo(() => {
    const q = hostQuery.trim().toLowerCase();
    return hostDetail.filter(h => {
      const matchesQuery = !q || [h.hostname, h.ip, h.os, ...(h.groups || [])].join(' ').toLowerCase().includes(q);
      if (!matchesQuery) return false;
      if (hostFilter === 'attention') return (h.compliance_score || 0) < 80;
      if (hostFilter === 'offline') return !h.is_online;
      if (hostFilter === 'reboot') return !!h.reboot_required;
      if (hostFilter === 'backlog') return (h.upgradable_count || 0) > 0;
      return true;
    });
  }, [hostDetail, hostQuery, hostFilter]);

  const scoreBadgeClass = (score) => score >= 90 ? 'badge-success' : score >= 80 ? 'badge-warning' : 'badge-danger';

  return (
    <div className="compliance-shell">
      <div className="compliance-toolbar">
        <div className="compliance-tabs">
          <button className={`compliance-tab ${view==='overview'?'active':''}`} onClick={()=>setView('overview')}>Overview</button>
          <button className={`compliance-tab ${view==='groups'?'active':''}`} onClick={()=>setView('groups')}>By Group</button>
          <button className={`compliance-tab ${view==='hosts'?'active':''}`} onClick={()=>setView('hosts')}>By Host</button>
        </div>
        <button className="btn btn-sm" onClick={refreshCompliance}>{loading ? 'Refreshing...' : 'Refresh Data'}</button>
      </div>

      {loading && !overview && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b' }}>Loading compliance posture...</p>
        </div>
      )}

      {view==='overview' && overview && (
        <div className="compliance-stack">
          <div className="compliance-hero">
            <div className="compliance-hero-main">
              <div className="compliance-kicker">Fleet Compliance Posture</div>
              <div className="compliance-hero-score">
                <div className="compliance-score-ring" style={{ color: posture.tone, background: posture.bg, borderColor: posture.border }}>
                  <span>{avgCompliance}%</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>{posture.title}</h3>
                  <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
                    {posture.description}
                  </p>
                </div>
              </div>
              <div className="compliance-chip-row">
                <span className="compliance-chip">Coverage {coveragePct}%</span>
                <span className="compliance-chip">Fully Patched {fullyPatched}</span>
                <span className="compliance-chip">Needs Attention {needsAttention}</span>
                <span className="compliance-chip">Critical CVEs {criticalCves}</span>
              </div>
            </div>
            <div className="compliance-hero-side">
              <div className="compliance-side-label">Compliance Notes</div>
              <div className="compliance-side-metric">
                <strong>{totalHosts}</strong>
                <span>Total managed hosts</span>
              </div>
              <div className="compliance-side-metric">
                <strong>{jobsSuccess}</strong>
                <span>Successful patch jobs in the last 30 days</span>
              </div>
              <div className="compliance-side-metric">
                <strong>{rebootRequired}</strong>
                <span>Hosts still waiting for restart</span>
              </div>
            </div>
          </div>

          <div className="compliance-summary-grid">
            {summaryCards.map(card => (
              <div key={card.label} className="compliance-summary-card">
                <div className="compliance-summary-head">
                  <span className="compliance-summary-icon" style={{ color: card.color, background: card.bg }}>
                    <AppIcon name={card.icon} size={18} />
                  </span>
                  <span className="compliance-summary-label">{card.label}</span>
                </div>
                <div className="compliance-summary-value">{card.value}</div>
                <div className="compliance-summary-sub">{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="card compliance-panel">
              <div className="card-header">
                <h3>Compliance Distribution</h3>
                <span className="badge badge-info">{totalHosts} hosts</span>
              </div>
              <div className="compliance-distribution">
                {distributionRows.map(row => (
                  <div key={row.key} className="distribution-row">
                    <div className="distribution-copy">
                      <strong>{row.label}</strong>
                      <span>{row.hint}</span>
                    </div>
                    <div className="distribution-bar">
                      <div className="distribution-fill" style={{ width: `${row.percent}%`, background: row.color }} />
                    </div>
                    <div className="distribution-meta">
                      <strong>{row.count}</strong>
                      <span>{row.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card compliance-panel">
              <div className="card-header">
                <h3>Operational Priorities</h3>
                <span className="badge badge-warning">Review daily</span>
              </div>
              <div className="priority-list">
                {priorityItems.map(item => (
                  <div key={item.label} className="priority-item">
                    <span className="priority-dot" style={{ background: item.bg, color: item.tone }} />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card compliance-panel">
              <div className="card-header">
                <h3>Group Risk Spotlight</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setView('groups')}>Open Groups</button>
              </div>
              {riskiestGroup ? (
                <div className="spotlight-card">
                  <div className="spotlight-top">
                    <div>
                      <div className="spotlight-kicker">Lowest-performing group</div>
                      <h4>{riskiestGroup.group}</h4>
                    </div>
                    <span className={`badge ${scoreBadgeClass(riskiestGroup.avg_compliance)}`}>{riskiestGroup.avg_compliance}% avg</span>
                  </div>
                  <div className="spotlight-grid">
                    <div><span>Hosts</span><strong>{riskiestGroup.host_count}</strong></div>
                    <div><span>Online</span><strong>{riskiestGroup.online}</strong></div>
                    <div><span>Total CVEs</span><strong>{riskiestGroup.total_cves}</strong></div>
                    <div><span>Upgradable</span><strong>{riskiestGroup.total_upgradable}</strong></div>
                  </div>
                </div>
              ) : (
                <p className="text-muted">No grouped compliance data is available yet.</p>
              )}
            </div>

            <div className="card compliance-panel">
              <div className="card-header">
                <h3>Hosts Requiring Review</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => setView('hosts')}>Open Host List</button>
              </div>
              {!riskiestHosts.length ? (
                <p className="text-muted">No host-level compliance data is available yet.</p>
              ) : (
                <div className="review-host-list">
                  {riskiestHosts.map(host => (
                    <div key={host.id} className="review-host-item">
                      <div>
                        <strong>{host.hostname}</strong>
                        <span>{host.ip} - {(host.groups || []).join(', ') || 'Ungrouped'}</span>
                      </div>
                      <div className="review-host-metrics">
                        <span className={`badge ${scoreBadgeClass(host.compliance_score || 0)}`}>{host.compliance_score || 0}%</span>
                        <span className="badge badge-info">{host.upgradable_count || 0} pkgs</span>
                        {host.reboot_required && <span className="badge badge-warning">Reboot</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {view==='groups' && (
        <div className="compliance-stack">
          <div className="card compliance-panel">
            <div className="card-header">
              <h3>Compliance by Group</h3>
              <span className="badge badge-info">{byGroup.length} group{byGroup.length === 1 ? '' : 's'}</span>
            </div>
            {byGroup.length===0 ? <p className="text-muted">No groups with hosts found.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Group</th><th>Hosts</th><th>Online</th><th>Avg Compliance</th><th>Lowest Score</th><th>Total CVEs</th><th>Upgradable</th></tr></thead>
                  <tbody>{groupHealth.map((g,i)=><tr key={i}><td><strong>{g.group}</strong></td><td>{g.host_count}</td><td>{g.online}</td><td><span className={`badge ${scoreBadgeClass(g.avg_compliance)}`}>{g.avg_compliance}%</span></td><td>{g.min_compliance}%</td><td>{g.total_cves}</td><td>{g.total_upgradable}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {view==='hosts' && (
        <div className="card compliance-panel">
          <div className="card-header">
            <h3>Per-Host Compliance</h3>
            <span className="badge badge-info">{filteredHosts.length} host{filteredHosts.length === 1 ? '' : 's'}</span>
          </div>
          <div className="compliance-table-toolbar">
            <input className="input search-input" placeholder="Search by host, IP, OS, or group..." value={hostQuery} onChange={e => setHostQuery(e.target.value)} />
            <div className="compliance-filter-pills">
              {[
                ['all', 'All Hosts'],
                ['attention', 'Needs Attention'],
                ['offline', 'Offline'],
                ['reboot', 'Reboot Queue'],
                ['backlog', 'Patch Backlog'],
              ].map(([key, label]) => (
                <button key={key} className={`compliance-pill ${hostFilter === key ? 'active' : ''}`} onClick={() => setHostFilter(key)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Hostname</th><th>IP</th><th>OS</th><th>Status</th><th>Compliance</th><th>CVEs</th><th>Upgradable</th><th>Reboot</th><th>Groups</th><th>Last Patched</th></tr></thead>
              <tbody>{filteredHosts.map(h=><tr key={h.id}><td><strong>{h.hostname}</strong></td><td>{h.ip}</td><td>{h.os}</td><td>{h.is_online?<span className="badge badge-success">Online</span>:<span className="badge badge-danger">Offline</span>}</td><td><span className={`badge ${scoreBadgeClass(h.compliance_score)}`}>{h.compliance_score}%</span></td><td>{h.cve_count}</td><td>{h.upgradable_count}</td><td>{h.reboot_required?<span className="badge badge-warning">Yes</span>:<span className="badge badge-info">No</span>}</td><td>{(h.groups||[]).join(', ') || 'Ungrouped'}</td><td>{h.last_patched ? new Date(h.last_patched).toLocaleDateString() : 'Not recorded'}</td></tr>)}</tbody>
            </table>
          </div>
          {!filteredHosts.length && <p className="text-muted" style={{ marginTop: 12 }}>No hosts match the current compliance filter.</p>}
        </div>
      )}
    </div>
  );
}

/* --- Groups & Tags --- */
function GroupsPage({ hosts }) {
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [newGroup, setNewGroup] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [groupHosts, setGroupHosts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHosts, setSelectedHosts] = useState([]);

  const refresh = () => {
    apiFetch(`${API}/api/groups/`).then(r=>r.json()).then(setGroups).catch(()=>{});
    apiFetch(`${API}/api/tags/`).then(r=>r.json()).then(setTags).catch(()=>{});
  };
  useEffect(refresh, []);

  const createGroup = () => {
    if (!newGroup) return;
    apiFetch(`${API}/api/groups/`, { method:'POST', body: JSON.stringify({name:newGroup,description:newGroupDesc}) }).then(()=>{ setNewGroup(''); setNewGroupDesc(''); refresh(); });
  };
  const deleteGroup = id => { if(!window.confirm('Delete group?')) return; apiFetch(`${API}/api/groups/${id}`,{method:'DELETE'}).then(refresh); };

  const toggleExpand = async (id) => {
    if (expandedGroup===id) { setExpandedGroup(null); return; }
    try {
      const r = await apiFetch(`${API}/api/groups/${id}`);
      if (!r.ok) throw new Error('Failed to load group');
      const d = await r.json();
      setGroupHosts(d.hosts||[]); setExpandedGroup(id);
    } catch {
      setGroupHosts([]); setExpandedGroup(id);
    }
  };

  const addHostsToGroup = async () => {
    if (!expandedGroup || selectedHosts.length === 0) return;
    for (const hid of selectedHosts) {
      await apiFetch(`${API}/api/groups/${expandedGroup}/hosts/${hid}`, { method: 'POST' });
    }
    setShowAddModal(false); setSelectedHosts([]); toggleExpand(expandedGroup); refresh();
  };

  const removeHost = async (gid, hid) => {
    if(!window.confirm('Remove host from group?')) return;
    await apiFetch(`${API}/api/groups/${gid}/hosts/${hid}`, { method: 'DELETE' });
    toggleExpand(gid); refresh();
  };

  return (
    <div>
      <div className="card">
        <h3>Create Host Group</h3>
        <div className="form-row">
          <input className="input" placeholder="Group name" value={newGroup} onChange={e=>setNewGroup(e.target.value)} />
          <input className="input" placeholder="Description" value={newGroupDesc} onChange={e=>setNewGroupDesc(e.target.value)} style={{flex:1}} />
          <button className="btn btn-primary" onClick={createGroup}>Create Group</button>
        </div>
      </div>
      <div className="card">
        <h3>Groups ({groups.length})</h3>
        {groups.length===0 ? <p className="text-muted">No groups created.</p> : (
          <table className="table"><thead><tr><th>Name</th><th>Description</th><th>Hosts</th><th>Actions</th></tr></thead>
          <tbody>{groups.map(g=><React.Fragment key={g.id}>
            <tr><td><strong>{g.name}</strong></td><td>{g.description||'-'}</td><td>{g.host_count||0}</td>
            <td>
              <button className="btn btn-sm" onClick={()=>toggleExpand(g.id)}>{expandedGroup===g.id?'Collapse':'View Hosts'}</button>
              {hasRole('admin')&&<button className="btn btn-sm btn-danger" onClick={()=>deleteGroup(g.id)}>Del</button>}
            </td></tr>
            {expandedGroup===g.id && <tr><td colSpan="4">
              <div style={{padding:'12px',background:'#f8f9fa',borderRadius:6}}>
                <div style={{marginBottom:10, display:'flex', justifyContent:'space-between'}}>
                  <strong>Hosts in {g.name}:</strong>
                  <button className="btn btn-sm btn-primary" onClick={()=>setShowAddModal(true)}>Add Hosts</button>
                </div>
                {groupHosts.length===0 ? <p className="text-muted">No hosts in this group.</p> : (
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {groupHosts.map(h=>(
                      <span key={h.id} className="badge badge-info" style={{paddingRight:2}}>
                        {h.hostname} ({h.ip})
                        <button
                          style={{border:'none',background:'none',color:'#fff',marginLeft:4,cursor:'pointer'}}
                          title="Remove host"
                          aria-label={`Remove ${h.hostname} from ${g.name}`}
                          onClick={()=>removeHost(g.id, h.id)}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </td></tr>}
          </React.Fragment>)}</tbody></table>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Add Hosts to Group</h3>
            <div style={{maxHeight:300, overflowY:'auto', margin:'10px 0'}}>
              {hosts.filter(h => !groupHosts.find(gh => gh.id === h.id)).map(h => (
                <div key={h.id} style={{padding:4}}>
                  <label>
                    <input type="checkbox" checked={selectedHosts.includes(h.id)}
                           onChange={e => setSelectedHosts(prev => e.target.checked ? [...prev, h.id] : prev.filter(id => id !== h.id))} />
                    <span style={{marginLeft:8}}>{h.hostname} ({h.ip})</span>
                  </label>
                </div>
              ))}
            </div>
            <div style={{textAlign:'right'}}>
              <button className="btn" onClick={()=>setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addHostsToGroup}>Add Selected</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Patch Manager --- */
function PatchManagerPage({ hosts }) {
  return (
    <PatchManagerOpsPage
      hosts={hosts}
      API={API}
      apiFetch={apiFetch}
      AppIcon={AppIcon}
      useInterval={useInterval}
    />
  );
}

function PatchFabricPage({ hosts, jobs, toast }) {
  const [activeView, setActiveView] = useState('linux-channel');
  const onlineHosts = hosts.filter(h => h.is_online).length;
  const runningJobs = jobs.filter(j => (j.status || '').toLowerCase() === 'running').length;
  const windowsPatchEnabled = hasPerm('windows_patching') || hasPerm('wsus');
  const windowsHosts = hosts.filter(h => {
    const os = String(h?.os || '').toLowerCase();
    const groups = Array.isArray(h?.groups) ? h.groups.map(g => String(g || '').toLowerCase()) : [];
    return os.includes('windows') || groups.includes('windows');
  });
  const linuxHosts = hosts.filter(h => !windowsHosts.some(w => w.id === h.id));
  useEffect(() => {
    if (activeView === 'windows-channel' && !windowsPatchEnabled) {
      setActiveView('linux-channel');
    }
  }, [activeView, windowsPatchEnabled]);
  return (
    <div>
      <div className="card highlight-card">
        <h3>Patch Management Control Plane</h3>
        <p>Single feature for Linux and Windows patch operations with transparent repository pipeline: online sources to local repository to controlled server push.</p>
      </div>
      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="stat-icon"><AppIcon name="server" size={20} /></div><div className="stat-info"><span className="stat-number">{hosts.length}</span><span className="stat-label">Hosts</span></div></div>
        <div className="stat-card success"><div className="stat-icon"><AppIcon name="monitor" size={20} /></div><div className="stat-info"><span className="stat-number">{onlineHosts}</span><span className="stat-label">Online</span></div></div>
        <div className="stat-card warning"><div className="stat-icon"><AppIcon name="timeline" size={20} /></div><div className="stat-info"><span className="stat-number">{runningJobs}</span><span className="stat-label">Running Jobs</span></div></div>
      </div>
      <div className="card">
        <div className="btn-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className={`btn btn-sm ${activeView === 'linux-channel' ? 'btn-primary' : ''}`} onClick={() => setActiveView('linux-channel')}><AppIcon name="terminal" size={14} style={{marginRight:4}} /> Linux Channel</button>
          {windowsPatchEnabled && (
            <button className={`btn btn-sm ${activeView === 'windows-channel' ? 'btn-primary' : ''}`} onClick={() => setActiveView('windows-channel')}><AppIcon name="monitor" size={14} style={{marginRight:4}} /> Windows Channel</button>
          )}
          <button className={`btn btn-sm ${activeView === 'orchestration' ? 'btn-primary' : ''}`} onClick={() => setActiveView('orchestration')}><AppIcon name="layers" size={14} style={{marginRight:4}} /> Orchestration</button>
          <button className={`btn btn-sm ${activeView === 'history' ? 'btn-primary' : ''}`} onClick={() => setActiveView('history')}><AppIcon name="timeline" size={14} style={{marginRight:4}} /> Patch History</button>
          <button className={`btn btn-sm ${activeView === 'runbook' ? 'btn-primary' : ''}`} onClick={() => setActiveView('runbook')}><AppIcon name="list" size={14} style={{marginRight:4}} /> Patch Runbook</button>
          <button className={`btn btn-sm ${activeView === 'mirror' ? 'btn-primary' : ''}`} onClick={() => setActiveView('mirror')}><AppIcon name="refresh" size={14} style={{marginRight:4}} /> Repository Mirrors</button>
          <button className={`btn btn-sm ${activeView === 'local-repo' ? 'btn-primary' : ''}`} onClick={() => setActiveView('local-repo')}><AppIcon name="package" size={14} style={{marginRight:4}} /> Local Repository</button>
          <button className={`btn btn-sm ${activeView === 'snapshots' ? 'btn-primary' : ''}`} onClick={() => setActiveView('snapshots')}><AppIcon name="camera" size={14} style={{marginRight:4}} /> Snapshots</button>
        </div>
      </div>
      {activeView === 'history' && <UnifiedPatchHistoryPage hosts={hosts} jobs={jobs} />}
      {activeView === 'runbook' && <PatchRunbookWizard hosts={hosts} />}
      {activeView === 'orchestration' && (
        <BulkPatchPage
          hosts={hosts}
          linuxHosts={linuxHosts}
          windowsHosts={windowsHosts}
          API={API}
          apiFetch={apiFetch}
          toast={toast}
        />
      )}
      {activeView === 'linux-channel' && (
        <div>
          <div className="card"><h3>Linux Patch Operations</h3><p className="text-muted">Linux-only scope. No Windows host appears in this channel.</p></div>
          <PatchManagerOpsPage
            hosts={linuxHosts}
            API={API}
            apiFetch={apiFetch}
            AppIcon={AppIcon}
            useInterval={useInterval}
          />
          <OfflinePatchPage hosts={linuxHosts} allowedOS="linux" channelTitle="Linux Offline Push" />
        </div>
      )}
      {activeView === 'windows-channel' && (
        <div>
          <div className="card"><h3>Windows Patch Operations</h3><p className="text-muted">Dedicated Windows update workflow for Windows hosts with scan, download, install, and controlled offline push support.</p></div>
          <WsusPage hosts={windowsHosts} />
          <OfflinePatchPage hosts={windowsHosts} allowedOS="windows" channelTitle="Windows Offline Push" />
        </div>
      )}
      {activeView === 'mirror' && (
        <MirrorRepoOpsPage
          API={API}
          apiFetch={apiFetch}
          AppIcon={AppIcon}
        />
      )}
      {activeView === 'local-repo' && (
        <LocalRepoOpsPage
          API={API}
          apiFetch={apiFetch}
          AppIcon={AppIcon}
        />
      )}
      {activeView === 'snapshots' && <SnapshotsPage hosts={hosts} />}
    </div>
  );
}

function UnifiedPatchHistoryPage({ hosts, jobs }) {
  const presetStorageKey = 'pm_patch_history_presets_v1';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hostFilter, setHostFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [osFilter, setOsFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [patchOnly, setPatchOnly] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState('none');
  const [presetName, setPresetName] = useState('');
  const [customPresets, setCustomPresets] = useState([]);
  const [serverPresets, setServerPresets] = useState([]);
  const [presetScope, setPresetScope] = useState('user');
  const [presetRole, setPresetRole] = useState('operator');
  const [presetSaving, setPresetSaving] = useState(false);
  const patchActions = useMemo(() => new Set(['server_patch', 'upgrade', 'offline_install', 'windows_update', 'patch', 'wsus_download']), []);

  const hostById = useMemo(() => {
    const m = new Map();
    hosts.forEach(h => m.set(String(h.id), h));
    return m;
  }, [hosts]);

  const hostOsChannel = (host) => {
    const raw = String(host?.os || host?.os_type || host?.platform || '').toLowerCase();
    return raw.includes('windows') ? 'windows' : 'linux';
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/api/jobs?limit=500`);
      const d = await r.json().catch(() => []);
      setRows(Array.isArray(d) ? d : []);
    } catch {
      setRows(Array.isArray(jobs) ? jobs : []);
    }
    setLoading(false);
  }, [jobs]);

  useEffect(() => { refresh(); }, [refresh]);
  const fetchServerPresets = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/api/patch-history/presets`);
      const d = await r.json().catch(() => []);
      setServerPresets(Array.isArray(d) ? d : []);
    } catch {
      setServerPresets([]);
    }
  }, []);
  useEffect(() => { fetchServerPresets(); }, [fetchServerPresets]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(presetStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setCustomPresets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomPresets([]);
    }
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysAgoStr = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const builtInPresets = useMemo(() => ([
    { id: 'fail-24h', label: 'Last 24h failures', filters: { hostFilter: 'all', statusFilter: 'failed', osFilter: 'all', fromDate: daysAgoStr(1), toDate: todayStr, patchOnly: true } },
    { id: 'win-7d', label: 'Windows last 7 days', filters: { hostFilter: 'all', statusFilter: 'all', osFilter: 'windows', fromDate: daysAgoStr(7), toDate: todayStr, patchOnly: true } },
    { id: 'linux-7d', label: 'Linux last 7 days', filters: { hostFilter: 'all', statusFilter: 'all', osFilter: 'linux', fromDate: daysAgoStr(7), toDate: todayStr, patchOnly: true } },
  ]), [todayStr]);

  const applyPresetFilters = (filters) => {
    if (!filters) return;
    setHostFilter(filters.hostFilter || 'all');
    setStatusFilter(filters.statusFilter || 'all');
    setOsFilter(filters.osFilter || 'all');
    setFromDate(filters.fromDate || '');
    setToDate(filters.toDate || '');
    setPatchOnly(filters.patchOnly !== false);
  };
  const allPresetOptions = [
    ...builtInPresets.map(p => ({ id: `builtin:${p.id}`, label: p.label, filters: p.filters })),
    ...serverPresets.map(p => ({ id: `server:${p.id}`, label: `${p.name} [${p.scope_type}]`, filters: p.filters || {} })),
    ...customPresets.map(p => ({ id: `custom:${p.id}`, label: p.label, filters: p.filters })),
  ];
  const applySelectedPreset = () => {
    const p = allPresetOptions.find(x => x.id === selectedPreset);
    if (!p) return;
    applyPresetFilters(p.filters);
  };
  const saveCurrentPreset = async () => {
    const label = (presetName || '').trim();
    if (!label) return;
    setPresetSaving(true);
    try {
      const desiredScope = hasRole('admin') ? presetScope : 'user';
      const payload = {
        name: label,
        scope_type: desiredScope,
        role: desiredScope === 'role' ? presetRole : null,
        filters: { hostFilter, statusFilter, osFilter, fromDate, toDate, patchOnly },
      };
      const r = await apiFetch(`${API}/api/patch-history/presets`, { method:'POST', body: JSON.stringify(payload) });
      if (r.ok) {
        const created = await r.json().catch(() => null);
        await fetchServerPresets();
        setSelectedPreset(created?.id ? `server:${created.id}` : 'none');
        setPresetName('');
        setPresetSaving(false);
        return;
      }
    } catch {}
    const entry = { id: `preset-${Date.now()}`, label, filters: { hostFilter, statusFilter, osFilter, fromDate, toDate, patchOnly } };
    const next = [...customPresets, entry];
    setCustomPresets(next);
    localStorage.setItem(presetStorageKey, JSON.stringify(next));
    setPresetName('');
    setPresetSaving(false);
  };
  const deleteCurrentPreset = async () => {
    if (String(selectedPreset || '').startsWith('server:')) {
      const id = selectedPreset.split(':')[1];
      try {
        const r = await apiFetch(`${API}/api/patch-history/presets/${id}`, { method:'DELETE' });
        if (r.ok) {
          await fetchServerPresets();
          setSelectedPreset('none');
        }
      } catch {}
      return;
    }
    if (!String(selectedPreset || '').startsWith('custom:')) return;
    const id = selectedPreset.split(':')[1];
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    localStorage.setItem(presetStorageKey, JSON.stringify(next));
    setSelectedPreset('none');
  };

  const filtered = useMemo(() => {
    const fromTs = fromDate ? Date.parse(fromDate) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;
    return (rows || []).filter((j) => {
      const action = String(j.action || '').toLowerCase();
      if (patchOnly && !patchActions.has(action)) return false;
      if (hostFilter !== 'all' && String(j.host_id || '') !== hostFilter) return false;
      if (statusFilter !== 'all' && String(j.status || '').toLowerCase() !== statusFilter) return false;
      const host = hostById.get(String(j.host_id || ''));
      const channel = hostOsChannel(host);
      if (osFilter !== 'all' && channel !== osFilter) return false;
      const ts = Date.parse(j.started_at || j.created_at || '');
      if (fromTs && Number.isFinite(ts) && ts < fromTs) return false;
      if (toTs && Number.isFinite(ts) && ts > toTs) return false;
      return true;
    }).sort((a,b) => Date.parse(b.started_at || b.created_at || 0) - Date.parse(a.started_at || a.created_at || 0));
  }, [rows, patchOnly, hostFilter, statusFilter, osFilter, fromDate, toDate, patchActions, hostById]);

  const exportCsv = () => {
    const header = ['Job ID','Host','IP','OS','Action','Status','Started At','Completed At'];
    const lines = [header.join(',')];
    filtered.forEach((j) => {
      const host = hostById.get(String(j.host_id || ''));
      const row = [
        j.id ?? '',
        (host?.hostname || host?.name || '').replace(/,/g, ' '),
        host?.ip || '',
        host?.os || '',
        j.action || '',
        j.status || '',
        j.started_at || '',
        j.completed_at || '',
      ];
      lines.push(row.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patch-history-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card">
        <h3>Unified Patch History</h3>
        <p className="text-muted">Combined Windows and Linux patch timeline with strict filters to avoid mix-up.</p>
        <div className="form-row">
          <select className="input" value={selectedPreset} onChange={e=>setSelectedPreset(e.target.value)} style={{maxWidth:260}}>
            <option value="none">Preset: None</option>
            {allPresetOptions.map(p => <option key={`preset-opt-${p.id}`} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn btn-sm" onClick={applySelectedPreset} disabled={selectedPreset==='none'}>Apply Preset</button>
          {hasRole('admin') && (
            <>
              <select className="input" value={presetScope} onChange={e=>setPresetScope(e.target.value)} style={{maxWidth:150}}>
                <option value="user">Scope: User</option>
                <option value="role">Scope: Role</option>
                <option value="global">Scope: Global</option>
              </select>
              {presetScope === 'role' && (
                <select className="input" value={presetRole} onChange={e=>setPresetRole(e.target.value)} style={{maxWidth:140}}>
                  <option value="admin">admin</option>
                  <option value="operator">operator</option>
                  <option value="auditor">auditor</option>
                  <option value="viewer">viewer</option>
                </select>
              )}
            </>
          )}
          <input className="input" placeholder="Save current preset as..." value={presetName} onChange={e=>setPresetName(e.target.value)} style={{maxWidth:240}} />
          <button className="btn btn-sm btn-secondary" onClick={saveCurrentPreset} disabled={!presetName.trim() || presetSaving}>{presetSaving ? 'Saving...' : 'Save Preset'}</button>
          <button className="btn btn-sm btn-danger" onClick={deleteCurrentPreset} disabled={!(String(selectedPreset||'').startsWith('custom:') || String(selectedPreset||'').startsWith('server:'))}>Delete Preset</button>
          <select className="input" value={hostFilter} onChange={e=>setHostFilter(e.target.value)} style={{maxWidth:260}}>
            <option value="all">All Hosts</option>
            {hosts.map(h => <option key={`history-host-${h.id}`} value={String(h.id)}>{h.hostname || h.name} ({h.ip})</option>)}
          </select>
          <select className="input" value={osFilter} onChange={e=>setOsFilter(e.target.value)} style={{maxWidth:170}}>
            <option value="all">All OS</option>
            <option value="linux">Linux only</option>
            <option value="windows">Windows only</option>
          </select>
          <select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{maxWidth:170}}>
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending_approval">Pending Approval</option>
          </select>
          <input className="input" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{maxWidth:170}} />
          <input className="input" type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{maxWidth:170}} />
          <label className="toggle-option"><input type="checkbox" checked={patchOnly} onChange={e=>setPatchOnly(e.target.checked)} /> Patch Actions Only</label>
          <button className="btn btn-secondary" onClick={refresh} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          <button className="btn btn-primary" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <div className="card">
        <h3>History Rows ({filtered.length})</h3>
        {filtered.length === 0 ? (
          <p className="text-muted">No matching records in selected filters.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Host</th>
                <th>IP</th>
                <th>OS</th>
                <th>Action</th>
                <th>Status</th>
                <th>Started</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => {
                const host = hostById.get(String(j.host_id || ''));
                return (
                  <tr key={`patch-history-row-${j.id}`}>
                    <td>#{j.id}</td>
                    <td>{host?.hostname || host?.name || 'Unknown'}</td>
                    <td>{host?.ip || '-'}</td>
                    <td>{host?.os || '-'}</td>
                    <td>{j.action || '-'}</td>
                    <td>{j.status || '-'}</td>
                    <td>{j.started_at ? new Date(j.started_at).toLocaleString() : '-'}</td>
                    <td>{j.completed_at ? new Date(j.completed_at).toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PatchRunbookWizard({ hosts }) {
  const storageKey = 'pm_patch_runbook_profiles_v1';
  const [channel, setChannel] = useState('linux');
  const [repos, setRepos] = useState([]);
  const [repoId, setRepoId] = useState('');
  const [packages, setPackages] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedHostIds, setSelectedHostIds] = useState([]);
  const [ringSize, setRingSize] = useState(2);
  const [snapshotMode, setSnapshotMode] = useState('packages');
  const [rollbackOnFailure, setRollbackOnFailure] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [approvedBy, setApprovedBy] = useState('');
  const [maintenanceStart, setMaintenanceStart] = useState('00:00');
  const [maintenanceEnd, setMaintenanceEnd] = useState('23:59');
  const [autoIntake, setAutoIntake] = useState(true);
  const [autoSelectPackages, setAutoSelectPackages] = useState(true);
  const [maxPackageCount, setMaxPackageCount] = useState(25);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('template-dev');
  const [profileName, setProfileName] = useState('');
  const [serverProfiles, setServerProfiles] = useState([]);
  const [selectedServerProfileId, setSelectedServerProfileId] = useState('');
  const [scheduleName, setScheduleName] = useState('Nightly Run');
  const [scheduleCron, setScheduleCron] = useState('0 2 * * *');
  const [serverSchedules, setServerSchedules] = useState([]);
  const [serverRuns, setServerRuns] = useState([]);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([
    { key: 'approval', label: 'Approval and maintenance window', status: 'pending', detail: '' },
    { key: 'mirror', label: 'Mirror sync', status: 'pending', detail: '' },
    { key: 'local_repo', label: 'Local repo validation', status: 'pending', detail: '' },
    { key: 'precheck', label: 'Prechecks', status: 'pending', detail: '' },
    { key: 'snapshot', label: 'Snapshots', status: 'pending', detail: '' },
    { key: 'rollout', label: 'Staged rollout', status: 'pending', detail: '' },
    { key: 'postcheck', label: 'Post-check and rollback policy', status: 'pending', detail: '' },
  ]);
  const [runbookLog, setRunbookLog] = useState([]);

  const scopedHosts = hosts.filter((h) => {
    const os = String(h?.os || '').toLowerCase();
    const groups = Array.isArray(h?.groups) ? h.groups.map(g => String(g || '').toLowerCase()) : [];
    const isWindows = os.includes('windows') || groups.includes('windows');
    return channel === 'windows' ? isWindows : !isWindows;
  });

  const setStep = (key, status, detail = '') => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status, detail } : s));
  };
  const addLog = (line) => setRunbookLog(prev => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 300));
  const defaultTemplates = useMemo(() => ([
    { id: 'template-dev', name: 'Dev Template', channel: 'linux', ringSize: 10, snapshotMode: 'packages', rollbackOnFailure: true, requireApproval: false, maintenanceStart: '00:00', maintenanceEnd: '23:59', autoIntake: true, autoSelectPackages: true, maxPackageCount: 25 },
    { id: 'template-test', name: 'Test Template', channel: 'linux', ringSize: 5, snapshotMode: 'packages', rollbackOnFailure: true, requireApproval: true, maintenanceStart: '20:00', maintenanceEnd: '23:30', autoIntake: true, autoSelectPackages: true, maxPackageCount: 20 },
    { id: 'template-prod', name: 'Prod Template', channel: 'linux', ringSize: 2, snapshotMode: 'full_system', rollbackOnFailure: true, requireApproval: true, maintenanceStart: '22:00', maintenanceEnd: '02:00', autoIntake: true, autoSelectPackages: true, maxPackageCount: 15 },
  ]), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved) && saved.length) {
        setProfiles([...defaultTemplates, ...saved]);
      } else {
        setProfiles(defaultTemplates);
      }
    } catch {
      setProfiles(defaultTemplates);
    }
  }, [defaultTemplates]);

  useEffect(() => {
    const p = profiles.find(x => x.id === selectedProfile);
    if (!p) return;
    setChannel(p.channel || 'linux');
    setRingSize(Math.max(parseInt(p.ringSize || 2), 1));
    setSnapshotMode(p.snapshotMode || 'packages');
    setRollbackOnFailure(p.rollbackOnFailure !== false);
    setRequireApproval(!!p.requireApproval);
    setMaintenanceStart(p.maintenanceStart || '00:00');
    setMaintenanceEnd(p.maintenanceEnd || '23:59');
    setAutoIntake(p.autoIntake !== false);
    setAutoSelectPackages(p.autoSelectPackages !== false);
    setMaxPackageCount(Math.max(parseInt(p.maxPackageCount || 25), 1));
  }, [selectedProfile, profiles]);

  const buildProfilePayload = () => ({
    name: profileName || `Runbook ${new Date().toLocaleDateString()}`,
    channel,
    require_approval: requireApproval,
    approval_role: 'operator',
    config: {
      host_ids: selectedHostIds.map(x => parseInt(x)),
      files: selectedFiles,
      ring_size: ringSize,
      snapshot_mode: snapshotMode,
      rollback_on_failure: rollbackOnFailure,
      maintenance_start: maintenanceStart,
      maintenance_end: maintenanceEnd,
      auto_intake: autoIntake,
      auto_select_packages: autoSelectPackages,
      max_package_count: maxPackageCount,
      approved_by: approvedBy,
      repo_ids: repoId ? [parseInt(repoId)] : [],
    },
    is_active: true,
  });

  const fetchServerRunbookData = useCallback(async () => {
    try {
      const [pr, sr, xr] = await Promise.all([
        apiFetch(`${API}/api/runbook/profiles`),
        apiFetch(`${API}/api/runbook/schedules`),
        apiFetch(`${API}/api/runbook/executions?limit=50`),
      ]);
      setServerProfiles(await pr.json().catch(() => []));
      setServerSchedules(await sr.json().catch(() => []));
      setServerRuns(await xr.json().catch(() => []));
    } catch {}
  }, []);

  useEffect(() => { fetchServerRunbookData(); }, [fetchServerRunbookData]);

  const saveCurrentProfile = async () => {
    const name = (profileName || '').trim();
    if (!name) return alert('Enter profile name');
    try {
      const r = await apiFetch(`${API}/api/runbook/profiles`, { method:'POST', body: JSON.stringify({ ...buildProfilePayload(), name }) });
      if (r.ok) {
        const p = await r.json();
        setSelectedServerProfileId(String(p.id));
        setProfileName('');
        fetchServerRunbookData();
      } else {
        const d = await r.json().catch(() => ({}));
        alert(d.detail || 'Failed to save profile on server');
      }
    } catch {}
    const id = `custom-${Date.now()}`;
    const entry = {
      id,
      name,
      channel,
      ringSize,
      snapshotMode,
      rollbackOnFailure,
      requireApproval,
      maintenanceStart,
      maintenanceEnd,
      autoIntake,
      autoSelectPackages,
      maxPackageCount,
    };
    const custom = [...profiles.filter(p => !String(p.id).startsWith('template-')).filter(p => p.id !== id), entry];
    localStorage.setItem(storageKey, JSON.stringify(custom));
    setProfiles([...defaultTemplates, ...custom]);
    setSelectedProfile(id);
  };

  useEffect(() => {
    if (!selectedServerProfileId) return;
    const p = serverProfiles.find(x => String(x.id) === String(selectedServerProfileId));
    if (!p) return;
    const cfg = p.config || {};
    setChannel(p.channel || 'linux');
    setRequireApproval(!!p.require_approval);
    setRingSize(Math.max(parseInt(cfg.ring_size || 2), 1));
    setSnapshotMode(cfg.snapshot_mode || 'packages');
    setRollbackOnFailure(cfg.rollback_on_failure !== false);
    setMaintenanceStart(cfg.maintenance_start || '00:00');
    setMaintenanceEnd(cfg.maintenance_end || '23:59');
    setAutoIntake(cfg.auto_intake !== false);
    setAutoSelectPackages(cfg.auto_select_packages !== false);
    setMaxPackageCount(Math.max(parseInt(cfg.max_package_count || 25), 1));
    setApprovedBy(cfg.approved_by || '');
    setSelectedHostIds((cfg.host_ids || []).map(x => String(x)));
    setSelectedFiles(cfg.files || []);
    const rid = Array.isArray(cfg.repo_ids) && cfg.repo_ids.length ? cfg.repo_ids[0] : '';
    setRepoId(rid ? String(rid) : '');
  }, [selectedServerProfileId, serverProfiles]);

  const createRunbookSchedule = async () => {
    if (!selectedServerProfileId) return alert('Select server profile');
    const r = await apiFetch(`${API}/api/runbook/schedules`, {
      method:'POST',
      body: JSON.stringify({
        profile_id: parseInt(selectedServerProfileId),
        name: scheduleName || 'Scheduled Run',
        cron_expression: scheduleCron || '0 2 * * *',
        timezone: 'UTC',
        is_active: true,
      }),
    });
    if (r.ok) {
      fetchServerRunbookData();
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.detail || 'Failed to create schedule');
    }
  };

  const approveSchedule = async (id) => {
    const r = await apiFetch(`${API}/api/runbook/schedules/${id}/approve`, { method:'POST' });
    if (r.ok) fetchServerRunbookData();
  };

  const executeServerProfile = async () => {
    const id = selectedServerProfileId || (serverProfiles[0] ? String(serverProfiles[0].id) : '');
    if (!id) return alert('Save or select a server profile first');
    const r = await apiFetch(`${API}/api/runbook/execute/${id}`, { method:'POST' });
    if (r.ok) {
      setTimeout(fetchServerRunbookData, 1200);
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.detail || 'Failed to queue runbook execution');
    }
  };

  const downloadRunAudit = async (runId, kind) => {
    const t = getToken();
    const resp = await fetch(`${API}/api/runbook/executions/${runId}/audit.${kind}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const a = document.createElement('a');
    const u = URL.createObjectURL(blob);
    const cd = resp.headers.get('content-disposition') || '';
    const filename = cd.includes('filename=') ? cd.split('filename=')[1].replace(/"/g, '').trim() : `runbook-${runId}.${kind}`;
    a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u);
  };

  const loadRepos = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/api/mirror/repos`);
      const d = await r.json().catch(() => []);
      const list = Array.isArray(d) ? d : (d.items || []);
      setRepos(list);
      if (!repoId && list.length) {
        const pick = list.find(x => String(x.os_family || '').toLowerCase() === channel) || list[0];
        if (pick?.id) setRepoId(String(pick.id));
      }
    } catch { setRepos([]); }
  }, [repoId, channel]);

  const loadLocalPackages = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/api/packages/local/`);
      const d = await r.json().catch(() => ({}));
      const list = d.packages || [];
      setPackages(list);
      if (!selectedFiles.length) setSelectedFiles(list.slice(0, 5).map(p => p.name));
    } catch { setPackages([]); }
  }, [selectedFiles.length]);

  useEffect(() => { loadRepos(); loadLocalPackages(); }, [loadRepos, loadLocalPackages]);
  useEffect(() => {
    setSelectedHostIds(prev => prev.filter(id => scopedHosts.some(h => String(h.id) === String(id))));
  }, [channel, hosts]);

  const waitForHostJob = async (hostIp, timeoutSeconds = 600) => {
    const start = Date.now();
    while ((Date.now() - start) / 1000 < timeoutSeconds) {
      const r = await apiFetch(`${API}/api/agent/${hostIp}/job/status`);
      const d = await r.json().catch(() => ({}));
      const st = String(d?.status || '').toLowerCase();
      if (st === 'success' || st === 'failed') return d;
      await new Promise(res => setTimeout(res, 3000));
    }
    return { status: 'failed', error: 'Timeout waiting for host job completion' };
  };

  const executeRunbook = async () => {
    if (!selectedHostIds.length) return alert('Select at least one host');
    setRunning(true);
    setRunbookLog([]);
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending', detail: '' })));
    const selectedHosts = scopedHosts.filter(h => selectedHostIds.includes(String(h.id)));
    const snapshotByHost = {};
    let currentStep = 'approval';
    try {
      setStep('approval', 'running', 'Validating approvals and maintenance window');
      addLog('Step 0 approval and maintenance checks');
      if (requireApproval && !String(approvedBy || '').trim()) {
        throw new Error('Approval is required. Please provide approver identity.');
      }
      const now = new Date();
      const [sh, sm] = String(maintenanceStart || '00:00').split(':').map(x => parseInt(x || '0'));
      const [eh, em] = String(maintenanceEnd || '23:59').split(':').map(x => parseInt(x || '0'));
      const startM = (sh * 60) + sm;
      const endM = (eh * 60) + em;
      const nowM = (now.getHours() * 60) + now.getMinutes();
      const inWindow = startM <= endM ? (nowM >= startM && nowM <= endM) : (nowM >= startM || nowM <= endM);
      if (!inWindow) {
        throw new Error(`Current time is outside maintenance window (${maintenanceStart} - ${maintenanceEnd})`);
      }
      setStep('approval', 'success', requireApproval ? `Approved by ${approvedBy}` : 'Approval not required');

      currentStep = 'mirror';
      setStep('mirror', 'running', 'Synchronizing selected mirror repository');
      addLog('Step 1 mirror sync started');
      if (autoIntake) {
        const inScopeRepos = repos.filter(r => String(r.os_family || '').toLowerCase() === channel && r.enabled !== false);
        for (const repo of inScopeRepos) {
          const rr = await apiFetch(`${API}/api/mirror/repos/${repo.id}/sync?wait=true`, { method: 'POST' });
          if (!rr.ok) {
            const rd = await rr.json().catch(() => ({}));
            throw new Error(rd?.detail || rd?.message || `Mirror sync failed for ${repo.name}`);
          }
        }
      } else if (repoId) {
        const rr = await apiFetch(`${API}/api/mirror/repos/${repoId}/sync?wait=true`, { method: 'POST' });
        if (!rr.ok) {
          const rd = await rr.json().catch(() => ({}));
          throw new Error(rd?.detail || rd?.message || 'Mirror sync failed');
        }
      }
      setStep('mirror', 'success', 'Mirror synchronization completed');

      currentStep = 'local_repo';
      setStep('local_repo', 'running', 'Validating package existence in local repository');
      addLog('Step 2 local repo validation');
      const rp = await apiFetch(`${API}/api/packages/local/`);
      const rpd = await rp.json().catch(() => ({}));
      const availablePkgs = rpd?.packages || [];
      if (autoSelectPackages) {
        const picked = availablePkgs.slice(0, Math.max(1, maxPackageCount)).map(x => x.name);
        setSelectedFiles(picked);
      }
      const filesForRun = autoSelectPackages ? availablePkgs.slice(0, Math.max(1, maxPackageCount)).map(x => x.name) : selectedFiles;
      if (!filesForRun.length) throw new Error('No package selected or available in local repository');
      const names = new Set(availablePkgs.map(x => x.name));
      const missing = filesForRun.filter(f => !names.has(f));
      if (missing.length) throw new Error(`Local repository missing packages: ${missing.join(', ')}`);
      setStep('local_repo', 'success', `Validated ${filesForRun.length} package(s)`);

      currentStep = 'precheck';
      setStep('precheck', 'running', 'Running snapshot prechecks on selected hosts');
      addLog('Step 3 host prechecks');
      for (const host of selectedHosts) {
        const pre = await apiFetch(`${API}/api/agent/by-host/${host.id}/snapshot/precheck`, { method: 'POST', body: JSON.stringify({ mode: snapshotMode }) });
        const pd = await pre.json().catch(() => ({}));
        if (!pre.ok || pd?.ok === false) throw new Error(`Precheck failed on ${host.hostname || host.ip}: ${pd?.error || pre.status}`);
      }
      setStep('precheck', 'success', `Prechecks passed on ${selectedHosts.length} host(s)`);

      currentStep = 'snapshot';
      setStep('snapshot', 'running', 'Creating snapshots before rollout');
      addLog('Step 4 creating snapshots');
      for (const host of selectedHosts) {
        const snapName = `runbook-${channel}-${Date.now()}-${host.id}`;
        const sr = await apiFetch(`${API}/api/agent/by-host/${host.id}/snapshot/create`, { method: 'POST', body: JSON.stringify({ name: snapName, mode: snapshotMode }) });
        const sd = await sr.json().catch(() => ({}));
        if (!sr.ok || sd?.success === false) throw new Error(`Snapshot failed on ${host.hostname || host.ip}: ${sd?.error || sr.status}`);
        snapshotByHost[String(host.id)] = snapName;
      }
      setStep('snapshot', 'success', 'Snapshots created successfully');

      currentStep = 'rollout';
      setStep('rollout', 'running', `Staged rollout in rings of ${ringSize}`);
      addLog('Step 5 staged patch rollout started');
      const failedHosts = [];
      for (let i = 0; i < selectedHosts.length; i += Math.max(1, ringSize)) {
        const ring = selectedHosts.slice(i, i + Math.max(1, ringSize));
        addLog(`Running ring ${Math.floor(i / Math.max(1, ringSize)) + 1} with ${ring.length} host(s)`);
        for (const host of ring) {
          const inst = await apiFetch(`${API}/api/agent/${host.ip}/offline/install`, {
            method: 'POST',
            body: JSON.stringify({ files: filesForRun, auto_snapshot: false, auto_rollback: false })
          });
          const id = await inst.json().catch(() => ({}));
          if (!inst.ok || id?.status !== 'started') {
            failedHosts.push({ host, reason: 'start_failed' });
            continue;
          }
          const status = await waitForHostJob(host.ip, 900);
          if (String(status?.status || '').toLowerCase() !== 'success') {
            failedHosts.push({ host, reason: status?.error || 'install_failed' });
          }
        }
        if (failedHosts.length) break;
      }
      if (failedHosts.length) {
        setStep('rollout', 'failed', `Failures on ${failedHosts.map(f => f.host.hostname || f.host.ip).join(', ')}`);
        if (rollbackOnFailure) {
          addLog('Rollback policy active, attempting rollbacks on failed hosts');
          for (const f of failedHosts) {
            const snapName = snapshotByHost[String(f.host.id)];
            if (!snapName) continue;
            await apiFetch(`${API}/api/agent/by-host/${f.host.id}/snapshot/rollback`, { method: 'POST', body: JSON.stringify({ name: snapName }) });
          }
          setStep('postcheck', 'success', 'Rollback policy executed for failed hosts');
        } else {
          setStep('postcheck', 'failed', 'Rollout failed and rollback policy disabled');
        }
        throw new Error('Rollout encountered failures');
      }
      setStep('rollout', 'success', 'All rings completed successfully');

      currentStep = 'postcheck';
      setStep('postcheck', 'running', 'Collecting post-check health state');
      addLog('Step 6 post-check started');
      for (const host of selectedHosts) {
        const jr = await apiFetch(`${API}/api/agent/${host.ip}/job/status`);
        const jd = await jr.json().catch(() => ({}));
        if (String(jd?.status || '').toLowerCase() === 'failed') throw new Error(`Post-check failed on ${host.hostname || host.ip}`);
      }
      setStep('postcheck', 'success', 'Post-check completed with rollback policy intact');
      addLog('Runbook completed successfully');
    } catch (e) {
      addLog(`Runbook stopped: ${e.message}`);
      if (currentStep) setStep(currentStep, 'failed', e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="card highlight-card">
        <h3>Patch Runbook Wizard</h3>
        <p>Executes end-to-end: mirror sync, local repo validation, prechecks, snapshots, staged rollout, and post-check rollback policy.</p>
      </div>
      <div className="card">
        <h3>Runbook Profiles</h3>
        <div className="form-row" style={{marginBottom:10}}>
          <select className="input" value={selectedProfile} onChange={e=>setSelectedProfile(e.target.value)} style={{maxWidth:260}}>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" value={selectedServerProfileId} onChange={e=>setSelectedServerProfileId(e.target.value)} style={{maxWidth:280}}>
            <option value="">Server Profile (optional)</option>
            {serverProfiles.map(p => <option key={`srv-prof-${p.id}`} value={p.id}>{p.name} [{p.channel}]</option>)}
          </select>
          <input className="input" placeholder="Save current as profile" value={profileName} onChange={e=>setProfileName(e.target.value)} style={{maxWidth:260}} />
          <button className="btn btn-secondary" onClick={saveCurrentProfile}>Save Profile</button>
          <button className="btn btn-primary" onClick={executeServerProfile}>Run Server Profile</button>
          <button className="btn btn-sm" onClick={fetchServerRunbookData}>Refresh</button>
        </div>
      </div>
      <div className="card">
        <h3>Scheduled Profile Execution</h3>
        <div className="form-row">
          <input className="input" value={scheduleName} onChange={e=>setScheduleName(e.target.value)} style={{maxWidth:260}} placeholder="Schedule name" />
          <input className="input" value={scheduleCron} onChange={e=>setScheduleCron(e.target.value)} style={{maxWidth:220}} placeholder="Cron (UTC)" />
          <button className="btn btn-secondary" onClick={createRunbookSchedule}>Create Schedule</button>
        </div>
        {serverSchedules.length === 0 ? <p className="text-muted">No schedules created.</p> : (
          <table className="table" style={{marginTop:10}}>
            <thead><tr><th>Name</th><th>Profile</th><th>Cron</th><th>Approved</th><th>Next Run</th><th>Actions</th></tr></thead>
            <tbody>
              {serverSchedules.slice(0, 20).map(s => (
                <tr key={`runbook-schedule-${s.id}`}>
                  <td>{s.name}</td>
                  <td>{serverProfiles.find(p => p.id === s.profile_id)?.name || s.profile_id}</td>
                  <td><code>{s.cron_expression}</code></td>
                  <td>{s.approved_by || '-'}</td>
                  <td>{s.next_run_at ? new Date(s.next_run_at).toLocaleString() : '-'}</td>
                  <td><button className="btn btn-sm btn-success" onClick={()=>approveSchedule(s.id)}>Approve</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="form-row">
          <select className="input" value={channel} onChange={e => setChannel(e.target.value)} style={{maxWidth:180}}>
            <option value="linux">Linux Channel</option>
            <option value="windows">Windows Channel</option>
          </select>
          <select className="input" value={repoId} onChange={e => setRepoId(e.target.value)} style={{maxWidth:260}}>
            <option value="">Select Mirror Repository</option>
            {repos.filter(r => String(r.os_family || '').toLowerCase() === channel).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" type="number" min="1" value={ringSize} onChange={e=>setRingSize(parseInt(e.target.value || 1))} style={{maxWidth:130}} placeholder="Ring size" />
          <select className="input" value={snapshotMode} onChange={e=>setSnapshotMode(e.target.value)} style={{maxWidth:190}}>
            <option value="packages">Snapshot: packages</option>
            <option value="full_system">Snapshot: full system</option>
          </select>
          <label className="toggle-option"><input type="checkbox" checked={autoIntake} onChange={e=>setAutoIntake(e.target.checked)} /> Auto intake updates</label>
          <label className="toggle-option"><input type="checkbox" checked={autoSelectPackages} onChange={e=>setAutoSelectPackages(e.target.checked)} /> Auto select packages</label>
          <input className="input" type="number" min="1" value={maxPackageCount} onChange={e=>setMaxPackageCount(parseInt(e.target.value || 1))} style={{maxWidth:160}} placeholder="Max packages" />
        </div>
        <div className="form-row" style={{marginTop:8}}>
          <label className="toggle-option"><input type="checkbox" checked={requireApproval} onChange={e=>setRequireApproval(e.target.checked)} /> Require approval</label>
          <input className="input" placeholder="Approved by" value={approvedBy} onChange={e=>setApprovedBy(e.target.value)} style={{maxWidth:220}} />
          <input className="input" type="time" value={maintenanceStart} onChange={e=>setMaintenanceStart(e.target.value)} style={{maxWidth:160}} />
          <input className="input" type="time" value={maintenanceEnd} onChange={e=>setMaintenanceEnd(e.target.value)} style={{maxWidth:160}} />
          <label className="toggle-option"><input type="checkbox" checked={rollbackOnFailure} onChange={e=>setRollbackOnFailure(e.target.checked)} /> Rollback on failure</label>
          <button className="btn btn-primary" onClick={executeRunbook} disabled={running}>{running ? 'Running...' : 'Execute Runbook'}</button>
        </div>
      </div>
      <div className="card">
        <h3>Target Hosts ({scopedHosts.length})</h3>
        {scopedHosts.length === 0 ? <p className="text-muted">No hosts in selected channel.</p> : (
          <table className="table">
            <thead><tr><th style={{width:60}}>Use</th><th>Host</th><th>IP</th><th>OS</th></tr></thead>
            <tbody>
              {scopedHosts.map(h => (
                <tr key={`runbook-host-${h.id}`}>
                  <td><input type="checkbox" checked={selectedHostIds.includes(String(h.id))} onChange={()=>setSelectedHostIds(prev => prev.includes(String(h.id)) ? prev.filter(x => x !== String(h.id)) : [...prev, String(h.id)])} /></td>
                  <td>{h.hostname || h.name}</td>
                  <td>{h.ip}</td>
                  <td>{h.os || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h3>Local Repository Packages ({packages.length})</h3>
        {packages.length === 0 ? <p className="text-muted">No packages available in local repository.</p> : (
          <table className="table">
            <thead><tr><th style={{width:60}}>Use</th><th>Name</th><th>Size</th></tr></thead>
            <tbody>
              {packages.slice(0, 150).map(p => (
                <tr key={`runbook-pkg-${p.name}`}>
                  <td><input type="checkbox" checked={selectedFiles.includes(p.name)} onChange={()=>setSelectedFiles(prev => prev.includes(p.name) ? prev.filter(x => x !== p.name) : [...prev, p.name])} /></td>
                  <td>{p.name}</td>
                  <td>{p.size_mb} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h3>Runbook Steps</h3>
        <table className="table">
          <thead><tr><th>Step</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            {steps.map(s => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td>{s.status === 'success' ? <span className="badge badge-success">success</span> : s.status === 'failed' ? <span className="badge badge-danger">failed</span> : s.status === 'running' ? <span className="badge badge-info">running</span> : <span className="badge badge-warning">pending</span>}</td>
                <td>{s.detail || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Execution Log</h3>
        {runbookLog.length === 0 ? <p className="text-muted">No run executed yet.</p> : <pre className="code-block">{runbookLog.join('\n')}</pre>}
      </div>
      <div className="card">
        <h3>Runbook Execution History</h3>
        {serverRuns.length === 0 ? <p className="text-muted">No execution history available.</p> : (
          <table className="table">
            <thead><tr><th>ID</th><th>Status</th><th>Trigger</th><th>Started</th><th>Completed</th><th>Audit</th></tr></thead>
            <tbody>
              {serverRuns.map(run => (
                <tr key={`runbook-run-${run.id}`}>
                  <td>#{run.id}</td>
                  <td>{run.status === 'success' ? <span className="badge badge-success">success</span> : run.status === 'failed' ? <span className="badge badge-danger">failed</span> : <span className="badge badge-info">{run.status}</span>}</td>
                  <td>{run.trigger_type}</td>
                  <td>{run.started_at ? new Date(run.started_at).toLocaleString() : '-'}</td>
                  <td>{run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="btn btn-sm btn-secondary" onClick={()=>downloadRunAudit(run.id, 'csv')}>CSV</button>
                    <button className="btn btn-sm btn-secondary" onClick={()=>downloadRunAudit(run.id, 'pdf')}>PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
/* --- Snapshots --- */
function SnapshotsPage({ hosts }) {
  const [selectedHostId, setSelectedHostId] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snapName, setSnapName] = useState('');
  const [snapMode, setSnapMode] = useState('packages');
  const [serviceList, setServiceList] = useState('');
  const [windowsBackupTarget, setWindowsBackupTarget] = useState('');
  const [actionResult, setActionResult] = useState(null);
  const [createState, setCreateState] = useState('idle');
  const selectedHostRow = hosts.find(h => String(h.id) === String(selectedHostId));
  const selectedHost = selectedHostRow?.ip || '';
  const selectedHostOs = (selectedHostRow?.os || '').toLowerCase();
  const isWindowsHost = selectedHostOs.includes('win');

  const fetchSnapshots = useCallback(async () => {
    if (!selectedHostId) return;
    setLoading(true);
    try { const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/list`); const d = await r.json(); setSnapshots(d.snapshots||[]); } catch { setSnapshots([]); }
    setLoading(false);
  }, [selectedHostId]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const createSnap = async () => {
    setActionResult(null);
    setCreateState('running');
    try {
      const services = serviceList.split(',').map(s=>s.trim()).filter(Boolean);
      const payload = {
        name:snapName||undefined,
        mode:snapMode,
        services,
        backup_target: windowsBackupTarget.trim() || undefined,
      };
      const pre = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/precheck`, {
        method:'POST',
        body: JSON.stringify(payload),
      });
      const preData = await pre.json().catch(()=>({ ok: false, error: `Precheck failed (${pre.status})` }));
      if (!pre.ok || preData.ok === false) {
        setCreateState('failed');
        setActionResult({ success:false, status:'failed', error: preData.error || 'Precheck failed', error_code: preData.error_code || 'precheck_failed', precheck: preData });
        return;
      }
      const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/create`, {
        method:'POST',
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      setActionResult(d);
      setCreateState(d.success ? 'success' : 'failed');
      if (d.success) {
        setSnapName('');
        fetchSnapshots();
      }
    } catch (e) {
      setCreateState('failed');
      setActionResult({success:false,error:e.message,status:'failed'});
    }
  };
  const rollbackSnap = async (name) => {
    if (!window.confirm(`ROLLBACK to snapshot "${name}"?`)) return;
    try { const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/rollback`, { method:'POST', body:JSON.stringify({name}) }); setActionResult(await r.json()); } catch(e) { setActionResult({error:e.message}); }
  };
  const deleteSnap = async (name) => {
    if (!window.confirm(`Delete snapshot "${name}"?`)) return;
    try { await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/delete`, { method:'POST', body:JSON.stringify({name}) }); fetchSnapshots(); } catch {}
  };

  const archiveSnap = async (name) => {
    try {
      const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/archive/${name}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setActionResult(d && Object.keys(d).length ? d : { success: false, error: `Export failed (${r.status})` });
        return;
      }
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fallback = `${name}.tar.gz`;
      const cd = r.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/i);
      a.href = href;
      a.download = (match && match[1]) ? match[1] : fallback;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setActionResult({ success: false, error: e.message });
    }
  };

  const restoreSnap = async (name) => {
    if (!window.confirm(`Restore snapshot "${name}" on ${selectedHost || 'selected host'}? This overwrites the system (Linux).`)) return;
    try {
      const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/rollback`, { method:'POST', body: JSON.stringify({name}) });
      const d = await r.json();
      setActionResult(d);
      if (!d.success) alert(d.error || 'Restore failed');
    } catch (e) { alert(e.message); }
  };

  const restoreFromUrl = async () => {
    const url = window.prompt('Enter snapshot archive URL');
    if (!url) return;
    try {
      const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/restore-url`, { method:'POST', body: JSON.stringify({url}) });
      const d = await r.json();
      setActionResult(d);
    } catch (e) { alert(e.message); }
  };

  const restoreFromFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/api/agent/by-host/${selectedHostId}/snapshot/restore-upload`, { method:'POST', body: fd, headers: authHeaders() });
      const d = await r.json();
      setActionResult(d);
    } catch (err) { alert(err.message); }
    e.target.value = '';
  };

  const cloneSnap = async (name) => {
    const targetIp = window.prompt('Clone to target host IP:');
    if (!targetIp) return;
    try {
      const r = await apiFetch(`${API}/api/agent/clone-snapshot`, { method:'POST', body: JSON.stringify({source_ip:selectedHost, target_ip:targetIp, name}) });
      const d = await r.json();
      setActionResult(d);
      if (!d.success && d.error) alert(d.error);
    } catch (e) { alert(e.message); }
  };

  const cleanup = async () => {
    if(!window.confirm('Delete snapshots older than 30 days?')) return;
    try {
      const r = await apiFetch(`${API}/api/agent/by-host/${selectedHostId}/cleanup`, { method:'POST', body: JSON.stringify({snapshot_retention_days: 30}) });
      const d = await r.json();
      alert(`Deleted ${d.deleted_snapshots.length} snapshots and ${d.deleted_packages.length} packages.`);
      fetchSnapshots();
    } catch(e) { alert(e.message); }
  };

  return (
    <div>
      <div className="card highlight-card"><h3>Image & Snapshot Center</h3><p>Create package or full-system images, export them, restore them, or clone them to another host as part of recovery and image-based provisioning workflows.</p></div>
      <div className="card"><h3>Select Host</h3><select className="input" value={selectedHostId} onChange={e=>setSelectedHostId(e.target.value)}><option value="">-- Select Host --</option>{hosts.map(h=><option key={h.id} value={String(h.id)}>{h.hostname||h.name} ({h.ip})</option>)}</select></div>
      {selectedHostId && <>
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
            <h3>Create Snapshot</h3>
            <div className="btn-group">
              <button className="btn btn-sm btn-secondary" onClick={restoreFromUrl}>Restore from URL</button>
              <label className="btn btn-sm btn-secondary" style={{cursor:'pointer'}}>
                Restore from file
                <input type="file" style={{display:'none'}} onChange={restoreFromFile} />
              </label>
              <button className="btn btn-sm btn-danger" onClick={cleanup}>Cleanup Old</button>
            </div>
          </div>
          <div className="card" style={{marginBottom:10, background:'#fff8e6', border:'1px solid #f59e0b'}}>
            <strong>Important:</strong> Windows full-system restore uses wbadmin and requires Admin; may prompt OS dialogs. Linux full-system restore overwrites the filesystem. Ensure backups, free disk space, and planned downtime.
          </div>
          <div className="form-row">
            <input className="input" placeholder="Snapshot name (optional)" value={snapName} onChange={e=>setSnapName(e.target.value)} style={{flex:1}} />
            <select className="input" value={snapMode} onChange={e=>setSnapMode(e.target.value)} style={{width:200}}>
              <option value="packages">Services + Packages</option>
              <option value="services">Services only</option>
              <option value="selected_services">Selected services</option>
              <option value="full_system">Full system image</option>
            </select>
            <button className="btn btn-success" onClick={createSnap} disabled={createState==='running'}>{createState==='running'?'Creating...':'Create'}</button>
          </div>
          {snapMode==='selected_services' && (
            <div className="form-row" style={{marginTop:8}}>
              <input className="input" placeholder="service1,service2" value={serviceList} onChange={e=>setServiceList(e.target.value)} />
            </div>
          )}
          {snapMode==='full_system' && (
            <p className="text-muted" style={{marginTop:8}}>Full system image may take time and disk space. Ensure the agent runs as Admin/root and has free space.</p>
          )}
          {isWindowsHost && snapMode==='full_system' && (
            <div className="form-row" style={{marginTop:8}}>
              <input
                className="input"
                placeholder="Optional wbadmin target, e.g. \\\\server\\patchmaster-wbadmin or E:"
                value={windowsBackupTarget}
                onChange={e=>setWindowsBackupTarget(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="card"><div className="card-header"><h3>Snapshots ({snapshots.length})</h3><button className="btn btn-sm" onClick={fetchSnapshots}>{loading?'Loading...':'Refresh'}</button></div>
          {snapshots.length===0?<p className="text-muted">No snapshots found.</p>:(
            <table className="table"><thead><tr><th>Name</th><th>Mode</th><th>Created</th><th>Packages</th><th>Image Size</th><th>Actions</th></tr></thead>
            <tbody>{snapshots.map((s,i)=><tr key={i}><td><strong>{s.name}</strong></td><td>{s.mode||'packages'}</td><td>{s.created||'-'}</td><td>{s.packages_count||'-'}</td><td>{s.image_size_bytes?`${(s.image_size_bytes/1024/1024).toFixed(1)} MB`:'-'}</td><td style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button className="btn btn-sm btn-info" onClick={()=>archiveSnap(s.name)}>Export</button>
              <button className="btn btn-sm btn-warning" onClick={()=>rollbackSnap(s.name)}>Rollback</button>
              <button className="btn btn-sm btn-secondary" onClick={()=>restoreSnap(s.name)}>Restore</button>
              <button className="btn btn-sm btn-primary" onClick={()=>cloneSnap(s.name)}>Clone</button>
              <button className="btn btn-sm btn-danger" onClick={()=>deleteSnap(s.name)}>Delete</button>
            </td></tr>)}</tbody></table>
          )}
        </div>
      </>}
      {(createState==='running' || actionResult) && (
        <div className={`card ${createState==='running' || actionResult?.success ? 'result-success' : 'result-failure'}`}>
          <h3>{createState==='running' ? 'Running' : (actionResult?.success ? 'Success' : 'Failed')}</h3>
          {createState==='running' && <p className="text-muted">Snapshot request is in progress. Full-system image can take several minutes.</p>}
          {actionResult?.status && <p><strong>Status:</strong> {String(actionResult.status).toUpperCase()}</p>}
          {actionResult?.error && <p><strong>Error:</strong> {actionResult.error}</p>}
          {actionResult?.error_code && <p><strong>Error code:</strong> {actionResult.error_code}</p>}
          {actionResult?.precheck?.checks?.length > 0 && (
            <div style={{marginTop:8}}>
              <strong>Capacity checks</strong>
              <pre className="code-block">{JSON.stringify(actionResult.precheck.checks, null, 2)}</pre>
            </div>
          )}
          <details><summary>Details</summary><pre className="code-block">{JSON.stringify(actionResult,null,2)}</pre></details>
        </div>
      )}
    </div>
  );
}

/* --- Compare Packages --- */
function ComparePackagesPage({ hosts }) {
  const [selectedHost, setSelectedHost] = useState('');
  const [installed, setInstalled] = useState([]);
  const [upgradable, setUpgradable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');

  const fetchData = async () => {
    if (!selectedHost) return alert('Select a host first');
    setLoading(true); setInstalled([]); setUpgradable([]);
    try {
      const [rI, rU] = await Promise.all([apiFetch(`${API}/api/agent/${selectedHost}/packages/installed`), apiFetch(`${API}/api/agent/${selectedHost}/packages/upgradable`)]);
      setInstalled((await rI.json()).packages||[]); setUpgradable((await rU.json()).packages||[]);
    } catch(e) { alert('Could not reach agent: '+e.message); }
    setLoading(false);
  };

  const upgMap = {}; upgradable.forEach(p=>{upgMap[p.name]=p;});
  const merged = installed.map(p=>({name:p.name,installed_version:p.version,available_version:upgMap[p.name]?.available_version||null,has_update:!!upgMap[p.name]}));
  const filtered = merged.filter(p=>{if(view==='upgradable'&&!p.has_update)return false;if(view==='uptodate'&&p.has_update)return false;if(search&&!p.name.toLowerCase().includes(search.toLowerCase()))return false;return true;});

  return (
    <div>
      <div className="card highlight-card"><h3><span style={{ display: 'inline-flex', marginRight: 8, verticalAlign: 'middle' }}><AppIcon name="search" size={16} /></span>Package Comparison</h3><p>Compare installed vs available package versions.</p></div>
      <div className="card"><div className="form-row">
        <select className="input" value={selectedHost} onChange={e=>setSelectedHost(e.target.value)}><option value="">-- Select Host --</option>{hosts.map(h=><option key={h.id} value={h.ip}>{h.hostname||h.name} ({h.ip})</option>)}</select>
        <button className="btn btn-primary" onClick={fetchData} disabled={loading}>{loading ? 'Scanning...' : 'Scan'}</button>
      </div></div>
      {installed.length>0 && <>
        <div className="stats-grid">
          <div className="stat-card" onClick={()=>setView('all')}><div className="stat-icon">PK</div><div className="stat-info"><span className="stat-number">{installed.length}</span><span className="stat-label">Installed</span></div></div>
          <div className="stat-card warning" onClick={()=>setView('upgradable')}><div className="stat-icon">UP</div><div className="stat-info"><span className="stat-number">{upgradable.length}</span><span className="stat-label">Updates</span></div></div>
          <div className="stat-card success" onClick={()=>setView('uptodate')}><div className="stat-icon"><AppIcon name="shield" size={20} /></div><div className="stat-info"><span className="stat-number">{installed.length-upgradable.length}</span><span className="stat-label">Up-to-date</span></div></div>
        </div>
        <div className="card"><div className="card-header"><h3>Packages ({filtered.length})</h3><input className="input search-input" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
          <div className="package-list"><table className="table"><thead><tr><th>Package</th><th>Installed</th><th>Available</th><th>Status</th></tr></thead>
          <tbody>{filtered.slice(0,200).map((p,i)=><tr key={i} className={p.has_update?'row-update':''}><td><strong>{p.name}</strong></td><td><code>{sanitizeDisplayText(p.installed_version, '-')}</code></td><td>{p.available_version?<code className="text-success-inline">{sanitizeDisplayText(p.available_version, '-')}</code>:<span className="text-muted">-</span>}</td><td>{p.has_update?<span className="badge badge-warning">Update</span>:<span className="badge badge-success">OK</span>}</td></tr>)}</tbody></table>
          {filtered.length>200&&<p className="text-muted">Showing first 200. Use search to filter.</p>}</div>
        </div>
      </>}
    </div>
  );
}

/* --- Windows Update Channel --- */
function WsusPage({ hosts }) {
  const windowsFeatureEnabled = hasPerm('windows_patching') || hasPerm('wsus');
  const windowsHosts = hosts.filter(h => ((h.os || '').toLowerCase().includes('windows')) || ((h.groups || []).map(g => (g || '').toLowerCase()).includes('windows')));
  const [selectedHost, setSelectedHost] = useState('');
  const [updates, setUpdates] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const [wsusPolicy, setWsusPolicy] = useState('latest');
  const [approvalDays, setApprovalDays] = useState(14);
  const [autoSnapshot, setAutoSnapshot] = useState(true);
  const [snapshotNamePrefix, setSnapshotNamePrefix] = useState('wsus-prepatch');
  const [filters, setFilters] = useState({ search:'', severity:'all', reboot:'all', downloaded:'all', sort:'title_asc' });
  const [excludeUpdates, setExcludeUpdates] = useState('');
  const [historyRows, setHistoryRows] = useState([]);
  const excludeTerms = useMemo(
    () => excludeUpdates.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    [excludeUpdates]
  );
  const isWsusExcluded = useCallback((u) => {
    if (!excludeTerms.length) return false;
    const title = String(u?.Title || '').toLowerCase();
    const kb = String(u?.KBArticleIDs || '').toLowerCase();
    const id = String(u?.UpdateID || '').toLowerCase();
    return excludeTerms.some(t => title.includes(t) || kb.includes(t) || id.includes(t));
  }, [excludeTerms]);

  const filteredUpdates = React.useMemo(() => {
    const s = (filters.search || '').toLowerCase();
    return updates
      .filter(u => {
        const matchSearch = !s || (u.Title||'').toLowerCase().includes(s) || (u.KBArticleIDs||'').toString().includes(filters.search);
        const matchSeverity = filters.severity==='all' || (u.MsrcSeverity||'').toLowerCase() === filters.severity.toLowerCase();
        const matchReboot = filters.reboot==='all' || (filters.reboot==='yes'?u.RebootRequired:!u.RebootRequired);
        const matchDl = filters.downloaded==='all' || (filters.downloaded==='yes'?u.IsDownloaded:!u.IsDownloaded);
        return matchSearch && matchSeverity && matchReboot && matchDl;
      })
      .sort((a,b)=>{
        switch(filters.sort){
          case 'title_desc': return (b.Title||'').localeCompare(a.Title||'');
          case 'severity_desc': return (b.MsrcSeverity||'').localeCompare(a.MsrcSeverity||'');
          case 'reboot_desc': return (b.RebootRequired===true) - (a.RebootRequired===true);
          default: return (a.Title||'').localeCompare(b.Title||'');
        }
      });
  }, [updates, filters]);

  const policyAnalyzedUpdates = React.useMemo(() => {
    if (wsusPolicy !== 'n_minus_1') {
      return filteredUpdates.map(u => {
        if (isWsusExcluded(u)) return { ...u, policyIncluded: false, policyReason: 'Excluded by hold/exclude list' };
        return { ...u, policyIncluded: true, policyReason: 'Included by Latest policy' };
      });
    }
    const days = Math.max(0, Number(approvalDays) || 0);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return filteredUpdates.map(u => {
      const raw = u.LastDeploymentChangeTime || u.LastDeploymentChangeTimeUtc || '';
      const ts = Date.parse(raw);
      if (isWsusExcluded(u)) {
        return { ...u, policyIncluded: false, policyReason: 'Excluded by hold/exclude list' };
      }
      if (!Number.isFinite(ts)) {
        return { ...u, policyIncluded: false, policyReason: 'Excluded by N-1: release date unavailable' };
      }
      if (ts > cutoff) {
        return { ...u, policyIncluded: false, policyReason: `Excluded by N-1: newer than ${days} day approval window` };
      }
      return { ...u, policyIncluded: true, policyReason: 'Included by N-1 approval window' };
    });
  }, [filteredUpdates, wsusPolicy, approvalDays, isWsusExcluded]);
  const policyFilteredUpdates = policyAnalyzedUpdates.filter(u => u.policyIncluded);
  const policyExcludedUpdates = policyAnalyzedUpdates.filter(u => !u.policyIncluded);
  const wsusScopeRows = React.useMemo(() => {
    if (selected.length) {
      const selectedSet = new Set(selected.map(String));
      return policyFilteredUpdates.filter(u => selectedSet.has(String(u.UpdateID || '')));
    }
    return policyFilteredUpdates;
  }, [selected, policyFilteredUpdates]);
  const wsusSizeImpact = React.useMemo(() => {
    let totalBytes = 0;
    let known = 0;
    let unknown = 0;
    wsusScopeRows.forEach((u) => {
      const n = Number(u?.MaxDownloadSize);
      if (Number.isFinite(n) && n > 0) {
        totalBytes += n;
        known += 1;
      } else {
        unknown += 1;
      }
    });
    return { totalBytes, known, unknown, count: wsusScopeRows.length };
  }, [wsusScopeRows]);

  useInterval(() => {
    if (!selectedHost) return;
    apiFetch(`${API}/api/agent/${selectedHost}/wsus/status`).then(r=>r.json()).then(setStatus).catch(()=>{});
  }, 8000);
  const refreshHistory = useCallback(async () => {
    if (!selectedHost) { setHistoryRows([]); return; }
    const host = windowsHosts.find(h => h.ip === selectedHost);
    if (!host?.id) { setHistoryRows([]); return; }
    try {
      const r = await apiFetch(`${API}/api/jobs?host_id=${host.id}&limit=25`);
      const d = await r.json().catch(() => []);
      const rows = Array.isArray(d) ? d : [];
      const onlyPatch = rows.filter(j => ['server_patch','upgrade','offline_install','windows_update','patch'].includes(String(j.action || '').toLowerCase()));
      setHistoryRows(onlyPatch);
    } catch {
      setHistoryRows([]);
    }
  }, [selectedHost, windowsHosts]);
  useEffect(() => {
    if (selectedHost) refreshHistory();
  }, [selectedHost, refreshHistory]);

  const refreshUpdates = async () => {
    if (!selectedHost) return alert('Select a Windows host first.');
    setLoading(true);
    setMsg('');
    setSelected([]);
    try {
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/wsus/updates`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to fetch updates');
      setUpdates(d.updates || []);
      refreshHistory();
    } catch (e) {
      setMsg(e.message);
    }
    setLoading(false);
  };

  const downloadUpdatesOnly = async () => {
    if (!selectedHost) return alert('Select a Windows host first.');
    const selectedIds = (selected.length ? selected : policyFilteredUpdates.map(u => u.UpdateID).filter(Boolean))
      .filter(id => {
        const row = updates.find(u => String(u.UpdateID) === String(id));
        return row ? !isWsusExcluded(row) : true;
      });
    if (!selectedIds.length) return alert('No updates selected by filters/policy.');
    setMsg('');
    const r = await apiFetch(`${API}/api/agent/${selectedHost}/wsus/download`, { method:'POST', body: JSON.stringify({ update_ids: selectedIds }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setMsg(`Download started for ${selectedIds.length} update(s). You can install later from downloaded filter.`);
      setTimeout(() => refreshUpdates(), 2500);
      return;
    }
    setMsg(d.error || d.detail || 'Failed to start download');
  };

  const installUpdates = async () => {
    if (!selectedHost) return alert('Select a Windows host first.');
    const selectedIds = (selected.length ? selected : policyFilteredUpdates.map(u => u.UpdateID).filter(Boolean))
      .filter(id => {
        const row = updates.find(u => String(u.UpdateID) === String(id));
        return row ? !isWsusExcluded(row) : true;
      });
    if (!window.confirm(`Install ${selectedIds.length} Windows update(s) on this host? Policy: ${wsusPolicy === 'n_minus_1' ? `N-1 (${approvalDays}d)` : 'Latest'}.`)) return;
    setMsg('');
    try {
      if (autoSnapshot) {
        const hostRow = windowsHosts.find(h => h.ip === selectedHost);
        if (!hostRow?.id) throw new Error('Cannot resolve Windows host for snapshot.');
        const snapName = `${snapshotNamePrefix || 'wsus-prepatch'}-${Date.now()}`;
        const s = await apiFetch(`${API}/api/agent/by-host/${hostRow.id}/snapshot/create`, {
          method:'POST',
          body: JSON.stringify({ name: snapName, mode: 'full_system' })
        });
        const sd = await s.json().catch(() => ({}));
        if (!s.ok || sd?.success === false) {
          throw new Error(sd?.error || `Snapshot failed (${s.status})`);
        }
      }
      const body = { update_ids: selectedIds };
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/wsus/install`, { method:'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to start install job');
      setMsg(`Install started for ${selectedIds.length} update(s). Monitor agent status below.${autoSnapshot ? ' Snapshot created before install.' : ''}`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  if (!windowsFeatureEnabled) {
    return (
      <div className="card">
        <h3>Windows Update Channel</h3>
        <p className="text-muted">Windows patching is not enabled for the current license or role. Open the License page to verify whether Windows patching and WSUS support are included for this environment.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card highlight-card">
        <h3>Windows Update Channel</h3>
        <p>Use Check Updates to scan the selected Windows host, review the policy-scoped results, then download or install them. This workflow uses the Windows Update Agent on the target host and does not require a separate WSUS server inside PatchMaster.</p>
      </div>

      <div className="card">
        <div className="form-row">
          <select className="input" value={selectedHost} onChange={e=>{setSelectedHost(e.target.value); setUpdates([]);}}>
            <option value="">-- Select Windows Host --</option>
            {windowsHosts.map(h => <option key={h.id} value={h.ip}>{h.hostname} ({h.ip})</option>)}
          </select>
          <select className="input" value={wsusPolicy} onChange={e=>setWsusPolicy(e.target.value)} style={{maxWidth:230}}>
            <option value="latest">Policy: Latest approved updates</option>
            <option value="n_minus_1">Policy: N-1 stabilization window</option>
          </select>
          {wsusPolicy==='n_minus_1' && (
            <input
              className="input"
              type="number"
              min="0"
              value={approvalDays}
              onChange={e=>setApprovalDays(e.target.value)}
              style={{maxWidth:180}}
              placeholder="Age gate (days)"
            />
          )}
          <label className="toggle-option" style={{display:'inline-flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={autoSnapshot} onChange={e=>setAutoSnapshot(e.target.checked)} />
            Auto-Snapshot
          </label>
          <input
            className="input"
            style={{maxWidth:260}}
            placeholder="Exclude updates (KB/title/id, comma-separated)"
            value={excludeUpdates}
            onChange={e=>setExcludeUpdates(e.target.value)}
          />
          {autoSnapshot && (
            <input className="input" style={{maxWidth:220}} placeholder="Snapshot prefix" value={snapshotNamePrefix} onChange={e=>setSnapshotNamePrefix(e.target.value)} />
          )}
          <button className="btn btn-primary" onClick={refreshUpdates} disabled={loading}>{loading?'Loading...':'Check Updates'}</button>
          <button className="btn btn-secondary" onClick={downloadUpdatesOnly} disabled={!selectedHost || (status && status.status==='installing')}>
            {selected.length ? `Download Selected (${selected.length})` : `Download In Policy Scope (${policyFilteredUpdates.length})`}
          </button>
          <button className="btn btn-warning" onClick={installUpdates} disabled={!selectedHost || (status && status.status==='installing')}>
            {selected.length ? `Install Selected (${selected.length})` : `Install In Policy Scope (${policyFilteredUpdates.length})`}
          </button>
        </div>
        {msg && <p style={{marginTop:10,fontWeight:500,color:msg.toLowerCase().includes('failed')||msg.toLowerCase().includes('error')?'#dc3545':'#28a745'}}>{msg}</p>}
        {status && (
          <div style={{marginTop:10,display:'flex',gap:10,flexWrap:'wrap'}}>
            <span className="badge badge-info">State: {status.status || 'idle'}</span>
            <span className="badge badge-success">Pending: {status.pending_count ?? 0}</span>
            {status.last_scan && <span className="badge badge-dark">Last scan: {new Date(status.last_scan).toLocaleTimeString()}</span>}
            {status.last_error && <span className="badge badge-danger">Error: {status.last_error}</span>}
          </div>
        )}
        <div style={{marginTop:10,display:'flex',gap:10,flexWrap:'wrap'}}>
          <span className="badge badge-info">Scope: {wsusSizeImpact.count} update(s)</span>
          <span className="badge badge-info">Estimated download: {(wsusSizeImpact.totalBytes / (1024 * 1024)).toFixed(2)} MB</span>
          <span className="badge badge-success">Known size: {wsusSizeImpact.known}</span>
          <span className="badge badge-warning">Unknown size: {wsusSizeImpact.unknown}</span>
        </div>
      </div>

      {selectedHost && (
        <div className="card">
          <h3>Windows Update Agent Status</h3>
          {status && Object.keys(status).length ? (
            <pre className="code-block">{JSON.stringify(status, null, 2)}</pre>
          ) : (
            <p className="text-muted">No agent status is available yet. Run Check Updates first to populate the Windows update scan state for this host.</p>
          )}
        </div>
      )}
      {selectedHost && (
        <div className="card">
          <h3>Patch History (Latest 25)</h3>
          {historyRows.length === 0 ? <p className="text-muted">No patch history yet for this host.</p> : (
            <table className="table">
              <thead><tr><th>ID</th><th>Action</th><th>Status</th><th>Started</th><th>Completed</th></tr></thead>
              <tbody>
                {historyRows.map(h => (
                  <tr key={`wsus-history-${h.id}`}>
                    <td>#{h.id}</td>
                    <td>{h.action}</td>
                    <td><span className={`badge ${String(h.status||'').toLowerCase()==='success'?'badge-success':String(h.status||'').toLowerCase()==='failed'?'badge-danger':String(h.status||'').toLowerCase()==='running'?'badge-info':'badge-warning'}`}>{h.status || '-'}</span></td>
                    <td>{h.started_at ? new Date(h.started_at).toLocaleString() : '-'}</td>
                    <td>{h.completed_at ? new Date(h.completed_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <h3>Pending Updates ({policyFilteredUpdates.length}/{updates.length})</h3>
        {wsusPolicy==='n_minus_1' && (
          <p className="text-muted">N-1 policy keeps updates older than {approvalDays} day(s) using LastDeploymentChangeTime. Excluded by policy: {policyExcludedUpdates.length}.</p>
        )}
        <div className="form-row" style={{marginBottom:10}}>
          <input className="input" placeholder="Search title or KB..." value={filters.search} onChange={e=>setFilters({...filters, search:e.target.value})} />
          <select className="input" value={filters.severity} onChange={e=>setFilters({...filters, severity:e.target.value})}>
            <option value="all">All severities</option>
            <option value="Critical">Critical</option>
            <option value="Important">Important</option>
            <option value="Moderate">Moderate</option>
            <option value="Low">Low</option>
            <option value="Unspecified">Unspecified</option>
          </select>
          <select className="input" value={filters.reboot} onChange={e=>setFilters({...filters, reboot:e.target.value})}>
            <option value="all">Reboot: All</option>
            <option value="yes">Reboot required</option>
            <option value="no">No reboot</option>
          </select>
          <select className="input" value={filters.downloaded} onChange={e=>setFilters({...filters, downloaded:e.target.value})}>
            <option value="all">Downloaded: All</option>
            <option value="yes">Downloaded</option>
            <option value="no">Not downloaded</option>
          </select>
          <select className="input" value={filters.sort} onChange={e=>setFilters({...filters, sort:e.target.value})}>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
            <option value="severity_desc">Severity high-low</option>
            <option value="reboot_desc">Reboot required first</option>
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => setSelected(policyFilteredUpdates.map(u => u.UpdateID).filter(Boolean))}>Select All</button>
          <button className="btn btn-sm" onClick={() => setSelected([])}>Clear</button>
        </div>
        {policyFilteredUpdates.length === 0 ? <p className="text-muted">No updates returned (or filtered out by policy).</p> : (
          <table className="table">
            <thead><tr><th style={{width:'60px'}}>Select</th><th>Title</th><th>KB</th><th>Severity</th><th>Downloaded</th><th>Reboot</th><th>ID</th></tr></thead>
            <tbody>{policyFilteredUpdates.map((u,i)=>(
              <tr key={i} style={isWsusExcluded(u) ? {opacity:0.55} : undefined}>
                <td><input type="checkbox" checked={selected.includes(u.UpdateID)} onChange={()=>setSelected(prev=>prev.includes(u.UpdateID)?prev.filter(x=>x!==u.UpdateID):[...prev,u.UpdateID])} /></td>
                <td style={{maxWidth:520,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={u.Title || ''}>{u.Title || '-'}</td>
                <td>{Array.isArray(u.KBArticleIDs) ? u.KBArticleIDs.join(',') : (u.KBArticleIDs || '-')}</td>
                <td>{u.MsrcSeverity || '-'}</td>
                <td>{u.IsDownloaded ? <span className="badge badge-success">Yes</span> : <span className="badge badge-warning">No</span>}</td>
                <td>{u.RebootRequired ? <span className="badge badge-warning">Yes</span> : <span className="badge badge-success">No</span>}</td>
                <td><code style={{fontSize:11}}>{u.UpdateID || '-'}</code></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {wsusPolicy==='n_minus_1' && policyExcludedUpdates.length > 0 && (
        <div className="card">
          <h3>Excluded by N-1 Policy ({policyExcludedUpdates.length})</h3>
          <table className="table">
            <thead><tr><th>Title</th><th>KB</th><th>Reason</th></tr></thead>
            <tbody>{policyExcludedUpdates.map((u,i)=>(
              <tr key={`excluded-${i}`}>
                <td style={{maxWidth:520,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={u.Title || ''}>{u.Title || '-'}</td>
                <td>{Array.isArray(u.KBArticleIDs) ? u.KBArticleIDs.join(',') : (u.KBArticleIDs || '-')}</td>
                <td>{u.policyReason}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --- Offline Patching --- */
function OfflinePatchPage({ hosts, allowedOS = 'all', channelTitle = 'Offline Patching and Air-Gapped Setup' }) {
  const [selectedHost, setSelectedHost] = useState('');
  const [offlinePkgs, setOfflinePkgs] = useState([]);
  const [masterPkgs, setMasterPkgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [autoSnapshot, setAutoSnapshot] = useState(true);
  const [autoRollback, setAutoRollback] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showPushModal, setShowPushModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [availableUpdates, setAvailableUpdates] = useState([]);
  const [selectedUpdates, setSelectedUpdates] = useState([]);
  const [updatePolicy, setUpdatePolicy] = useState('latest');
  const [intakeJobId, setIntakeJobId] = useState(null);
  const [intakeJob, setIntakeJob] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const scopedHosts = hosts.filter((h) => {
    const raw = String(h?.os || h?.os_type || h?.platform || '').toLowerCase();
    const isWindows = raw.includes('windows');
    if (allowedOS === 'windows') return isWindows;
    if (allowedOS === 'linux') return !isWindows;
    return true;
  });

  const showToast = (text, type='info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const osLabelForHost = (h) => {
    const raw = (h?.os || h?.os_type || h?.platform || '').toLowerCase();
    if (raw.includes('windows')) return 'Windows';
    if (raw.includes('mac')) return 'macOS';
    if (raw.includes('ubuntu') || raw.includes('debian') || raw.includes('centos') || raw.includes('rocky') || raw.includes('rhel') || raw.includes('linux')) return 'Linux';
    return h?.os || h?.os_type || 'Unknown';
  };

  // Poll for job status
  useInterval(() => {
    if (jobId && (!jobStatus || (jobStatus.status !== 'success' && jobStatus.status !== 'failed'))) {
      apiFetch(`${API}/api/agent/${selectedHost}/job/status`)
        .then(r => r.json())
        .then(d => setJobStatus(d))
        .catch(() => {});
    }
  }, jobId ? 2000 : null);
  useInterval(() => {
    if (!intakeJobId) return;
    apiFetch(`${API}/api/jobs/${intakeJobId}`)
      .then(r => r.json())
      .then((d) => {
        setIntakeJob(d);
        const st = String(d?.status || '').toLowerCase();
        if (st === 'success' || st === 'failed' || st === 'rolled_back') {
          setTimeout(() => fetchMasterPkgs(), 1200);
          setTimeout(() => fetchHistory(), 1200);
        }
      })
      .catch(() => {});
  }, intakeJobId ? 2500 : null);

  const fetchPkgs = useCallback(async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const hostObj = scopedHosts.find(h => h.ip === selectedHost);
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/offline/list`);
      setOfflinePkgs((await r.json()).pkgs || []);
    } catch { setOfflinePkgs([]); }
    setLoading(false);
  }, [selectedHost, scopedHosts]);
  const fetchAvailableUpdates = useCallback(async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const hostObj = scopedHosts.find(h => h.ip === selectedHost);
      if (!hostObj) return;
      const osName = String(hostObj.os || '').toLowerCase();
      if (osName.includes('windows')) {
        const r = await apiFetch(`${API}/api/agent/${selectedHost}/wsus/updates`);
        const d = await r.json().catch(() => ({}));
        const rows = d.updates || [];
        setAvailableUpdates(rows.map(u => ({ key: u.UpdateID, name: u.Title || u.UpdateID, raw: u })));
      } else {
        const r = await apiFetch(`${API}/api/agent/${selectedHost}/packages/upgradable`);
        const d = await r.json().catch(() => ({}));
        const rows = d.packages || [];
        setAvailableUpdates(rows.map(u => ({ key: u.name, name: `${u.name} (${u.current_version || 'unknown'} -> ${u.available_version || 'unknown'})`, raw: u })));
      }
      setSelectedUpdates([]);
    } catch {
      setAvailableUpdates([]);
    }
    setLoading(false);
  }, [selectedHost, scopedHosts]);
  const fetchHistory = useCallback(async () => {
    if (!selectedHost) { setHistoryRows([]); return; }
    const hostObj = scopedHosts.find(h => h.ip === selectedHost);
    if (!hostObj?.id) { setHistoryRows([]); return; }
    try {
      const r = await apiFetch(`${API}/api/jobs?host_id=${hostObj.id}&limit=25`);
      const d = await r.json().catch(() => []);
      setHistoryRows(Array.isArray(d) ? d : []);
    } catch {
      setHistoryRows([]);
    }
  }, [selectedHost, scopedHosts]);

  const fetchMasterPkgs = async () => {
    try {
      const r = await apiFetch(`${API}/api/packages/local/`);
      setMasterPkgs((await r.json()).packages || []);
    } catch { setMasterPkgs([]); }
  };

  useEffect(() => { fetchPkgs(); }, [fetchPkgs]);
  useEffect(() => { if (showPushModal) fetchMasterPkgs(); }, [showPushModal]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => {
    const st = String(jobStatus?.status || '').toLowerCase();
    if (st === 'success' || st === 'failed' || st === 'rolled_back') {
      fetchHistory();
    }
  }, [jobStatus, fetchHistory]);
  useEffect(() => {
    if (selectedHost && !scopedHosts.some(h => h.ip === selectedHost)) {
      setSelectedHost('');
      setOfflinePkgs([]);
      setSelectedFiles([]);
    }
  }, [selectedHost, scopedHosts]);

  const pushFromMaster = async (filename) => {
    const hostObj = scopedHosts.find(h => h.ip === selectedHost);
    if (!hostObj) return;
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/api/packages/local/push/${hostObj.id}?filename=${filename}`, { method: 'POST' });
      const payload = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast(`Pushed ${filename} to agent`,'success');
        fetchPkgs();
        setShowPushModal(false);
      } else {
        const detail = payload?.detail && typeof payload.detail === 'object' ? payload.detail : payload;
        const message = detail?.message || payload?.message || 'Push failed';
        const reason = detail?.reason || detail?.agent_response?.detail || detail?.agent_response?.raw || '';
        showToast(reason ? `${message}: ${String(reason).slice(0, 140)}` : message,'danger');
      }
    } catch(e) { showToast('Error: ' + e.message,'danger'); }
    setLoading(false);
  };

  const installOffline = async () => {
    const hostRow = scopedHosts.find(h => h.ip === selectedHost);
    if (!hostRow) return showToast('Host is outside selected channel scope','danger');
    if (!window.confirm(`Install ${selectedFiles.length || 'ALL'} package(s) on ${selectedHost}?`)) return;
    setJobId(null); setJobStatus(null); setLoading(true);
    try {
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/offline/install`, {
        method: 'POST',
        body: JSON.stringify({ files: selectedFiles.length > 0 ? selectedFiles : [], auto_snapshot: autoSnapshot, auto_rollback: autoRollback })
      });
      const d = await r.json();
      if (d.status === 'started') {
        setJobId('offline_install'); // Agent only tracks one job at a time, so ID doesn't matter much for direct polling
      } else {
        showToast('Failed to start job: ' + JSON.stringify(d),'danger');
      }
      fetchPkgs();
    } catch (e) { showToast('Error: ' + e.message,'danger'); }
    setLoading(false);
  };
  const downloadUpdatesOnly = async () => {
    const hostObj = scopedHosts.find(h => h.ip === selectedHost);
    if (!hostObj) return showToast('Select valid host', 'danger');
    const osName = String(hostObj.os || '').toLowerCase();
    try {
      if (osName.includes('windows')) {
        const ids = selectedUpdates.length ? selectedUpdates : availableUpdates.map(u => u.key).filter(Boolean);
        if (!ids.length) return showToast('No updates selected', 'danger');
        const r = await apiFetch(`${API}/api/agent/${selectedHost}/wsus/download`, { method:'POST', body: JSON.stringify({ update_ids: ids }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return showToast(d.error || 'Download failed', 'danger');
        showToast(`Download started for ${ids.length} update(s)`, 'success');
        return;
      }
      const names = selectedUpdates.length ? selectedUpdates : availableUpdates.map(u => u.key).filter(Boolean);
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/patch/server-patch`, {
        method:'POST',
        body: JSON.stringify({ packages: names, download_only: true, save_to_repo: true, update_policy: updatePolicy }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return showToast(d.detail?.message || d.error || 'Intake failed', 'danger');
      setIntakeJobId(d.job_id || null);
      setIntakeJob({ status:'running', id:d.job_id });
      showToast('Download-only intake started. Packages will be stored in local repository.', 'success');
    } catch {
      showToast('Intake failed', 'danger');
    }
  };

  const clearPkgs = async () => {
    if (!window.confirm('Remove all package files?')) return;
    await apiFetch(`${API}/api/agent/${selectedHost}/cleanup`, { method: 'POST', body: JSON.stringify({package_retention_days: 0}) });
    fetchPkgs();
  };

  return (
    <div>
      {toast && (
        <div style={{
          position:'fixed', bottom:20, right:20, padding:'12px 16px', borderRadius:8,
          background: toast.type==='success' ? '#0f5132' : toast.type==='danger' ? '#842029' : '#1e293b',
          color: '#fff', boxShadow:'0 10px 20px rgba(0,0,0,0.25)', zIndex:2000
        }}>
          {toast.text}
        </div>
      )}
      <div className="card highlight-card">
        <h3>{channelTitle}</h3>
        <p>Transparent flow: mirror online repositories into local repository, then push from local repository to target servers in a controlled manner.</p>
      </div>

      <div className="card">
        <h3>Select Target Host</h3>
        <select className="input" value={selectedHost} onChange={e => {setSelectedHost(e.target.value); setJobId(null); setJobStatus(null);}}>
          <option value="">-- Select Host --</option>
          {scopedHosts.map(h => <option key={h.id} value={h.ip}>{h.hostname || h.name} ({h.ip}) - {osLabelForHost(h)}</option>)}
        </select>
        {selectedHost && (
          <p className="text-muted" style={{marginTop:6}}>
            Detected OS: <strong>{osLabelForHost(scopedHosts.find(h=>h.ip===selectedHost))}</strong>
          </p>
        )}
      </div>

      {selectedHost && (
        <>
          <div className="card">
            <div className="card-header">
              <h3>Available Updates Intake ({availableUpdates.length})</h3>
              <div className="btn-group">
                <select className="input" style={{minWidth:160}} value={updatePolicy} onChange={e=>setUpdatePolicy(e.target.value)}>
                  <option value="latest">Policy: Latest</option>
                  <option value="security">Policy: Security</option>
                </select>
                <button className="btn btn-sm btn-primary" onClick={fetchAvailableUpdates}>Check Available Updates</button>
                <button className="btn btn-sm btn-warning" onClick={downloadUpdatesOnly}>
                  {selectedUpdates.length ? `Download Selected (${selectedUpdates.length})` : `Download All (${availableUpdates.length})`}
                </button>
              </div>
            </div>
            {intakeJob && (
              <div style={{marginBottom:10}}>
            <span className="badge badge-info">Intake Job #{intakeJob.id || intakeJobId || '-'}: {intakeJob.status || 'running'}</span>
              </div>
            )}
            {availableUpdates.length === 0 ? (
              <p className="text-muted" style={{ padding: '1rem' }}>No available updates loaded yet. Click "Check Available Updates".</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{width:60}}>
                      <input
                        type="checkbox"
                        checked={selectedUpdates.length > 0 && selectedUpdates.length === availableUpdates.length}
                        onChange={(e)=>setSelectedUpdates(e.target.checked ? availableUpdates.map(x=>x.key) : [])}
                      />
                    </th>
                    <th>Update / Package</th>
                  </tr>
                </thead>
                <tbody>
                  {availableUpdates.map((u, idx) => (
                    <tr key={`available-update-${idx}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUpdates.includes(u.key)}
                          onChange={()=>setSelectedUpdates(prev => prev.includes(u.key) ? prev.filter(x=>x!==u.key) : [...prev, u.key])}
                        />
                      </td>
                      <td>{u.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-header">
              <h3>Agent Local Storage ({offlinePkgs.length})</h3>
              <div className="btn-group">
                <button className="btn btn-sm btn-primary" onClick={() => setShowPushModal(true)}>Push from Master Repo</button>
                <button className="btn btn-sm" onClick={fetchPkgs}>Refresh</button>
                <button className="btn btn-sm btn-danger" onClick={clearPkgs}>Clear All</button>
              </div>
            </div>
            {offlinePkgs.length === 0 ? (
              <p className="text-muted" style={{ padding: '1rem' }}>No packages found on agent storage. Push from Master or upload via SCP.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Select</th>
                    <th>Filename</th>
                    <th>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {offlinePkgs.map((d, i) => (
                    <tr key={i} className={selectedFiles.includes(d.name) ? 'row-selected' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(d.name)}
                          onChange={() => setSelectedFiles(prev => prev.includes(d.name) ? prev.filter(f => f !== d.name) : [...prev, d.name])}
                        />
                      </td>
                      <td><strong>{d.name}</strong></td>
                      <td>{d.size_mb} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>Installation Options</h3>
            <div className="options-grid">
              <label className="toggle-option"><input type="checkbox" checked={autoSnapshot} onChange={e => setAutoSnapshot(e.target.checked)} /> Auto-Snapshot</label>
              <label className="toggle-option"><input type="checkbox" checked={autoRollback} onChange={e => setAutoRollback(e.target.checked)} /> Auto-Rollback</label>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-lg btn-success" onClick={installOffline} disabled={loading || offlinePkgs.length === 0 || (jobId && jobStatus?.status === 'running')}>
                {jobId && jobStatus?.status === 'running' ? 'Installing...' : `Install ${selectedFiles.length || 'All'} Package(s)`}
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Patch History (Time / Date)</h3>
            {historyRows.length === 0 ? (
              <p className="text-muted">No patch jobs found yet for this host.</p>
            ) : (
              <table className="table">
                <thead><tr><th>ID</th><th>Action</th><th>Status</th><th>Started</th><th>Completed</th></tr></thead>
                <tbody>
                  {historyRows.map((h) => (
                    <tr key={`hist-${h.id}`}>
                      <td>#{h.id}</td>
                    <td>{h.action || '-'}</td>
                    <td>{h.status || '-'}</td>
                    <td>{h.started_at ? new Date(h.started_at).toLocaleString() : '-'}</td>
                    <td>{h.completed_at ? new Date(h.completed_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {jobStatus && (
        <div className={`card ${jobStatus.status==='success'?'result-success':jobStatus.status==='failed'?'result-failure':'result-running'}`} style={{background: jobStatus.status==='running'?'#fffbeb':undefined}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>Status: {jobStatus.status.toUpperCase()}</h3>
            {jobStatus.status === 'running' && <span className="spinner"></span>}
          </div>
          {jobStatus.log && (
            <div style={{background:'#1e293b', color:'#e2e8f0', padding:12, borderRadius:6, fontFamily:'monospace', whiteSpace:'pre-wrap', maxHeight:300, overflowY:'auto'}}>
              {jobStatus.log.join('\n') || 'Processing...'}
            </div>
          )}
          {jobStatus.last_result && <details><summary>Final Result</summary><pre className="code-block">{JSON.stringify(jobStatus.last_result,null,2)}</pre></details>}
        </div>
      )}

      {showPushModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <h3>Push Package to {selectedHost}</h3>
            <p style={{ color: '#9ca3af', marginBottom: 20 }}>Select a package from the Master node's local repository to transfer to the air-gapped agent.</p>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
              <table className="table">
                <thead><tr><th>Package</th><th>Size</th><th>Action</th></tr></thead>
                <tbody>
                  {masterPkgs.map(p => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>{p.size_mb} MB</td>
                      <td><button className="btn btn-sm btn-primary" onClick={() => pushFromMaster(p.name)}>Push</button></td>
                    </tr>
                  ))}
                  {masterPkgs.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#666' }}>Local repository is empty.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setShowPushModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* --- Schedules --- */
function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ group_id:'', cron_expression:'0 2 * * SAT', action:'upgrade', auto_snapshot:true, auto_rollback:true, auto_reboot:false });

  const refresh = () => { apiFetch(`${API}/api/schedules/`).then(r=>r.json()).then(setSchedules).catch(()=>{}); };
  useEffect(()=>{ refresh(); apiFetch(`${API}/api/groups/`).then(r=>r.json()).then(setGroups).catch(()=>{}); },[]);

  const create = () => {
    if(!form.group_id) return alert('Select a group');
    apiFetch(`${API}/api/schedules/`, { method:'POST', body:JSON.stringify({...form,group_id:parseInt(form.group_id)}) }).then(()=>{refresh();setForm({group_id:'',cron_expression:'0 2 * * SAT',action:'upgrade',auto_snapshot:true,auto_rollback:true,auto_reboot:false});});
  };
  const del = id => { if(!window.confirm('Delete schedule?'))return; apiFetch(`${API}/api/schedules/${id}`,{method:'DELETE'}).then(refresh); };
  const toggle = async (id, enabled) => { await apiFetch(`${API}/api/schedules/${id}`,{method:'PUT',body:JSON.stringify({is_active:!enabled})}); refresh(); };

  return (
    <div>
      <div className="card"><h3>Create Schedule</h3>
        <div className="form-row">
          <select className="input" value={form.group_id} onChange={e=>setForm(f=>({...f,group_id:e.target.value}))}>
            <option value="">-- Select Group --</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input className="input" placeholder="Cron (e.g. 0 2 * * SAT)" value={form.cron_expression} onChange={e=>setForm(f=>({...f,cron_expression:e.target.value}))} />
          <select className="input" value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}><option value="upgrade">Upgrade</option><option value="server_patch">Server Patch</option></select>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
        <div className="options-grid" style={{marginTop:10}}>
          <label className="toggle-option"><input type="checkbox" checked={form.auto_snapshot} onChange={e=>setForm(f=>({...f,auto_snapshot:e.target.checked}))} /> Auto-Snapshot</label>
          <label className="toggle-option"><input type="checkbox" checked={form.auto_rollback} onChange={e=>setForm(f=>({...f,auto_rollback:e.target.checked}))} /> Auto-Rollback</label>
          <label className="toggle-option"><input type="checkbox" checked={form.auto_reboot} onChange={e=>setForm(f=>({...f,auto_reboot:e.target.checked}))} /> Auto-Reboot</label>
        </div>
      </div>
      <div className="card"><h3>Schedules ({schedules.length})</h3>
        {schedules.length===0?<p className="text-muted">No schedules created.</p>:(
          <table className="table"><thead><tr><th>Group</th><th>Cron</th><th>Action</th><th>Snapshot</th><th>Rollback</th><th>Enabled</th><th>Next Run</th><th>Actions</th></tr></thead>
            <tbody>{schedules.map(s=><tr key={s.id}><td><strong>{s.group_name||s.group_id}</strong></td><td><code>{s.cron_expression}</code></td><td>{s.action}</td><td>{s.auto_snapshot ? <span className="badge badge-success">Yes</span> : <span className="badge badge-warning">No</span>}</td><td>{s.auto_rollback ? <span className="badge badge-success">Yes</span> : <span className="badge badge-warning">No</span>}</td><td><button className={`btn btn-sm ${s.is_active?'btn-success':'btn-secondary'}`} onClick={()=>toggle(s.id,s.is_active)}>{s.is_active?'ON':'OFF'}</button></td><td>{s.next_run||'-'}</td><td><button className="btn btn-sm btn-danger" onClick={()=>del(s.id)}>Del</button></td></tr>)}</tbody></table>
        )}
      </div>
    </div>
  );
}

/* --- CVE Tracker --- */
function CVEPage() {
  return (
    <CVEOpsPage
      API={API}
      apiFetch={apiFetch}
      hasRole={hasRole}
      getToken={getToken}
      AppIcon={AppIcon}
    />
  );
}
/* --- Software Manager --- */
function SoftwarePage({ hosts }) {
  return <SoftwarePageView hosts={hosts} API={API} apiFetch={apiFetch} />;
}

function JobsPage({ jobs, setJobs }) {
  return <JobsPageView jobs={jobs} setJobs={setJobs} API={API} apiFetch={apiFetch} useInterval={useInterval} hasRole={hasRole} />;
}

function OpsQueuePage({ focusJobId, focusJobSeq }) {
  return <OpsQueuePageView API={API} apiFetch={apiFetch} useInterval={useInterval} toast={useToastCtx()} focusJobId={focusJobId} focusJobSeq={focusJobSeq} />;
}

function PluginIntegrationsPage() {
  return <PluginIntegrationsPageView API={API} apiFetch={apiFetch} useInterval={useInterval} toast={useToastCtx()} />;
}

function RingRolloutPage() {
  return <RingRolloutPageView API={API} apiFetch={apiFetch} useInterval={useInterval} toast={useToastCtx()} />;
}

function AuditPage() {
  return <AuditPageView API={API} apiFetch={apiFetch} />;
}

function NotificationsPage() {
  return <NotificationsPageView API={API} apiFetch={apiFetch} hasRole={hasRole} />;
}

function UsersPage() {
  return (
    <UsersOpsPage
      API={API}
      apiFetch={apiFetch}
      AppIcon={AppIcon}
    />
  );
}

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || error || 'Unknown error') };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <h3>{this.props.title || 'Page error'}</h3>
          <p className="text-muted">This page failed to render. Reload or check latest backend migration/restart.</p>
          <pre className="code-block">{this.state.message}</pre>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, message: '' })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CICDPage() {
  return (
    <PageErrorBoundary title="CI/CD page error">
      <CICDOpsPage
        API={API}
        apiFetch={apiFetch}
        hasPerm={hasPerm}
        hasRole={hasRole}
        getToken={getToken}
        useToastCtx={useToastCtx}
        TestingPage={TestingPage}
        AppIcon={AppIcon}
      />
    </PageErrorBoundary>
  );
}

function BackupManagerPage() {
  return (
    <BackupManagerPageView
      API={API}
      apiFetch={apiFetch}
      useInterval={useInterval}
    />
  );
}

function ProvisioningPage({ hosts }) {
  return (
    <ProvisioningPageView
      hosts={hosts}
      API={API}
      apiFetch={apiFetch}
      useInterval={useInterval}
    />
  );
}

function NetworkBootPage({ hosts }) {
  return (
    <NetworkBootPageView
      hosts={hosts}
      API={API}
      apiFetch={apiFetch}
      useInterval={useInterval}
      AppIcon={AppIcon}
    />
  );
}

function RestoreDrillPage() {
  return <RestoreDrillPageView API={API} apiFetch={apiFetch} useInterval={useInterval} toast={useToastCtx()} />;
}

function PolicyManagerPage() {
  return (
    <PolicyManagerPageView
      API={API}
      apiFetch={apiFetch}
    />
  );
}

function ReportsPage() {
  return (
    <ReportsOpsPage
      API={API}
      apiFetch={apiFetch}
      getToken={getToken}
      authHeaders={authHeaders}
      toast={useToastCtx()}
      AppIcon={AppIcon}
    />
  );
}
/* --- Local Repository --- */
function LocalRepoPage() {
  return (
    <LocalRepoOpsPage
      API={API}
      apiFetch={apiFetch}
      AppIcon={AppIcon}
    />
  );
}

function MirrorReposPage() {
  return (
    <MirrorRepoOpsPage
      API={API}
      apiFetch={apiFetch}
      AppIcon={AppIcon}
    />
  );
}

function MonitoringToolsPage({ licenseInfo, hosts }) {
  return (
    <MonitoringOpsPage
      licenseInfo={licenseInfo}
      hosts={hosts}
      API={API}
      apiFetch={apiFetch}
      hasRole={hasRole}
      getToken={getToken}
    />
  );
}
function AlertsCenterPage() {
  return <AlertsCenterPageView API={API} apiFetch={apiFetch} useInterval={useInterval} toast={useToastCtx()} />;
}
function OnboardingPage() {
  return <OnboardingOpsPage AppIcon={AppIcon} />;
}

function LicensePage({ licenseInfo, onRefresh }) {
  return (
    <LicenseOpsPage
      licenseInfo={licenseInfo}
      onRefresh={onRefresh}
      API={API}
      apiFetch={apiFetch}
      AppIcon={AppIcon}
    />
  );
}

function SettingsPage({ health, hosts, jobs }) {
  return (
    <SettingsOpsPage
      health={health}
      hosts={hosts}
      jobs={jobs}
      API={API}
      apiFetch={apiFetch}
      AppIcon={AppIcon}
    />
  );
}

function SLAPage() {
  const toast = useToastCtx();
  return <SLAOpsPage API={API} apiFetch={apiFetch} toast={toast} />;
}

function RemediationPage() {
  const toast = useToastCtx();
  return <RemediationPageView API={API} apiFetch={apiFetch} toast={toast} />;
}

function MaintenanceWindowsPage() {
  const toast = useToastCtx();
  return <MaintenanceWindowsPageView API={API} apiFetch={apiFetch} toast={toast} />;
}

function PatchHooksPage() {
  const toast = useToastCtx();
  return <PatchHooksPageView API={API} apiFetch={apiFetch} toast={toast} />;
}

function BulkPatchPage({ hosts, linuxHosts, windowsHosts }) {
  const toast = useToastCtx();
  return (
    <BulkPatchPageView
      hosts={hosts}
      linuxHosts={linuxHosts || hosts.filter(h => !String(h?.os || '').toLowerCase().includes('windows'))}
      windowsHosts={windowsHosts || hosts.filter(h => String(h?.os || '').toLowerCase().includes('windows'))}
      API={API}
      apiFetch={apiFetch}
      toast={toast}
    />
  );
}

function PatchOrchestrationPage({ hosts }) {
  const toast = useToastCtx();
  const linuxHosts = hosts.filter(h => !String(h?.os || '').toLowerCase().includes('windows'));
  const windowsHosts = hosts.filter(h => String(h?.os || '').toLowerCase().includes('windows'));
  return (
    <BulkPatchPageView
      hosts={hosts}
      linuxHosts={linuxHosts}
      windowsHosts={windowsHosts}
      API={API}
      apiFetch={apiFetch}
      toast={toast}
    />
  );
}

function HostTimelinePage({ hosts }) {
  return <HostTimelinePageView hosts={hosts} API={API} apiFetch={apiFetch} CodeIcon={CodeIcon} />;
}

function LiveCommandPage({ hosts }) {
  return <LiveCommandPageView hosts={hosts} API={API} apiFetch={apiFetch} CodeIcon={CodeIcon} />;
}

function AgentUpdatePage({ hosts }) {
  return <AgentUpdatePageView hosts={hosts} API={API} apiFetch={apiFetch} hasRole={hasRole} CodeIcon={CodeIcon} />;
}

export default App;




