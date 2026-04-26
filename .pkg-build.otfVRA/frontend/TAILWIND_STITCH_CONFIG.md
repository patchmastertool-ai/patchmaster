# Tailwind CSS Configuration - Stitch Design System

## Overview

This document describes the Tailwind CSS configuration for the PatchMaster UI redesign, implementing the **Command Horizon** design system from the Stitch design library.

## Design Philosophy

The configuration follows the "Silent Sentinel" creative direction:
- **Editorial Technical** aesthetic with deep tonal layering
- **No-Line Rule**: Boundaries defined through background shifts, not borders
- **Glass & Gradient**: 15% opacity gradients for visual depth
- **Extreme White Space**: 48px+ breathing room between sections
- **Precision Typography**: Inter font with tight letter-spacing for authority

## Color System

### Surface Hierarchy (Physical Layers of Deep-Tinted Glass)

```
Level 0 (Base):        background              #060e20  (The void)
Level 1 (Navigation):  surface-container-low   #06122d  (Sidebars)
Level 2 (Workspace):   surface-container       #05183c  (Main content)
Level 3 (Interactive): surface-container-highest #00225a (Cards/modals)
```

### Complete Color Palette

#### Background Colors
- `background`: #060e20 - Overall canvas
- `surface`: #060e20 - Base surface
- `surface-container-lowest`: #000000 - Negative elevation
- `surface-container-low`: #06122d - Primary work areas
- `surface-container`: #05183c - Main content area
- `surface-container-high`: #031d4b - Active widgets
- `surface-container-highest`: #00225a - Lifted elements
- `surface-dim`: #060e20 - Dimmed surface
- `surface-bright`: #002867 - Bright surface
- `surface-variant`: #00225a - Surface variant

#### Primary Colors (Blue)
- `primary`: #7bd0ff - Main brand color
- `primary-dim`: #47c4ff - Dimmed primary
- `primary-container`: #004c69 - Success badge background
- `on-primary`: #004560 - Text on primary
- `on-primary-container`: #97d8ff - Text on primary container

#### Secondary Colors (Gray-Blue)
- `secondary`: #939eb5 - Non-essential text
- `secondary-container`: #313c4f - Secondary container
- `on-secondary`: #152032 - Text on secondary
- `on-secondary-container`: #b4c0d7 - Text on secondary container

#### Tertiary Colors (Yellow/Gold)
- `tertiary`: #ffd16f - Warning color
- `tertiary-container`: #fcc025 - Warning container
- `on-tertiary`: #614700 - Text on tertiary

#### Error Colors (Red)
- `error`: #ee7d77 - Error state
- `error-container`: #7f2927 - Error badge background
- `on-error-container`: #ff9993 - Text on error container

#### Text Colors
- `on-surface`: #dee5ff - Primary text (brightest allowed)
- `on-surface-variant`: #91aaeb - Context labels
- `on-background`: #dee5ff - Text on background

#### Border Colors
- `outline`: #5b74b1 - Standard outline
- `outline-variant`: #2b4680 - Ghost border (use at 15% opacity)

## Typography System

### Editorial Scale (Inter Font)

#### Display Sizes (Critical Metrics)
- `text-display-lg`: 56px, line-height 1.1, letter-spacing -0.02em
- `text-display-md`: 48px, line-height 1.1, letter-spacing -0.02em
- `text-display-sm`: 40px, line-height 1.1, letter-spacing -0.02em

**Usage**: System-critical metrics like "99.9% Uptime"

#### Headline Sizes (Section Titles)
- `text-headline-lg`: 40px, line-height 1.2, letter-spacing -0.02em
- `text-headline-md`: 32px, line-height 1.2, letter-spacing -0.02em
- `text-headline-sm`: 24px, line-height 1.3, letter-spacing -0.02em

**Usage**: Primary section titles with tight letter-spacing for authority

#### Body Sizes (Content)
- `text-body-lg`: 16px, line-height 1.5
- `text-body-md`: 14px, line-height 1.5
- `text-body-sm`: 13px, line-height 1.5

**Usage**: Table cell data, paragraph text

#### Label Sizes (Status Indicators)
- `text-label-md`: 13px, line-height 1.4, letter-spacing 0.05em
- `text-label-sm`: 11px, line-height 1.4, letter-spacing 0.05em

**Usage**: All uppercase status indicators and table headers

### Typography Utilities

- `.text-label-uppercase`: Uppercase with 0.05em letter-spacing
- `.text-headline-tight`: Tight letter-spacing (-0.02em) for headlines

## Spacing Scale

Follows the Stitch design system with emphasis on breathing room:

```
spacing-4:  16px - Minimum vertical spacing for list items
spacing-6:  24px - Standard component spacing
spacing-8:  32px - Section spacing
spacing-12: 48px - Standard breathing room between unrelated modules
spacing-16: 64px - Large section breaks
spacing-20: 80px - Extra large spacing
```

**Rule**: Use `spacing-12` (48px) or larger between unrelated modules.

## Border Radius

Sharp and engineered feel:

- `rounded`: 0.125rem (2px) - Default
- `rounded-lg`: 0.25rem (4px) - Standard
- `rounded-xl`: 0.5rem (8px) - Maximum for cards
- `rounded-full`: 0.75rem (12px) - Pills/badges

