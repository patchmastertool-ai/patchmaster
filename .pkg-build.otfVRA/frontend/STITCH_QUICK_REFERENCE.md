# Stitch Design System - Quick Reference

## Color Usage

### Backgrounds (Layering)
```jsx
// Level 0: Base canvas
<div className="bg-background">

// Level 1: Navigation/Sidebar
<div className="bg-surface-container-low">

// Level 2: Main content area
<div className="bg-surface-container">

// Level 3: Cards/Modals (lifted)
<div className="bg-surface-container-highest">
```

### Text Colors
```jsx
// Primary text (brightest allowed)
<p className="text-on-surface">

// Context labels, secondary info
<p className="text-on-surface-variant">

// Non-essential text
<p className="text-secondary">

// Brand/interactive elements
<p className="text-primary">
```

## Typography

### Display (Critical Metrics)
```jsx
<div className="text-display-lg text-on-surface">99.9%</div>
```

### Headlines (Section Titles)
```jsx
<h2 className="text-headline-sm text-headline-tight text-on-surface">
  Patch Status
</h2>
```

### Labels (Status, Headers)
```jsx
<span className="text-label-md text-label-uppercase text-on-surface-variant">
  System Health
</span>
```

### Body (Content)
```jsx
<p className="text-body-md text-on-surface">
  Regular content text
</p>
```

## Spacing

```jsx
// Minimum list item spacing
<div className="space-y-4">

// Standard component spacing
<div className="space-y-6">

// Section breathing room (standard)
<div className="space-y-12">

// Large section breaks
<div className="space-y-16">
```

## Components

### Status Badge
```jsx
<span className="badge-success">Active</span>
<span className="badge-warning">Pending</span>
<span className="badge-error">Failed</span>
```

### Widget with Accent
```jsx
<div className="bg-surface-container-low widget-accent-success p-6">
  <div className="text-label-md text-label-uppercase text-on-surface-variant mb-2">
    Uptime
  </div>
  <div className="text-display-lg text-on-surface">
    99.9%
  </div>
</div>
```

### Button (Primary)
```jsx
<button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-medium hover:bg-primary-dim">
  Apply Patches
</button>
```

### Button (Secondary)
```jsx
<button className="border border-outline/40 text-on-surface px-6 py-3 rounded-lg hover:bg-surface-bright">
  Cancel
</button>
```

### Input Field
```jsx
<input
  className="bg-surface-container-highest text-on-surface px-4 py-3 rounded-lg ghost-border focus:ghost-border-full focus:shadow-glow-primary outline-none"
  type="text"
/>
```

### Glass Panel
```jsx
<div className="glass-morphism p-6">
  <div className="glass-gradient">
    Content with gradient overlay
  </div>
</div>
```

### Icon
```jsx
<span className="material-symbols text-on-surface">dashboard</span>
<span className="material-symbols text-primary">settings</span>
```

## Table Pattern

```jsx
<table className="w-full">
  <thead>
    <tr className="text-label-sm text-label-uppercase text-on-surface-variant">
      <th className="text-left py-2">Host</th>
      <th className="text-right py-2">Patches</th>
    </tr>
  </thead>
  <tbody className="space-y-1">
    <tr className="bg-surface-container-low hover:bg-surface-container-high transition-colors">
      <td className="text-body-md text-on-surface py-3 px-4">server-01</td>
      <td className="text-body-md text-on-surface text-right py-3 px-4">42</td>
    </tr>
  </tbody>
</table>
```

## Common Patterns

### Card
```jsx
<div className="bg-surface-container-low rounded-xl p-6 space-y-4">
  <h3 className="text-headline-sm text-headline-tight text-on-surface">
    Title
  </h3>
  <p className="text-body-md text-secondary">
    Description
  </p>
</div>
```

### Section with Breathing Room
```jsx
<section className="space-y-12">
  <div>
    <h2 className="text-headline-sm text-headline-tight text-on-surface mb-6">
      Section 1
    </h2>
    {/* Content */}
  </div>
  
  <div>
    <h2 className="text-headline-sm text-headline-tight text-on-surface mb-6">
      Section 2
    </h2>
    {/* Content */}
  </div>
</section>
```

### Modal
```jsx
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
  <div className="bg-surface-container-highest rounded-xl p-8 shadow-ambient max-w-2xl">
    <h2 className="text-headline-sm text-headline-tight text-on-surface mb-6">
      Modal Title
    </h2>
    {/* Content */}
  </div>
</div>
```

## Design Rules

### ✅ Do
- Use `spacing-12` (48px) between unrelated modules
- Use `text-secondary` for non-essential text
- Right-align numerical data in tables
- Use background shifts instead of borders
- Use Material Symbols icons with 300 weight

### ❌ Don't
- Use white (#FFFFFF) - use `text-on-surface` instead
- Use rounded corners larger than `rounded-xl`
- Use dividers between list items - use spacing
- Use drop shadows - use negative elevation
- Use borders for sectioning - use background shifts

## Icon Reference

Common Material Symbols icons:
- `dashboard` - Dashboard/home
- `settings` - Settings/configuration
- `notifications` - Alerts/notifications
- `schedule` - Calendar/scheduling
- `security` - Security/patches
- `storage` - Servers/hosts
- `analytics` - Reports/analytics
- `terminal` - Command line
- `backup` - Backup/restore
- `policy` - Policies/rules
- `group` - Users/teams
- `error` - Errors/issues
- `check_circle` - Success/complete
- `warning` - Warnings/caution

Full icon list: https://fonts.google.com/icons
