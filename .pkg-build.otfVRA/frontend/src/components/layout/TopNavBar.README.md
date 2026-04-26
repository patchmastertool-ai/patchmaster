# TopNavBar Component

## Overview

The `TopNavBar` component is a fixed header bar that spans the top of the application, positioned to the right of the sidebar. It provides global search functionality, displays license status, shows notifications, and provides access to user account settings.

## Design Reference

This component is based on the Stitch design found in `frontend/stitch_dashboard_raw.html`. It follows the PatchMaster UI redesign specifications using Tailwind CSS and Material Symbols Outlined icons.

## Features

- **Fixed Positioning**: Stays at the top of the viewport, offset by sidebar width (256px)
- **Global Search**: Search input with icon for searching hosts, patches, or CVEs
- **License Status Indicator**: Visual indicator showing license status (active/expired)
- **Notification Bell**: Shows unread notification count with badge
- **User Account Menu**: Quick access to user account settings
- **Glass-morphism Effect**: Backdrop blur for modern visual depth
- **Responsive Design**: Adapts to different screen sizes

## Props

```typescript
interface TopNavBarProps {
  pageTitle: string;           // Current page title (not displayed in current design)
  pageIcon: string;            // Material Symbol icon name for the page (not displayed in current design)
  onSearch: (query: string) => void;  // Search handler function
  notificationCount: number;   // Number of unread notifications (default: 0)
  licenseStatus: {
    active: boolean;           // Whether license is active
    label: string;             // License status label text
  };
}
```

## Usage

### Basic Usage

```jsx
import { TopNavBar } from './components/layout/TopNavBar';

function App() {
  const handleSearch = (query) => {
    console.log('Search query:', query);
    // Implement search logic
  };

  return (
    <TopNavBar
      pageTitle="Dashboard"
      pageIcon="dashboard"
      onSearch={handleSearch}
      notificationCount={3}
      licenseStatus={{
        active: true,
        label: 'License Active',
      }}
    />
  );
}
```

### With Expired License

```jsx
<TopNavBar
  pageTitle="Dashboard"
  pageIcon="dashboard"
  onSearch={handleSearch}
  notificationCount={0}
  licenseStatus={{
    active: false,
    label: 'License Expired',
  }}
/>
```

### Without License Status

```jsx
<TopNavBar
  pageTitle="Dashboard"
  pageIcon="dashboard"
  onSearch={handleSearch}
  notificationCount={5}
  licenseStatus={undefined}  // Shows "License Status" as default
/>
```

## Layout Integration

The TopNavBar is designed to work with the SideNavBar component:

```jsx
import { SideNavBar } from './components/layout/SideNavBar';
import { TopNavBar } from './components/layout/TopNavBar';

function Layout({ children }) {
  return (
    <>
      <SideNavBar
        currentPage="dashboard"
        onNavigate={(page) => console.log('Navigate to:', page)}
        user={{ username: 'Admin', role: 'Administrator' }}
        licenseInfo={{ tier: 'Enterprise Tier', status: 'active' }}
      />
      
      <TopNavBar
        pageTitle="Dashboard"
        pageIcon="dashboard"
        onSearch={(query) => console.log('Search:', query)}
        notificationCount={3}
        licenseStatus={{ active: true, label: 'License Active' }}
      />
      
      <main className="ml-64 pt-24 pb-12 px-8 min-h-screen bg-[#060e20]">
        {children}
      </main>
    </>
  );
}
```

## Styling

### Color Tokens (Stitch Palette)

- **Background**: `#060e20` with 80% opacity + backdrop blur
- **Search Input Background**: `#05183c` (surface-container)
- **Search Icon**: `#91aaeb` (on-surface-variant)
- **Focus Ring**: `#7bd0ff` (primary)
- **Active License**: `#7bd0ff` (primary) on `#004c69/20` (primary-container)
- **Expired License**: `#ee7d77` (error) on `#7f2927/20` (error-container)
- **Notification Badge**: `#ee7d77` (error)
- **Button Hover**: `#dee5ff` (on-surface)

