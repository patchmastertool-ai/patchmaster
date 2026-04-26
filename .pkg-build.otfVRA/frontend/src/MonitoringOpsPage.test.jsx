import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonitoringOpsPage from './MonitoringOpsPage';

describe('MonitoringOpsPage', () => {
  const mockApiFetch = vi.fn();
  const mockHasRole = vi.fn(() => true);
  const mockAPI = 'http://localhost:8000';

  const mockHosts = [
    {
      id: 1,
      hostname: 'server-01',
      name: 'server-01',
      ip: '192.168.1.10',
      os: 'Ubuntu 22.04',
      node_exporter_enabled: true,
      is_monitored: true,
      monitoring_enabled: true,
      last_seen: '2024-01-15T10:30:00Z'
    },
    {
      id: 2,
      hostname: 'server-02',
      name: 'server-02',
      ip: '192.168.1.11',
      os: 'CentOS 8',
      node_exporter_enabled: false,
      is_monitored: false,
      monitoring_enabled: false,
      last_seen: '2024-01-15T09:15:00Z'
    }
  ];

  const mockLicenseInfo = {
    features: ['monitoring'],
    expired: false,
    tier_label: 'Enterprise'
  };

  const mockMonitoringStatus = {
    licensed: true,
    tier_label: 'Enterprise',
    services: {
      'prometheus.service': {
        name: 'Prometheus',
        installed: true,
        running: true,
        port: 9090
      },
      'grafana.service': {
        name: 'Grafana',
        installed: true,
        running: true,
        port: 3001
      }
    }
  };

  const mockHealthStatus = {
    services: {
      'prometheus': {
        running: true,
        port: 9090
      },
      'grafana': {
        running: true,
        port: 3001
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockImplementation((url) => {
      if (url.includes('/api/monitoring/status')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockMonitoringStatus)
        });
      }
      if (url.includes('/api/monitoring/health')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockHealthStatus)
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  describe('Component Rendering', () => {
    it('should render the page header with title and subtitle', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Monitoring Operations')).toBeInTheDocument();
        expect(screen.getByText('Infrastructure Observability')).toBeInTheDocument();
        expect(screen.getByText(/2 endpoints in scope/)).toBeInTheDocument();
      });
    });

    it('should render all stat cards with correct data', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Hosts Monitored')).toBeInTheDocument();
        expect(screen.getAllByText('Prometheus').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Grafana').length).toBeGreaterThan(0);
        expect(screen.getByText('License')).toBeInTheDocument();
      });
    });

    it('should render tab navigation with all tabs', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^hosts$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^grafana$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^prometheus$/i })).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      expect(screen.getByText('Loading monitoring data…')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to hosts tab when clicked', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const hostsTab = screen.getByText('Hosts');
      fireEvent.click(hostsTab);

      await waitFor(() => {
        expect(screen.getByText('Per-Host Monitoring Status')).toBeInTheDocument();
        expect(screen.getByText('server-01')).toBeInTheDocument();
        expect(screen.getByText('server-02')).toBeInTheDocument();
      });
    });

    it('should switch to grafana tab when clicked', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const grafanaTab = screen.getByRole('button', { name: /^grafana$/i });
      fireEvent.click(grafanaTab);

      await waitFor(() => {
        expect(screen.getByText('Grafana Dashboards')).toBeInTheDocument();
        expect(screen.getByTitle('Grafana')).toBeInTheDocument();
      });
    });

    it('should switch to prometheus tab when clicked', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const prometheusTab = screen.getByRole('button', { name: /^prometheus$/i });
      fireEvent.click(prometheusTab);

      await waitFor(() => {
        expect(screen.getByText('Prometheus Metrics')).toBeInTheDocument();
        expect(screen.getByTitle('Prometheus')).toBeInTheDocument();
      });
    });
  });

  describe('Service Status Display', () => {
    it('should display running services with correct status badges', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        const runningBadges = screen.getAllByText('Running');
        expect(runningBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display stopped services with correct status badges', async () => {
      const stoppedStatus = {
        ...mockMonitoringStatus,
        services: {
          'prometheus.service': {
            name: 'Prometheus',
            installed: true,
            running: false,
            port: 9090
          },
          'grafana.service': {
            name: 'Grafana',
            installed: true,
            running: false,
            port: 3001
          }
        }
      };

      mockApiFetch.mockImplementation((url) => {
        if (url.includes('/api/monitoring/status')) {
          return Promise.resolve({
            json: () => Promise.resolve(stoppedStatus)
          });
        }
        if (url.includes('/api/monitoring/health')) {
          return Promise.resolve({
            json: () => Promise.resolve({ services: {} })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        const stoppedBadges = screen.getAllByText('Stopped');
        expect(stoppedBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Action Buttons', () => {
    it('should call bootstrap API when Deploy button is clicked', async () => {
      mockApiFetch.mockImplementation((url, options) => {
        if (url.includes('/api/monitoring/bootstrap') && options?.method === 'POST') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true })
          });
        }
        if (url.includes('/api/monitoring/status')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockMonitoringStatus)
          });
        }
        if (url.includes('/api/monitoring/health')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockHealthStatus)
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const deployButton = screen.getByText('Deploy Monitoring Stack');
      fireEvent.click(deployButton);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/monitoring/bootstrap'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should call enforce API when Enforce button is clicked', async () => {
      mockApiFetch.mockImplementation((url, options) => {
        if (url.includes('/api/monitoring/enforce') && options?.method === 'POST') {
          return Promise.resolve({
            json: () => Promise.resolve({ action: 'started' })
          });
        }
        if (url.includes('/api/monitoring/status')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockMonitoringStatus)
          });
        }
        if (url.includes('/api/monitoring/health')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockHealthStatus)
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const enforceButton = screen.getByText('Enforce Configuration');
      fireEvent.click(enforceButton);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/monitoring/enforce'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should display success message after successful bootstrap', async () => {
      mockApiFetch.mockImplementation((url, options) => {
        if (url.includes('/api/monitoring/bootstrap') && options?.method === 'POST') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true })
          });
        }
        if (url.includes('/api/monitoring/status')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockMonitoringStatus)
          });
        }
        if (url.includes('/api/monitoring/health')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockHealthStatus)
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const deployButton = screen.getByText('Deploy Monitoring Stack');
      fireEvent.click(deployButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Monitoring stack refreshed.')).toBeInTheDocument();
      });
    });
  });

  describe('License Handling', () => {
    it('should show licensed status when license is active', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Licensed/)).toBeInTheDocument();
      });
    });

    it('should show warning when license is not active', async () => {
      const unlicensedInfo = {
        features: [],
        expired: true,
        tier_label: 'Community'
      };

      const unlicensedStatus = {
        ...mockMonitoringStatus,
        licensed: false,
        tier_label: 'Community'
      };

      mockApiFetch.mockImplementation((url) => {
        if (url.includes('/api/monitoring/status')) {
          return Promise.resolve({
            json: () => Promise.resolve(unlicensedStatus)
          });
        }
        if (url.includes('/api/monitoring/health')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockHealthStatus)
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={unlicensedInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Monitoring requires a higher license tier/)).toBeInTheDocument();
      });
    });
  });

  describe('Hosts Table', () => {
    it('should display all hosts in the hosts tab', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const hostsTab = screen.getByText('Hosts');
      fireEvent.click(hostsTab);

      await waitFor(() => {
        expect(screen.getByText('server-01')).toBeInTheDocument();
        expect(screen.getByText('server-02')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.10')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.11')).toBeInTheDocument();
      });
    });

    it('should display correct monitoring status for each host', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const hostsTab = screen.getByText('Hosts');
      fireEvent.click(hostsTab);

      await waitFor(() => {
        const enabledBadges = screen.getAllByText('Enabled');
        const disabledBadges = screen.getAllByText('Disabled');
        expect(enabledBadges.length).toBeGreaterThan(0);
        expect(disabledBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh data when refresh button is clicked', async () => {
      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const initialCallCount = mockApiFetch.mock.calls.length;

      const refreshButton = screen.getByText('Refresh Data');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockApiFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Suppress console errors for this test
      const consoleError = console.error;
      console.error = vi.fn();

      mockApiFetch.mockImplementation(() => {
        return Promise.reject(new Error('API Error'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      // Restore console.error
      console.error = consoleError;
    });

    it('should display error message when bootstrap fails', async () => {
      mockApiFetch.mockImplementation((url, options) => {
        if (url.includes('/api/monitoring/bootstrap') && options?.method === 'POST') {
          return Promise.reject(new Error('Bootstrap failed'));
        }
        if (url.includes('/api/monitoring/status')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockMonitoringStatus)
          });
        }
        if (url.includes('/api/monitoring/health')) {
          return Promise.resolve({
            json: () => Promise.resolve(mockHealthStatus)
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MonitoringOpsPage
          licenseInfo={mockLicenseInfo}
          hosts={mockHosts}
          API={mockAPI}
          apiFetch={mockApiFetch}
          hasRole={mockHasRole}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monitoring data…')).not.toBeInTheDocument();
      });

      const deployButton = screen.getByText('Deploy Monitoring Stack');
      fireEvent.click(deployButton);

      await waitFor(() => {
        expect(screen.getByText('✗ Bootstrap failed.')).toBeInTheDocument();
      });
    });
  });
});
