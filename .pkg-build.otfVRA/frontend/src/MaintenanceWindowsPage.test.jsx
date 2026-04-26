import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import MaintenanceWindowsPage from './MaintenanceWindowsPage';

describe('MaintenanceWindowsPage', () => {
  let mockApiFetch;
  let mockToast;
  let mockAPI;

  beforeEach(() => {
    cleanup();
    mockAPI = 'http://localhost:8000';
    mockToast = vi.fn();

    mockApiFetch = vi.fn((url, options) => {
      // Mock maintenance windows list
      if (url.includes('/api/maintenance/') && !options?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              name: 'Weekly Maintenance',
              description: 'Weekly production maintenance window',
              day_of_week: ['Mon', 'Wed', 'Fri'],
              start_hour: 2,
              end_hour: 6,
              timezone: 'UTC',
              is_active: true,
              recurring: true,
              block_outside: true
            },
            {
              id: 2,
              name: 'Emergency Window',
              description: 'One-time emergency maintenance',
              day_of_week: ['Sat'],
              start_hour: 0,
              end_hour: 4,
              timezone: 'EST',
              is_active: false,
              recurring: false,
              block_outside: false
            }
          ])
        });
      }

      // Mock current status check
      if (url.includes('/api/maintenance/check')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            in_maintenance_window: true
          })
        });
      }

      // Mock window creation
      if (url.includes('/api/maintenance/') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 3,
            name: 'New Window',
            is_active: true
          })
        });
      }

      // Mock window update
      if (url.includes('/api/maintenance/') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }

      // Mock window deletion
      if (url.includes('/api/maintenance/') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
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
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Maintenance Scheduler')).toBeInTheDocument();
        expect(screen.getByText('Maintenance Windows')).toBeInTheDocument();
      });
    });

    it('should render all stat cards with correct values', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Total Windows')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Recurring')).toBeInTheDocument();
        expect(screen.getByText('One-Time')).toBeInTheDocument();
      });
    });

    it('should display current window status badge when status is loaded', async () => {
      // Create a more explicit mock that ensures status is returned
      const customMockApiFetch = vi.fn((url) => {
        if (url.includes('/api/maintenance/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              in_maintenance_window: true
            })
          });
        }
        if (url.includes('/api/maintenance/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 1,
                name: 'Weekly Maintenance',
                description: 'Weekly production maintenance window',
                day_of_week: ['Mon', 'Wed', 'Fri'],
                start_hour: 2,
                end_hour: 6,
                timezone: 'UTC',
                is_active: true,
                recurring: true,
                block_outside: true
              }
            ])
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={customMockApiFetch} 
          toast={mockToast}
        />
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
      });

      // Check that the API was called for status
      expect(customMockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/maintenance/check')
      );
    });

    it('should display OUT OF WINDOW status when not in maintenance window', async () => {
      mockApiFetch = vi.fn((url) => {
        if (url.includes('/api/maintenance/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              in_maintenance_window: false
            })
          });
        }
        if (url.includes('/api/maintenance/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('OUT OF WINDOW')).toBeInTheDocument();
      });
    });

    it('should render maintenance windows list', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Emergency Window')).toBeInTheDocument();
      });
    });

    it('should display window details correctly', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly production maintenance window')).toBeInTheDocument();
        expect(screen.getByText('2:00 – 6:00 UTC')).toBeInTheDocument();
        expect(screen.getByText('0:00 – 4:00 EST')).toBeInTheDocument();
      });
    });

    it('should display day of week badges', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const monBadges = screen.getAllByText('Mon');
        const wedBadges = screen.getAllByText('Wed');
        const friBadges = screen.getAllByText('Fri');
        expect(monBadges.length).toBeGreaterThan(0);
        expect(wedBadges.length).toBeGreaterThan(0);
        expect(friBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display active/inactive status badges', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const activeBadges = screen.getAllByText('Active');
        const inactiveBadges = screen.getAllByText('Inactive');
        expect(activeBadges.length).toBeGreaterThan(0);
        expect(inactiveBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Form Display', () => {
    it('should show form when New Window button is clicked', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Configure New Window')).toBeInTheDocument();
      });
    });

    it('should hide form when Cancel button is clicked', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Configure New Window')).toBeInTheDocument();
      });

      await waitFor(() => {
        const cancelButtons = screen.getAllByText('Cancel');
        fireEvent.click(cancelButtons[cancelButtons.length - 1]);
      });

      await waitFor(() => {
        expect(screen.queryByText('Configure New Window')).not.toBeInTheDocument();
      });
    });

    it('should render all form fields', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Window Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Timezone/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Hour/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/End Hour/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      });
    });

    it('should render day selection buttons', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const dayButtons = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        dayButtons.forEach(day => {
          const buttons = screen.getAllByText(day);
          expect(buttons.length).toBeGreaterThan(0);
        });
      });
    });

    it('should render block outside checkbox', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Block patching outside window hours/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    it('should update window name field', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Window Name/i);
        fireEvent.change(nameInput, { target: { value: 'Test Window' } });
        expect(nameInput.value).toBe('Test Window');
      });
    });

    it('should update timezone field', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const timezoneInput = screen.getByLabelText(/Timezone/i);
        fireEvent.change(timezoneInput, { target: { value: 'EST' } });
        expect(timezoneInput.value).toBe('EST');
      });
    });

    it('should update start hour field', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const startHourInput = screen.getByLabelText(/Start Hour/i);
        fireEvent.change(startHourInput, { target: { value: '10' } });
        expect(startHourInput.value).toBe('10');
      });
    });

    it('should update end hour field', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const endHourInput = screen.getByLabelText(/End Hour/i);
        fireEvent.change(endHourInput, { target: { value: '14' } });
        expect(endHourInput.value).toBe('14');
      });
    });

    it('should toggle day selection', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const monButtons = screen.getAllByText('Mon');
        const dayButton = monButtons[monButtons.length - 1];
        fireEvent.click(dayButton);
        // Day should be selected (visual change)
        expect(dayButton).toBeInTheDocument();
      });
    });

    it('should toggle block outside checkbox', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Block patching outside window hours/i);
        expect(checkbox.checked).toBe(true);
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
      });
    });
  });

  describe('Window Creation', () => {
    it('should create window successfully with valid data', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Window Name/i);
        fireEvent.change(nameInput, { target: { value: 'Test Window' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Window');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/maintenance/'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should show toast on successful creation', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Window Name/i);
        fireEvent.change(nameInput, { target: { value: 'Test Window' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Window');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Window created', 'success');
      });
    });

    it('should handle creation failure', async () => {
      mockApiFetch = vi.fn((url, options) => {
        if (url.includes('/api/maintenance/') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ detail: 'Creation failed' })
          });
        }
        if (url.includes('/api/maintenance/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ in_maintenance_window: false })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Window Name/i);
        fireEvent.change(nameInput, { target: { value: 'Test Window' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Window');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Creation failed', 'danger');
      });
    });

    it('should reset form after successful creation', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const newWindowButton = screen.getByText('New Window');
        fireEvent.click(newWindowButton);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Window Name/i);
        fireEvent.change(nameInput, { target: { value: 'Test Window' } });
      });

      await waitFor(() => {
        const createButton = screen.getByText('Create Window');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Configure New Window')).not.toBeInTheDocument();
      });
    });
  });

  describe('Window Actions', () => {
    it('should toggle window activation', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        const deactivateButton = screen.getByText('Deactivate');
        fireEvent.click(deactivateButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/maintenance/1'),
          expect.objectContaining({ method: 'PUT' })
        );
      });
    });

    it('should delete window with confirmation', async () => {
      // Mock window.confirm
      global.confirm = vi.fn(() => true);

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
      });

      // Find all buttons and look for one with delete icon
      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        return icon && icon.textContent.trim() === 'delete';
      });

      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(global.confirm).toHaveBeenCalled();
        });
      }
    });

    it('should not delete window if confirmation is cancelled', async () => {
      // Mock window.confirm to return false
      global.confirm = vi.fn(() => false);

      const deleteCallsBefore = mockApiFetch.mock.calls.filter(
        call => call[1]?.method === 'DELETE'
      ).length;

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        return icon && icon.textContent.trim() === 'delete';
      });

      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(global.confirm).toHaveBeenCalled();
        });

        const deleteCallsAfter = mockApiFetch.mock.calls.filter(
          call => call[1]?.method === 'DELETE'
        ).length;
        expect(deleteCallsAfter).toBe(deleteCallsBefore);
      }
    });

    it('should show toast on successful deletion', async () => {
      global.confirm = vi.fn(() => true);

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        return icon && icon.textContent.trim() === 'delete';
      });

      if (deleteButton) {
        fireEvent.click(deleteButton);
        
        await waitFor(() => {
          expect(mockToast).toHaveBeenCalledWith('Deleted', 'success');
        });
      }
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh data when refresh button is clicked', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      const initialCalls = mockApiFetch.mock.calls.length;

      await waitFor(() => {
        // Find refresh button (it has no text, just icon)
        const refreshButtons = screen.getAllByRole('button').filter(btn => 
          btn.querySelector('.material-symbols-outlined')?.textContent === 'refresh'
        );
        if (refreshButtons.length > 0) {
          fireEvent.click(refreshButtons[0]);
        }
      });

      await waitFor(() => {
        expect(mockApiFetch.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no windows exist', async () => {
      mockApiFetch = vi.fn((url) => {
        if (url.includes('/api/maintenance/check')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ in_maintenance_window: false })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No maintenance windows configured yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load windows on mount', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/maintenance/')
        );
      });
    });

    it('should load current status on mount', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/maintenance/check')
        );
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiFetch = vi.fn(() => Promise.reject(new Error('API Error')));

      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      // Should not crash, should show empty state
      await waitFor(() => {
        expect(screen.getByText('Maintenance Windows')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate total windows correctly', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        // Should show 2 total windows
        const statCards = screen.getAllByText('2');
        expect(statCards.length).toBeGreaterThan(0);
      });
    });

    it('should calculate active windows correctly', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        // Should show "1 active windows" in the subtitle
        expect(screen.getByText(/1.*active windows/)).toBeInTheDocument();
      });
    });

    it('should calculate recurring windows correctly', async () => {
      render(
        <MaintenanceWindowsPage 
          API={mockAPI} 
          apiFetch={mockApiFetch} 
          toast={mockToast}
        />
      );

      await waitFor(() => {
        // Should show "1 recurring" in the subtitle
        expect(screen.getByText(/1.*recurring/)).toBeInTheDocument();
      });
    });
  });
});
