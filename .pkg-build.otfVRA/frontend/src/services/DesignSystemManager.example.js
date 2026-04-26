/**
 * Usage examples for DesignSystemManager
 * 
 * This file demonstrates how to use the DesignSystemManager
 * to apply design systems to projects and screens.
 */

import MCPClientService from './MCPClientService.js';
import { DesignSystemManager } from './DesignSystemManager.js';

// Example 1: Apply design system to entire project
async function applyDesignSystemToProject() {
  const mcpClient = new MCPClientService();
  await mcpClient.connect('http://localhost:3000');

  const manager = new DesignSystemManager(mcpClient);

  try {
    // Apply design system to all screens in project
    const result = await manager.applyDesignSystemToProject(
      '4044680601076201931', // projectId
      '15996705518239280238'  // designSystemId
    );

    console.log(`Applied design system to ${result.appliedCount} screens`);
    console.log('Screens:', result.screens);
  } catch (error) {
    console.error('Failed to apply design system:', error);
  }
}

// Example 2: Apply design system to specific screens
async function applyDesignSystemToSpecificScreens() {
  const mcpClient = new MCPClientService();
  await mcpClient.connect('http://localhost:3000');

  const manager = new DesignSystemManager(mcpClient);

  const screenInstances = [
    {
      id: 'screen-instance-1',
      sourceScreen: 'projects/4044680601076201931/screens/98b50e2ddc9943efb387052637738f61'
    },
    {
      id: 'screen-instance-2',
      sourceScreen: 'projects/4044680601076201931/screens/abc123def456'
    }
  ];

  try {
    const result = await manager.applyDesignSystemToScreens(
      '4044680601076201931',
      '15996705518239280238',
      screenInstances
    );

    console.log(`Applied design system to ${result.appliedCount} screens`);
  } catch (error) {
    console.error('Failed to apply design system:', error);
  }
}

// Example 3: Inject design system tokens into code
function injectTokensIntoCode() {
  const mcpClient = new MCPClientService();
  const manager = new DesignSystemManager(mcpClient);

  const generatedCode = `
    import React from 'react';
    
    function MyComponent() {
      return (
        <div style={{ backgroundColor: '#ff0000', color: '#00ff00' }}>
          <h1>Hello World</h1>
        </div>
      );
    }
    
    export default MyComponent;
  `;

  const designSystem = {
    displayName: 'My Custom Design System',
    theme: {
      colorMode: 'LIGHT',
      headlineFont: 'INTER',
      bodyFont: 'INTER',
      roundness: 'ROUND_EIGHT',
      customColor: '#ff0000',
      overrideSecondaryColor: '#00ff00'
    }
  };

  // Inject design system tokens
  const transformedCode = manager.injectDesignSystemTokens(generatedCode, designSystem);
  
  console.log('Transformed code:');
  console.log(transformedCode);
  // Output will have 'var(--ds-primary)' and 'var(--ds-secondary)' instead of hex colors
}

// Example 4: Full transformation with design system
function fullTransformation() {
  const mcpClient = new MCPClientService();
  const manager = new DesignSystemManager(mcpClient);

  const generatedCode = `
    import React from 'react';
    
    function MyPage() {
      return (
        <div style={{ backgroundColor: '#060e20' }}>
          <h1>My Page</h1>
          <button onClick={handleClick}>Click me</button>
        </div>
      );
    }
    
    export default MyPage;
  `;

  // Apply full transformation (CH imports, component replacement, color tokens, CHPage wrapper)
  const transformedCode = manager.transformCodeWithDesignSystem(generatedCode);
  
  console.log('Fully transformed code:');
  console.log(transformedCode);
  // Output will have:
  // - CH.jsx imports
  // - CHBtn instead of button
  // - CH.bg instead of #060e20
  // - CHPage wrapper
}

// Example 5: Validate design system before creation
function validateDesignSystem() {
  const mcpClient = new MCPClientService();
  const manager = new DesignSystemManager(mcpClient);

  const designSystem = {
    displayName: 'My Design System',
    theme: {
      colorMode: 'LIGHT',
      headlineFont: 'INTER',
      bodyFont: 'INTER',
      roundness: 'ROUND_EIGHT',
      customColor: '#ff0000',
      overridePrimaryColor: 'invalid-color' // This will fail validation
    }
  };

  const validation = manager.validateDesignSystem(designSystem);
  
  if (!validation.valid) {
    console.error('Design system validation failed:');
    validation.errors.forEach(error => console.error(`- ${error}`));
  } else {
    console.log('Design system is valid!');
  }
}

// Example 6: React component usage
function ReactComponentExample() {
  const [mcpClient] = React.useState(() => new MCPClientService());
  const [manager] = React.useState(() => new DesignSystemManager(mcpClient));
  const [currentProject, setCurrentProject] = React.useState(null);
  const [designSystem, setDesignSystem] = React.useState(null);

  React.useEffect(() => {
    // Connect to MCP server
    mcpClient.connect('http://localhost:3000').then(() => {
      console.log('Connected to Stitch MCP server');
    });
  }, []);

  const handleApplyDesignSystem = async () => {
    if (!currentProject || !designSystem) {
      alert('Please select a project and design system');
      return;
    }

    try {
      const result = await manager.applyDesignSystemToProject(
        currentProject.id,
        designSystem.id
      );

      alert(`Design system applied to ${result.appliedCount} screens!`);
    } catch (error) {
      alert(`Failed to apply design system: ${error.message}`);
    }
  };

  return (
    <div>
      <h1>Design System Manager</h1>
      <button onClick={handleApplyDesignSystem}>
        Apply Design System to Project
      </button>
    </div>
  );
}

export {
  applyDesignSystemToProject,
  applyDesignSystemToSpecificScreens,
  injectTokensIntoCode,
  fullTransformation,
  validateDesignSystem,
  ReactComponentExample
};