### Layout Classes

```css
/* Header Container */
.fixed.top-0.right-0.left-64.h-16.z-40
.bg-[#060e20]/80.backdrop-blur-xl

/* Search Input */
.w-full.bg-[#05183c].rounded-lg.py-2.pl-10.pr-4
.focus:ring-1.focus:ring-[#7bd0ff]

/* License Status */
.px-3.py-1.5.rounded-full.text-xs.font-bold.uppercase.tracking-widest

/* Notification Badge */
.absolute.top-0.right-0.w-2.h-2.rounded-full
```

## Accessibility

- **Semantic HTML**: Uses `<header>` element
- **ARIA Labels**: All interactive elements have descriptive aria-labels
- **Keyboard Navigation**: All buttons and inputs are keyboard accessible
- **Screen Reader Support**: 
  - Search input has `aria-label="Global search"`
  - Notification button includes count in aria-label
  - License status uses `role="status"` and `aria-live="polite"`
- **Focus Indicators**: Visible focus ring on search input

## Behavior

### Search

- **Real-time Search**: Calls `onSearch` on every input change
- **Form Submission**: Also calls `onSearch` on form submit (Enter key)
- **Controlled Input**: Maintains internal state for input value

### License Status

- **Active License**: Shows green/blue indicator with pulsing animation
- **Expired License**: Shows red indicator without animation
- **Default State**: Shows neutral gray when no status provided

### Notifications

- **Badge Display**: Only shows badge when `notificationCount > 0`
- **Aria Label**: Includes count in button label for screen readers
- **Visual Indicator**: Small red dot positioned at top-right of bell icon

## Testing

The component includes comprehensive unit tests covering:

- Basic rendering and structure
- Search functionality (input changes, form submission)
- License status indicator (active, expired, default states)
- Notification bell (badge display, aria-labels)
- User account menu
- Responsive behavior
- Color token usage
- Accessibility features
- Layout and positioning

Run tests with:

```bash
npm test -- TopNavBar.test.jsx
```

## Design System Compliance

This component follows the PatchMaster UI Redesign specifications:

- ✅ Uses Stitch color palette exclusively
- ✅ Uses Material Symbols Outlined icons
- ✅ Uses Inter font family
- ✅ Fixed positioning with correct dimensions (h-16 = 64px)
- ✅ Offset from sidebar (left-64 = 256px)
- ✅ Z-index layering (z-40, below sidebar's z-50)
- ✅ Glass-morphism effect with backdrop blur
- ✅ Consistent spacing and padding
- ✅ Hover transitions (duration-200)

## Browser Compatibility

- Modern browsers with CSS backdrop-filter support
- Fallback: Semi-transparent background without blur
- Requires Material Symbols Outlined font to be loaded

## Performance Considerations

- **Controlled Input**: Uses React state for search input
- **Event Handlers**: Debounce search handler if needed for API calls
- **Backdrop Blur**: GPU-accelerated, minimal performance impact
- **Icon Loading**: Material Symbols font should be preloaded

## Future Enhancements

Potential improvements for future iterations:

- [ ] Add dropdown menu for user account button
- [ ] Add notification panel/dropdown
- [ ] Add page title display (currently not shown)
- [ ] Add breadcrumb navigation
- [ ] Add quick actions menu
- [ ] Add theme toggle (if dark/light mode support added)
- [ ] Add search suggestions/autocomplete
- [ ] Add keyboard shortcuts (e.g., Cmd+K for search)

## Related Components

- **SideNavBar**: Left sidebar navigation component
- **MainContent**: Main content wrapper component
- **Icon**: Material Symbols icon wrapper component

## References

- Design File: `frontend/stitch_dashboard_raw.html`
- Spec: `.kiro/specs/patchmaster-ui-redesign/`
- Task: `2.3 Migrate TopNavBar component`
- Requirements: 2.2, 2.4, 2.5, 3.6, 3.7, 3.8, 3.9
