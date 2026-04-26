import React, { useState } from 'react';
import { DataTable } from './DataTable';

/**
 * DataTable Component Usage Examples
 * 
 * This file demonstrates various usage patterns for the DataTable component
 * following the Stitch design system.
 */

// Example 1: Basic Table
export function BasicTableExample() {
  const columns = [
    { key: 'hostname', label: 'Hostname', sortable: true },
    { key: 'ip', label: 'IP Address', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const data = [
    { hostname: 'prod-db-01', ip: '10.0.4.12', status: 'healthy' },
    { hostname: 'win-node-sec', ip: '192.168.1.45', status: 'critical' },
    { hostname: 'rhel-core-srv', ip: '10.0.8.212', status: 'healthy' },
  ];

  return (
    <div className="p-8 bg-[#060e20]">
      <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Basic Table</h2>
      <DataTable columns={columns} data={data} />
    </div>
  );
}

// Example 2: Table with Custom Cell Rendering
export function CustomRenderingExample() {
  const columns = [
    { 
      key: 'hostname', 
      label: 'Hostname', 
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#dee5ff]">{value}</span>
          <span className="text-[10px] text-[#91aaeb]">{row.cluster}</span>
        </div>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => {
        const colors = {
          healthy: 'bg-[#7bd0ff]/20 text-[#7bd0ff]',
          critical: 'bg-[#ee7d77]/20 text-[#ee7d77]',
          warning: 'bg-[#ffd16f]/20 text-[#ffd16f]',
        };
        return (
          <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${colors[value]}`}>
            {value}
          </span>
        );
      }
    },
    { 
      key: 'version', 
      label: 'Agent Version',
      render: (value) => (
        <span className="px-2 py-1 rounded bg-[#05183c] text-xs font-medium text-[#dee5ff]">
          {value}
        </span>
      )
    },
  ];

  const data = [
    { hostname: 'prod-db-01', cluster: 'CLUSTER-A1', status: 'healthy', version: 'v2.4.1' },
    { hostname: 'win-node-sec', cluster: 'LEGACY-POOL', status: 'critical', version: 'v1.9.0' },
    { hostname: 'rhel-core-srv', cluster: 'CORE-SVC', status: 'healthy', version: 'v2.4.1' },
  ];

  return (
    <div className="p-8 bg-[#060e20]">
      <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Custom Cell Rendering</h2>
      <DataTable columns={columns} data={data} />
    </div>
  );
}

// Example 3: Table with Sorting
export function SortingExample() {
  const [sortedData, setSortedData] = useState([
    { name: 'Alice', age: 30, role: 'Admin' },
    { name: 'Bob', age: 25, role: 'User' },
    { name: 'Charlie', age: 35, role: 'Manager' },
  ]);

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'age', label: 'Age', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
  ];

  const handleSort = (key, direction) => {
    if (!direction) {
      // Reset to original order
      setSortedData([
        { name: 'Alice', age: 30, role: 'Admin' },
        { name: 'Bob', age: 25, role: 'User' },
        { name: 'Charlie', age: 35, role: 'Manager' },
      ]);
      return;
    }

    const sorted = [...sortedData].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setSortedData(sorted);
  };

  return (
    <div className="p-8 bg-[#060e20]">
      <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Sortable Table</h2>
      <DataTable columns={columns} data={sortedData} onSort={handleSort} />
    </div>
  );
}

// Example 4: Table with Row Actions
export function RowActionsExample() {
  const columns = [
    { key: 'hostname', label: 'Hostname', sortable: true },
    { key: 'ip', label: 'IP Address', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const data = [
    { id: 1, hostname: 'prod-db-01', ip: '10.0.4.12', status: 'healthy' },
    { id: 2, hostname: 'win-node-sec', ip: '192.168.1.45', status: 'critical' },
    { id: 3, hostname: 'rhel-core-srv', ip: '10.0.8.212', status: 'healthy' },
  ];

  const actions = [
    {
      label: 'Terminal',
      icon: 'terminal',
      onClick: (row) => console.log('Open terminal for', row.hostname),
    },
    {
      label: 'Reboot',
      icon: 'restart_alt',
      onClick: (row) => console.log('Reboot', row.hostname),
    },
    {
      label: 'Monitor',
      icon: 'monitoring',
      onClick: (row) => console.log('Monitor', row.hostname),
    },
  ];

  return (
    <div className="p-8 bg-[#060e20]">
      <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Table with Actions</h2>
      <DataTable columns={columns} data={data} actions={actions} />
    </div>
  );
}

// Example 5: Table with Row Click
export function RowClickExample() {
  const [selectedRow, setSelectedRow] = useState(null);

  const columns = [
    { key: 'hostname', label: 'Hostname', sortable: true },
    { key: 'ip', label: 'IP Address', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const data = [
    { id: 1, hostname: 'prod-db-01', ip: '10.0.4.12', status: 'healthy' },
    { id: 2, hostname: 'win-node-sec', ip: '192.168.1.45', status: 'critical' },
    { id: 3, hostname: 'rhel-core-srv', ip: '10.0.8.212', status: 'healthy' },
  ];

  const handleRowClick = (row) => {
    setSelectedRow(row);
    console.log('Row clicked:', row);
  };

  return (
    <div className="p-8 bg-[#060e20]">
      <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Clickable Rows</h2>
      <DataTable columns={columns} data={data} onRowClick={handleRowClick} />
      {selectedRow && (
        <div className="mt-4 p-4 bg-[#05183c] rounded-lg text-[#dee5ff]">
          <p className="text-sm">Selected: {selectedRow.hostname}</p>
        </div>
      )}
    </div>
  );
}

// Example 6: Complete Example (like stitch_hosts_raw.html)
export function CompleteExample() {
  const [sortedData, setSortedData] = useState([
    { 
      id: 1, 
      hostname: 'prod-db-01.internal', 
      cluster: 'CLUSTER-A1',
      ip: '10.0.4.12', 
      os: 'Ubuntu 22.04 LTS',
      osIcon: 'terminal',
      version: 'v2.4.1',
      status: 'healthy' 
    },
    { 
      id: 2, 
      hostname: 'win-node-sec.cloud', 
      cluster: 'LEGACY-POOL',
      ip: '192.168.1.45', 
      os: 'Windows Server 2022',
      osIcon: 'desktop_windows',
      version: 'v1.9.0 (Outdated)',
      status: 'critical' 
    },
    { 
      id: 3, 
      hostname: 'rhel-core-srv-09', 
      cluster: 'CORE-SVC',
      ip: '10.0.8.212', 
      os: 'RHEL 9.2 Enterprise',
      osIcon: 'verified_user',
      version: 'v2.4.1',
      status: 'healthy' 
    },
  ]);

  const columns = [
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => {
        const config = {
          healthy: { color: 'bg-[#7bd0ff]', label: 'Healthy', textColor: 'text-[#7bd0ff]' },
          critical: { color: 'bg-[#ee7d77]', label: 'Critical', textColor: 'text-[#ee7d77]' },
        };
        const { color, label, textColor } = config[value];
        return (
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color} shadow-[0_0_8px_rgba(123,208,255,0.4)]`}></span>
            <span className={`text-[11px] font-bold uppercase tracking-widest ${textColor}`}>{label}</span>
          </div>
        );
      }
    },
    { 
      key: 'hostname', 
      label: 'Hostname', 
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#dee5ff] group-hover:text-[#7bd0ff] transition-colors">
            {value}
          </span>
          <span className="text-[10px] text-[#91aaeb] font-medium">{row.cluster}</span>
        </div>
      )
    },
    { 
      key: 'ip', 
      label: 'IP Address',
      render: (value) => (
        <span className="font-mono text-xs text-[#91aaeb]">{value}</span>
      )
    },
    { 
      key: 'os', 
      label: 'OS Platform',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#05183c] flex items-center justify-center text-[#91aaeb]">
            <span className="material-symbols-outlined text-lg">{row.osIcon}</span>
          </div>
          <span className="text-sm">{value}</span>
        </div>
      )
    },
    { 
      key: 'version', 
      label: 'Agent Version',
      render: (value, row) => {
        const isOutdated = value.includes('Outdated');
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isOutdated 
              ? 'bg-[#7f2927]/40 text-[#ff9993]' 
              : 'bg-[#00225a] text-[#b4c0d7]'
          }`}>
            {value}
          </span>
        );
      }
    },
  ];

  const actions = [
    {
      label: 'Terminal',
      icon: 'terminal',
      onClick: (row) => alert(`Opening terminal for ${row.hostname}`),
    },
    {
      label: 'Reboot',
      icon: 'restart_alt',
      onClick: (row) => alert(`Rebooting ${row.hostname}`),
    },
    {
      label: 'Monitor',
      icon: 'monitoring',
      onClick: (row) => alert(`Monitoring ${row.hostname}`),
    },
  ];

  const handleSort = (key, direction) => {
    if (!direction) {
      setSortedData([...sortedData]);
      return;
    }

    const sorted = [...sortedData].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setSortedData(sorted);
  };

  const handleRowClick = (row) => {
    console.log('Navigate to host details:', row.hostname);
  };

  return (
    <div className="p-8 bg-[#060e20] min-h-screen">
      <div className="mb-8">
        <h2 className="text-4xl font-bold tracking-tighter text-[#dee5ff]">Host Management</h2>
        <p className="text-[#939eb5] mt-2">Complete DataTable example matching Stitch design</p>
      </div>
      
      <div className="bg-[#06122d] rounded-2xl overflow-hidden shadow-2xl">
        <DataTable 
          columns={columns} 
          data={sortedData} 
          onSort={handleSort}
          onRowClick={handleRowClick}
          actions={actions}
        />
      </div>
    </div>
  );
}

export default CompleteExample;
