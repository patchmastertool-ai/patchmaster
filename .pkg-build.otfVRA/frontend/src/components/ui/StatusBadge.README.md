# StatusBadge Component

A reusable status indicator component that displays color-coded labels following the Stitch design system.

## Overview

The `StatusBadge` component is used throughout PatchMaster to display status information with consistent styling. It supports five status variants (success, warning, error, info, pending) and three size options (sm, md, lg).

## Requirements

**Validates:**
- **Requirement 4.3**: Status badge color variants
- **Requirement 4.8**: Status badge uppercase text with 9px font
- **Requirement 7.6**: Consistent status badge styling

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `status` | `'success' \| 'warning' \| 'error' \| 'info' \| 'pending'` | Yes | - | Status type that determines color scheme |
| `label` | `string` | Yes | - | Text to display in the badge |
| `size` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Size variant |
| `className` | `string` | No | `''` | Additional CSS classes |

## Status Variants

### Success
- **Color**: `#7bd0ff` (primary blue)
- **Background**: `#7bd0ff` at 20% opacity
- **Use Cases**: Active hosts, completed jobs, successful operations

### Warning
- **Color**: `#ffd16f` (yellow/gold)
- **Background**: `#ffd16f` at 20% opacity
- **Use Cases**: Outdated packages, degraded services, medium severity issues

### Error
- **Color**: `#ee7d77` (red)
- **Background**: `#ee7d77` at 20% opacity
- **Use Cases**: Failed jobs, offline hosts, critical vulnerabilities

### Info
- **Color**: `#939eb5` (gray-blue)
- **Background**: `#939eb5` at 20% opacity
- **Use Cases**: Informational messages, neutral status, low severity

### Pending
- **Color**: `#5b74b1` (outline blue)
- **Background**: `#5b74b1` at 20% opacity
- **Use Cases**: In-progress operations, queued jobs, pending actions

## Size Variants

| Size | Font Size | Use Case |
|------|-----------|----------|
| `sm` | 8px | Compact tables, dense layouts |
| `md` | 9px | Default size, most common use |
| `lg` | 10px | Emphasis, headers, important status |

## Base Styling

All badges include the following base styles:
- **Padding**: `6px horizontal, 2px vertical` (`px-1.5 py-0.5`)
- **Border Radius**: `rounded`
- **Font Weight**: `bold` (700)
- **Text Transform**: `uppercase`
- **Letter Spacing**: `tighter` (`tracking-tighter`)
- **Display**: `inline-block`

## Usage Examples

### Basic Usage

```jsx
import { StatusBadge } from './components/ui/StatusBadge';

function HostList() {
  return (
    <div>
      <StatusBadge status="success" label="Online" />
      <StatusBadge status="error" label="Offline" />
    </div>
  );
}
```

### With Size Variants

```jsx
<StatusBadge status="error" label="Critical" size="lg" />
<StatusBadge status="warning" label="Medium" size="md" />
<StatusBadge status="info" label="Low" size="sm" />
```

### In a Table

```jsx
function HostTable({ hosts }) {
  return (
    <table>
      <tbody>
        {hosts.map(host => (
          <tr key={host.id}>
            <td>{host.name}</td>
            <td>
              <StatusBadge 
                status={host.online ? 'success' : 'error'} 
                label={host.online ? 'Online' : 'Offline'} 
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### In a Card Header

```jsx
function JobCard({ job }) {
  const getStatus = () => {
    if (job.status === 'completed') return 'success';
    if (job.status === 'failed') return 'error';
    if (job.status === 'running') return 'pending';
    return 'info';
  };

  return (
    <div className="bg-surface-container-low rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-on-surface">
          {job.name}
        </h3>
        <StatusBadge 
          status={getStatus()} 
          label={job.status} 
        />
      </div>
      <p className="text-sm text-on-surface-variant">
        {job.description}
      </p>
    </div>
  );
}
```

### With Custom Styling

```jsx
<StatusBadge 
  status="success" 
  label="Active" 
  className="ml-2" 
/>
```

## Common Use Cases

### Host Status
```jsx
<StatusBadge status="success" label="Online" />
<StatusBadge status="error" label="Offline" />
<StatusBadge status="warning" label="Degraded" />
<StatusBadge status="pending" label="Rebooting" />
```

### Patch Status
```jsx
<StatusBadge status="success" label="Patched" />
<StatusBadge status="warning" label="Outdated" />
<StatusBadge status="error" label="Vulnerable" />
<StatusBadge status="info" label="Up to Date" />
```

### Job Status
```jsx
<StatusBadge status="success" label="Completed" />
<StatusBadge status="pending" label="Running" />
<StatusBadge status="error" label="Failed" />
<StatusBadge status="info" label="Queued" />
```

### CVE Severity
```jsx
<StatusBadge status="error" label="Critical" size="lg" />
<StatusBadge status="error" label="High" />
<StatusBadge status="warning" label="Medium" />
<StatusBadge status="info" label="Low" />
```

### License Status
```jsx
<StatusBadge status="success" label="Enterprise" />
<StatusBadge status="info" label="Professional" />
<StatusBadge status="warning" label="Trial" />
<StatusBadge status="error" label="Expired" />
```

## Accessibility

The StatusBadge component follows accessibility best practices:

- Uses semantic HTML (`<span>` element)
- Maintains sufficient color contrast ratios
- Text is readable and properly sized
- Works with screen readers (text content is announced)

## Design System Compliance

This component adheres to the Stitch design system:

- ✅ Uses Stitch color palette exclusively
- ✅ Follows typography scale (8px, 9px, 10px)
- ✅ Applies consistent spacing (px-1.5 py-0.5)
- ✅ Uses uppercase text transformation
- ✅ Implements tighter letter spacing

## Testing

The component includes comprehensive unit tests covering:

- Rendering with label text
- All status variants (success, warning, error, info, pending)
- All size variants (sm, md, lg)
- Base styling classes
- Custom className application
- Requirements validation

Run tests with:
```bash
npm test StatusBadge.test.jsx
```

## Related Components

- **StatCard**: Uses StatusBadge for displaying metric status
- **DataTable**: Uses StatusBadge in table cells for row status
- **TopNavBar**: Uses StatusBadge for license status indicator

## Migration Notes

When migrating from CH.jsx components:

1. Replace `<CHBadge>` with `<StatusBadge>`
2. Map old status values to new variants:
   - `active` → `success`
   - `inactive` → `error`
   - `warning` → `warning`
   - `info` → `info`
   - `pending` → `pending`
3. Update color references to use Stitch palette
4. Ensure uppercase text is handled by the component (no need for manual transformation)

## File Location

```
frontend/src/components/ui/StatusBadge.jsx
frontend/src/components/ui/StatusBadge.test.jsx
frontend/src/components/ui/StatusBadge.example.jsx
frontend/src/components/ui/StatusBadge.README.md
```
