import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MirrorRepoOpsPage from './MirrorRepoOpsPage';

describe('MirrorRepoOpsPage', () => {
  const mockAPI = 'http://localhost:8000';
  let mockApiFetch;

  beforeEach(() => {
    mockApiFetch = vi.fn();
    vi.clearAllMocks();
  });

  const mockRepos = [
    {
      id: 1,
      name: 'Ubuntu Security',
      provider: 'ubuntu',
      os_family: 'linux',
      channel: 'default',
      source_url: 'https://ubuntu.com/security/notices.json',
      enabled: true,
      metadata_only: true,
      sync_interval_minutes: 360,
      retention_days: 30,
      keep_versions: 2
    },
    {
      id: 2,
      name: 'Red Hat CVE',
      provider: 'redhat',
      os_family: 'linux',
      channel: 'default',
      source_url: 'https://access.redhat.com/hydra/rest/securitydata/csaf.json',
      enabled: false,
      metadata_only: true,
      sync_interval_minutes: 720,
      retention_days: 60,
      keep_versions: 3
    }
  ];

  const mockRuns = [
    {
      id: 1,
      status: 'success',
      trigger_type: 'manual',
      started_at: '2024-01-15T10:30:00Z',
      summary: { items_seen: 100, inserted: 10 },
      error: null
    },
    {
      id: 2,
      status: 'failed',
      trigger_type: 'scheduled',
      started_at: '2024-01-14T08:00:00Z',
      summary: { items_seen: 0, inserted: 0 },
      error: 'Connection timeout'
    }
  ];

  const mockPackages = {
    items: [
      { id: 1, package_name: 'openssl', package_version: '1.1.1', architecture: 'amd64' },
      { id: 2, package_name: 'curl', package_version: '7.68.0', architecture: 'amd64' }
    ]
  };

  it('renders page header with title and stats', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepos
    });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Mirror Repositories')).toBeInTheDocument();
      expect(screen.getByText('Vulnerability Intelligence')).toBeInTheDocument();
      expect(screen.getByText('2 configured upstream repositories')).toBeInTheDocument();
    });
  });

  it('displays stat cards with correct values', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepos
    });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Total Mirrors')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Total repos
      const activeElements = screen.getAllByText('Active');
      expect(activeElements.length).toBeGreaterThan(0);
      expect(screen.getByText('1')).toBeInTheDocument(); // Active repos
    });
  });

  it('loads and displays repository list', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepos
    });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
      expect(screen.getByText('Red Hat CVE')).toBeInTheDocument();
      expect(screen.getByText('ubuntu · linux')).toBeInTheDocument();
      expect(screen.getByText('redhat · linux')).toBeInTheDocument();
    });
  });

  it('shows add repository form when Add Repository button is clicked', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepos
    });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Add Repository')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add Repository');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Register New Mirror')).toBeInTheDocument();
      expect(screen.getByText('Create Mirror')).toBeInTheDocument();
    });
  });

  it('creates a new repository successfully', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 3, name: 'Test Repo', provider: 'ubuntu' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [...mockRepos, { id: 3, name: 'Test Repo' }]
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Add Repository')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add Repository'));

    await waitFor(() => {
      expect(screen.getByText('Register New Mirror')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Repo' } });

    // Submit
    const createButton = screen.getByText('Create Mirror');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mirror/repos'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test Repo')
        })
      );
    });
  });

  it('selects a repository and loads its details', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
    });

    // Click on first repository
    fireEvent.click(screen.getByText('Ubuntu Security'));

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security Configuration')).toBeInTheDocument();
      // Check that the API was called with the correct endpoints (accounting for initial load)
      const calls = mockApiFetch.mock.calls;
      expect(calls.some(call => call[0].includes('/api/mirror/repos/1/runs'))).toBe(true);
      expect(calls.some(call => call[0].includes('/api/mirror/repos/1/packages'))).toBe(true);
    });
  });

  it('displays sync runs table when repository is selected', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ubuntu Security'));

    await waitFor(() => {
      expect(screen.getByText('Recent Sync Runs')).toBeInTheDocument();
      expect(screen.getByText('manual')).toBeInTheDocument();
      expect(screen.getByText('scheduled')).toBeInTheDocument();
    });
  });

  it('updates repository configuration', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockRepos[0], sync_interval_minutes: 480 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ubuntu Security'));

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security Configuration')).toBeInTheDocument();
    });

    // Find and click Save button
    const saveButtons = screen.getAllByText('Save');
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mirror/repos/1'),
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });
  });

  it('triggers manual sync', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: { status: 'queued' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ubuntu Security'));

    await waitFor(() => {
      expect(screen.getByText('Run Sync')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Run Sync'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mirror/repos/1/sync'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('deletes repository with confirmation', async () => {
    window.confirm = vi.fn(() => true);

    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockRepos[1]]
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ubuntu Security'));

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Delete Ubuntu Security?');
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mirror/repos/1'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  it('runs retention preview', async () => {
    const mockRetentionPreview = {
      summary: {
        would_remove_packages: 5,
        preview: [
          { id: 1, package_name: 'old-package', package_version: '1.0.0', architecture: 'amd64', reason: 'Exceeds retention days' }
        ]
      }
    };

    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRuns
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRetentionPreview
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Ubuntu Security')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ubuntu Security'));

    await waitFor(() => {
      expect(screen.getByText('Preview Retention')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Preview Retention'));

    await waitFor(() => {
      // Check that the API was called with the retention preview endpoint
      const calls = mockApiFetch.mock.calls;
      expect(calls.some(call => call[0].includes('/api/mirror/repos/1/retention/preview'))).toBe(true);
      expect(screen.getByText('Retention Candidate Preview')).toBeInTheDocument();
      expect(screen.getByText('old-package')).toBeInTheDocument();
    });
  });

  it('triggers auto-bootstrap', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Auto-Bootstrap')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Auto-Bootstrap'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mirror/automation/bootstrap-sync'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('displays error notice when API call fails', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Failed to create repository' })
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Add Repository')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Repository'));

    await waitFor(() => {
      expect(screen.getByText('Register New Mirror')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Repo' } });

    fireEvent.click(screen.getByText('Create Mirror'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create repository')).toBeInTheDocument();
    });
  });

  it('shows empty state when no repository is selected', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRepos
    });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Select a mirror to manage')).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepos
      });

    render(<MirrorRepoOpsPage API={mockAPI} apiFetch={mockApiFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });
  });
});
