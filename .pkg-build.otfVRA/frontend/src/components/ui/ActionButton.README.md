# ActionButton Component

A versatile button component with multiple variants, icon support, loading states, and disabled states. Part of the PatchMaster UI redesign following the Stitch design system.

## Overview

The ActionButton component provides consistent button styling across the application with support for:
- Four visual variants (primary, secondary, tertiary, danger)
- Material Symbols icon integration
- Loading states with spinner animation
- Disabled states
- Keyboard accessibility
- Consistent sizing and transitions

## Props

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `label` | `string` | - | Yes | The button text label |
| `onClick` | `function` | - | Yes | Click handler function |
| `variant` | `'primary' \| 'secondary' \| 'tertiary' \| 'danger'` | `'primary'` | No | Button visual variant |
| `icon` | `string` | - | No | Material Symbol icon name |
| `disabled` | `boolean` | `false` | No | Whether the button is disabled |
| `loading` | `boolean` | `false` | No | Whether the button is in loading state |
| `className` | `string` | `''` | No | Additional CSS classes |

## Variants

### Primary
- **Use case**: Main actions, primary CTAs
- **Style**: Bright cyan background (#7bd0ff) with dark text (#004560)
- **Example**: "Save Changes", "Create Host", "Deploy Patch"

### Secondary
- **Use case**: Secondary actions, alternative options
- **Style**: Subtle background with border, light text (#dee5ff)
- **Example**: "Cancel", "View Details", "Export"

### Tertiary
- **Use case**: Tertiary actions, inline actions
- **Style**: Transparent background with cyan text (#7bd0ff)
- **Example**: "Learn More", "View All", "Filter"

### Danger
- **Use case**: Destructive actions, critical operations
- **Style**: Red background (#ee7d77) with white text
- **Example**: "Delete Host", "Remove User", "Revoke Access"

## States

### Normal
- Full opacity, hover effects enabled
- Cursor changes to pointer on hover
- Brightness increases on hover

### Disabled
- 50% opacity
- Cursor changes to not-allowed
- Click events are prevented
- Hover effects disabled

### Loading
- 50% opacity (same as disabled)
- Cursor changes to not-allowed
- Animated spinner icon replaces regular icon
- Click events are prevented
- `aria-busy` attribute set to true

## Usage Examples

### Basic Button
```jsx
<ActionButton 
  label="Save" 
  onClick={handleSave}
/>
```

### Button with Icon
```jsx
<ActionButton 
  label="Download Report" 
  onClick={handleDownload}
  variant="secondary"
  icon="download"
/>
```

### Danger Button
```jsx
<ActionButton 
  label="Delete Host" 
  onClick={handleDelete}
  variant="danger"
  icon="delete"
/>
```

### Loading State
```jsx
<ActionButton 
  label="Processing..." 
  onClick={handleSubmit}
  loading={isSubmitting}
/>
```

### Disabled State
```jsx
<ActionButton 
  label="Save" 
  onClick={handleSave}
  disabled={!isValid}
/>
```

### Button Group
```jsx
<div className="flex gap-3">
  <ActionButton 
    label="Save" 
    onClick={handleSave}
    variant="primary"
    icon="save"
  />
  <ActionButton 
    label="Cancel" 
    onClick={handleCancel}
    variant="secondary"
  />
</div>
```

## Styling

### Base Styles
- **Padding**: 16px horizontal, 8px vertical (`px-4 py-2`)
- **Font**: 12px bold (`text-xs font-bold`)
- **Border Radius**: 8px (`rounded-lg`)
- **Transition**: All properties, 200ms duration
- **Layout**: Flexbox with 8px gap between icon and text

### Icon Sizing
- Icons are rendered at 16px size
- Loading spinner uses the same 16px size
- Icons are positioned before the label text

### Accessibility
- Proper `aria-disabled` attribute when disabled
- Proper `aria-busy` attribute when loading
- Keyboard navigation support (Enter and Space keys)
- Disabled buttons prevent click events

## Design System Compliance

This component validates the following requirements:

- **Requirement 4.6**: ActionButton component with variants (primary, secondary, tertiary, danger)
- **Requirement 4.9**: Disabled and loading states
- **Requirement 7.5**: Consistent button styling (12px font, 700 weight, proper padding)

## Color Tokens

The component uses the following Stitch color tokens:

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | `#7bd0ff` | `#004560` | - |
| Secondary | `#5b74b1/10` | `#dee5ff` | `#5b74b1/20` |
| Tertiary | `transparent` | `#7bd0ff` | - |
| Danger | `#ee7d77` | `white` | - |

## Icon Support

The component integrates with the Material Symbols Outlined icon system. Common icons include:

- **Actions**: `save`, `edit`, `delete`, `add`, `refresh`
- **Navigation**: `arrow_back`, `arrow_forward`, `close`
- **Status**: `check_circle`, `warning`, `error`, `info`
- **Content**: `download`, `upload`, `search`, `filter_list`

See the Icon component documentation for the complete whitelist.

## Accessibility Features

- **Keyboard Navigation**: Supports Enter and Space key activation
- **ARIA Attributes**: Proper `aria-disabled` and `aria-busy` states
- **Focus Management**: Native button focus behavior
- **Screen Readers**: Button role and label are properly announced

## Best Practices

### Do's
✅ Use primary variant for main actions
✅ Use danger variant for destructive actions
✅ Include icons for better visual recognition
✅ Show loading state during async operations
✅ Disable buttons when actions are not available
✅ Group related buttons together

### Don'ts
❌ Don't use multiple primary buttons in the same context
❌ Don't use danger variant for non-destructive actions
❌ Don't forget to handle loading states for async operations
❌ Don't use buttons for navigation (use links instead)
❌ Don't override core styling that breaks consistency

## Testing

The component includes comprehensive tests covering:
- Rendering with all props
- All four variants
- Disabled state behavior
- Loading state behavior
- Click event handling
- Keyboard navigation
- Icon rendering
- Styling validation
- Requirements validation

Run tests with:
```bash
npm test ActionButton.test.jsx
```

## Related Components

- **Icon**: Material Symbols icon wrapper
- **FormInput**: Text input component
- **FormSelect**: Dropdown select component
- **StatusBadge**: Status indicator component

## Migration Notes

When migrating from CH.jsx buttons:
1. Replace `<CHButton>` with `<ActionButton>`
2. Map `type` prop to `variant` prop
3. Update icon names to Material Symbols equivalents
4. Update color references to use Stitch tokens
5. Test keyboard navigation and accessibility

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support

## Performance

- Lightweight component with minimal re-renders
- CSS transitions for smooth animations
- No external dependencies beyond Icon component
- Optimized for production builds
