import React, { useState, useCallback, useMemo } from 'react';
import { 
  StitchTable,
  StitchTablePagination,
  StitchActionBar,
  StitchButton,
  StitchSelect,
  StitchInput,
  StitchFormField,
  StitchBadge,
  StitchStatusDot,
  StitchEmptyState,
  StitchPageHeader
} from './components/StitchComponents';

export default function HostsOpsPage({ hosts = [], setHosts, API, apiFetch, hasRole, AppIcon, useInterval }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [osFilter, setOsFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedHosts, setSelectedHosts] = useState([]);
  const itemsPerPage = 25;

  // Transform hosts data for display
  const processedHosts = useMemo(() => {
    return hosts.map(h => {
      const online = !!h.is_online;
      const hasCritical = (h.critical_cves || 0) > 0;
      const hasUpdates = (h.upgradable_count || 0) > 0;
      
      let status = 'offline';
      let statusLabel = 'Offline';
      if (online) {
        if (hasCritical) {
          status = 'critical';
          statusLabel = 'Critical';
        } else if (hasUpdates) {
          status = 'warning';
          statusLabel = 'Updates Available';
        } else {
          status = 'healthy';
          statusLabel = 'Healthy';
        }
      }

      const lastSeen = h.last_seen ? (() => {
        const diff = Math.floor((Date.now() - new Date(h.last_seen)) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
      })() : 'never';

      return {
        id: h.id,
        hostname: h.hostname || `host-${h.id}`,
        ip: h.ip || h.last_ip || '—',
        os: h.os || 'Unknown',
        agentVersion: h.agent_version || 'v2.4.1',
        status,
        statusLabel,
        lastSeen,
        groups: Array.isArray(h.groups) ? h.groups : [],
        upgradableCount: h.upgradable_count || 0,
        criticalCves: h.critical_cves || 0,
        rebootRequired: h.reboot_required || false,
        raw: h
      };
    });
  }, [hosts]);

  // Filter hosts
  const filteredHosts = useMemo(() => {
    return processedHosts.filter(host => {
      const matchesSearch = !searchQuery || 
        host.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        host.ip.includes(searchQuery) ||
        host.os.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesGroup = groupFilter === 'all' || host.groups.includes(groupFilter);
      const matchesOs = osFilter === 'all' || host.os.toLowerCase().includes(osFilter.toLowerCase());
      const matchesStatus = statusFilter === 'all' || host.status === statusFilter;

      return matchesSearch && matchesGroup && matchesOs && matchesStatus;
    });
  }, [processedHosts, searchQuery, groupFilter, osFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredHosts.length / itemsPerPage);
  const paginatedHosts = filteredHosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique values for filters
  const uniqueGroups = [...new Set(processedHosts.flatMap(h => h.groups))];
  const uniqueOSes = [...new Set(processedHosts.map(h => h.os))];

  // Table columns matching Stitch reference
  const columns = [
    {
      header: 'Status',
      key: 'status',
      render: (host) => (
        <StitchStatusDot 
          status={host.status} 
          label={host.statusLabel}
          size="md"
        />
      )
    },
    {
      header: 'Hostname',
      key: 'hostname',
      render: (host) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#dee5ff] group-hover:text-[#7bd0ff] transition-colors">
            {host.hostname}
          </span>
          <span className="text-[10px] text-[#91aaeb] font-medium">
            {host.groups.length > 0 ? host.groups[0] : 'UNASSIGNED'}
          </span>
        </div>
      )
    },
    {
      header: 'IP Address',
      key: 'ip',
      render: (host) => (
        <span className="font-mono text-xs text-[#91aaeb]">{host.ip}</span>
      )
    },
    {
      header: 'OS Platform',
      key: 'os',
      render: (host) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#031d4b] flex items-center justify-center text-[#91aaeb]">
            <span className="material-symbols-outlined text-lg">
              {host.os.toLowerCase().includes('windows') ? 'desktop_windows' : 
               host.os.toLowerCase().includes('ubuntu') ? 'terminal' :
               host.os.toLowerCase().includes('rhel') ? 'verified_user' : 'cloud'}
            </span>
          </div>
          <span className="text-sm text-[#dee5ff]">{host.os}</span>
        </div>
      )
    },
    {
      header: 'Agent Version',
      key: 'agentVersion',
      render: (host) => (
        <StitchBadge 
          variant={host.agentVersion.includes('2.4') ? 'success' : 'warning'}
          size="sm"
        >
          {host.agentVersion}
        </StitchBadge>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (host) => (
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            className="p-2 rounded-lg hover:bg-[#7bd0ff]/20 hover:text-[#7bd0ff] transition-all"
            title="Terminal"
            onClick={() => console.log('Terminal', host.id)}
          >
            <span className="material-symbols-outlined text-xl">terminal</span>
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-[#ffd16f]/20 hover:text-[#ffd16f] transition-all"
            title="Reboot"
            onClick={() => console.log('Reboot', host.id)}
          >
            <span className="material-symbols-outlined text-xl">restart_alt</span>
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-[#00225a] transition-all"
            title="Detailed Status"
            onClick={() => console.log('Details', host.id)}
          >
            <span className="material-symbols-outlined text-xl">monitoring</span>
          </button>
        </div>
      )
    }
  ];

  const handleRowClick = (host) => {
    console.log('Host clicked:', host);
  };

  const handleRegisterHost = () => {
    console.log('Register new host');
  };

  if (!hosts.length) {
    return (
      <StitchEmptyState
        icon="dns"
        title="No Hosts Registered"
        description="Start by registering your first host to begin monitoring and managing your infrastructure."
        actionLabel="Register Host"
        onAction={handleRegisterHost}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Workspace Distinction Indicator */}
      <div className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30 bg-[#7bd0ff]" />
      
      {/* Page Header */}
      <StitchPageHeader
        kicker="Infrastructure"
        title="Host Management"
        description="Centralized control for enterprise nodes. Manage, monitor, and patch distributed systems from a single command interface."
        workspace="fleet"
        actions={
          <StitchButton icon="add_circle" onClick={handleRegisterHost}>
            Register New Host
          </StitchButton>
        }
      />

      {/* Stats & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Filter Panel */}
        <StitchActionBar className="lg:col-span-8">
          <StitchFormField label="HostGroup">
            <StitchSelect
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Clusters' },
                ...uniqueGroups.map(group => ({ value: group, label: group }))
              ]}
            />
          </StitchFormField>

          <StitchFormField label="Operating System">
            <div className="flex items-center gap-2 bg-[#031d4b] rounded-lg p-1">
              <button 
                className={`p-1.5 rounded-md transition-all ${osFilter === 'all' ? 'bg-[#7bd0ff]/20 text-[#7bd0ff]' : 'hover:bg-[#00225a]'}`}
                onClick={() => setOsFilter('all')}
              >
                <span className="material-symbols-outlined text-lg">grid_view</span>
              </button>
              <button 
                className={`p-1.5 rounded-md transition-all ${osFilter === 'windows' ? 'bg-[#7bd0ff]/20 text-[#7bd0ff]' : 'hover:bg-[#00225a]'}`}
                onClick={() => setOsFilter('windows')}
              >
                <span className="material-symbols-outlined text-lg">desktop_windows</span>
              </button>
              <button 
                className={`p-1.5 rounded-md transition-all ${osFilter === 'linux' ? 'bg-[#7bd0ff]/20 text-[#7bd0ff]' : 'hover:bg-[#00225a]'}`}
                onClick={() => setOsFilter('linux')}
              >
                <span className="material-symbols-outlined text-lg">terminal</span>
              </button>
            </div>
          </StitchFormField>

          <StitchFormField label="Status">
            <StitchSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'healthy', label: 'Healthy' },
                { value: 'warning', label: 'Updates Available' },
                { value: 'critical', label: 'Critical' },
                { value: 'offline', label: 'Offline' }
              ]}
            />
          </StitchFormField>

          <StitchFormField label="Search">
            <StitchInput
              placeholder="Search hosts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </StitchFormField>
        </StitchActionBar>

        {/* Health Metric */}
        <div className="lg:col-span-4 bg-[#031d4b] rounded-xl p-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-[#7bd0ff]/10 to-transparent"></div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7bd0ff] block mb-1">Health Status</span>
            <h3 className="text-3xl font-black text-[#dee5ff] tracking-tight">
              {processedHosts.filter(h => h.status === 'healthy').length}
              <span className="text-lg font-medium text-[#91aaeb] opacity-50"> / {processedHosts.length}</span>
            </h3>
            <p className="text-[11px] text-[#91aaeb] mt-1">Systems are currently reachable</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-[#00225a] flex items-center justify-center relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle 
                className="text-[#7bd0ff]" 
                cx="24" 
                cy="24" 
                fill="transparent" 
                r="20" 
                stroke="currentColor" 
                strokeDasharray="125 125" 
                strokeWidth="4"
              />
            </svg>
            <span className="material-symbols-outlined text-[#7bd0ff] text-xl">bolt</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div>
        <StitchTable
          columns={columns}
          data={paginatedHosts}
          onRowClick={handleRowClick}
          emptyState={
            <StitchEmptyState
              icon="search"
              title="No hosts match your filters"
              description="Try adjusting your search criteria or filters to find the hosts you're looking for."
            />
          }
        />
        
        {totalPages > 1 && (
          <StitchTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredHosts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* System Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-[#05183c] rounded-xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#ffd16f]/10 flex items-center justify-center text-[#ffd16f]">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#dee5ff]">Patch Window Approaching</h4>
            <p className="text-xs text-[#91aaeb] mt-1 leading-relaxed">
              The global maintenance window for "CLUSTER-A1" starts in 2 hours. Ensure all backups are verified.
            </p>
          </div>
        </div>
        <div className="p-6 bg-[#05183c] rounded-xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#7bd0ff]/10 flex items-center justify-center text-[#7bd0ff]">
            <span className="material-symbols-outlined">history</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#dee5ff]">Recent Activity</h4>
            <p className="text-xs text-[#91aaeb] mt-1 leading-relaxed">
              Host <span className="text-[#dee5ff]">win-node-sec.cloud</span> reported agent version mismatch 12 minutes ago.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}