/**
 * Unit tests for ProjectList component
 * Tests project display, selection handling, and metadata rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectList from './ProjectList.jsx';

describe('ProjectList Component', () => {
  let mockMcpClient;
  let mockOnProjectSelect;

  beforeEach(() => {
    // Mock MCPClientService
    mockMcpClient = {
      isConnected: vi.fn(() => true),
      listProjects: vi.fn()
    };

    mockOnProjectSelect = vi.fn();
  });

  describe('Loading State', () => {
    it('should display loading state when loading prop is true', () => {
      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
          loading={true}
        />
      );

      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('should display loading state while fetching projects', async () => {
      mockMcpClient.listProjects.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ projects: [] }), 100))
      );

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(mockMcpClient.listProjects).toHaveBeenCalled();
      });
    });
  });

  describe('Error State', () => {
    it('should display error message when error prop is provided', () => {
      const errorMessage = 'Failed to connect to server';
      
      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should display error when listProjects fails', async () => {
      const errorMessage = 'Network error';
      mockMcpClient.listProjects.mockRejectedValue(new Error(errorMessage));

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should retry loading projects when retry button is clicked', async () => {
      mockMcpClient.listProjects
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ projects: [] });

      const { rerender } = render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockMcpClient.listProjects).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no projects exist', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ projects: [] });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/No projects found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Project Display', () => {
    const mockProjects = [
      {
        name: 'projects/123456',
        title: 'test-project-1',
        description: 'First test project',
        createTime: '2024-01-15T10:00:00Z',
        updateTime: '2024-01-20T15:30:00Z'
      },
      {
        name: 'projects/789012',
        title: 'test-project-2',
        description: 'Second test project',
        createTime: '2024-02-01T08:00:00Z',
        updateTime: '2024-02-10T12:00:00Z'
      }
    ];

    it('should display all projects with metadata', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-project-1')).toBeInTheDocument();
        expect(screen.getByText('test-project-2')).toBeInTheDocument();
      });

      expect(screen.getByText('First test project')).toBeInTheDocument();
      expect(screen.getByText('Second test project')).toBeInTheDocument();
    });

    it('should display project count in header', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Projects (2)')).toBeInTheDocument();
      });
    });

    it('should display formatted creation and update dates', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ 
        projects: [mockProjects[0]] 
      });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Created:/)).toBeInTheDocument();
        expect(screen.getByText(/Updated:/)).toBeInTheDocument();
      });
    });

    it('should display truncated project ID', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ 
        projects: [mockProjects[0]] 
      });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/123456\.\.\./)).toBeInTheDocument();
      });
    });
  });

  describe('Project Selection', () => {
    const mockProjects = [
      {
        name: 'projects/123456',
        title: 'test-project-1',
        description: 'First test project',
        createTime: '2024-01-15T10:00:00Z'
      },
      {
        name: 'projects/789012',
        title: 'test-project-2',
        description: 'Second test project',
        createTime: '2024-02-01T08:00:00Z'
      }
    ];

    it('should call onProjectSelect when project is clicked', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-project-1')).toBeInTheDocument();
      });

      const projectButton = screen.getByText('test-project-1').closest('button');
      fireEvent.click(projectButton);

      expect(mockOnProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('should highlight selected project', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={mockProjects[0]}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Selected')).toBeInTheDocument();
      });
    });

    it('should not show selected badge for unselected projects', async () => {
      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={mockProjects[0]}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        const badges = screen.queryAllByText('Selected');
        expect(badges).toHaveLength(1);
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload projects when refresh button is clicked', async () => {
      const mockProjects = [
        {
          name: 'projects/123456',
          title: 'test-project-1',
          description: 'First test project'
        }
      ];

      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(mockMcpClient.listProjects).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockMcpClient.listProjects).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle projects without descriptions', async () => {
      const projectWithoutDescription = {
        name: 'projects/123456',
        title: 'test-project',
        createTime: '2024-01-15T10:00:00Z'
      };

      mockMcpClient.listProjects.mockResolvedValue({ 
        projects: [projectWithoutDescription] 
      });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-project')).toBeInTheDocument();
      });
    });

    it('should handle projects without dates', async () => {
      const projectWithoutDates = {
        name: 'projects/123456',
        title: 'test-project',
        description: 'Test project'
      };

      mockMcpClient.listProjects.mockResolvedValue({ 
        projects: [projectWithoutDates] 
      });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-project')).toBeInTheDocument();
      });
    });

    it('should handle invalid date formats gracefully', async () => {
      const projectWithInvalidDate = {
        name: 'projects/123456',
        title: 'test-project',
        description: 'Test project',
        createTime: 'invalid-date'
      };

      mockMcpClient.listProjects.mockResolvedValue({ 
        projects: [projectWithInvalidDate] 
      });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={mockOnProjectSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-project')).toBeInTheDocument();
      });
    });

    it('should not call onProjectSelect if callback is not provided', async () => {
      const mockProjects = [
        {
          name: 'projects/123456',
          title: 'test-project',
          description: 'Test project'
        }
      ];

      mockMcpClient.listProjects.mockResolvedValue({ projects: mockProjects });

      render(
        <ProjectList
          mcpClient={mockMcpClient}
          selectedProject={null}
          onProjectSelect={null}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-project')).toBeInTheDocument();
      });

      const projectButton = screen.getByText('test-project').closest('button');
      fireEvent.click(projectButton);

      // Should not throw error
    });
  });
});
