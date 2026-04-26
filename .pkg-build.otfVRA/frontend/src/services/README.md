# MCPClientService

Abstraction layer for Stitch MCP server communication. This service provides a type-safe API for generating UI components, managing projects, and handling design systems through the Model Context Protocol.

## Features

- **Connection Management**: Connect/disconnect with automatic reconnection
- **Project Operations**: Create, list, and manage Stitch projects
- **Screen Generation**: Generate UI screens from text prompts
- **Screen Editing**: Edit existing screens and generate design variants
- **Design Systems**: Create and apply design systems to projects
- **Error Handling**: Comprehensive error handling with connection status monitoring

## Installation

The service uses the `@modelcontextprotocol/sdk` package which is already installed in the project.

## Basic Usage

```javascript
import MCPClientService from './services/MCPClientService.js';

const mcpClient = new MCPClientService();

// Connect to Stitch MCP server
await mcpClient.connect('http://localhost:3000');

// Check connection status
console.log(mcpClient.isConnected()); // true

// Create a project
const project = await mcpClient.createProject({
  title: 'My UI Project',
});

// Generate a screen
const screen = await mcpClient.generateScreen({
  projectId: project.name.split('/')[1],
  prompt: 'Create a dashboard with stats cards',
  deviceType: 'DESKTOP',
});

// Disconnect when done
await mcpClient.disconnect();
```

## API Reference

### Connection Management

#### `connect(serverUrl: string): Promise<void>`
Connect to the Stitch MCP server.

**Parameters:**
- `serverUrl` - The URL of the Stitch MCP server (e.g., 'http://localhost:3000')

**Throws:** Error if connection fails

**Example:**
```javascript
await mcpClient.connect('http://localhost:3000');
```

#### `disconnect(): Promise<void>`
Disconnect from the Stitch MCP server.

#### `isConnected(): boolean`
Check if currently connected to the server.

**Returns:** `true` if connected, `false` otherwise

#### `addConnectionListener(listener: Function): void`
Add a listener for connection status changes.

**Parameters:**
- `listener` - Callback function `(status: string, error?: Error) => void`
  - `status` can be: 'connected', 'disconnected', 'error'

**Example:**
```javascript
mcpClient.addConnectionListener((status, error) => {
  console.log('Connection status:', status);
  if (error) console.error('Error:', error);
});
```

#### `removeConnectionListener(listener: Function): void`
Remove a connection status listener.

### Project Operations

#### `createProject(params: object): Promise<object>`
Create a new Stitch project.

**Parameters:**
- `params.title` - Project title (string)

**Returns:** Created project object

**Example:**
```javascript
const project = await mcpClient.createProject({
  title: 'Dashboard Redesign',
});
```

#### `getProject(projectName: string): Promise<object>`
Get a specific project by resource name.

**Parameters:**
- `projectName` - Project resource name (e.g., 'projects/123')

**Returns:** Project details

#### `listProjects(params?: object): Promise<object>`
List all projects.

**Parameters:**
- `params.filter` - Optional filter (e.g., 'view=owned')

**Returns:** List of projects

### Screen Operations

#### `listScreens(projectId: string): Promise<object>`
List all screens in a project.

**Parameters:**
- `projectId` - Project ID without 'projects/' prefix

**Returns:** List of screens

#### `getScreen(params: object): Promise<object>`
Get a specific screen.

**Parameters:**
- `params.name` - Screen resource name (e.g., 'projects/123/screens/abc')
- `params.projectId` - Project ID
- `params.screenId` - Screen ID

**Returns:** Screen details

#### `generateScreen(params: object): Promise<object>`
Generate a new screen from a text prompt.

**Parameters:**
- `params.projectId` - Project ID (required)
- `params.prompt` - Text prompt describing the desired UI (required)
- `params.deviceType` - Device type: 'MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC' (optional)
- `params.modelId` - Model ID (optional)

**Returns:** Generated screen object

**Example:**
```javascript
const screen = await mcpClient.generateScreen({
  projectId: '123',
  prompt: 'Create a modern dashboard with stats cards',
  deviceType: 'DESKTOP',
});
```

#### `editScreens(params: object): Promise<object>`
Edit existing screens with a text prompt.

**Parameters:**
- `params.projectId` - Project ID (required)
- `params.selectedScreenIds` - Array of screen IDs to edit (required)
- `params.prompt` - Text prompt describing modifications (required)
- `params.deviceType` - Device type (optional)
- `params.modelId` - Model ID (optional)

**Returns:** Edited screens

#### `generateVariants(params: object): Promise<object>`
Generate design variants of existing screens.