**Rule**: Never use rounded corners larger than `xl` (0.75rem).

## Shadows

### Ambient Shadows (Floating Modals)
- `shadow-ambient`: 40px blur, 0% spread, rgba(0, 0, 0, 0.5)
- `shadow-ambient-lg`: 60px blur, 0% spread, rgba(0, 0, 0, 0.6)

**Usage**: Mimics natural light falloff in a dark server room

### Glow Effects (Status Indicators)
- `shadow-glow-warning`: 2px blur for tertiary/warning badges
- `shadow-glow-primary`: 4px blur for primary highlights

## Custom Utilities

### Glass Morphism
```jsx
<div className="glass-morphism">
  // 80% opacity background with 20px blur
</div>
```

### Glass Gradients
```jsx
<div className="glass-gradient">
  // 15% opacity primary gradient (top-left to transparent)
</div>

<div className="glass-gradient-secondary">
  // 15% opacity secondary gradient
</div>

<div className="glass-gradient-tertiary">
  // 15% opacity tertiary gradient
</div>
```

### Ghost Borders
```jsx
<div className="ghost-border">
  // 15% opacity outline-variant border
</div>

<div className="ghost-border-full">
  // 100% opacity outline-variant border (focus state)
</div>
```

### Status Badges
```jsx
<span className="badge-success">Active</span>
<span className="badge-warning">Pending</span>
<span className="badge-error">Failed</span>
```

### Widget Accent Lines
```jsx
<div className="widget-accent-success">
  // 2px top border in success color
</div>

<div className="widget-accent-warning">
  // 2px top border in warning color
</div>

<div className="widget-accent-error">
  // 2px top border in error color
</div>
```

### Material Symbols Icons
```jsx
<span className="material-symbols">dashboard</span>
<span className="material-symbols">settings</span>
```

**Rule**: All icons must use Material Symbols with thin stroke (300 weight).

## Component Patterns

### Data Tables
```jsx
<table className="w-full">
  <thead>
    <tr className="text-label-sm text-label-uppercase text-on-surface-variant">
      <th className="text-left py-2">Host</th>
      <th className="text-right py-2">Patches</th>
    </tr>
  </thead>
  <tbody className="space-y-1">
    <tr className="bg-surface-container-low hover:bg-surface-container-high">
      <td className="text-body-md text-on-surface py-3">server-01</td>
      <td className="text-body-md text-on-surface text-right py-3">42</td>
    </tr>
  </tbody>
</table>
```

**Rules**:
- No dividers between rows (use 4px vertical gap)
- Label-SM for headers (uppercase)
- Body-MD for cell data
- Right-align numerical data

### Dashboard Widgets
```jsx
<div className="bg-surface-container-low widget-accent-success p-6">
  <div className="text-label-md text-label-uppercase text-on-surface-variant mb-2">
    System Health
  </div>
  <div className="text-display-lg text-on-surface">
    99.9%
  </div>
</div>
```

**Rules**:
- No visible borders
- 2px top accent line in status color
- Label above metric for context

### Buttons
```jsx
// Primary
<button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-medium">
  Apply Patches
</button>

// Secondary
<button className="border border-outline/40 text-on-surface px-6 py-3 rounded-lg hover:bg-surface-bright">
  Cancel
</button>

// Tertiary
<button className="text-on-surface text-label-md hover:text-primary">
  Learn More
</button>
```

### Input Fields
```jsx
<input
  className="bg-surface-container-highest text-on-surface px-4 py-3 rounded-lg ghost-border focus:ghost-border-full focus:shadow-glow-primary"
  type="text"
/>
```

**Rules**:
- Unfocused: `surface-container-highest` background
- Focus: Ghost border transitions to 100% opacity with subtle glow

## Material Symbols Integration

The Material Symbols icon font is loaded via Google Fonts CDN in `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
```

### Icon Usage
```jsx
<span className="material-symbols">dashboard</span>
<span className="material-symbols">settings</span>
<span className="material-symbols">notifications</span>
```

### Icon Styling
- Font weight: 300 (thin stroke to match Inter precision)
- Font size: 20px default
- Use with text color utilities: `text-on-surface`, `text-primary`, etc.

## Design Rules

### Do:
✅ Use extreme white space (48px+) between unrelated modules
✅ Use `secondary` color for non-essential text
✅ Favor asymmetric layouts
✅ Use background shifts instead of borders
✅ Right-align numerical data in tables

### Don't:
❌ Use 100% white (#FFFFFF) - brightest is `on-surface` (#dee5ff)
❌ Use rounded corners larger than `xl` (0.75rem)
❌ Use dividers or horizontal lines between list items
❌ Use drop-shadow effects (use negative elevation instead)
❌ Use generic icons (Material Symbols only)

## Requirements Validation

This configuration satisfies:
- **Requirement 3.1**: Tailwind CSS for all styling
- **Requirement 10.2**: Tailwind CSS exclusive usage
- **Requirement 10.3**: Material Symbols icon system integration

## References

- Design System: `stitch/patchmaster_pro/DESIGN.md`
- Requirements: `.kiro/specs/patchmaster-ui-redesign/requirements.md`
- Design Document: `.kiro/specs/patchmaster-ui-redesign/design.md`
