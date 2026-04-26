import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import './OpsPages.css';

// Debounce hook for search input to improve performance on large datasets
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

// Local storage persistence hook for filter state (UI-009: Filter Persistence)
function useFilterPersistence(key) {
  const [savedFilters, setSavedFilters] = useState({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pm-filters-${key}`);
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch {}
  }, [key]);

  const saveFilters = useCallback((filters) => {
    try {
      localStorage.setItem(`pm-filters-${key}`, JSON.stringify(filters));
    } catch {}
  }, [key]);

  return [savedFilters, saveFilters];
}

export default function HostsOpsPage({ hosts, setHosts, API, apiFetch, hasRole, AppIcon, useInterval }) {
  // Defensive check: ensure hosts is always an array
  const safeHosts = Array.isArray(hosts) ? hosts : [];
  
  // Persist filters to localStorage (UI-009)
  const [persistedFilters, setPersistedFilters] = useFilterPersistence('hosts');
  
  // Persist pagination state to localStorage (UI-010)
  const [page, setPage] = useState(() => {
    try {
      const saved = localStorage.getItem('pm_hosts_page');
      return saved ? parseInt(saved, 10) : 1;
    } catch { return 1; }
  });
  const PER_PAGE = 50;
  
  // Save page to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('pm_hosts_page', String(page));
    } catch {}
  }, [page]);
  
  const [search, setSearch] = useState(persistedFilters.search || '');
  // Debounce search input by 300ms to avoid re-filtering on every keystroke
  const debouncedSearch = useDebounce(search, 300);
  const [osFilter, setOsFilter] = useState(persistedFilters.os || 'all');
  const [siteFilter, setSiteFilter] = useState(persistedFilters.site || 'all');
  const [agentStatus, setAgentStatus] = useState({});
  const [tagModalHost, setTagModalHost] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [detailHost, setDetailHost] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [tooltipTarget, setTooltipTarget] = useState(null);

  const refreshHosts = useCallback(() => {
    // Fetch with pagination (UI-010)
    apiFetch(`${API}/api/hosts/?page=${page}&per_page=${PER_PAGE}`).then(r => r.json()).then(data => {
      // Handle paginated response format
      if (data && data.hosts) {
        setHosts(data.hosts);
      } else if (Array.isArray(data)) {
        setHosts(data);
      }
    }).catch(() => {});
  }, [API, apiFetch, setHosts, page]);

  const checkAgent = useCallback(async (ip) => {
    if (!ip) return;
    try {
      const r = await apiFetch(`${API}/api/agent/${ip}/ping`);
      const d = await r.json();
      setAgentStatus(prev => ({
        ...prev,
        [ip]: {
          reachable: !!d.online,
          latency_ms: d.latency_ms,
          reboot_required: d.reboot_required,
          agent_version: d.raw?.agent_version || '',
        },
      }));
    } catch {
      setAgentStatus(prev => ({ ...prev, [ip]: { reachable: false } }));
    }
  }, [API, apiFetch]);

  useEffect(() => {
    safeHosts.forEach(host => {
      if (host?.ip) checkAgent(host.ip);
    });
  }, [safeHosts, checkAgent]);

  useInterval(() => {
    safeHosts.forEach(host => {
      if (host?.ip) checkAgent(host.ip);
    });
  }, safeHosts.length ? 15000 : null);

  const deleteHost = async (id) => {
    try {
      const response = await apiFetch(`${API}/api/hosts/${id}`, { method: 'DELETE' });
      if (response.ok) {
        refreshHosts();
        return;
      }
      
      // Handle 409 Conflict - host has associated data
      if (response.status === 409) {
        const payload = await response.json();
        const confirmed = window.confirm(
          `⚠️ WARNING: Data Loss Risk\n\n${payload.detail}\n\n` +
          `Are you absolutely sure you want to delete this host and ALL associated data?\n\n` +
          `This action CANNOT be undone.`
        );
        
        if (confirmed) {
          // Force delete with confirmation
          const forceResponse = await apiFetch(`${API}/api/hosts/${id}?force=true`, { method: 'DELETE' });
          if (forceResponse.ok) {
            refreshHosts();
          } else {
            const errorPayload = await forceResponse.json().catch(() => ({ detail: 'Delete failed' }));
            alert(`Error: ${errorPayload.detail || 'Failed to delete host'}`);
          }
        }
      } else {
        // Other error
        const errorPayload = await response.json().catch(() => ({ detail: 'Delete failed' }));
        alert(`Error: ${errorPayload.detail || 'Failed to delete host'}`);
      }
    } catch (error) {
      alert(`Error: ${error.message || 'Failed to delete host'}`);
    }
  };

  const rebootHost = async (ip) => {
    if (!window.confirm(`Reboot ${ip}? This will restart the server immediately.`)) return;
    try {
      await apiFetch(`${API}/api/agent/${ip}/system/reboot`, { method: 'POST' });
      alert(`Reboot command sent to ${ip}.`);
    } catch (e) {
      alert(e.message);
    }
  };

  const shutdownHost = async (ip) => {
    if (!window.confirm(`Shut down ${ip}? Queued shutdown installs will run first and the server will power off.`)) return;
    try {
      await apiFetch(`${API}/api/agent/${ip}/system/shutdown`, { method: 'POST' });
      alert(`Shutdown command sent to ${ip}.`);
    } catch (e) {
      alert(e.message);
    }
  };

  const openTagModal = async (host) => {
    setTagModalHost(host);
    try {
      const r = await apiFetch(`${API}/api/tags/`);
      setAvailableTags((await r.json()) || []);
    } catch {
      setAvailableTags([]);
    }
  };

  const addTag = async () => {
    if (!newTag || !tagModalHost) return;
    try {
      await apiFetch(`${API}/api/hosts/${tagModalHost.id}/tags`, {
        method: 'POST',
        body: JSON.stringify({ name: newTag }),
      });
      setNewTag('');
      refreshHosts();
      setTagModalHost(null);
    } catch {}
  };

  const removeTag = async (tagId) => {
    if (!tagModalHost) return;
    try {
      await apiFetch(`${API}/api/hosts/${tagModalHost.id}/tags/${tagId}`, { method: 'DELETE' });
      refreshHosts();
      setTagModalHost(null);
    } catch {}
  };

  const openDetail = async (host) => {
    setDetailHost(host);
    setDetailData(null);
    try {
      const r = await apiFetch(`${API}/api/hosts/${host.id}/detail`);
      setDetailData(await r.json());
    } catch {
      setDetailData(host);
    }
  };

  const exportCSV = () => {
    const escapeCSV = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const rows = [['ID', 'Hostname', 'IP', 'Site', 'OS', 'Boot Mode', 'Secure Boot', 'Compliance', 'CVEs', 'Online', 'Reboot Required']];
    filtered.forEach(host => rows.push([
      host.id,
      host.hostname,
      host.ip,
      host.site || '',
      host.os,
      host.hardware_inventory?.boot_mode || '',
      host.hardware_inventory?.secure_boot_enabled ?? '',
      host.compliance_score,
      host.cve_count,
      host.is_online,
      host.reboot_required,
    ]));
    const csv = rows.map(row => row.map(escapeCSV).join(',')).join('\r\n');
    // Use UTF-8 with BOM for proper international character support (Excel compatible)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hosts.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const osFamily = (host) => {
    // Defensive: ensure groups is always an array of strings
    const rawGroups = Array.isArray(host.groups) ? host.groups : [];
    const groups = rawGroups.map(group => {
      if (typeof group === 'string') return group.toLowerCase();
      if (group && typeof group.name === 'string') return group.name.toLowerCase();
      return '';
    }).filter(Boolean);
    
    const osText = (host.os || '').toLowerCase();
    
    // Windows detection
    if (groups.includes('windows') || osText.includes('windows')) return 'windows';
    
    // Debian/Ubuntu detection
    if (groups.includes('debian/ubuntu') || 
        groups.includes('debian') ||
        groups.includes('ubuntu') ||
        osText.includes('ubuntu') || 
        osText.includes('debian') || 
        osText.includes('linux mint') || 
        osText.includes('pop')) return 'debian';
    
    // RHEL/RPM family detection
    if (groups.includes('rhel/rpm') || 
        groups.includes('rhel') ||
        groups.includes('rpm') ||
        osText.includes('red hat') || 
        osText.includes('rhel') || 
        osText.includes('centos') || 
        osText.includes('rocky') || 
        osText.includes('alma') || 
        osText.includes('fedora') ||
        osText.includes('amazon linux')) return 'rhel';
    
    // Arch Linux family detection
    if (groups.includes('arch') || 
        groups.includes('arch linux') ||
        osText.includes('arch') || 
        osText.includes('manjaro') || 
        osText.includes('endeavour')) return 'arch';
    
    // openSUSE detection
    if (groups.includes('opensuse') || 
        groups.includes('suse') ||
        osText.includes('opensuse') || 
        osText.includes('suse') ||
        osText.includes('sles')) return 'opensuse';
    
    // Alpine Linux detection
    if (groups.includes('alpine') || 
        osText.includes('alpine')) return 'alpine';
    
    // FreeBSD detection
    if (groups.includes('freebsd') || 
        groups.includes('bsd') ||
        osText.includes('freebsd') ||
        osText.includes('bsd')) return 'freebsd';
    
    // Solaris detection
    if (groups.includes('solaris') || 
        osText.includes('solaris') ||
        osText.includes('opensolaris') ||
        osText.includes('sunos')) return 'solaris';
    
    // HP-UX detection
    if (groups.includes('hp-ux') || 
        groups.includes('hpux') ||
        osText.includes('hp-ux') ||
        osText.includes('hpux')) return 'hpux';
    
    // AIX detection
    if (groups.includes('aix') || 
        osText.includes('aix')) return 'aix';
    
    return 'other';
  };

  const filtered = useMemo(() => {
    // Use debounced search value for filtering to improve performance
    const q = debouncedSearch.trim().toLowerCase();
    return safeHosts.filter(host => {
      const searchable = [
        host.hostname || host.name || '',
        host.ip || '',
        host.site || '',
        host.os || '',
        ...(host.groups || []),
        ...((host.tags || []).map(tag => tag.name || tag)),
      ].join(' ').toLowerCase();
      if (q && !searchable.includes(q)) return false;
      if (osFilter !== 'all' && osFamily(host) !== osFilter) return false;
      if (siteFilter !== 'all' && (host.site || '') !== siteFilter) return false;
      return true;
    });
  }, [safeHosts, debouncedSearch, osFilter, siteFilter]);

  // Persist filters to localStorage when they change (UI-009: Filter Persistence)
  useEffect(() => {
    setPersistedFilters({ search: debouncedSearch, os: osFilter, site: siteFilter });
  }, [debouncedSearch, osFilter, siteFilter, setPersistedFilters]);

  // Keyboard navigation support (UI-014: Keyboard Nav)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes modals
      if (e.key === 'Escape') {
        if (detailHost) setDetailHost(null);
        if (tagModalHost) setTagModalHost(null);
        setTooltipTarget(null);
      }
      // Ctrl/Cmd + F focuses search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('.search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailHost, tagModalHost]);

  // Tooltip handler (UI-015: Tooltips via mouse enter/leave)
  const showTooltip = (e, message) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipTarget({
      message,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };
  const hideTooltip = () => setTooltipTarget(null);

  const statusForHost = (host) => agentStatus[host.ip] || {};
  const isHostOnline = (host) => !!host.is_online;
  const needsReboot = (host) => {
    const state = statusForHost(host);
    return typeof state.reboot_required === 'boolean' ? state.reboot_required : !!host.reboot_required;
  };

  const totalHosts = safeHosts.length;
  const onlineCount = safeHosts.filter(isHostOnline).length;
  const avgCompliance = totalHosts ? Math.round(safeHosts.reduce((sum, host) => sum + Number(host.compliance_score || 0), 0) / totalHosts) : 0;
  const rebootCount = safeHosts.filter(needsReboot).length;
  const totalCves = safeHosts.reduce((sum, host) => sum + Number(host.cve_count || 0), 0);
  const highRiskHosts = safeHosts.filter(host => Number(host.cve_count || 0) > 0 || Number(host.compliance_score || 0) < 80).length;
  const osCounts = safeHosts.reduce((acc, host) => {
    acc[osFamily(host)] = (acc[osFamily(host)] || 0) + 1;
    return acc;
  }, { windows: 0, debian: 0, rhel: 0, arch: 0, opensuse: 0, alpine: 0, freebsd: 0, solaris: 0, hpux: 0, aix: 0, other: 0 });
  const siteOptions = useMemo(() => {
    const names = Array.from(new Set(safeHosts.map(host => (host.site || '').trim()).filter(Boolean)));
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }, [safeHosts]);

  const posture = avgCompliance >= 92
    ? {
        title: 'Stable fleet posture',
        description: 'Most hosts are reachable and patch hygiene is under control. Focus on the smaller backlog of exceptions.',
        tone: '#166534',
        bg: 'linear-gradient(145deg, #ecfdf3, #f8fffb)',
        border: '#86efac',
      }
    : avgCompliance >= 80
      ? {
          title: 'Watchlist posture',
          description: 'Coverage is healthy, but there are still hosts with lagging compliance or unresolved exposure.',
          tone: '#1d4ed8',
          bg: 'linear-gradient(145deg, #eff6ff, #f8fbff)',
          border: '#93c5fd',
        }
      : {
          title: 'Needs remediation planning',
          description: 'Several hosts are below target. Prioritize high-risk systems, stale agents, and reboot backlog.',
          tone: '#b45309',
          bg: 'linear-gradient(145deg, #fffbeb, #fffdf5)',
          border: '#fcd34d',
        };

  const summaryCards = [
    { label: 'Managed Hosts', value: totalHosts, sub: `${filtered.length} visible in the current view`, icon: 'server', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Active Agents', value: onlineCount, sub: `${Math.max(totalHosts - onlineCount, 0)} offline by heartbeat`, icon: 'monitor', color: '#0f766e', bg: 'rgba(20,184,166,0.12)' },
    { label: 'Avg Compliance', value: `${avgCompliance}%`, sub: `${highRiskHosts} hosts need follow-up`, icon: 'shield', color: '#0f766e', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Open Exposure', value: totalCves, sub: 'total CVEs linked across hosts', icon: 'bug', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
    { label: 'Restart Queue', value: rebootCount, sub: 'hosts waiting for reboot completion', icon: 'refresh', color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
    { label: 'Bulk Scope', value: selected.length, sub: selected.length ? 'hosts selected for bulk changes' : 'no hosts selected', icon: 'layers', color: '#06b6d4', bg: 'rgba(139,92,246,0.12)' },
    { label: 'Active Sites', value: siteOptions.length, sub: siteOptions.length ? 'first-class locations tracked in inventory' : 'no locations assigned yet', icon: 'map-pin', color: '#1d4ed8', bg: 'rgba(59,130,246,0.12)' },
  ];

  const inventoryMix = [
    { label: 'Windows', value: osCounts.windows },
    { label: 'Debian / Ubuntu', value: osCounts.debian },
    { label: 'RHEL / RPM', value: osCounts.rhel },
    { label: 'Solaris', value: osCounts.solaris },
    { label: 'HP-UX', value: osCounts.hpux },
    { label: 'AIX', value: osCounts.aix },
    { label: 'Other', value: osCounts.other },
  ];

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const selectAll = () => setSelected(filtered.map(host => host.id));
  const clearSelect = () => setSelected([]);

  const executeBulk = async () => {
    if (!bulkAction || selected.length === 0) return;
    if (bulkAction === 'delete' && !window.confirm(`Delete ${selected.length} hosts?`)) return;
    try {
      await apiFetch(`${API}/api/hosts/bulk`, {
        method: 'POST',
        body: JSON.stringify({ host_ids: selected, action: bulkAction, value: bulkValue || null }),
      });
      setSelected([]);
      setBulkAction('');
      setBulkValue('');
      refreshHosts();
    } catch (e) {
      alert(e.message);
    }
  };

  const detail = detailData || detailHost || null;
  const detailRecentJobs = Array.isArray(detail?.recent_jobs) ? detail.recent_jobs : [];
  const detailActiveCves = Array.isArray(detail?.active_cves) ? detail.active_cves : [];
  const detailTags = detail?.tags || detailHost?.tags || [];
  const detailGroups = detail?.groups || detailHost?.groups || [];
  const detailState = detailHost ? statusForHost(detailHost) : {};
  const detailHardware = detail?.hardware_inventory || {};

  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: posture.border, background: posture.bg }}>
          <div className="ops-kicker">Endpoint operations</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Average compliance</span>
              <span className="ops-emphasis-value" style={{ color: posture.tone }}>{avgCompliance}%</span>
              <span className="ops-emphasis-meta">{highRiskHosts} hosts need attention</span>
            </div>
            <div className="ops-hero-copy">
              <h3>{posture.title}</h3>
              <p>{posture.description}</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{totalHosts} managed hosts</span>
            <span className="ops-chip">{onlineCount} agents reporting</span>
            <span className="ops-chip">{rebootCount} awaiting restart</span>
            <span className="ops-chip">{selected.length ? `${selected.length} selected for bulk actions` : 'Select hosts to run bulk updates'}</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Inventory mix</span>
          <div className="ops-side-metric">{totalHosts}</div>
          <p className="ops-side-note">Registered hosts grouped by operating system family for faster targeting.</p>
          <div className="ops-inline-list">
            {inventoryMix.map(item => (
              <div key={item.label} className="ops-inline-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ops-summary-grid">
        {summaryCards.map(card => (
          <div key={card.label} className="ops-summary-card">
            <div className="ops-summary-head">
              <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>
                <AppIcon name={card.icon} size={18} />
              </span>
              <span className="ops-summary-label">{card.label}</span>
            </div>
            <div className="ops-summary-value">{card.value}</div>
            <div className="ops-summary-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Bulk host actions</div>
              <p className="ops-subtle">Apply tagging, grouping, or cleanup actions to the selected host set.</p>
            </div>
            <div className="ops-actions">
              <button className="btn btn-sm" onClick={clearSelect}>Clear Selection</button>
            </div>
          </div>
          <div className="form-row">
            <select className="input" value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Choose bulk action</option>
              <option value="set_group">Set group</option>
              <option value="set_tag">Add tag</option>
              <option value="remove_tag">Remove tag</option>
              <option value="set_site">Set site</option>
              {hasRole('admin') && <option value="delete">Delete hosts</option>}
            </select>
            {(bulkAction === 'set_group' || bulkAction === 'set_tag' || bulkAction === 'remove_tag' || bulkAction === 'set_site') && (
              <input className="input" placeholder={bulkAction === 'set_site' ? 'Enter site or location value' : 'Enter group or tag value'} value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{ minWidth: 220 }} />
            )}
            <button className="btn btn-primary" onClick={executeBulk} disabled={!bulkAction}>Apply Action</button>
          </div>
        </div>
      )}

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Host inventory</div>
            <p className="ops-subtle">Track reachability, patch posture, reboot backlog, and operational tags from one place.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-sm" onClick={refreshHosts} aria-label="Refresh host list">Refresh</button>
            <button className="btn btn-sm btn-secondary" onClick={exportCSV} aria-label="Export hosts to CSV">Export CSV</button>
            <button className="btn btn-sm" onClick={selectAll} disabled={!filtered.length} aria-label="Select all visible hosts">Select View</button>
          </div>
        </div>

        <div className="ops-table-toolbar">
          <input 
            className="input search-input" 
            placeholder="Search by host, IP, site, OS, group, or tag" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ flex: '1 1 260px' }}
            aria-label="Search hosts by hostname, IP, site, OS, group, or tag"
          />
          <select className="input" value={siteFilter} onChange={e => setSiteFilter(e.target.value)} style={{ maxWidth: 220 }} aria-label="Filter by site">
            <option value="all">All Sites</option>
            {siteOptions.map(site => <option key={site} value={site}>{site}</option>)}
          </select>
          <div className="ops-pills" role="group" aria-label="Filter by platform">
            {[
              { key: 'all', label: 'All Platforms' },
              { key: 'windows', label: 'Windows' },
              { key: 'debian', label: 'Debian / Ubuntu' },
              { key: 'rhel', label: 'RHEL / RPM' },
              { key: 'arch', label: 'Arch Linux' },
              { key: 'opensuse', label: 'openSUSE' },
              { key: 'alpine', label: 'Alpine' },
              { key: 'freebsd', label: 'FreeBSD' },
              { key: 'solaris', label: 'Solaris' },
              { key: 'hpux', label: 'HP-UX' },
              { key: 'aix', label: 'AIX' },
              { key: 'other', label: 'Other' },
            ].map(filter => (
              <button 
                key={filter.key} 
                className={`ops-pill ${osFilter === filter.key ? 'active' : ''}`} 
                onClick={() => setOsFilter(filter.key)}
                aria-pressed={osFilter === filter.key}
              >
                {filter.label}
                {filter.key !== 'all' && <span className="badge badge-sm" style={{ marginLeft: 6 }}>{osCounts[filter.key] || 0}</span>}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="ops-empty">No hosts match the current filters.</div>
        ) : (
          <>
          <div className="table-wrap">
            <table className="table ops-table" role="table" aria-label="Host inventory">
              <thead>
                <tr role="row">
                  <th style={{ width: 36 }} role="columnheader">
                    <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={e => (e.target.checked ? selectAll() : clearSelect())} aria-label="Select all visible hosts" />
                  </th>
                  <th role="columnheader">Host</th>
                  <th role="columnheader">Platform</th>
                  <th role="columnheader">Compliance</th>
                  <th role="columnheader">Exposure</th>
                  <th role="columnheader">Tags</th>
                  <th role="columnheader">Status</th>
                  <th role="columnheader">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(host => {
                  const state = statusForHost(host);
                  const online = !!host.is_online;
                  const reachable = typeof state.reachable === 'boolean' ? state.reachable : null;
                  const rebootRequired = typeof state.reboot_required === 'boolean' ? state.reboot_required : !!host.reboot_required;
                  const groups = Array.isArray(host.groups) ? host.groups : [];
                  const tags = Array.isArray(host.tags) ? host.tags : [];
                  const compliance = Number(host.compliance_score || 0);
                  const cveCount = Number(host.cve_count || 0);
                  return (
                    <tr key={host.id} className={selected.includes(host.id) ? 'row-selected' : ''}>
                      <td><input type="checkbox" checked={selected.includes(host.id)} onChange={() => toggleSelect(host.id)} /></td>
                      <td>
                        <strong style={{ color: '#0f172a', cursor: 'pointer' }} onClick={() => openDetail(host)}>{host.hostname || host.name}</strong>
                        <span className="ops-table-meta">{host.ip}</span>
                        <span className="ops-table-meta">{host.site ? `Site: ${host.site}` : 'Site not assigned'}</span>
                        {groups.length > 0 && <span className="ops-table-meta">{groups.join(' / ')}</span>}
                      </td>
                      <td>
                        <strong>{host.os || 'Unknown platform'}</strong>
                        <span className="ops-table-meta">{host.agent_version || state.agent_version ? `Agent v${host.agent_version || state.agent_version}` : 'Agent version unavailable'}</span>
                      </td>
                      <td>
                        <div className="ops-badge-stack">
                          <span className={`badge badge-${compliance >= 90 ? 'success' : compliance >= 70 ? 'warning' : 'danger'}`}>{compliance}%</span>
                          {rebootRequired && <span className="badge badge-warning">Reboot pending</span>}
                        </div>
                      </td>
                      <td>
                        <div className="ops-badge-stack">
                          <span className={`badge badge-${cveCount > 10 ? 'danger' : cveCount > 3 ? 'warning' : 'info'}`}>{cveCount} CVEs</span>
                          <span className={`badge badge-${cveCount > 0 ? 'warning' : 'success'}`}>{cveCount > 0 ? 'Action needed' : 'Clear'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ops-tag-row">
                          {tags.length === 0 && <span className="ops-table-meta">No tags</span>}
                          {tags.map(tag => <span key={tag.id || tag} className="badge badge-info">{tag.name || tag}</span>)}
                          <button className="btn btn-sm" onClick={() => openTagModal(host)} aria-label={`Manage tags for ${host.hostname || host.name}`}>Manage Tags</button>
                        </div>
                      </td>
                      <td>
                        <div className="ops-badge-stack">
                          <span className={`badge badge-${online ? 'success' : 'danger'}`}>{online ? 'Online' : 'Offline'}</span>
                          {reachable === false && online ? <span className="badge badge-warning">API unreachable</span> : null}
                          {reachable === true ? <span className="badge badge-info">API reachable</span> : null}
                          {state.latency_ms ? <span className="badge badge-info">{state.latency_ms} ms</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="btn-group" role="group" aria-label="Host actions">
                          <button className="btn btn-sm" onClick={() => openDetail(host)} aria-label={`View details for ${host.hostname || host.name}`}>Details</button>
                          <button className="btn btn-sm" onClick={() => checkAgent(host.ip)} aria-label={`Ping ${host.ip}`}>Ping</button>
                          {hasRole('admin') && <button className="btn btn-sm btn-warning" onClick={() => rebootHost(host.ip)} aria-label={`Reboot ${host.ip}`}>Reboot</button>}
                          {hasRole('admin') && <button className="btn btn-sm" onClick={() => shutdownHost(host.ip)} aria-label={`Shutdown ${host.ip}`}>Shutdown</button>}
                          {hasRole('admin', 'operator') && <button className="btn btn-sm btn-danger" onClick={() => deleteHost(host.id)} aria-label={`Delete ${host.hostname || host.name}`}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          

          <div className="ops-table-toolbar" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <div className="ops-actions">
              <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
              <span style={{ padding: '0 12px', fontWeight: 500 }}>Page {page}</span>
              <button className="btn btn-sm" onClick={() => setPage(p => p + 1)} disabled={filtered.length < PER_PAGE}>Next</button>
            </div>
          </div>
          </>
        )}
      </div>

      {detailHost && (
        <div className="modal-overlay" onClick={() => { setDetailHost(null); setDetailData(null); }}>
          <div className="modal-card ops-modal-card" style={{ maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="ops-table-toolbar">
              <div>
                <div className="ops-panel-title">{detailHost.hostname || detailHost.name}</div>
                <p className="ops-subtle">{detailHost.ip} - {detail?.os || detailHost.os || 'Platform information unavailable'}</p>
              </div>
              <button className="btn btn-sm" onClick={() => { setDetailHost(null); setDetailData(null); }}>Close</button>
            </div>

            {!detail ? (
              <div className="ops-empty">Loading host details...</div>
            ) : (
              <>
                <div className="ops-summary-grid">
                  {[
                    { label: 'Reachability', value: detail.is_online ? 'Online' : 'Offline', sub: detail.last_heartbeat ? new Date(detail.last_heartbeat).toLocaleString() : 'No heartbeat recorded', icon: 'monitor', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
                    { label: 'Compliance', value: `${detail.compliance_score || 0}%`, sub: `${detail.upgradable_count || 0} package updates remaining`, icon: 'shield', color: '#0f766e', bg: 'rgba(16,185,129,0.12)' },
                    { label: 'Active CVEs', value: detail.cve_count || 0, sub: detailActiveCves.length ? `${detailActiveCves.length} in the active list` : 'No active CVEs linked', icon: 'bug', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
                    { label: 'Patch History', value: detail.last_patched ? new Date(detail.last_patched).toLocaleDateString() : 'Not recorded', sub: detailRecentJobs.length ? `${detailRecentJobs.length} recent job records` : 'No recent jobs recorded', icon: 'timeline', color: '#06b6d4', bg: 'rgba(139,92,246,0.12)' },
                  ].map(card => (
                    <div key={card.label} className="ops-summary-card">
                      <div className="ops-summary-head">
                        <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>
                          <AppIcon name={card.icon} size={18} />
                        </span>
                        <span className="ops-summary-label">{card.label}</span>
                      </div>
                      <div className="ops-summary-value" style={{ fontSize: 22 }}>{card.value}</div>
                      <div className="ops-summary-sub">{card.sub}</div>
                    </div>
                  ))}
                </div>

                <div className="ops-detail-grid">
                  <div className="ops-detail-item"><span>Operating system</span><strong>{detail.os || 'Unknown'} {detail.os_version || ''}</strong></div>
                  <div className="ops-detail-item"><span>Kernel</span><strong>{detail.kernel || 'Unavailable'}</strong></div>
                  <div className="ops-detail-item"><span>Architecture</span><strong>{detail.arch || 'Unavailable'}</strong></div>
                  <div className="ops-detail-item"><span>Agent version</span><strong>{detail.agent_version || detailState.agent_version ? `v${detail.agent_version || detailState.agent_version}` : 'Unavailable'}</strong></div>
                  <div className="ops-detail-item"><span>Site / location</span><strong>{detail.site || 'Not assigned'}</strong></div>
                  <div className="ops-detail-item"><span>CPU</span><strong>{detailHardware.cpu_model || 'Unavailable'}{detailHardware.cpu_cores ? ` (${detailHardware.cpu_cores} cores)` : ''}</strong></div>
                  <div className="ops-detail-item"><span>Memory</span><strong>{detailHardware.memory_mb ? `${detailHardware.memory_mb} MB` : 'Unavailable'}</strong></div>
                  <div className="ops-detail-item"><span>Disk capacity</span><strong>{detailHardware.disk_total_gb ? `${detailHardware.disk_total_gb} GB` : 'Unavailable'}</strong></div>
                  <div className="ops-detail-item"><span>Boot mode</span><strong>{detailHardware.boot_mode ? String(detailHardware.boot_mode).toUpperCase() : 'Unavailable'}</strong></div>
                  <div className="ops-detail-item"><span>UEFI detected</span><strong>{typeof detailHardware.uefi_present === 'boolean' ? (detailHardware.uefi_present ? 'Yes' : 'No') : 'Unknown'}</strong></div>
                  <div className="ops-detail-item"><span>Secure Boot</span><strong>{typeof detailHardware.secure_boot_enabled === 'boolean' ? (detailHardware.secure_boot_enabled ? 'Enabled' : 'Disabled') : 'Unknown'}</strong></div>
                  <div className="ops-detail-item"><span>Groups</span><strong>{detailGroups.length ? detailGroups.join(', ') : 'No groups assigned'}</strong></div>
                  <div className="ops-detail-item"><span>Tags</span><strong>{detailTags.length ? detailTags.map(tag => tag.name || tag).join(', ') : 'No tags assigned'}</strong></div>
                </div>

                {detailRecentJobs.length > 0 && (
                  <div className="ops-panel" style={{ padding: 18, marginBottom: 16 }}>
                    <div className="ops-panel-title" style={{ marginBottom: 12 }}>Recent jobs</div>
                    <div className="table-wrap">
                      <table className="table ops-table">
                        <thead>
                          <tr><th>ID</th><th>Action</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                          {detailRecentJobs.map(job => (
                            <tr key={job.id}>
                              <td>#{job.id}</td>
                              <td>{job.action}</td>
                              <td><span className={`badge badge-${job.status === 'success' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}`}>{job.status}</span></td>
                              <td>{job.created_at ? new Date(job.created_at).toLocaleString() : 'Unavailable'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="ops-panel" style={{ padding: 18, marginBottom: 0 }}>
                  <div className="ops-panel-title" style={{ marginBottom: 12 }}>Active CVEs</div>
                  {detailActiveCves.length === 0 ? (
                    <div className="ops-empty">No active CVEs linked to this host.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table ops-table">
                        <thead>
                          <tr><th>CVE</th><th>Severity</th><th>Package / Notes</th></tr>
                        </thead>
                        <tbody>
                          {detailActiveCves.map(cve => (
                            <tr key={cve.cve_id}>
                              <td><strong>{cve.cve_id}</strong></td>
                              <td><span className={`badge badge-${cve.severity === 'critical' ? 'danger' : cve.severity === 'high' ? 'warning' : 'info'}`}>{cve.severity}</span></td>
                              <td>{cve.package_name || cve.description?.slice(0, 100) || 'Description unavailable'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tagModalHost && (
        <div className="modal-overlay" onClick={() => setTagModalHost(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="ops-table-toolbar">
              <div>
                <div className="ops-panel-title">Manage tags</div>
                <p className="ops-subtle">{tagModalHost.hostname || tagModalHost.name} - {tagModalHost.ip}</p>
              </div>
              <button className="btn btn-sm" onClick={() => setTagModalHost(null)}>Close</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong style={{ display: 'block', marginBottom: 10 }}>Current tags</strong>
              <div className="ops-tag-row">
                {(tagModalHost.tags || []).length === 0 && <span className="ops-table-meta">No tags assigned</span>}
                {(tagModalHost.tags || []).map(tag => (
                  <span key={tag.id} className="badge badge-info">
                    {tag.name}
                    <span style={{ cursor: 'pointer', marginLeft: 6 }} onClick={() => removeTag(tag.id)}>x</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="form-row">
              <input className="input" placeholder="Tag name" value={newTag} onChange={e => setNewTag(e.target.value)} list="availableTags" style={{ flex: 1 }} />
              <datalist id="availableTags">
                {availableTags.map(tag => <option key={tag.id} value={tag.name} />)}
              </datalist>
              <button className="btn btn-primary" onClick={addTag}>Add Tag</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
