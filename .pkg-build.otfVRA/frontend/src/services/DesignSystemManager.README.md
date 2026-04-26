# DesignSystemManager

## Overview

The `DesignSystemManager` is a service that manages design system application to Stitch-generated screens and projects. It provides functionality to:

1. Apply design systems to all screens in a project (Requirement 12.5)
2. Apply design systems to specific screens
3. Inject design system color tokens into generated code (Requirement 12.6)
4. Transform code with full design system integration
5. Validate design system configurations

## Requirements

This implementation satisfies the following requirements:

- **Requirement 12.5**: "WHEN a design system is applied to a project, THE MCP_Client SHALL apply it to all screens in that project"
- **Requirement 12.6**: "WHEN a design system is applied to a screen, THE generated code SHALL use the design system's color tokens"

## Installation

The `DesignSystemManager` depends on:
- `MCPClientService` - For communicating with the Stitch MCP server
- `CHDesignSystemAdapter` - For Command Horizon design system transformations

```javascript
import MCPClientService from './MCPClientService.js';
import { DesignSystemManager } from './DesignSystemManager.js';
```

## Usage

### Basic Setup

```javascript
// Create MCP client and connect
const mcpClient = new MCPClientService();
await mcpClient.connect('http://localhost:3000');

// Create design system manager
const manager = new DesignSystemManager(mcpClient);
```

### Apply Design System to Entire Project

```javascript
// Apply design system to all screens in a project
const result = await manager.applyDesignSystemToProject(
  '4044680601076201931', // projectId
  '15996705518239280238'  // designSystemId
);

console.log(`Applied to ${result.appliedCount} screens`);
```

### Apply Design System to Specific Screens

```javascript
const screenInstances = [
  {
    id: 'screen-instance-1',
    sourceScreen: 'projects/123/screens/abc'
  },
  {
    id: 'screen-instance-2',
    sourceScreen: 'projects/123/screens/def'
  }
];

const result = await manager.applyDesignSystemToScreens(
  '4044680601076201931',
  '15996705518239280238',
  screenInstances
);
```

### Inject Design System Tokens into Code

```javascript
const code = `
  function MyComponent() {
    return <div style={{ backgroundColor: '#ff0000' }}>Content</div>;
  }
`;

const designSystem = {
  theme: {
    customColor: '#ff0000',
    overrideSecondaryColor: '#00ff00'
  }
};

const transformed = manager.injectDesignSystemTokens(code, designSystem);
// Result: backgroundColor: 'var(--ds-primary)'
```

### Full Code Transformation

```javascript
const code = `
  import React from 'react';
  
  function MyPage() {
    return (
      <div style={{ backgroundColor: '#060e20' }}>
        <button>Click me</button>
      </div>
    );
  }
`;

const transformed = manager.transformCodeWithDesignSystem(code);
// Result includes:
// - CH.jsx imports
// - CHBtn instead of button
// - CH.bg instead of #060e20
// - CHPage wrapper
```

### Validate Design System

