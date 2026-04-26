# Component Library Documentation - PatchMaster UI

## Overview
This document provides comprehensive documentation for all Stitch design system components used in the PatchMaster UI. Each component includes usage examples, props documentation, and best practices.

## Layout Components

### SideNavBar
Primary navigation sidebar with branding, menu items, and user profile.

**Props:**
- `currentPage` (string): Current active page identifier
- `onNavigate` (function): Navigation handler function
- `user` (object): User information
  - `username` (string): User's display name
  - `role` (string): User's role/title
  - `avatar` (string, optional): User's avatar URL
- `licenseInfo` (object): License information
  - `tier` (string): License tier
  - `status` (string): License status

**Example:**
```jsx
<SideNavBar 
  currentPage="dashboard"
  onNavigate={(page) => navigate(page)}
  user={{ username: 'Admin User', role: 'Administrator' }}
  licenseInfo={{ tier: 'Enterprise', status: 'active' }}
/>
```

### TopNavBar
Fixed header with page title, global search, notifications, and user actions.

**Props:**
- `pageTitle` (string): Current page title
- `pageIcon` (string): Material Symbol icon name
- `onSearch` (function): Search handler function
- `notificationCount` (number): Unread notifications count
- `licenseStatus` (object): License status information

**Example:**
```jsx
<TopNavBar 
  pageTitle="Dashboard"
  pageIcon="dashboard"
  onSearch={(query) => handleSearch(query)}
  notificationCount={3}
  licenseStatus={{ active: true, label: 'Active' }}
/>
```

### MainContent
Main content wrapper with proper spacing and scrolling.

**Props:**
- `children` (ReactNode): Page content
- `maxWidth` (string, optional): Max-width constraint
- `className` (string, optional): Additional CSS classes

**Example:**
```jsx
<MainContent maxWidth="max-w-7xl">
  <h1>Page Content</h1>
</MainContent>
```

## Core UI Components

### StatCard
Displays a metric with icon, value, and optional trend information.

**Props:**
- `label` (string): Metric label
- `value` (string|number): Main metric value
- `icon` (string): Material Symbol icon name
- `trend` (object, optional): Trend information
  - `value` (string|number): Trend value
  - `label` (string): Trend label
- `variant` ('primary'|'error'|'tertiary'): Border color variant
- `onClick` (function, optional): Click handler

**Example:**
```jsx
<StatCard
  label="Total Hosts"
  value="1,248"
  icon="dns"
  trend={{ value: '+12', label: 'since yesterday' }}
  variant="primary"
  onClick={() => navigate('/hosts')}
/>
```

### DataTable
Displays tabular data with sorting, filtering, and row actions.

**Props:**
- `columns` (array): Column definitions
  - `key` (string): Column identifier
  - `label` (string): Column header label
  - `sortable` (boolean): Whether column is sortable
  - `render` (function): Custom cell renderer
- `data` (array): Row data
- `onSort` (function, optional): Sort handler
- `onRowClick` (function, optional): Row click handler
- `actions` (array, optional): Row action buttons

**Example:**
```jsx
<DataTable
  columns={[
    { key: 'hostname', label: 'Hostname', sortable: true },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> }
  ]}
  data={hosts}
  onSort={(key, dir) => handleSort(key, dir)}
  actions={[
    { label: 'Terminal', icon: 'terminal', onClick: (row) => openTerminal(row) }
  ]}
/>
```

### StatusBadge
Displays a small colored label indicating status.

**Props:**
- `status` ('success'|'warning'|'error'|'info'|'pending'): Status type
- `label` (string): Badge text
- `size` ('sm'|'md'|'lg'): Badge size
- `className` (string, optional): Additional CSS classes

**Example:**
```jsx
<StatusBadge status="success" label="Online" />
<StatusBadge status="error" label="Failed" size="lg" />
```

### ChartCard
Container for chart visualizations with title, legend, and actions.

**Props:**
- `title` (string): Card title
- `subtitle` (string, optional): Subtitle/description
- `legend` (array, optional): Legend items
- `children` (ReactNode): Chart content
- `actions` (array, optional): Action buttons

**Example:**
```jsx
<ChartCard
  title="Heartbeat Activity"
  subtitle="Live Metrics"
  legend={[
    { label: 'Core Fleet', color: 'bg-primary' },
    { label: 'Edge Nodes', color: 'bg-outline' }
  ]}
  actions={[
    { label: 'Export', icon: 'download', onClick: () => exportData() }
  ]}
>
  <LineChart data={chartData} />
</ChartCard>
```

## Form Components

### FormInput
Text input field with label, validation, and error handling.

**Props:**
- `label` (string): Input label
- `value` (string): Current value
- `onChange` (function): Change handler
- `placeholder` (string, optional): Placeholder text
- `error` (string, optional): Error message
- `required` (boolean): Whether field is required
- `type` ('text'|'email'|'password'|'number'): Input type

**Example:**
```jsx
<FormInput 
  label="Email Address" 
  value={email} 
  onChange={setEmail}
  type="email"
  required
  error={emailError}
/>
```

### FormSelect
Dropdown selection field with label and validation.

