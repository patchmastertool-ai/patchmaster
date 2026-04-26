/**
 * ProjectList Component
 * 
 * Displays a list of Stitch projects with metadata and selection handling.
 * 
 * Requirements: 3.3, 3.4
 */

import React, { useState, useEffect } from 'react';
import { CH, CHCard, CHLabel, CHBadge, CHEmpty, CHLoading } from '../CH.jsx';

/**
 * ProjectList component displays all available Stitch projects
 * and allows users to select a project.
 * 
 * @param {object} props - Component props
 * @param {object} props.mcpClient - MCPClientService instance
 * @param {object} props.selectedProject - Currently selected project
 * @param {function} props.onProjectSelect - Callback when project is selected
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message if any
 */
export default function ProjectList({ 
  mcpClient, 
  selectedProject, 
  onProjectSelect,
  loading = false,
  error = null
}) {
  const [projects, setProjects] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Load projects when component mounts or mcpClient changes
  useEffect(() => {
    // Only load if connected and no error prop is provided
    if (mcpClient && mcpClient.isConnected() && !error) {
      loadProjects();
    }
  }, [mcpClient]);

  /**
   * Load projects from MCP server
   */
  const loadProjects = async () => {
    setLocalLoading(true);
    setLocalError(null);

    try {
      const result = await mcpClient.listProjects();
      setProjects(result.projects || []);
    } catch (err) {
      console.error('ProjectList: Failed to load projects:', err);
      setLocalError(err.message || 'Failed to load projects');
    } finally {
      setLocalLoading(false);
    }
  };

  /**
   * Handle project selection
   */
  const handleProjectClick = (project) => {
    if (onProjectSelect) {
      onProjectSelect(project);
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Extract project ID from resource name
   */
  const getProjectId = (resourceName) => {
    if (!resourceName) return null;
    const parts = resourceName.split('/');
    return parts[parts.length - 1];
  };

  // Show loading state
  const isLoading = loading || localLoading;
  if (isLoading) {
    return (
      <CHCard>
        <CHLabel>Projects</CHLabel>
        <div className="mt-4">
          <CHLoading />
        </div>
      </CHCard>
    );
  }

  // Show error state
  const displayError = error || localError;
  if (displayError) {
    return (
      <CHCard>
        <CHLabel>Projects</CHLabel>
        <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid ${CH.red}` }}>
          <p className="text-sm" style={{ color: CH.red }}>
            {displayError}
          </p>
          <button
            onClick={loadProjects}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: CH.red, color: '#fff' }}
          >
            Retry
          </button>
        </div>
      </CHCard>
    );
  }

  // Show empty state
  if (!projects || projects.length === 0) {
    return (
      <CHCard>
        <CHLabel>Projects</CHLabel>
        <div className="mt-4">
          <CHEmpty 
            title="No projects found" 
            description="Create a new project to get started." 
          />
        </div>
      </CHCard>
    );
  }

  // Render project list
  return (
    <CHCard>
      <div className="flex items-center justify-between mb-4">
        <CHLabel>Projects ({projects.length})</CHLabel>
        <button
          onClick={loadProjects}
          className="text-xs px-3 py-1 rounded-lg transition-colors"
          style={{ 
            background: 'rgba(123,208,255,0.1)', 
            color: CH.accent,
            border: `1px solid ${CH.accent}`
          }}
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {projects.map((project) => {
          const projectId = getProjectId(project.name);
          const isSelected = selectedProject && getProjectId(selectedProject.name) === projectId;
          
          return (
            <button
              key={project.name}
              onClick={() => handleProjectClick(project)}
              className="w-full text-left p-4 rounded-xl transition-all"
              style={{
                background: isSelected ? 'rgba(123,208,255,0.1)' : 'rgba(5,24,60,0.5)',
                border: `1px solid ${isSelected ? CH.accent : CH.border}`,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(5,24,60,0.8)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(5,24,60,0.5)';
                }
              }}
            >
              {/* Project Title */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold" style={{ color: CH.text }}>
                  {project.title || project.displayName || 'Untitled Project'}
                </h3>
                {isSelected && (
                  <CHBadge color={CH.accent}>Selected</CHBadge>
                )}
              </div>

              {/* Project Description */}
              {project.description && (
                <p className="text-sm mb-3" style={{ color: CH.textSub }}>
                  {project.description}
                </p>
              )}

              {/* Project Metadata */}
              <div className="flex items-center gap-4 text-xs" style={{ color: CH.textSub }}>
                {project.createTime && (
                  <div className="flex items-center gap-1">
                    <span>Created:</span>
                    <span style={{ color: CH.text }}>{formatDate(project.createTime)}</span>
                  </div>
                )}
                
                {project.updateTime && (
                  <div className="flex items-center gap-1">
                    <span>Updated:</span>
                    <span style={{ color: CH.text }}>{formatDate(project.updateTime)}</span>
                  </div>
                )}

                {projectId && (
                  <div className="flex items-center gap-1 ml-auto">
                    <span>ID:</span>
                    <code 
                      className="px-2 py-0.5 rounded text-[10px] font-mono"
                      style={{ background: 'rgba(123,208,255,0.1)', color: CH.accent }}
                    >
                      {projectId.substring(0, 8)}...
                    </code>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </CHCard>
  );
}
