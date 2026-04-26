# StatCard Component

A Bento Grid card component for displaying key metrics with icons, values, and optional trend information. Part of the PatchMaster UI Redesign using the Stitch design system.

## Overview

The StatCard component displays metrics in a visually appealing card format with:
- Color-coded top border based on variant
- Material Symbols icon
- Uppercase label
- Large, bold value display
- Optional trend information
- Glass-morphism overlay effect
- Hover transitions
- Optional click interaction for drill-down

## Usage

### Basic Example

```jsx
import { StatCard } from './components/ui/StatCard';

function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard
        label="Total Hosts"
        value="1,248"
        icon="dns"
        variant="primary"
      />
    </div>
  );
}
```

### With Trend Information

```jsx
<StatCard
  label="Total Hosts"
  value="1,248"
  icon="dns"
  trend={{ value: "+12", label: "since yesterday" }}
  variant="primary"
/>
```

### With Click Handler

```jsx
<StatCard
  label="Failed Jobs"
  value="3"
  icon="warning"
  trend={{ value: "Critical", label: "response required" }}
  variant="error"
  onClick={() => navigate('/jobs?status=failed')}
/>
```

### All Variants

```jsx
// Primary variant (blue)
<StatCard
  label="Online Hosts"
  value="1,242"
  icon="dns"
  variant="primary"
/>

// Error variant (red)
<StatCard
  label="Failed Jobs"
  value="3"
  icon="warning"
  variant="error"
/>

// Warning variant (yellow/gold)
<StatCard
  label="Pending Updates"
  value="156"
  icon="system_update"
  variant="warning"
/>

// Success variant (blue, same as primary)
<StatCard
  label="Completed"
  value="99"
  icon="check_circle"
  variant="success"
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | Yes | - | The metric label (displayed in uppercase) |
| `value` | `string \| number` | Yes | - | The metric value (displayed prominently) |
| `icon` | `string` | Yes | - | Material Symbol icon name (e.g., "dns", "warning") |
| `trend` | `object` | No | - | Optional trend information |
| `trend.value` | `string` | No | - | Trend value (e.g., "+12", "99.5%", "Critical") |
| `trend.label` | `string` | No | - | Trend label (e.g., "since yesterday", "availability") |
| `variant` | `string` | No | `'primary'` | Color variant: `'primary'`, `'error'`, `'warning'`, `'success'` |
| `onClick` | `function` | No | - | Optional click handler for drill-down navigation |
| `className` | `string` | No | `''` | Additional CSS classes |

## Styling

### Base Classes

The component uses the following Tailwind classes:
- `group relative overflow-hidden` - Container positioning
- `bg-surface-container-low` - Background color
- `p-6` - Padding (24px)
- `rounded-xl` - Border radius (12px)
- `transition-all duration-300` - Smooth transitions
- `hover:bg-surface-container` - Hover state background
- `border-t-2` - Top border width

### Variant Border Colors

- **primary/success**: `border-primary` (#7bd0ff - cyan blue)
- **error**: `border-error` (#ee7d77 - red)
- **warning**: `border-tertiary` (#ffd16f - yellow/gold)

### Label Styling

- `text-on-surface-variant` - Color (#91aaeb)
- `uppercase` - Text transform
- `tracking-widest` - Letter spacing
- `text-[10px]` - Font size
- `font-bold` - Font weight

### Value Styling

- `text-4xl` - Font size (40px)
- `font-extrabold` - Font weight (800)
- `tracking-tighter` - Letter spacing
- `text-on-surface` - Color (#dee5ff)

### Trend Styling

- `text-xs` - Font size (12px)
- `text-on-surface-variant/80` - Color with opacity
- Trend value uses variant color with `font-bold`

## Accessibility

The component includes accessibility features:

- **Keyboard Navigation**: When `onClick` is provided, the card is keyboard accessible with `tabIndex={0}`
- **Semantic Roles**: Cards with `onClick` have `role="button"`
- **Keyboard Events**: Supports Enter and Space key activation
- **Focus States**: Inherits Tailwind focus utilities

## Design System Integration

This component follows the Stitch design system:

- **Colors**: Uses Stitch color tokens (primary, error, tertiary, surface variants)
- **Typography**: Uses Inter font family with defined scale
- **Icons**: Uses Material Symbols Outlined (weight 400, fill 0)
- **Spacing**: Follows 8px grid system
- **Effects**: Includes glass-morphism gradient overlay

## Examples from Reference Design

Based on `stitch_dashboard_raw.html`:

```jsx
// Total Hosts Card
<StatCard
  label="Total Hosts"
  value="1,248"
  icon="dns"
  trend={{ value: "+12", label: "since yesterday" }}
  variant="primary"
/>

// Online Hosts Card
<StatCard
  label="Online"
  value="1,242"
  icon="sensors"
  trend={{ value: "99.5%", label: "availability" }}
  variant="primary"
/>

// Failed Jobs Card
<StatCard
  label="Failed Jobs"
  value="3"
  icon="warning"
  trend={{ value: "Critical", label: "response required" }}
  variant="error"
/>

// Pending Updates Card
<StatCard
  label="Pending Updates"
  value="156"
  icon="system_update_alt"
  trend={{ value: "24", label: "security patches" }}
  variant="warning"
/>
```

## Testing

The component includes comprehensive unit tests covering:

- Basic rendering with required props
- All variant border colors
- Trend display logic
- Click handler invocation
- Keyboard accessibility (Enter/Space keys)
- Label, value, and icon styling
- Glass gradient overlay effect
- Custom className application

Run tests with:
```bash
npm test -- StatCard.test.jsx --run
```

## Requirements Validation

This component validates the following requirements from the spec:

- **Requirement 4.1**: Provides StatCard component for displaying metrics
- **Requirement 4.7**: Applies border-top color based on variant
- **Requirement 7.4**: Uses consistent padding (24px), border radius (12px), and border-top width (2px)

## Related Components

- **Icon**: Material Symbols wrapper used for icon rendering
- **SideNavBar**: Layout component that may contain navigation to stat details
- **TopNavBar**: Layout component for page header
- **MainContent**: Layout wrapper for page content including stat cards

## Notes

- The glass-gradient effect requires custom CSS defined in `frontend/src/styles/custom.css`
- Icon names must be in the Icon component whitelist
- Numeric values can be passed as strings or numbers
- The component is fully responsive and works in grid layouts
