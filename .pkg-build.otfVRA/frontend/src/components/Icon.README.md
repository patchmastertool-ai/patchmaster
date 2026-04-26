# Icon Component

A secure, validated wrapper component for Material Symbols Outlined icons in the PatchMaster UI redesign.

## Overview

The `Icon` component provides a consistent interface for rendering Material Symbols icons with built-in security features, validation, and styling controls. It replaces the legacy `AppIcon` component as part of the Tailwind CSS migration.

## Features

- ✅ **Security**: Whitelist-based validation prevents icon injection attacks
- ✅ **Consistency**: Enforces Material Symbols Outlined style (weight 400, fill 0, grade 0)
- ✅ **Flexibility**: Supports custom sizes, weights, fills, and grades
- ✅ **Accessibility**: Built-in ARIA label support
- ✅ **Performance**: Uses font-display: swap for optimal loading
- ✅ **Developer Experience**: TypeScript-style JSDoc annotations and helpful warnings

## Installation

The Material Symbols Outlined font is loaded via Google Fonts CDN in `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
```

## Basic Usage

```jsx
import { Icon } from './components/Icon';

function MyComponent() {
  return (
    <div>
      {/* Simple icon */}
      <Icon name="dashboard" />
      
      {/* Icon with custom size */}
      <Icon name="settings" size={20} />
      
      {/* Icon with Tailwind classes */}
      <Icon name="notifications" className="text-primary hover:text-primary-dim" />
      
      {/* Icon with accessibility label */}
      <Icon name="search" ariaLabel="Search hosts" />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | *required* | Material Symbol icon name (validated against whitelist) |
| `size` | `number` | `24` | Icon size in pixels (also sets optical size) |
| `weight` | `number` | `400` | Icon weight (100-700) |
| `fill` | `number` | `0` | Icon fill (0 for outlined, 1 for filled) |
| `grade` | `number` | `0` | Icon grade (-50 to 200) |
| `className` | `string` | `''` | Additional CSS classes |
| `style` | `object` | `{}` | Additional inline styles |
| `ariaLabel` | `string` | `undefined` | Accessible label for screen readers |

## Advanced Usage

### Custom Styling

```jsx
// Using Tailwind classes
<Icon 
  name="warning" 
  size={24} 
  className="text-error hover:text-error-dim transition-colors duration-200"
/>

// Using inline styles
<Icon 
  name="success" 
  size={20} 
  style={{ color: '#10b981', marginRight: '8px' }}
/>
```

### Icon Variations

```jsx
// Bolder icon
<Icon name="dashboard" weight={600} />

// Filled icon (instead of outlined)
<Icon name="star" fill={1} />

// High emphasis icon
<Icon name="error" grade={200} />

// Combining multiple properties
<Icon 
  name="notifications" 
  size={24} 
  weight={500} 
  grade={100}
  className="text-primary"
/>
```

### Accessibility

```jsx
// Interactive icon with label
<button onClick={handleSearch}>
  <Icon name="search" ariaLabel="Search hosts" />
</button>

// Decorative icon (aria-hidden automatically set)
<div>
  <Icon name="info" />
  <span>Information message</span>
</div>
```

## Helper Functions

### `isValidIcon(name)`

Check if an icon name is in the whitelist:

```jsx
import { isValidIcon } from './components/Icon';

if (isValidIcon('dashboard')) {
  // Icon is valid
}
```

### `getValidIconNames()`

Get all valid icon names (useful for documentation or icon pickers):

```jsx
import { getValidIconNames } from './components/Icon';