**Parameters:**
- `params.projectId` - Project ID (required)
- `params.selectedScreenIds` - Array of screen IDs (required)
- `params.prompt` - Text prompt for variant generation (required)
- `params.variantOptions` - Variant configuration (required)
  - `variantCount` - Number of variants (1-5)
  - `creativeRange` - 'REFINE', 'EXPLORE', or 'REIMAGINE'
  - `aspects` - Array of aspects to vary: 'LAYOUT', 'COLOR_SCHEME', 'IMAGES', 'TEXT_FONT', 'TEXT_CONTENT'
- `params.deviceType` - Device type (optional)
- `params.modelId` - Model ID (optional)

**Returns:** Generated variants

**Example:**
```javascript
const variants = await mcpClient.generateVariants({
  projectId: '123',
  selectedScreenIds: ['abc'],
  prompt: 'Create variations with different color schemes',
  variantOptions: {
    variantCount: 3,
    creativeRange: 'EXPLORE',
    aspects: ['COLOR_SCHEME'],
  },
});
```

#### `fetchScreenCode(params: object): Promise<string>`
Fetch the HTML/code content of a screen.

**Parameters:**
- `params.projectId` - Project ID
- `params.screenId` - Screen ID

**Returns:** Screen code as string

#### `fetchScreenImage(params: object): Promise<Blob>`
Fetch the screenshot/preview image of a screen.

**Parameters:**
- `params.projectId` - Project ID
- `params.screenId` - Screen ID

**Returns:** Screen image as Blob

### Design System Operations

#### `createDesignSystem(params: object): Promise<object>`
Create a new design system.

**Parameters:**
- `params.designSystem` - Design system configuration (required)
  - `displayName` - Display name (string)
  - `theme` - Theme configuration (object)
    - `colorMode` - 'LIGHT' or 'DARK'
    - `headlineFont` - Font name (e.g., 'INTER')
    - `bodyFont` - Font name
    - `roundness` - 'ROUND_FOUR', 'ROUND_EIGHT', 'ROUND_TWELVE', 'ROUND_FULL'
    - `customColor` - Primary color (hex format, e.g., '#7bd0ff')
- `params.projectId` - Optional project ID

**Returns:** Created design system

**Example:**
```javascript
const designSystem = await mcpClient.createDesignSystem({
  projectId: '123',
  designSystem: {
    displayName: 'Dark Theme',
    theme: {
      colorMode: 'DARK',
      headlineFont: 'INTER',
      bodyFont: 'INTER',
      roundness: 'ROUND_EIGHT',
      customColor: '#7bd0ff',
    },
  },
});
```

#### `updateDesignSystem(params: object): Promise<object>`
Update an existing design system.

**Parameters:**
- `params.name` - Design system resource name (e.g., 'assets/123')
- `params.projectId` - Project ID
- `params.designSystem` - Updated design system configuration

**Returns:** Updated design system

#### `listDesignSystems(params?: object): Promise<object>`
List all design systems for a project.

**Parameters:**
- `params.projectId` - Optional project ID

**Returns:** List of design systems

#### `applyDesignSystem(params: object): Promise<object>`
Apply a design system to screens.

**Parameters:**
- `params.projectId` - Project ID
- `params.assetId` - Design system asset ID
- `params.selectedScreenInstances` - Array of screen instances to apply to

**Returns:** Application result

## Error Handling

All methods throw errors if:
- Not connected to the server (call `connect()` first)
- Network request fails
- Server returns an error

Always wrap calls in try-catch blocks:

```javascript
try {
  await mcpClient.connect('http://localhost:3000');
  const project = await mcpClient.createProject({ title: 'My Project' });
} catch (error) {
  console.error('Operation failed:', error.message);
}
```

## Connection Status Monitoring

Monitor connection status changes:

```javascript
mcpClient.addConnectionListener((status, error) => {
  switch (status) {
    case 'connected':
      console.log('Connected to Stitch MCP server');
      break;
    case 'disconnected':
      console.log('Disconnected from server');
      break;
    case 'error':
      console.error('Connection error:', error);
      break;
  }
});
```

## Transport Details

The service uses `StreamableHTTPClientTransport` from the MCP SDK, which provides:
- HTTP POST for sending messages
- HTTP GET with Server-Sent Events for receiving messages
- Automatic reconnection with exponential backoff
- Session management

Reconnection options:
- Initial delay: 1 second
- Max delay: 30 seconds
- Growth factor: 1.5x
- Max retries: 5

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 2.1**: Connection establishment and status management
- **Requirement 2.2**: Enable operations when connected
- **Requirement 2.3**: Error handling and reconnection
- **Requirement 2.4**: Automatic reconnection with exponential backoff

## See Also

- [MCPClientService.example.js](./MCPClientService.example.js) - Usage examples
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - MCP SDK documentation