**Props:**
- `label` (string): Select label
- `value` (string): Current selected value
- `onChange` (function): Change handler
- `options` (array): Option objects
  - `value` (string): Option value
  - `label` (string): Option label
  - `group` (string, optional): Optgroup name
- `error` (string, optional): Error message
- `required` (boolean): Whether field is required

**Example:**
```jsx
<FormSelect 
  label="Operating System" 
  value={os} 
  onChange={setOs}
  options={[
    { value: 'ubuntu', label: 'Ubuntu' },
    { value: 'centos', label: 'CentOS' }
  ]}
  required
/>
```

### ActionButton
Styled button with variants, icons, and loading states.

**Props:**
- `label` (string): Button text
- `onClick` (function): Click handler
- `variant` ('primary'|'secondary'|'tertiary'|'danger'): Button style
- `icon` (string, optional): Material Symbol icon name
- `disabled` (boolean): Whether button is disabled
- `loading` (boolean): Whether button is in loading state

**Example:**
```jsx
<ActionButton 
  label="Save Changes" 
  onClick={handleSave}
  variant="primary"
  icon="save"
  loading={isSaving}
/>
```

## Icon Component

### Icon
Material Symbols icon wrapper with accessibility support.

**Props:**
- `name` (string): Material Symbol icon name
- `size` (number): Icon size in pixels
- `className` (string, optional): Additional CSS classes
- `fill` (0|1, optional): Fill style
- `weight` (100-700, optional): Icon weight
- `ariaLabel` (string, optional): Accessibility label

**Example:**
```jsx
<Icon 
  name="dashboard" 
  size={24}
  className="text-primary"
  ariaLabel="Dashboard icon"
/>
```

## Color Tokens

### Background Colors
- `bg-[#060e20]` - Primary background
- `bg-[#06122d]` - Surface container low
- `bg-[#05183c]` - Surface container
- `bg-[#031d4b]` - Surface container high
- `bg-[#00225a]` - Surface container highest

### Text Colors
- `text-[#dee5ff]` - Primary text
- `text-[#91aaeb]` - Secondary text
- `text-[#7bd0ff]` - Primary accent
- `text-[#ffd16f]` - Tertiary accent
- `text-[#ee7d77]` - Error text

### Border Colors
- `border-[#7bd0ff]` - Primary border
- `border-[#2b4680]` - Outline variant
- `border-[#5b74b1]` - Outline

## Typography Scale

### Font Sizes
- `text-xs` - 10px
- `text-sm` - 11px
- `text-base` - 13px
- `text-md` - 14px
- `text-lg` - 18px
- `text-xl` - 24px
- `text-2xl` - 32px
- `text-4xl` - 40px

### Font Weights
- `font-light` - 300
- `font-normal` - 400
- `font-medium` - 500
- `font-semibold` - 600
- `font-bold` - 700
- `font-extrabold` - 800

### Letter Spacing
- `tracking-tighter` - -0.02em
- `tracking-tight` - -0.01em
- `tracking-normal` - 0
- `tracking-wide` - 0.02em
- `tracking-wider` - 0.15em
- `tracking-widest` - 0.2em

## Best Practices

### Component Usage
1. **Always use layout components**: Wrap pages with SideNavBar, TopNavBar, and MainContent
2. **Consistent spacing**: Use gap-6 for card grids, gap-4 for form fields
3. **Proper variants**: Use appropriate StatusBadge and ActionButton variants
4. **Accessibility**: Include aria-labels for icon-only buttons
5. **Responsive design**: Use responsive grid classes (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)

### Color Usage
1. **Use color tokens**: Never use hardcoded colors outside the token set
2. **Maintain contrast**: Ensure text meets WCAG AA standards (4.5:1 for normal text)
3. **Consistent variants**: Use primary for success, error for failures, tertiary for warnings

### Typography
1. **Heading hierarchy**: Use proper h1-h6 tags with consistent sizing
2. **Uppercase labels**: Use text-[10px] uppercase tracking-widest for labels
3. **Body text**: Use text-sm or text-base for body content

### Performance
1. **Lazy load images**: Use loading="lazy" for images
2. **Minimize re-renders**: Use React.memo for expensive components
3. **Optimize bundles**: Tailwind purges unused CSS in production

## Migration Guide

### From CH.jsx to Stitch Components

**Old (CH.jsx):**
```jsx
<CHPage>
  <CHHeader title="Dashboard" />
  <CHStat label="Total" value={100} />
  <CHTable headers={['Name', 'Status']} data={data} />
</CHPage>
```

**New (Stitch):**
```jsx
<div className="flex">
  <SideNavBar currentPage="dashboard" />
  <TopNavBar pageTitle="Dashboard" pageIcon="dashboard" />
  <MainContent>
    <StatCard label="Total" value={100} icon="dashboard" />
    <DataTable columns={columns} data={data} />
  </MainContent>
</div>
```

## Support

For questions or issues with components:
1. Check this documentation
2. Review component source code in `frontend/src/components/`
3. Check example usage in migrated pages
4. Refer to Stitch design files in `stitch/` folder
