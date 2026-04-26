import React, { useState, useEffect, useRef } from 'react';
import { AppIcon, BellIcon } from '../AppIcons';
import { API, apiFetch, getToken, websocketUrl } from '../appRuntime';

/**
 * StitchShell - Global application shell matching Stitch design
 * 
 * This component owns:
 * - Sidebar navigation
 * - Top bar with search and notifications
 * - Page frame and content area
 * 
 * Preserves all product logic:
 * - Routing via setPage callback
 * - Permissions via navItems prop
 * - Notifications via WebSocket
 * - Global search
 */

/* Global Search Component */
function GlobalSearch({ setPage }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
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

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => { 
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { 
        e.preventDefault(); 
        setOpen(true); 
        ref.current?.querySelector('input')?.focus(); 
      } 
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigate = (type) => { 
    setPage(type === 'host' ? 'hosts' : type === 'cve' ? 'cve' : 'jobs'); 
    setQuery(''); 
    setResults(null); 
    setOpen(false); 
  };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91aaeb]" aria-hidden="true">
          <AppIcon name="search" size={18} />
        </span>
        <input
          className="w-full bg-[#05183c] border-none rounded-lg py-2 pl-10 pr-4 text-sm font-inter tracking-normal focus:ring-1 focus:ring-[#7bd0ff] transition-all outline-none text-[#dee5ff] placeholder-[#91aaeb]/50"
          placeholder="Search hosts, patches, or CVEs..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
        />
      </div>
      {open && results && (
        <div className="absolute top-full mt-2 left-0 right-0 max-h-96 overflow-y-auto border border-[#2b4680]/50 rounded-xl bg-[#05183c] shadow-2xl z-50">
          {loading && <div className="p-3 text-[#64748b] text-sm">Searching...</div>}
          {!loading && results.hosts?.length === 0 && results.cves?.length === 0 && results.jobs?.length === 0 && (
            <div className="p-4 text-[#64748b] text-center text-sm">No results for "{query}"</div>
          )}
          {results.hosts?.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#91aaeb] border-b border-[#2b4680]/30">Hosts</div>
              {results.hosts.map(h => (
                <div key={h.id} className="px-4 py-3 cursor-pointer border-b border-[#2b4680]/15 hover:bg-[#00225a] transition-colors flex items-center gap-3" onClick={() => navigate('host')}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: h.is_online ? '#22c55e' : '#ef4444', boxShadow: `0 0 0 3px ${h.is_online ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)'}` }} />
                  <div>
                    <div className="text-sm font-semibold text-[#dee5ff]">{h.hostname}</div>
                    <div className="text-xs text-[#64748b]">{h.ip} - {h.os}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {results.cves?.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#91aaeb] border-b border-[#2b4680]/30">CVEs</div>
              {results.cves.map(c => (
                <div key={c.id} className="px-4 py-3 cursor-pointer border-b border-[#2b4680]/15 hover:bg-[#00225a] transition-colors flex items-center gap-3" onClick={() => navigate('cve')}>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.severity === 'critical' ? 'bg-[#7f2927] text-[#ff9993]' : c.severity === 'high' ? 'bg-[#fcc025]/20 text-[#ffd16f]' : 'bg-[#00668b] text-[#a2dcff]'}`}>
                    {c.severity}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#dee5ff]">{c.id}</div>
                    <div className="text-xs text-[#64748b]">{c.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Notification Center Component */
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
      dashboard: 'dashboard', hosts: 'hosts', host: 'hosts', cve: 'cve', cves: 'cve',
      jobs: 'jobs', job: 'jobs', notifications: 'notifications', reports: 'reports',
      license: 'license', monitoring: 'monitoring', settings: 'settings',
      onboarding: 'onboarding', backups: 'backups', software: 'software',
      policies: 'policies', users: 'users', testing: 'testing',
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
          } catch {}
        };
      } catch {}
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
    <div className="relative">
      <button 
        className="relative text-[#91aaeb] hover:text-[#dee5ff] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-[#ee7d77] rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 max-h-96 overflow-y-auto border border-[#2b4680]/50 rounded-xl bg-[#05183c] shadow-2xl z-50">
          <div className="px-4 py-3 border-b border-[#2b4680]/30 flex justify-between items-center">
            <h4 className="text-sm font-bold text-[#dee5ff]">Notifications</h4>
            <button 
              className="text-xs text-[#7bd0ff] hover:text-[#a2dcff] font-semibold"
              onClick={(e) => { e.stopPropagation(); markAllRead(); }}
            >
              Mark all read
            </button>
          </div>
          {notes.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#64748b]">No notifications</div>
          ) : (
            <div>
              {notes.map(n => {
                const timestamp = n.created_at ? new Date(n.created_at) : null;
                const timeLabel = timestamp && !Number.isNaN(timestamp.getTime())
                  ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--';
                return (
                  <div 
                    key={n.id} 
                    className={`px-4 py-3 cursor-pointer border-b border-[#2b4680]/15 hover:bg-[#00225a] transition-colors ${!n.is_read ? 'bg-[#7bd0ff]/5' : ''}`}
                    onClick={() => markRead(n.id, n.link)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <strong className="text-sm font-semibold text-[#dee5ff]">
                        {n.title}
                      </strong>
                      <span className="text-[10px] text-[#4d556b]">{timeLabel}</span>
                    </div>
                    <p className="text-xs text-[#91aaeb]">{(n.message || 'No details available.').replace(/\n/g, ' ')}</p>
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

/* Main Shell Component */
export function StitchShell({ 
  user, 
  page, 
  setPage, 
  navItems, 
  licenseInfo, 
  health, 
  onLogout,
  onRefresh,
  toast,
  topBannerOffset = 0,
  children 
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPageMeta = navItems.find(n => n.key === page) || navItems[0] || { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' };

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [page]);

  // Close sidebar on escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#060e20]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 flex flex-col w-64 bg-[#06122d] z-50 overflow-y-auto no-scrollbar transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`} style={{ top: topBannerOffset, height: `calc(100vh - ${topBannerOffset}px)` }}>
        <div className="p-6 flex flex-col gap-1">
          <div className="text-xl font-bold text-[#dee5ff] tracking-tighter flex items-center gap-2">
            <span className="text-[#7bd0ff]" aria-hidden="true">
              <AppIcon name="shield" size={20} />
            </span>
            PatchMaster
          </div>
          <div className="font-inter tracking-tight text-xs text-[#91aaeb]/60 uppercase tracking-widest">
            Enterprise Tier
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map(n => (
            <button
              key={n.key}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all ${
                page === n.key
                  ? 'text-[#7bd0ff] border-l-2 border-[#7bd0ff] bg-[#05183c]'
                  : 'text-[#91aaeb] hover:text-[#dee5ff] hover:bg-[#031d4b]'
              }`}
              onClick={() => setPage(n.key)}
            >
              <span className="nav-icon"><AppIcon name={n.icon} size={18} /></span>
              <span className="font-inter tracking-tight text-base">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-[#2b4680]/10">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[#00225a]/40">
            <div className="w-10 h-10 rounded-lg bg-[#00225a] flex items-center justify-center text-[#7bd0ff] overflow-hidden">
              <AppIcon name="users" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-[#dee5ff]">{user?.username || 'User'}</p>
              <p className="text-[10px] uppercase tracking-widest text-[#91aaeb]">{user?.role || 'Operator'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="fixed right-0 left-0 lg:left-64 flex justify-between items-center px-4 sm:px-6 lg:px-8 h-16 z-40 bg-[#060e20]/80 backdrop-blur-xl" style={{ top: topBannerOffset }}>
          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden text-[#91aaeb] hover:text-[#dee5ff] transition-colors mr-4"
            onClick={() => setSidebarOpen(true)}
          >
            <AppIcon name="menu" size={20} />
          </button>

          <div className="flex items-center gap-4 flex-1">
            <GlobalSearch setPage={setPage} />
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {/* License Status Indicator */}
            {licenseInfo && (
              <div 
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase cursor-pointer ${
                  !licenseInfo.valid || !licenseInfo.activated || licenseInfo.expired
                    ? 'bg-[#7f2927]/20 text-[#ff9993]'
                    : licenseInfo.days_remaining <= 30
                    ? 'bg-[#fcc025]/20 text-[#ffd16f]'
                    : 'bg-[#004c69]/20 text-[#7bd0ff]'
                }`}
                onClick={() => setPage('license')}
              >
                <span className={`w-2 h-2 rounded-full ${
                  !licenseInfo.valid || !licenseInfo.activated || licenseInfo.expired
                    ? 'bg-[#ee7d77]'
                    : 'bg-[#7bd0ff] animate-pulse'
                }`}></span>
                <span className="hidden md:inline">
                  {!licenseInfo.valid ? 'Invalid' : !licenseInfo.activated ? 'No License' : licenseInfo.expired ? 'Expired' : 'License Active'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 sm:gap-4">
              <NotificationCenter setPage={setPage} toast={toast} />
              <button 
                className="hidden sm:block text-[#91aaeb] hover:text-[#dee5ff] transition-colors"
                onClick={onRefresh}
                title="Refresh data"
              >
                <AppIcon name="refresh" size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="pt-6 sm:pt-8 pb-12 px-4 sm:px-6 lg:px-8 flex-1 bg-[#060e20]" style={{ marginTop: 64 + topBannerOffset }}>
          <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
            {/* Page Header */}
            <div className="flex flex-col gap-1">
              <div className="text-[#91aaeb] uppercase tracking-[0.2em] text-[10px] font-bold">
                {currentPageMeta.key === 'dashboard' ? 'Infrastructure Overview' : 'Workspace'}
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-[#dee5ff]">
                {currentPageMeta.label}
              </h1>
            </div>

            {/* Page Content */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
