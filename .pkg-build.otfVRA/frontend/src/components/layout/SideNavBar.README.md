# SideNavBar Component

## Overview

The `SideNavBar` component is the primary navigation sidebar for the PatchMaster application. It provides a fixed left-side navigation menu with branding, navigation items, and user profile information.

## Features

- **Fixed Positioning**: Stays visible on the left side of the screen at all times
- **Active State Highlighting**: Visually indicates the current page with primary color and left border
- **Hover Effects**: Smooth color transitions on hover for better UX
- **Branding Section**: Displays PatchMaster logo and license tier
- **User Profile Footer**: Shows user avatar, username, and role
- **Material Symbols Icons**: Uses the Icon component for consistent iconography
- **Accessibility**: Proper ARIA labels and semantic HTML

## Usage

### Basic Example

```jsx
import React, { useState } from 'react';
import SideNavBar from './components/layout/SideNavBar';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const user = {
    username: 'Admin User',
    role: 'System Operator',
    avatar: 'https://example.com/avatar.jpg', // Optional
  };

  const licenseInfo = {
    tier: 'Enterprise Tier',
    status: 'active',
  };

  return (
    <div>
      <SideNavBar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
        licenseInfo={licenseInfo}
      />
      
      {/* Your main content with ml-64 offset */}
      <main className="ml-64 pt-24 px-8">
        {/* Page content */}
      </main>
    </div>
  );
}
```

### With React Router

```jsx
import { useNavigate, useLocation } from 'react-router-dom';
import SideNavBar from './components/layout/SideNavBar';

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract current page from pathname
  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  const handleNavigate = (page) => {
    navigate(`/${page}`);
  };

  return (
    <div>
      <SideNavBar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={currentUser}
        licenseInfo={licenseData}
      />
      
      <main className="ml-64 pt-24 px-8">
        <Outlet />
      </main>
    </div>
  );
}
```

## Props

### `currentPage` (string, required)

The identifier of the currently active page. Should match one of the navigation item paths.

**Example values**: `'dashboard'`, `'hosts'`, `'patching'`, `'cicd'`, `'cves'`, `'backups'`, `'policies'`, `'monitoring'`, `'reports'`, `'settings'`

### `onNavigate` (function, required)

Callback function invoked when a navigation item is clicked.

**Signature**: `(page: string) => void`

**Example**:
```jsx
const handleNavigate = (page) => {
  console.log(`Navigating to: ${page}`);
  setCurrentPage(page);
};
```

### `user` (object, required)

User information to display in the profile footer.

**Properties**:
- `username` (string, required): User's display name
- `role` (string, required): User's role or title
- `avatar` (string, optional): URL to user's avatar image

**Example**:
```jsx
const user = {
  username: 'John Doe',
  role: 'System Administrator',
  avatar: 'https://example.com/avatar.jpg',
};
```

### `licenseInfo` (object, required)

License information to display in the branding section.

**Properties**:
- `tier` (string, required): License tier name (e.g., "Enterprise Tier", "Professional", "Community Edition")
- `status` (string, required): License status - `'active'`, `'expired'`, or `'invalid'`

**Example**:
```jsx
const licenseInfo = {
  tier: 'Enterprise Tier',
  status: 'active',
};
```

## Navigation Items

The sidebar includes the following default navigation items:

| Label | Icon | Path |
|-------|------|------|
| Dashboard | dashboard | `dashboard` |
| Hosts | dns | `hosts` |
| Patching | system_update | `patching` |
| CI/CD | terminal | `cicd` |
| CVEs | security | `cves` |
| Backups | backup | `backups` |
| Policies | policy | `policies` |
| Monitoring | monitoring | `monitoring` |
| Reports | analytics | `reports` |
| Settings | settings | `settings` |

## Styling

### Tailwind Classes

The component uses the following key Tailwind classes:

**Container**:
```
fixed left-0 top-0 h-screen w-64 bg-[#06122d] z-50 overflow-y-auto flex flex-col
```

**Active Navigation Item**:
```
text-[#7bd0ff] border-l-2 border-[#7bd0ff] bg-[#05183c]
```

**Inactive Navigation Item (with hover)**:
```
text-[#91aaeb] hover:text-[#dee5ff] hover:bg-[#031d4b]
```

### Color Tokens

- Background: `#06122d` (surface-container-low)
- Active text: `#7bd0ff` (primary)
- Active background: `#05183c` (surface-container)
- Inactive text: `#91aaeb` (on-surface-variant)
- Hover background: `#031d4b` (surface-container-high)
- Border: `#2b4680` (outline-variant)

## Layout Integration

The SideNavBar has a fixed width of 256px (w-64). Your main content area should account for this:

```jsx
<main className="ml-64 pt-24 px-8">
  {/* Content */}
</main>
```

- `ml-64`: Left margin to offset the sidebar (256px)
- `pt-24`: Top padding to offset the header (96px)
- `px-8`: Horizontal padding for content

## Accessibility

The component includes several accessibility features:

- **Semantic HTML**: Uses `<aside>`, `<nav>`, and `<a>` elements
- **ARIA Labels**: Icons have descriptive `ariaLabel` props
- **Current Page Indicator**: Active items have `aria-current="page"`
- **Keyboard Navigation**: All navigation items are keyboard accessible
- **Alt Text**: User avatar has descriptive alt text

## Customization

### Adding New Navigation Items

To add new navigation items, modify the `navigationItems` array in the component:

```jsx
const navigationItems = [
  // ... existing items
  { label: 'New Page', icon: 'new_icon', path: 'new-page' },
];
```

Make sure the icon name is in the Icon component's whitelist.

### Changing Colors

The component uses Stitch color tokens. To change colors, update the Tailwind classes:

```jsx
// Example: Change active color from blue to green
className="text-[#00ff00] border-l-2 border-[#00ff00] bg-[#05183c]"
```

## Requirements Satisfied

This component satisfies the following requirements from the PatchMaster UI Redesign spec:

- **2.1**: Fixed left sidebar with width 256px
- **2.4**: Consistent layout structure
- **2.5**: Fixed positioning
- **3.1**: PatchMaster branding with logo and license tier
- **3.2**: Navigation menu items with icons and labels
- **3.4**: Active state highlighting with primary color
- **3.5**: User profile information display

## Testing

See `SideNavBar.test.jsx` for unit tests covering:
- Navigation item rendering
- Active state highlighting
- Hover state transitions
- User profile display
- Icon rendering
- Accessibility features

## Related Components

- **Icon**: Used for all icons in the sidebar
- **TopNavBar**: Companion header component
- **MainContent**: Main content wrapper component

## Browser Support

The component uses modern CSS features:
- Flexbox
- CSS transitions
- Backdrop filters (for potential glass-morphism effects)

Supported browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- **No Runtime CSS**: Uses static Tailwind classes for optimal performance
- **Minimal Re-renders**: Component only re-renders when props change
- **Optimized Icons**: Material Symbols loaded via font (cached by browser)

## Migration Notes

This component replaces the old CH.jsx-based sidebar with:
- Tailwind CSS utility classes instead of custom CSS
- Material Symbols Outlined instead of custom icons
- Stitch color palette instead of old color scheme
- Modern React patterns (functional component with hooks)