const allIcons = getValidIconNames();
console.log(allIcons); // ['add', 'analytics', 'arrow_back', ...]
```

## Security

The Icon component includes multiple security layers:

1. **Whitelist Validation**: Only approved icon names can be rendered
2. **Input Sanitization**: Icon names are sanitized to remove special characters
3. **Fallback Handling**: Invalid icons default to `more_horiz` with console warning

### Adding New Icons

To add a new icon to the whitelist:

1. Find the icon at [Google Fonts Material Symbols](https://fonts.google.com/icons)
2. Edit `frontend/src/components/Icon.jsx`
3. Add the icon name to the `ICON_WHITELIST` Set:

```javascript
const ICON_WHITELIST = new Set([
  // ... existing icons
  'your_new_icon',
]);
```

4. Update the icon mapping documentation
5. Test the icon renders correctly

## Migration from AppIcon

### Before (AppIcon)

```jsx
import { AppIcon } from './AppIcons';

<AppIcon name="dashboard" size={18} />
<AppIcon name="users" size={20} />
<AppIcon name="bell" size={18} />
```

### After (Material Symbols)

```jsx
import { Icon } from './components/Icon';

<Icon name="dashboard" size={18} />
<Icon name="group" size={20} />
<Icon name="notifications" size={18} />
```

See [ICON_MAPPING.md](./ICON_MAPPING.md) for complete AppIcon → Material Symbols mapping.

## Common PatchMaster Icons

| Use Case | Icon Name | Example |
|----------|-----------|---------|
| Dashboard | `dashboard` | `<Icon name="dashboard" />` |
| Hosts | `dns` | `<Icon name="dns" />` |
| Patching | `system_update` | `<Icon name="system_update" />` |
| CI/CD | `terminal` | `<Icon name="terminal" />` |
| CVEs | `security` | `<Icon name="security" />` |
| Backups | `backup` | `<Icon name="backup" />` |
| Policies | `policy` | `<Icon name="policy" />` |
| Monitoring | `monitoring` | `<Icon name="monitoring" />` |
| Reports | `analytics` | `<Icon name="analytics" />` |
| Settings | `settings` | `<Icon name="settings" />` |
| Users | `group` | `<Icon name="group" />` |
| Notifications | `notifications` | `<Icon name="notifications" />` |

## Testing

Run the Icon component tests:

```bash
npm test -- Icon.test.jsx --run
```

Visual testing with IconDemo component:

```jsx
import { IconDemo } from './components/IconDemo';

// Render in your app or Storybook
<IconDemo />
```

## Performance

- **Font Loading**: Uses `font-display: swap` for optimal loading performance
- **Bundle Size**: Material Symbols font is ~50KB (woff2), loaded from CDN
- **Rendering**: CSS-based rendering is faster than SVG icons
- **Caching**: Font is cached by browser after first load

## Browser Support

Material Symbols Outlined is supported in all modern browsers:
- Chrome/Edge 88+
- Firefox 89+
- Safari 14.1+

Variable font features (weight, fill, grade) require:
- Chrome/Edge 88+
- Firefox 62+
- Safari 11+

## Resources

- [Material Symbols Documentation](https://fonts.google.com/icons)
- [Material Design Icon Guidelines](https://m3.material.io/styles/icons/overview)
- [Icon Mapping Document](./ICON_MAPPING.md)
- [Design System Spec](../../../.kiro/specs/patchmaster-ui-redesign/design.md)

## Troubleshooting

### Icon not rendering

1. Check if icon name is in whitelist: `isValidIcon('your_icon')`
2. Check browser console for warnings
3. Verify Material Symbols font is loaded (check Network tab)
4. Ensure icon name matches Material Symbols exactly (use underscore, not dash)

### Icon looks different than expected

1. Verify default settings: weight=400, fill=0, grade=0, size=24
2. Check if custom styles are overriding font properties
3. Ensure font-variation-settings is not being overridden by CSS

### Console warnings

- **"Icon not in whitelist"**: Add the icon to `ICON_WHITELIST` in `Icon.jsx`
- **"Invalid icon name"**: Check icon name spelling and format
- **Font loading errors**: Check network connection and CDN availability

## License

Material Symbols is licensed under Apache License 2.0.
