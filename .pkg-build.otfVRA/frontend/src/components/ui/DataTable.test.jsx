import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DataTable } from './DataTable';

describe('DataTable Component', () => {
  const defaultColumns = [
    { key: 'hostname', label: 'Hostname', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'ip', label: 'IP Address' },
  ];

  const defaultData = [
    { hostname: 'prod-db-01', status: 'Healthy', ip: '10.0.4.12' },
    { hostname: 'prod-web-02', status: 'Warning', ip: '10.0.4.13' },
    { hostname: 'prod-cache-03', status: 'Critical', ip: '10.0.4.14' },
  ];

  describe('Rendering', () => {
    it('should render table headers', () => {
      render(<DataTable columns={defaultColumns} data={defaultData} />);
      expect(screen.getByText('Hostname')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('IP Address')).toBeInTheDocument();
    });

    it('should render table data rows', () => {
      render(<DataTable columns={defaultColumns} data={defaultData} />);
      expect(screen.getByText('prod-db-01')).toBeInTheDocument();
      expect(screen.getByText('prod-web-02')).toBeInTheDocument();
      expect(screen.getByText('prod-cache-03')).toBeInTheDocument();
    });

    it('should render empty state when no data', () => {
      render(<DataTable columns={defaultColumns} data={[]} />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render all cells correctly', () => {
      render(<DataTable columns={defaultColumns} data={defaultData} />);
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('10.0.4.12')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should call onSort when sortable column header is clicked', () => {
      const handleSort = vi.fn();
      render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          onSort={handleSort}
        />
      );
      const hostnameHeader = screen.getByText('Hostname');
      fireEvent.click(hostnameHeader);
      expect(handleSort).toHaveBeenCalledWith('hostname', 'asc');
    });

    it('should toggle sort direction on repeated clicks', () => {
      const handleSort = vi.fn();
      render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          onSort={handleSort}
        />
      );
      const hostnameHeader = screen.getByText('Hostname');
      fireEvent.click(hostnameHeader);
      fireEvent.click(hostnameHeader);
      expect(handleSort).toHaveBeenLastCalledWith('hostname', 'desc');
    });

    it('should not call onSort for non-sortable columns', () => {
      const handleSort = vi.fn();
      render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          onSort={handleSort}
        />
      );
      const statusHeader = screen.getByText('Status');
      fireEvent.click(statusHeader);
      expect(handleSort).not.toHaveBeenCalled();
    });

    it('should display sort indicator icon', () => {
      const handleSort = vi.fn();
      const { container } = render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          onSort={handleSort}
        />
      );
      const hostnameHeader = screen.getByText('Hostname');
      fireEvent.click(hostnameHeader);
      // After click, sort icon should be visible
      const sortIcon = container.querySelector('.material-symbols-outlined');
      expect(sortIcon).toBeInTheDocument();
    });
  });

  describe('Custom Rendering', () => {
    it('should use custom render function for cells', () => {
      const customColumns = [
        {
          key: 'hostname',
          label: 'Hostname',
          render: (value) => `[${value}]`,
        },
        { key: 'status', label: 'Status' },
      ];
      render(<DataTable columns={customColumns} data={defaultData} />);
      expect(screen.getByText('[prod-db-01]')).toBeInTheDocument();
    });

    it('should pass row data to render function', () => {
      const renderFn = vi.fn((value) => value);
      const customColumns = [
        { key: 'hostname', label: 'Hostname', render: renderFn },
        { key: 'status', label: 'Status' },
      ];
      render(<DataTable columns={customColumns} data={defaultData} />);
      expect(renderFn).toHaveBeenCalledWith('prod-db-01', defaultData[0]);
    });
  });

  describe('Row Actions', () => {
    it('should render action buttons', () => {
      const actions = [
        { label: 'Terminal', icon: 'terminal', onClick: vi.fn() },
        { label: 'Reboot', icon: 'restart_alt', onClick: vi.fn() },
      ];
      render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          actions={actions}
        />
      );
      expect(screen.getAllByText('terminal').length).toBeGreaterThan(0);
    });

    it('should call action handler with row data', () => {
      const handleAction = vi.fn();
      const actions = [
        { label: 'Terminal', icon: 'terminal', onClick: handleAction },
      ];
      const { container } = render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          actions={actions}
        />
      );
      const actionButtons = container.querySelectorAll('button[title="Terminal"]');
      fireEvent.click(actionButtons[0]);
      expect(handleAction).toHaveBeenCalledWith(defaultData[0]);
    });

    it('should not trigger row click when action is clicked', () => {
      const handleRowClick = vi.fn();
      const handleAction = vi.fn();
      const actions = [
        { label: 'Terminal', icon: 'terminal', onClick: handleAction },
      ];
      const { container } = render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          onRowClick={handleRowClick}
          actions={actions}
        />
      );
      const actionButtons = container.querySelectorAll('button[title="Terminal"]');
      fireEvent.click(actionButtons[0]);
      expect(handleAction).toHaveBeenCalled();
      // Row click should not be triggered
      expect(handleRowClick).not.toHaveBeenCalled();
    });
  });

  describe('Row Interactions', () => {
    it('should call onRowClick when row is clicked', () => {
      const handleRowClick = vi.fn();
      const { container } = render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          onRowClick={handleRowClick}
        />
      );
      const rows = container.querySelectorAll('tbody tr');
      fireEvent.click(rows[0]);
      expect(handleRowClick).toHaveBeenCalledWith(defaultData[0]);
    });

    it('should apply hover state to rows', () => {
      const { container } = render(
        <DataTable columns={defaultColumns} data={defaultData} />
      );
      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0]).toHaveClass('hover:bg-[#05183c]');
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          className="custom-table"
        />
      );
      expect(container.firstChild).toHaveClass('custom-table');
    });

    it('should have correct header styling', () => {
      const { container } = render(
        <DataTable columns={defaultColumns} data={defaultData} />
      );
      const headers = container.querySelectorAll('th');
      headers.forEach((header) => {
        expect(header).toHaveClass(
          'text-[10px]',
          'uppercase',
          'tracking-widest',
          'font-bold',
          'text-[#91aaeb]'
        );
      });
    });

    it('should have correct row styling', () => {
      const { container } = render(
        <DataTable columns={defaultColumns} data={defaultData} />
      );
      const rows = container.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        expect(row).toHaveClass(
          'border-b',
          'border-[#2b4680]/30',
          'hover:bg-[#05183c]',
          'transition-colors',
          'cursor-pointer'
        );
      });
    });

    it('should have correct cell styling', () => {
      const { container } = render(
        <DataTable columns={defaultColumns} data={defaultData} />
      );
      const cells = container.querySelectorAll('tbody td');
      cells.forEach((cell) => {
        expect(cell).toHaveClass('px-4', 'py-3', 'text-[#dee5ff]');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should have overflow-x-auto for horizontal scrolling', () => {
      const { container } = render(
        <DataTable columns={defaultColumns} data={defaultData} />
      );
      expect(container.firstChild).toHaveClass('overflow-x-auto');
    });
  });

  describe('Actions Column', () => {
    it('should render Actions header when actions are provided', () => {
      const actions = [
        { label: 'Terminal', icon: 'terminal', onClick: vi.fn() },
      ];
      render(
        <DataTable
          columns={defaultColumns}
          data={defaultData}
          actions={actions}
        />
      );
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should not render Actions header when no actions', () => {
      render(<DataTable columns={defaultColumns} data={defaultData} />);
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });
  });
});
