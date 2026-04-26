# Stitch UI Components

This directory contains reusable components for the Stitch UI Builder integration and the PatchMaster UI redesign.

## Icon Component

The `Icon` component is a secure wrapper for Material Symbols Outlined icons, part of the PatchMaster UI redesign migration from AppIcon to Material Symbols.

### Features

- **Security**: Whitelist-based validation prevents icon injection attacks
- **Consistency**: Enforces Material Symbols Outlined style (weight 400, fill 0, grade 0)
- **Flexibility**: Supports custom sizes, weights, fills, and grades
- **Accessibility**: Built-in ARIA label support
- **Performance**: Uses font-display: swap for optimal loading

### Quick Start

```jsx
import { Icon } from './components/Icon';

// Basic usage
<Icon name="dashboard" />

// With custom size and styling
<Icon name="settings" size={20} className="text-primary" />

// With accessibility
<Icon name="search" ariaLabel="Search hosts" />
```

### Documentation

- [Icon Component README](./Icon.README.md) - Complete documentation
- [Icon Mapping Guide](./ICON_MAPPING.md) - AppIcon to Material Symbols mapping
- [Icon Demo](./IconDemo.jsx) - Visual reference of all icons

### Testing

```bash
npm test -- Icon.test.jsx --run
```

---

## ProjectList Component

The `ProjectList` component displays a list of Stitch projects with metadata and provides project selection functionality.

### Features

- **Project Display**: Shows all available Stitch projects with name, description, and metadata
- **Project Selection**: Allows users to select a project with visual feedback
- **Loading States**: Displays loading indicator while fetching projects
- **Error Handling**: Shows error messages with retry functionality
- **Empty State**: Displays helpful message when no projects exist
- **Metadata Display**: Shows creation date, update date, and project ID
- **Refresh**: Allows manual refresh of project list

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `mcpClient` | `MCPClientService` | Yes | Instance of MCPClientService for API communication |
| `selectedProject` | `object` | No | Currently selected project object |
| `onProjectSelect` | `function` | No | Callback function called when a project is selected |
| `loading` | `boolean` | No | External loading state (default: false) |
| `error` | `string` | No | External error message to display |

### Usage Example

```jsx
import React, { useState } from 'react';
import MCPClientService from '../services/MCPClientService.js';
import ProjectList from './ProjectList.jsx';

function MyComponent() {
  const [mcpClient] = useState(() => new MCPClientService());
  const [selectedProject, setSelectedProject] = useState(null);

  // Initialize connection
  useEffect(() => {
    mcpClient.connect('http://localhost:3000');
  }, []);

  return (
    <ProjectList
      mcpClient={mcpClient}
      selectedProject={selectedProject}
      onProjectSelect={setSelectedProject}
    />
  );
}
```

### Project Object Structure

Projects returned from the Stitch MCP server have the following structure:

```typescript
{
  name: string;           // Resource name (e.g., 'projects/123456')
  title: string;          // Project title
  description?: string;   // Optional project description
  createTime?: string;    // ISO 8601 creation timestamp
  updateTime?: string;    // ISO 8601 update timestamp
}
```

### Styling

The component uses the Command Horizon V2 design system (CH.jsx) for consistent styling:

- **Colors**: Dark blue theme with cyan accents
- **Cards**: Rounded cards with subtle borders
- **Hover States**: Interactive hover effects on project items
- **Selection**: Visual highlight for selected project

### Testing

The component includes comprehensive unit tests covering:

- Loading states
- Error handling and retry functionality
- Empty state display
- Project display with metadata
- Project selection functionality
- Refresh functionality
- Edge cases (missing data, invalid dates, etc.)

Run tests with:

```bash
npm test -- components/ProjectList.test.jsx
```

### Requirements Satisfied

This component satisfies the following requirements from the Stitch UI Integration spec:

- **Requirement 3.3**: Display a list of all available projects
- **Requirement 3.4**: Allow users to select a project and display project metadata

### Related Components

- `MCPClientService`: Service for communicating with Stitch MCP server
- `CH.jsx`: Command Horizon V2 design system components

### Future Enhancements

Potential improvements for future iterations:

- Project search/filter functionality
- Project sorting options
- Project creation inline
- Project deletion with confirmation
- Project editing capabilities
- Pagination for large project lists
