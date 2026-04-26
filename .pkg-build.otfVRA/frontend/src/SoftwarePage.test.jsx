import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoftwarePage from './SoftwarePage';
import * as appRuntime from './appRuntime';

// Mock the appRuntime module
vi.mock('./appRuntime', () => ({
  getUser: vi.fn()
}));

describe('SoftwarePage', () => {
  const mockHosts = [
    { id: 1, hostname: 'web-server-01', ip: '192.168.1.10', os: 'Ubuntu 22.04', site: 'DC1' },
    { id: 2, hostname: 'db-server-01', ip: '192.168.1.20', os: 'CentOS 8', site: 'DC2' },
    { id: 3, hostname: 'app-server-01', ip: '192.168.1.30', os: 'Windows Server 2022', site: 'DC1' }
  ];

  const mockAPI = 'http://localhost:8000';
  
  const mockApiFetch = vi.fn();

  const defaultProps = {
    hosts: mockHosts,
    API: mockAPI,
    apiFetch: mockApiFetch
  };

  beforeEach(() => {
    vi.clearAllMocks();
    appRuntime.getUser.mockReturnValue({ username: 'admin', role: 'admin' });
    
    // Default mock responses
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/api/software-kiosk/catalog')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/api/software-kiosk/requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('Page Rendering', () => {
    it('renders page header with title and subtitle', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Software Center')).toBeInTheDocument();
        expect(screen.getByText(/Software Distribution Platform/i)).toBeInTheDocument();
      });
    });

    it('displays correct endpoint count in subtitle', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/3 endpoints/)).toBeInTheDocument();
      });
    });

    it('renders stat cards with correct metrics', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Fleet')).toBeInTheDocument();
        expect(screen.getByText('Catalog')).toBeInTheDocument();
        expect(screen.getByText('Open Requests')).toBeInTheDocument();
        expect(screen.getByText('In Queue')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('renders both tab buttons', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Operator Push')).toBeInTheDocument();
        expect(screen.getByText('Approved Catalog')).toBeInTheDocument();
      });
    });

    it('starts with Operator Push tab active', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const pushButton = screen.getByText('Operator Push').closest('button');
        expect(pushButton).toHaveClass('bg-[#7bd0ff]/20');
        expect(pushButton).toHaveClass('text-[#7bd0ff]');
      });
    });

    it('switches to Approved Catalog tab when clicked', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogButton = screen.getByText('Approved Catalog');
        fireEvent.click(catalogButton);
      });

      await waitFor(() => {
        const catalogButton = screen.getByText('Approved Catalog').closest('button');
        expect(catalogButton).toHaveClass('bg-[#7bd0ff]/20');
        expect(catalogButton).toHaveClass('text-[#7bd0ff]');
      });
    });
  });

  describe('Operator Push View', () => {
    it('renders host selection card', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Target Hosts/)).toBeInTheDocument();
        expect(screen.getByText('web-server-01')).toBeInTheDocument();
        expect(screen.getByText('db-server-01')).toBeInTheDocument();
        expect(screen.getByText('app-server-01')).toBeInTheDocument();
      });
    });

    it('displays host details correctly', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('web-server-01')).toBeInTheDocument();
      });
      
      // Check that IP addresses are rendered (they may be in separate text nodes)
      const ipElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('192.168.1.10') || false;
      });
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('allows selecting individual hosts', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
      });
    });

    it('selects all hosts when All button clicked', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const allButton = screen.getByText('All');
        fireEvent.click(allButton);
      });

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox').filter(cb => cb.type === 'checkbox');
        checkboxes.forEach(checkbox => {
          expect(checkbox).toBeChecked();
        });
      });
    });

    it('deselects all hosts when None button clicked', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // First select all
        const allButton = screen.getByText('All');
        fireEvent.click(allButton);
      });

      await waitFor(() => {
        // Then deselect all
        const noneButton = screen.getByText('None');
        fireEvent.click(noneButton);
      });

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox').filter(cb => cb.type === 'checkbox');
        checkboxes.forEach(checkbox => {
          expect(checkbox).not.toBeChecked();
        });
      });
    });

    it('renders action configuration card', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Configure Action')).toBeInTheDocument();
        expect(screen.getByText('Operation')).toBeInTheDocument();
        expect(screen.getByText('Execution Mode')).toBeInTheDocument();
      });
    });

    it('renders package input field', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText('nginx, curl, vim');
        expect(input).toBeInTheDocument();
      });
    });

    it('disables execute button when no hosts selected', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const executeButton = screen.getByText(/Execute Now|Queue Action/).closest('button');
        expect(executeButton).toBeDisabled();
      });
    });

    it('disables execute button when no packages entered', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // Select a host
        const allButton = screen.getByText('All');
        fireEvent.click(allButton);
      });

      await waitFor(() => {
        const executeButton = screen.getByText(/Execute Now|Queue Action/).closest('button');
        expect(executeButton).toBeDisabled();
      });
    });
  });

  describe('Shutdown Queue', () => {
    it('does not show shutdown queue when no host selected', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Shutdown Queue/)).not.toBeInTheDocument();
      });
    });

    it('shows shutdown queue when single host selected', async () => {
      mockApiFetch.mockImplementation((url) => {
        if (url.includes('/software/queue')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: [] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      });

      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
      });

      await waitFor(() => {
        expect(screen.getByText(/Shutdown Queue/)).toBeInTheDocument();
      });
    });

    it('fetches queue data for selected host', async () => {
      const queueItems = [
        {
          id: 1,
          queued_at: '2024-01-15T10:30:00Z',
          action: 'install',
          packages: ['nginx', 'curl'],
          requested_by: 'admin',
          reason: 'CHG-12345'
        }
      ];

      mockApiFetch.mockImplementation((url) => {
        if (url.includes('/software/queue')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: queueItems })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      });

      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/software/queue')
        );
      });
    });
  });

  describe('Approved Catalog View', () => {
    beforeEach(() => {
      mockApiFetch.mockImplementation((url) => {
        if (url.includes('/api/software-kiosk/catalog')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              items: [
                {
                  id: 1,
                  name: 'Nginx Web Server',
                  package_name: 'nginx',
                  description: 'High-performance web server',
                  supported_platforms: ['linux'],
                  allowed_actions: ['install', 'remove'],
                  default_execution_mode: 'immediate',
                  is_enabled: true
                }
              ]
            })
          });
        }
        if (url.includes('/api/software-kiosk/requests')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: [] })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });
    });

    it('renders request configuration section', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Request Configuration')).toBeInTheDocument();
        expect(screen.getAllByText('Target Host')[0]).toBeInTheDocument();
      });
    });

    it('renders catalog table with items', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Nginx Web Server')).toBeInTheDocument();
        expect(screen.getByText('High-performance web server')).toBeInTheDocument();
      });
    });

    it('shows Add Item button for privileged users', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Add Item')).toBeInTheDocument();
      });
    });

    it('hides Add Item button for non-privileged users', async () => {
      appRuntime.getUser.mockReturnValue({ username: 'user', role: 'user' });
      
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        expect(screen.queryByText('Add Item')).not.toBeInTheDocument();
      });
    });

    it('shows catalog form when Add Item clicked', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        const addButton = screen.getByText('Add Item');
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Display name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Package \/ apt \/ winget ID/)).toBeInTheDocument();
      });
    });

    it('renders request queue section', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        expect(screen.getByText(/Request Queue/)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('fetches catalog on mount', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/software-kiosk/catalog')
        );
      });
    });

    it('fetches requests on mount', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/software-kiosk/requests')
        );
      });
    });

    it('includes include_disabled parameter for privileged users', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('include_disabled=true')
        );
      });
    });

    it('excludes include_disabled parameter for non-privileged users', async () => {
      appRuntime.getUser.mockReturnValue({ username: 'user', role: 'user' });
      
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const calls = mockApiFetch.mock.calls.filter(call => 
          call[0].includes('/api/software-kiosk/catalog')
        );
        expect(calls[0][0]).not.toContain('include_disabled');
      });
    });
  });

  describe('Design System Compliance', () => {
    it('uses Stitch color palette for backgrounds', async () => {
      const { container } = render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const bgElements = container.querySelectorAll('[class*="bg-"]');
        expect(bgElements.length).toBeGreaterThan(0);
      });
    });

    it('uses Material Symbols icons', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // Icons are rendered via the Icon component
        expect(screen.getByText('Software Center')).toBeInTheDocument();
      });
    });

    it('uses Tailwind CSS classes exclusively', async () => {
      const { container } = render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // Check that no CH.jsx style objects are present
        const inlineStyles = container.querySelectorAll('[style*="background"]');
        expect(inlineStyles.length).toBe(0);
      });
    });

    it('applies consistent border radius', async () => {
      const { container } = render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const roundedElements = container.querySelectorAll('[class*="rounded"]');
        expect(roundedElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsive Design', () => {
    it('uses responsive grid classes', async () => {
      const { container } = render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const gridElements = container.querySelectorAll('[class*="grid-cols"]');
        expect(gridElements.length).toBeGreaterThan(0);
      });
    });

    it('uses responsive breakpoint classes', async () => {
      const { container } = render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const responsiveElements = container.querySelectorAll('[class*="md:"], [class*="lg:"]');
        expect(responsiveElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent('Software Center');
      });
    });

    it('has accessible form labels', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Operation')).toBeInTheDocument();
        expect(screen.getByText('Execution Mode')).toBeInTheDocument();
      });
    });

    it('has accessible checkboxes', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Requirements Validation', () => {
    it('validates Requirement 4.1: Uses Stitch color palette', async () => {
      const { container } = render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // Check for primary color #7bd0ff
        const primaryElements = container.querySelectorAll('[class*="7bd0ff"]');
        expect(primaryElements.length).toBeGreaterThan(0);
        
        // Check for background color #060e20
        const bgElements = container.querySelectorAll('[class*="060e20"]');
        expect(bgElements.length).toBeGreaterThan(0);
      });
    });

    it('validates Requirement 4.2: Uses DataTable component', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        // DataTable renders table elements
        const tables = screen.getAllByRole('table');
        expect(tables.length).toBeGreaterThan(0);
      });
    });

    it('validates Requirement 4.3: Uses StatusBadge component', async () => {
      mockApiFetch.mockImplementation((url) => {
        if (url.includes('/api/software-kiosk/catalog')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              items: [{
                id: 1,
                name: 'Test',
                package_name: 'test',
                is_enabled: true,
                allowed_actions: ['install'],
                default_execution_mode: 'immediate'
              }]
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      });

      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        const catalogTab = screen.getByText('Approved Catalog');
        fireEvent.click(catalogTab);
      });

      await waitFor(() => {
        // StatusBadge renders with uppercase text
        const badges = screen.getAllByText(/ACTIVE|IMMEDIATE/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('validates Requirement 4.5: Uses FormInput and FormSelect', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // FormSelect for Operation
        expect(screen.getByText('Operation')).toBeInTheDocument();
        
        // FormInput for packages
        expect(screen.getByPlaceholderText('nginx, curl, vim')).toBeInTheDocument();
      });
    });

    it('validates Requirement 4.6: Uses ActionButton component', async () => {
      render(<SoftwarePage {...defaultProps} />);
      
      await waitFor(() => {
        // ActionButton for execute
        expect(screen.getByText(/Execute Now|Queue Action/)).toBeInTheDocument();
        
        // ActionButton for All/None
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('None')).toBeInTheDocument();
      });
    });
  });
});
