/**
 * Example usage of MCPClientService
 * 
 * This file demonstrates how to use the MCPClientService to interact with
 * the Stitch MCP server for UI generation.
 */

import MCPClientService from './MCPClientService.js';

// Example 1: Basic connection and project creation
async function example1_BasicConnection() {
  const mcpClient = new MCPClientService();

  try {
    // Connect to Stitch MCP server
    await mcpClient.connect('http://localhost:3000');
    console.log('Connected:', mcpClient.isConnected());

    // Create a new project
    const project = await mcpClient.createProject({
      title: 'PatchMaster UI Extensions',
    });
    console.log('Created project:', project);

    // List all projects
    const projects = await mcpClient.listProjects();
    console.log('All projects:', projects);

    // Disconnect
    await mcpClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 2: Generate a screen from a prompt
async function example2_GenerateScreen() {
  const mcpClient = new MCPClientService();

  try {
    await mcpClient.connect('http://localhost:3000');

    // Create a project first
    const project = await mcpClient.createProject({
      title: 'Dashboard Redesign',
    });

    // Extract project ID from the resource name (e.g., 'projects/123' -> '123')
    const projectId = project.name.split('/')[1];

    // Generate a screen from a text prompt
    const screen = await mcpClient.generateScreen({
      projectId: projectId,
      prompt: 'Create a modern dashboard page with stats cards showing system health, recent patches, and active hosts. Use a dark blue theme with cyan accents.',
      deviceType: 'DESKTOP',
    });

    console.log('Generated screen:', screen);

    // Fetch the generated code
    const screenId = screen.name.split('/')[3]; // Extract from 'projects/123/screens/abc'
    const code = await mcpClient.fetchScreenCode({
      projectId: projectId,
      screenId: screenId,
    });

    console.log('Generated code:', code);

    await mcpClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 3: Connection status monitoring
async function example3_ConnectionMonitoring() {
  const mcpClient = new MCPClientService();

  // Add connection listener
  mcpClient.addConnectionListener((status, error) => {
    console.log('Connection status changed:', status);
    if (error) {
      console.error('Connection error:', error);
    }
  });

  try {
    await mcpClient.connect('http://localhost:3000');
    
    // Do some work...
    const projects = await mcpClient.listProjects();
    console.log('Projects:', projects);

    await mcpClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 4: Design system operations
async function example4_DesignSystem() {
  const mcpClient = new MCPClientService();

  try {
    await mcpClient.connect('http://localhost:3000');

    // Create a project
    const project = await mcpClient.createProject({
      title: 'Themed Pages',
    });
    const projectId = project.name.split('/')[1];

    // Create a design system
    const designSystem = await mcpClient.createDesignSystem({
      projectId: projectId,
      designSystem: {
        displayName: 'PatchMaster Dark Theme',
        theme: {
          colorMode: 'DARK',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: '#7bd0ff', // Cyan accent
        },
      },
    });

    console.log('Created design system:', designSystem);

    // List design systems
    const designSystems = await mcpClient.listDesignSystems({
      projectId: projectId,
    });
    console.log('Design systems:', designSystems);

    await mcpClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 5: Edit and generate variants
async function example5_EditAndVariants() {
  const mcpClient = new MCPClientService();

  try {
    await mcpClient.connect('http://localhost:3000');

    // Assume we have a project and screen already
    const projectId = '123'; // Replace with actual project ID
    const screenId = 'abc'; // Replace with actual screen ID

    // Edit an existing screen
    const editedScreens = await mcpClient.editScreens({
      projectId: projectId,
      selectedScreenIds: [screenId],
      prompt: 'Make the header more prominent and add a search bar',
      deviceType: 'DESKTOP',
    });

    console.log('Edited screens:', editedScreens);

    // Generate design variants
    const variants = await mcpClient.generateVariants({
      projectId: projectId,
      selectedScreenIds: [screenId],
      prompt: 'Create variations with different color schemes',
      variantOptions: {
        variantCount: 3,
        creativeRange: 'EXPLORE',
        aspects: ['COLOR_SCHEME'],
      },
    });

    console.log('Generated variants:', variants);

    await mcpClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export examples for testing
export {
  example1_BasicConnection,
  example2_GenerateScreen,
  example3_ConnectionMonitoring,
  example4_DesignSystem,
  example5_EditAndVariants,
};