```javascript
const designSystem = {
  displayName: 'My Design System',
  theme: {
    colorMode: 'LIGHT',
    headlineFont: 'INTER',
    bodyFont: 'INTER',
    roundness: 'ROUND_EIGHT',
    customColor: '#ff0000'
  }
};

const validation = manager.validateDesignSystem(designSystem);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## API Reference

### Constructor

```javascript
new DesignSystemManager(mcpClient)
```

**Parameters:**
- `mcpClient` (MCPClientService) - Connected MCP client instance

### Methods

#### `applyDesignSystemToProject(projectId, designSystemId)`

Apply a design system to all screens in a project.

**Parameters:**
- `projectId` (string) - Project ID without 'projects/' prefix
- `designSystemId` (string) - Design system asset ID without 'assets/' prefix

**Returns:** `Promise<Object>`
```javascript
{
  success: boolean,
  appliedCount: number,
  message: string,
  screens: Array<{id: string, sourceScreen: string}>,
  result: Object
}
```

**Throws:** Error if MCP client is not connected or if parameters are invalid

---

#### `applyDesignSystemToScreens(projectId, designSystemId, screenInstances)`

Apply a design system to specific screens.

**Parameters:**
- `projectId` (string) - Project ID without 'projects/' prefix
- `designSystemId` (string) - Design system asset ID without 'assets/' prefix
- `screenInstances` (Array) - Array of screen instances with `id` and `sourceScreen`

**Returns:** `Promise<Object>` - Same structure as `applyDesignSystemToProject`

---

#### `injectDesignSystemTokens(code, designSystem)`

Inject design system color tokens into generated code.

**Parameters:**
- `code` (string) - Generated JSX/TSX code
- `designSystem` (Object) - Design system configuration with theme

**Returns:** `string` - Code with design system tokens injected

**Example:**
```javascript
// Input: backgroundColor: '#ff0000'
// Output: backgroundColor: 'var(--ds-primary)'
```

---

#### `transformCodeWithDesignSystem(code, designSystem)`

Apply full design system transformation to code.

**Parameters:**
- `code` (string) - Generated JSX/TSX code
- `designSystem` (Object, optional) - Design system configuration

**Returns:** `string` - Fully transformed code with:
- CH.jsx imports
- Component replacements (button → CHBtn)
- Color token injection
- CHPage wrapper

---

#### `validateDesignSystem(designSystem)`

Validate a design system configuration.

**Parameters:**
- `designSystem` (Object) - Design system to validate

**Returns:** `Object`
```javascript
{
  valid: boolean,
  errors: Array<string>
}
```

**Validation Rules:**
- Display name is required
- Theme is required
- Color mode, fonts, roundness, and custom color are required
- All color values must be valid CSS colors (hex, rgb, rgba, hsl, hsla, or named)

## Design System Structure

```javascript
{
  displayName: 'My Design System',
  theme: {
    // Required fields
    colorMode: 'LIGHT' | 'DARK',
    headlineFont: 'INTER' | 'MANROPE' | ...,
    bodyFont: 'INTER' | 'MANROPE' | ...,
    roundness: 'ROUND_FOUR' | 'ROUND_EIGHT' | 'ROUND_TWELVE' | 'ROUND_FULL',
    customColor: '#ff0000', // Primary color
    
    // Optional color overrides
    overridePrimaryColor: '#ff0000',
    overrideSecondaryColor: '#00ff00',
    overrideTertiaryColor: '#0000ff',
    overrideNeutralColor: '#cccccc'
  }
}
```

## Color Token Mapping

When a design system is applied, color values are replaced with CSS custom properties:

| Design System Field | CSS Variable |
|---------------------|--------------|
| `customColor` | `var(--ds-primary)` |
| `overridePrimaryColor` | `var(--ds-primaryOverride)` |
| `overrideSecondaryColor` | `var(--ds-secondary)` |
| `overrideTertiaryColor` | `var(--ds-tertiary)` |
| `overrideNeutralColor` | `var(--ds-neutral)` |

## Error Handling

The manager throws descriptive errors for common issues:

```javascript
try {
  await manager.applyDesignSystemToProject(projectId, designSystemId);
} catch (error) {
  if (error.message.includes('not connected')) {
    // MCP client is not connected
  } else if (error.message.includes('required')) {
    // Missing required parameters
  } else {
    // Other errors (network, server, etc.)
  }
}
```

## Integration with React Components

```javascript
function DesignSystemPanel() {
  const [mcpClient] = useState(() => new MCPClientService());
  const [manager] = useState(() => new DesignSystemManager(mcpClient));
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    try {
      const result = await manager.applyDesignSystemToProject(
        currentProject.id,
        selectedDesignSystem.id
      );
      toast.success(`Applied to ${result.appliedCount} screens`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleApply} disabled={loading}>
      {loading ? 'Applying...' : 'Apply Design System'}
    </button>
  );
}
```

## Testing

The implementation includes comprehensive unit tests covering:

- Design system application to projects
- Design system application to specific screens
- Color token injection
- Full code transformation
- Design system validation
- Error handling
- Edge cases (empty code, invalid colors, etc.)

Run tests:
```bash
npm test -- DesignSystemManager.test.js --run
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol communication
- `CHDesignSystemAdapter` - Command Horizon design system transformations

## See Also

- [MCPClientService](./MCPClientService.js) - MCP server communication
- [CHDesignSystemAdapter](./CHDesignSystemAdapter.js) - CH design system transformations
- [DesignSystemManager.example.js](./DesignSystemManager.example.js) - Usage examples
