# Stitch UI Builder Demo

## Overview

The Stitch UI Builder Demo is a frontend-only demonstration of the Stitch MCP integration for generating modern React pages. This demo showcases the UI components and workflow without requiring a backend MCP server connection.

## Accessing the Demo

1. **Login to PatchMaster** with any account that has `testing` permissions
2. **Navigate to the sidebar** and look for "Stitch UI Builder" (appears below "Testing Center")
3. **Click "Stitch UI Builder"** to open the demo page

## Demo Features

### 1. Project List
- Displays mock Stitch projects with metadata
- Shows project selection with visual feedback
- Demonstrates the ProjectList component from `components/ProjectList.jsx`

### 2. Code Preview Panel
- Syntax-highlighted JSX code display
- Copy to clipboard functionality
- Download as file functionality
- Code formatting with Prettier
- **Live inline editing** with syntax validation
- Real-time syntax error detection
- Demonstrates the CodePreviewPanel component from `components/CodePreviewPanel.jsx`

### 3. Prompt Input
- Text area for entering page generation prompts
- Quick example buttons for common page types
- Generate button with loading state

### 4. Generated Code Examples
The demo includes three pre-built examples:
- **Dashboard Page**: Stats cards and recent activity
- **User Management Page**: Table with search and actions
- **Reports Page**: Grid of report cards

### 5. Export Options
- Target path configuration
- Route name configuration
- Backup and navigation update options
- Export button (demo only - doesn't actually write files)

## How to Use the Demo

1. **Select a Project** (optional)
   - Click on any project in the left panel to select it
   - Selected project will be highlighted

2. **Enter a Prompt**
   - Type a description of the page you want to generate
   - Or click one of the quick example buttons:
     - "Dashboard with stats"
     - "User management"
     - "Reports page"

3. **Generate Code**
   - Click the "✨ Generate" button
   - Wait for the simulated generation (1.5 seconds)
   - Generated code will appear in the Code Preview Panel

4. **Edit Code (Optional)**
   - Click the "✏️ Edit" button in the code preview toolbar
   - Modify the code directly in the editor
   - Syntax errors will be highlighted in real-time
   - Click "👁️ View" to return to read-only mode

5. **Copy or Download**
   - Click "📋 Copy" to copy code to clipboard
   - Click "💾 Download" to save as a .jsx file
   - Click "✨ Format" to auto-format the code with Prettier

6. **Configure Export** (demo only)
   - Set target path (e.g., `frontend/src/NewPage.jsx`)
   - Set route name (e.g., `new-page`)
   - Toggle backup and navigation options
   - Click "💾 Export to PatchMaster" (shows demo message)

## Components Demonstrated

### ProjectList Component
**Location**: `frontend/src/components/ProjectList.jsx`

Features:
- Project listing with metadata
- Selection handling
- Loading states
- Error handling with retry
- Empty state display
- Refresh functionality

### CodePreviewPanel Component
**Location**: `frontend/src/components/CodePreviewPanel.jsx`

Features:
- Syntax highlighting with react-syntax-highlighter
- Line numbers and code folding
- Copy to clipboard
- Download as file
- Code formatting with Prettier
- **Inline editing with live validation**
- Real-time syntax error detection with @babel/parser
- Error highlighting with line/column information

## Mock Data

The demo uses mock data for:
- **Projects**: 3 sample projects with realistic metadata
- **Generated Code**: 3 pre-built React component examples
- **MCP Connection**: Simulated "connected" status

## Limitations

This is a **frontend-only demo** with the following limitations:

1. **No Real MCP Server**: Uses mock data instead of connecting to Stitch MCP
2. **No File Writing**: Export button doesn't actually write files
3. **Limited Generation**: Only 3 pre-built code examples (selected based on prompt keywords)
4. **No Visual Preview**: Visual preview panel not included in this demo
5. **No Variant Generation**: Variant generation button is non-functional
6. **No Design System Application**: Design system features not demonstrated

## Real Implementation

For the full Stitch UI Builder implementation with real MCP server connectivity, see:

- **Services**: `frontend/src/services/`
  - `MCPClientService.js` - MCP server communication
  - `CHDesignSystemAdapter.js` - Command Horizon design system integration
  - `DesignSystemManager.js` - Design system management
  - `ExportManager.js` - File export and navigation registration
  - `ScreenCacheService.js` - IndexedDB caching

- **Components**: `frontend/src/components/`
  - `ProjectList.jsx` - Project listing (used in demo)
  - `CodePreviewPanel.jsx` - Code preview (used in demo)
  - Additional components for visual preview, etc.

- **Tests**: Comprehensive test coverage
  - `MCPClientService.test.js` - 61 tests
  - `ProjectList.test.jsx` - 18 tests
  - `CHDesignSystemAdapter.test.js` - 12 tests
  - `CodePreviewPanel.test.jsx` - 7 tests
  - `DesignSystemManager.test.js` - 30 tests
  - `ScreenCacheService.test.js` - 22 tests
  - `StitchUIBuilder.integration.test.jsx` - 23 integration tests

## Design System

The demo uses the **Command Horizon V2** design system (CH.jsx):

- **Colors**: Dark blue theme (#060e20) with cyan accents (#7bd0ff)
- **Components**: CHPage, CHHeader, CHCard, CHLabel, CHBtn, CHInput, CHBadge
- **Typography**: Clean, modern fonts with proper hierarchy
- **Spacing**: Consistent spacing scale
- **Interactions**: Smooth transitions and hover effects

## Next Steps

To implement the full Stitch UI Builder:

1. **Configure MCP Server**: Set up Stitch MCP server connection
2. **Implement Main Page**: Create `StitchUIBuilderPage.jsx` with all features
3. **Add Visual Preview**: Implement `VisualPreviewPanel.jsx` component
4. **Enable Export**: Connect `ExportManager.js` for file writing
5. **Add Design System**: Integrate `CHDesignSystemAdapter.js` and `DesignSystemManager.js`
6. **Enable Caching**: Connect `ScreenCacheService.js` for offline access

## Troubleshooting

### Demo Not Appearing in Navigation
- Ensure you're logged in with an account that has `testing` permissions
- Check that the user role is `admin` or has the `testing` permission

### Code Not Generating
- Check browser console for errors
- Ensure you've entered a prompt before clicking Generate
- Try one of the quick example buttons

### Syntax Errors Not Showing
- Ensure you're in edit mode (click "✏️ Edit" button)
- Make a syntax error (e.g., remove a closing brace)
- Error should appear in red banner above code

## Support

For questions or issues with the Stitch UI Builder:
- Review the spec: `.kiro/specs/stitch-ui-integration/`
- Check the implementation: `frontend/src/services/` and `frontend/src/components/`
- Run tests: `npm test` in the frontend directory
