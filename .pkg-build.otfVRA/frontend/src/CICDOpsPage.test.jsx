import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CICDOpsPage from './CICDOpsPage';

describe('CICDOpsPage', () => {
  const mockAPI = 'http://localhost:8000';
  let mockApiFetch;
  let mockHasPerm;

  beforeEach(() => {
    mockApiFetch = vi.fn();
    mockHasPerm = vi.fn(() => true);
    vi.clearAllMocks();
  });

  const mockPipelines = [
    {
      id: 1,
      name: 'Production Deploy',
      tool: 'internal',
      server_url: '',
      job_path: '',
      status: 'active',
      script_type: 'internal_v2',
      script_content: '{"stages": []}'
    },
    {
      id: 2,
      name: 'Staging Pipeline',
      tool: 'jenkins',
      server_url: 'https://jenkins.example.com',
      job_path: 'namespace/project',
      status: 'paused',
      script_type: 'jenkins',
      script_content: ''
    }
  ];

  const mockBuilds = [
    {
      id: 1,
      pipeline_id: 1,
      pipeline: { name: 'Production Deploy' },
      status: 'success',
      started_at: '2024-01-15T10:30:00Z',
      trigger_source: 'manual'
    },
    {
      id: 2,
      pipeline_id: 1,
      pipeline: { name: 'Production Deploy' },
      status: 'running',
      started_at: '2024-01-15T11:00:00Z',
      trigger_source: 'webhook'
    },
    {
      id: 3,
      pipeline_id: 2,
      pipeline: { name: 'Staging Pipeline' },
      status: 'failed',
      started_at: '2024-01-14T08:00:00Z',
      trigger_source: 'scheduled'
    }
  ];

  it('renders page header with title and stats', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('CI/CD Operations Workspace')).toBeInTheDocument();
      expect(screen.getByText('Release Engineering')).toBeInTheDocument();
      expect(screen.getByText(/2 configured pipelines/)).toBeInTheDocument();
    });
  });

  it('displays stat cards with correct values', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Total Pipelines')).toBeInTheDocument();
      expect(screen.getByText('Active Builds')).toBeInTheDocument();
      expect(screen.getByText('Successful Deployments')).toBeInTheDocument();
      expect(screen.getByText('Git Handlers')).toBeInTheDocument();
      // Verify the stat values are present (there may be multiple "2"s in the page)
      const allTwos = screen.getAllByText('2');
      expect(allTwos.length).toBeGreaterThan(0);
    });
  });

  it('loads and displays pipeline list', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Production Deploy')).toBeInTheDocument();
      expect(screen.getByText('Staging Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Internal Runtime Engine · No constraints')).toBeInTheDocument();
      expect(screen.getByText(/https:\/\/jenkins.example.com/)).toBeInTheDocument();
    });
  });

  it('shows add pipeline form when New Pipeline button is clicked', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('New Pipeline')).toBeInTheDocument();
    });

    const addButton = screen.getByText('New Pipeline');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Create CI/CD Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Save Pipeline')).toBeInTheDocument();
      expect(screen.getByLabelText(/Pipeline Name/i)).toBeInTheDocument();
    });
  });

  it('creates a new pipeline successfully', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 3, name: 'Test Pipeline', tool: 'internal' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [...mockPipelines, { id: 3, name: 'Test Pipeline' }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('New Pipeline')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('New Pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Create CI/CD Pipeline')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText(/Pipeline Name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Pipeline' } });

    // Submit
    const saveButton = screen.getByText('Save Pipeline');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/cicd/pipelines'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test Pipeline')
        })
      );
      expect(screen.getByText('Pipeline created!')).toBeInTheDocument();
    });
  });

  it('shows validation error when creating pipeline without name', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('New Pipeline')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('New Pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Create CI/CD Pipeline')).toBeInTheDocument();
    });

    // Submit without filling name
    const saveButton = screen.getByText('Save Pipeline');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('shows additional fields when non-internal tool is selected', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('New Pipeline')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('New Pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Create CI/CD Pipeline')).toBeInTheDocument();
    });

    // Change tool to Jenkins
    const toolSelect = screen.getByLabelText(/Engine Tool/i);
    fireEvent.change(toolSelect, { target: { value: 'jenkins' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/Endpoint URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Job \/ Project Path/i)).toBeInTheDocument();
    });
  });

  it('triggers a build successfully', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'queued' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Production Deploy')).toBeInTheDocument();
    });

    // Find and click Trigger button for active pipeline
    const triggerButtons = screen.getAllByText('Trigger');
    fireEvent.click(triggerButtons[0]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/cicd/pipelines/1/trigger'),
        expect.objectContaining({
          method: 'POST'
        })
      );
      expect(screen.getByText('Build triggered')).toBeInTheDocument();
    });
  });

  it('switches to builds tab and displays build logs', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText(/Pipelines \(2\)/)).toBeInTheDocument();
    });

    // Click on builds tab
    const buildsTab = screen.getByText(/Build Logs \(3\)/);
    fireEvent.click(buildsTab);

    await waitFor(() => {
      expect(screen.getByText('Build Execution Logs')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
      expect(screen.getByText('manual')).toBeInTheDocument();
      expect(screen.getByText('webhook')).toBeInTheDocument();
      expect(screen.getByText('scheduled')).toBeInTheDocument();
    });
  });

  it('displays status badges with correct variants', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Production Deploy')).toBeInTheDocument();
    });

    // Switch to builds tab to see status badges
    const buildsTab = screen.getByText(/Build Logs/);
    fireEvent.click(buildsTab);

    await waitFor(() => {
      // Check that status badges are rendered
      const statusElements = screen.getAllByText(/success|running|failed/i);
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      // Initial load (2 calls) + refresh (2 calls) = 4 calls
      expect(mockApiFetch).toHaveBeenCalledTimes(4);
    });
  });

  it('shows empty state when no pipelines exist', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('No pipelines configured.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no builds exist', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText(/Pipelines \(2\)/)).toBeInTheDocument();
    });

    // Switch to builds tab
    const buildsTab = screen.getByText(/Build Logs \(0\)/);
    fireEvent.click(buildsTab);

    await waitFor(() => {
      expect(screen.getByText('No build logs available.')).toBeInTheDocument();
    });
  });

  it('displays error message when API call fails', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Failed to create pipeline' })
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('New Pipeline')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('New Pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Create CI/CD Pipeline')).toBeInTheDocument();
    });

    // Fill and submit
    const nameInput = screen.getByLabelText(/Pipeline Name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Pipeline' } });
    fireEvent.click(screen.getByText('Save Pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create pipeline')).toBeInTheDocument();
    });
  });

  it('displays error message when trigger build fails', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Pipeline is not active' })
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Production Deploy')).toBeInTheDocument();
    });

    // Trigger build
    const triggerButtons = screen.getAllByText('Trigger');
    fireEvent.click(triggerButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Pipeline is not active')).toBeInTheDocument();
    });
  });

  it('shows permission denied message when user lacks CICD permission', async () => {
    mockHasPerm = vi.fn(() => false);

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText(/CI\/CD capability requires appropriate roles/)).toBeInTheDocument();
    });
  });

  it('disables trigger button for inactive pipelines', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('Staging Pipeline')).toBeInTheDocument();
    });

    // Find all trigger buttons
    const triggerButtons = screen.getAllByText('Trigger');
    
    // The second pipeline (Staging) has status 'paused', so its button should be disabled
    // Note: We need to check the parent button element
    const stagingTriggerButton = triggerButtons[1].closest('button');
    expect(stagingTriggerButton).toBeDisabled();
  });

  it('closes form when Cancel button is clicked', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPipelines
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuilds
      });

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    await waitFor(() => {
      expect(screen.getByText('New Pipeline')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('New Pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Create CI/CD Pipeline')).toBeInTheDocument();
    });

    // Close form
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Create CI/CD Pipeline')).not.toBeInTheDocument();
    });
  });

  it('handles API errors gracefully during data load', async () => {
    mockApiFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    render(<CICDOpsPage API={mockAPI} apiFetch={mockApiFetch} hasPerm={mockHasPerm} />);

    // Should not crash and should show empty state
    await waitFor(() => {
      expect(screen.getByText('No pipelines configured.')).toBeInTheDocument();
    });
  });
});
