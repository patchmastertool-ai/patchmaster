import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import NetworkBootPage from './NetworkBootPage';

describe('NetworkBootPage', () => {
  let mockApiFetch;
  let mockHosts;
  let mockAPI;

  beforeEach(() => {
    cleanup();
    mockAPI = 'http://localhost:8000';
    mockHosts = [
      { id: 1, hostname: 'host-01', ip: '10.0.0.1', site: 'Site-A' },
      { id: 2, hostname: 'host-02', ip: '10.0.0.2', site: 'Site-B' },
    ];

    mockApiFetch = vi.fn((url, options) => {
      // Mock successful responses for all endpoints
      if (url.includes('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/networks')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 1, name: 'Test Network' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/profiles')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 1, name: 'Test Profile' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/relays')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 1, name: 'Test Relay' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/assignments')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 1, hostname: 'test-host', mac_address: 'AA:BB:CC:DD:EE:FF' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/catalog')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ provisioning_templates: [], mirror_repositories: [] })
        });
      }
      if (url.includes('/boot-sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      }
      if (url.includes('/service-preview')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      }
      if (url.includes('/deployment-bundle')) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['test']))
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('Rendering', () => {
    it('should render the page header with title and subtitle', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Network Boot (PXE)')).toBeInTheDocument();
        expect(screen.getByText('Bare-Metal Deployment Workspace')).toBeInTheDocument();
      });
    });

    it('should render all stat cards', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Networks')).toBeInTheDocument();
        expect(screen.getByText('Profiles')).toBeInTheDocument();
        expect(screen.getByText('Assignments')).toBeInTheDocument();
        expect(screen.getByText('Relays')).toBeInTheDocument();
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getByText('Templates')).toBeInTheDocument();
      });
    });

    it('should render all tab buttons', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Overview \(/)).toBeInTheDocument();
        expect(screen.getByText(/Relays \(/)).toBeInTheDocument();
        expect(screen.getByText(/Networks \(/)).toBeInTheDocument();
        expect(screen.getByText(/Profiles \(/)).toBeInTheDocument();
        expect(screen.getByText(/Assignments \(/)).toBeInTheDocument();
        expect(screen.getByText(/Sessions \(/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to relays tab when clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const relaysTab = screen.getByText(/Relays \(/);
        fireEvent.click(relaysTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Register Boot Relay')).toBeInTheDocument();
      });
    });

    it('should switch to networks tab when clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const networksTab = screen.getByText(/Networks \(/);
        fireEvent.click(networksTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Define Boot Network')).toBeInTheDocument();
      });
    });

    it('should switch to profiles tab when clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const profilesTab = screen.getByText(/Profiles \(/);
        fireEvent.click(profilesTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Create Boot Profile')).toBeInTheDocument();
      });
    });

    it('should switch to assignments tab when clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const assignmentsTab = screen.getByText(/Assignments \(/);
        fireEvent.click(assignmentsTab);
      });

      await waitFor(() => {
        expect(screen.getAllByText('Create PXE Assignment')[0]).toBeInTheDocument();
      });
    });

    it('should switch to sessions tab when clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const sessionsTab = screen.getByText(/Sessions \(/);
        fireEvent.click(sessionsTab);
      });

      await waitFor(() => {
        expect(screen.getByText(/Live Boot Sessions/)).toBeInTheDocument();
      });
    });
  });

  describe('Network Creation', () => {
    it('should show validation error when network name is empty', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const networksTab = screen.getByText(/Networks \(/);
        fireEvent.click(networksTab);
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Boot Network');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Boot network name is required.')).toBeInTheDocument();
      });
    });

    it('should create network successfully with valid data', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const networksTab = screen.getByText(/Networks \(/);
        fireEvent.click(networksTab);
      });

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Branch-London-UEFI');
        fireEvent.change(nameInput, { target: { value: 'Test Network' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Boot Network');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/networks'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Relay Creation', () => {
    it('should show validation error when relay name or host is missing', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const relaysTab = screen.getByText(/Relays \(/);
        fireEvent.click(relaysTab);
      });

      await waitFor(() => {
        const createButton = screen.getByText('Register Relay');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Relay name and managed host are required.')).toBeInTheDocument();
      });
    });

    it('should create relay successfully with valid data', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const relaysTab = screen.getByText(/Relays \(/);
        fireEvent.click(relaysTab);
      });

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('mumbai-hq-relay-01');
        fireEvent.change(nameInput, { target: { value: 'Test Relay' } });
      });

      await waitFor(() => {
        const hostSelect = screen.getByLabelText(/Managed Host/i);
        fireEvent.change(hostSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Register Relay');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/relays'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Profile Creation', () => {
    it('should show validation error when profile name is empty', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const profilesTab = screen.getByText(/Profiles \(/);
        fireEvent.click(profilesTab);
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Profile');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Profile name is required.')).toBeInTheDocument();
      });
    });

    it('should create profile successfully with valid data', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const profilesTab = screen.getByText(/Profiles \(/);
        fireEvent.click(profilesTab);
      });

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Ubuntu-22.04-UEFI');
        fireEvent.change(nameInput, { target: { value: 'Test Profile' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Profile');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/profiles'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('Assignment Creation', () => {
    it('should show validation error when required fields are missing', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const assignmentsTab = screen.getByText(/Assignments \(/);
        fireEvent.click(assignmentsTab);
      });

      await waitFor(() => {
        const createButton = screen.getAllByText('Create PXE Assignment')[1];
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Network, profile, and MAC address are required.')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should call refresh when refresh button is clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const refreshButton = screen.getAllByText('Refresh')[0];
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalled();
      });
    });
  });

  describe('Download Functionality', () => {
    it('should call API when download button is clicked', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const downloadButton = screen.getByText('Deployment Bundle');
        fireEvent.click(downloadButton);
      });

      await waitFor(() => {
        const calls = mockApiFetch.mock.calls;
        const deploymentBundleCall = calls.find(call => 
          call[0] && call[0].includes('/deployment-bundle')
        );
        expect(deploymentBundleCall).toBeDefined();
      });
    });
  });

  describe('Data Display', () => {
    it('should display workflow cards when data is available', async () => {
      mockApiFetch = vi.fn((url) => {
        if (url.includes('/workflows')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              items: [
                { id: 1, label: 'Workflow-1', title: 'Test Workflow', status: 'implemented', capabilities: ['Cap1', 'Cap2'] }
              ] 
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] })
        });
      });

      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state message when no data is available', async () => {
      render(
        <NetworkBootPage 
          hosts={mockHosts} 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
        />
      );

      await waitFor(() => {
        const networksTab = screen.getByText(/Networks \(/);
        fireEvent.click(networksTab);
      });

      await waitFor(() => {
        expect(screen.getByText('No networks yet.')).toBeInTheDocument();
      });
    });
  });
});
