/**
 * Example usage of ProjectList component
 * 
 * This file demonstrates how to integrate the ProjectList component
 * into a Stitch UI Builder page.
 */

import React, { useState, useEffect } from 'react';
import { CHPage, CHHeader } from '../CH.jsx';
import MCPClientService from '../services/MCPClientService.js';
import ProjectList from './ProjectList.jsx';

export default function ProjectListExample() {
  const [mcpClient] = useState(() => new MCPClientService());
  const [selectedProject, setSelectedProject] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Initialize MCP connection on mount
  useEffect(() => {
    const initConnection = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);
        
        // Connect to Stitch MCP server
        await mcpClient.connect('http://localhost:3000');
        
        console.log('Connected to Stitch MCP server');
      } catch (error) {
        console.error('Failed to connect:', error);
        setConnectionError(error.message);
      } finally {
        setIsConnecting(false);
      }
    };

    initConnection();

    // Cleanup on unmount
    return () => {
      if (mcpClient.isConnected()) {
        mcpClient.disconnect();
      }
    };
  }, []);

  // Handle project selection
  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    console.log('Selected project:', project);
    
    // You can now use the selected project to:
    // - Load screens for this project
    // - Generate new screens in this project
    // - Apply design systems to this project
  };

  return (
    <CHPage>
      <CHHeader
        kicker="Stitch UI Builder"
        title="Project Management"
        subtitle="Select a project to view and manage screens"
      />

      {/* Display connection error if any */}
      {connectionError && (
        <div 
          className="p-4 rounded-lg mb-4" 
          style={{ 
            background: 'rgba(239,68,68,0.1)', 
            border: '1px solid #ef4444' 
          }}
        >
          <p className="text-sm" style={{ color: '#ef4444' }}>
            Connection Error: {connectionError}
          </p>
        </div>
      )}

      {/* Project List Component */}
      <ProjectList
        mcpClient={mcpClient}
        selectedProject={selectedProject}
        onProjectSelect={handleProjectSelect}
        loading={isConnecting}
        error={connectionError}
      />

      {/* Display selected project info */}
      {selectedProject && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#dee5ff' }}>
            Selected Project Details
          </h2>
          <pre 
            className="p-4 rounded-lg overflow-auto"
            style={{ 
              background: 'rgba(5,24,60,0.5)', 
              color: '#91aaeb',
              fontSize: '12px'
            }}
          >
            {JSON.stringify(selectedProject, null, 2)}
          </pre>
        </div>
      )}
    </CHPage>
  );
}
