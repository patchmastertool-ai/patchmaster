# MainContent Component

## Overview

The `MainContent` component is a reusable layout wrapper that provides the main content area for all pages in the PatchMaster application. It works in conjunction with the `SideNavBar` (task 2.1) and `TopNavBar` (task 2.3) components to create a complete layout shell.

## Purpose

- Provides consistent spacing and positioning for page content
- Accounts for fixed sidebar (256px left margin)
- Accounts for fixed header (96px top padding)
- Ensures scrollable content area
- Applies consistent background color from Stitch design system

## Usage

### Basic Usage

```jsx
import MainContent from './components/layout/MainContent';

function MyPage() {
  return (
    <MainContent>
      <h1>Page Title</h1>
      <p>Page content goes here...</p>
    </MainContent>
  );
}
```

### With Max-Width Container

```jsx
import MainContent from './components/layout/MainContent';

function MyPage() {
  return (
    <MainContent maxWidth="max-w-7xl">
      <h1>Page Title</h1>
      <p>Centered content with max-width constraint...</p>
    </MainContent>
  );
}
```

### With Additional Classes

```jsx
import MainContent from './components/layout/MainContent';

function MyPage() {
  return (
    <MainContent className="pb-16">
      <h1>Page Title</h1>
      <p>Content with extra bottom padding...</p>
    </MainContent>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `React.ReactNode` | Yes | - | Page content to render inside the wrapper |
| `maxWidth` | `string` | No | - | Optional Tailwind max-width class (e.g., 'max-w-7xl', 'max-w-5xl') |
| `className` | `string` | No | `''` | Optional additional CSS classes to apply |

## Layout Specifications

### Spacing
- **Left Margin**: `ml-64` (256px) - Accounts for fixed sidebar width
- **Top Padding**: `pt-24` (96px) - Accounts for fixed header height
- **Horizontal Padding**: `px-8` (32px) - Content spacing from edges

### Dimensions
- **Min Height**: `min-h-screen` (100vh) - Fills entire viewport height
- **Overflow**: `overflow-y-auto` - Enables vertical scrolling for long content

### Colors
- **Background**: `bg-[#060e20]` - Stitch design system background color

## Integration with Layout Shell

The MainContent component is designed to work with:

1. **SideNavBar** (task 2.1)
   - Fixed left sidebar with width 256px
   - MainContent uses `ml-64` to offset content

2. **TopNavBar** (task 2.3)
   - Fixed top header with height 64px
   - MainContent uses `pt-24` (96px) to offset content and provide spacing

### Complete Layout Example

```jsx
import SideNavBar from './components/layout/SideNavBar';
import TopNavBar from './components/layout/TopNavBar';
import MainContent from './components/layout/MainContent';

function App() {
  return (
    <>
      <SideNavBar 
        currentPage="dashboard"
        onNavigate={(page) => console.log(page)}
        user={{ username: 'admin', role: 'Administrator' }}
        licenseInfo={{ tier: 'Enterprise', status: 'active' }}
      />
      <TopNavBar 
        pageTitle="Dashboard"
        pageIcon="dashboard"
        onSearch={(query) => console.log(query)}
        notificationCount={3}
        licenseStatus={{ active: true, label: 'Active' }}
      />
      <MainContent>
        <h1>Dashboard Content</h1>
        {/* Page content here */}
      </MainContent>
    </>
  );
}
```

## Max-Width Options

Common Tailwind max-width classes for content containers:

- `max-w-7xl` - 1280px (recommended for most pages)
- `max-w-6xl` - 1152px
- `max-w-5xl` - 1024px
- `max-w-4xl` - 896px
- `max-w-full` - No constraint (full width)

## Responsive Behavior

The component uses fixed spacing values that work well on desktop viewports (1920x1080). For responsive designs, you can:

1. Add responsive classes via the `className` prop:
```jsx
<MainContent className="md:px-4 lg:px-8">
  {/* Content */}
</MainContent>
```

2. Use responsive max-width:
```jsx
<MainContent maxWidth="max-w-full md:max-w-7xl">
  {/* Content */}
</MainContent>
```

## Requirements Satisfied

- **Requirement 2.3**: Main content area with left margin 256px and top padding 96px
- **Requirement 2.4**: Layout structure identical across all pages
- **Requirement 2.6**: Scrollable content area with consistent background

## Design System Compliance

- Uses Stitch color token: `#060e20` (background)
- Uses Tailwind utility classes for spacing
- Follows layout specifications from design.md
- Compatible with fixed sidebar and header positioning

## Testing

See `MainContent.test.jsx` for unit tests covering:
- Correct Tailwind classes applied
- Children rendering
- Max-width container logic
- Additional className merging
