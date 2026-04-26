# Icon Mapping: AppIcon to Material Symbols

This document maps the existing `AppIcon` component names to their Material Symbols Outlined equivalents for the PatchMaster UI redesign.

## Overview

The PatchMaster UI is migrating from custom SVG icons (AppIcon) to Material Symbols Outlined. This mapping ensures visual consistency and provides a reference for developers during the migration.

## Icon Configuration

All Material Symbols icons should be rendered with these default settings:
- **Weight**: 400 (regular)
- **Fill**: 0 (outlined style)
- **Grade**: 0 (standard)
- **Optical Size**: 24px (default, can be adjusted per use case)

## Complete Mapping Table

| AppIcon Name | Material Symbol | Notes |
|--------------|-----------------|-------|
| `dashboard` | `dashboard` | Direct match |
| `analytics` | `analytics` | Direct match |
| `reports` | `analytics` | Same as analytics |
| `shield` | `security` | Security/protection concept |
| `server` | `dns` | Server/host representation |
| `layers` | `layers` | Direct match |
| `package` | `inventory_2` | Package/box concept |
| `box` | `inventory_2` | Same as package |
| `window` | `web_asset` | Window/application concept |
| `camera` | `photo_camera` | Direct match |
| `compare` | `compare_arrows` | Comparison concept |
| `cloud-off` | `cloud_off` | Direct match |
| `archive` | `archive` | Direct match |
| `clock` | `schedule` | Time/scheduling concept |
| `bug` | `bug_report` | Bug/issue tracking |
| `timeline` | `timeline` | Direct match |
| `search` | `search` | Direct match |
| `list` | `list` | Direct match |
| `bell` | `notifications` | Notification bell |
| `users` | `group` | User group concept |
| `key` | `vpn_key` | Key/authentication concept |
| `pipeline` | `account_tree` | Pipeline/workflow concept |
| `database` | `storage` | Database/storage concept |
| `sliders` | `tune` | Settings/adjustment concept |
| `settings` | `settings` | Direct match |
| `monitor` | `monitoring` | Direct match |
| `flask` | `science` | Experimental/testing concept |
| `rocket` | `rocket_launch` | Launch/deployment concept |
| `calendar` | `calendar_month` | Direct match |
| `wrench` | `build` | Tools/configuration concept |
| `terminal` | `terminal` | Direct match |
| `refresh` | `refresh` | Direct match |

## Common PatchMaster-Specific Icons

These icons are commonly used throughout PatchMaster and have been mapped to Material Symbols:

| Use Case | Material Symbol | Description |
|----------|-----------------|-------------|
| Hosts/Servers | `dns` | Host management pages |
| Patching | `system_update` | Patch operations |
| CI/CD | `terminal` | CI/CD pipelines |
| CVEs | `security` | CVE tracking |
| Backups | `backup` | Backup management |
| Policies | `policy` | Policy management |
| Monitoring | `monitoring` | Monitoring operations |
| Reports | `analytics` | Analytics and reports |
| Settings | `settings` | Configuration pages |
| Users | `group` | User management |
| Notifications | `notifications` | Alert center |
| Search | `search` | Global search |
| Filter | `filter_list` | Data filtering |
| Refresh | `refresh` | Data refresh |
| Add | `add` | Create new items |
| Edit | `edit` | Edit existing items |
| Delete | `delete` | Remove items |
| Download | `download` | Download files |
| Upload | `upload` | Upload files |
| Success | `check_circle` | Success status |
| Warning | `warning` | Warning status |
| Error | `error` | Error status |
| Info | `info` | Information status |

## Usage Examples

### Basic Usage

```jsx
import { Icon } from './components/Icon';

// Simple icon
<Icon name="dashboard" />

// Icon with custom size
<Icon name="settings" size={20} />

// Icon with custom styling
<Icon name="notifications" size={24} className="text-primary" />

// Icon with accessibility label
<Icon name="search" ariaLabel="Search hosts" />
```

### Migration Example

**Before (AppIcon):**
```jsx
import { AppIcon } from './AppIcons';

<AppIcon name="dashboard" size={18} />
<AppIcon name="users" size={20} />
```

**After (Material Symbols):**
```jsx
import { Icon } from './components/Icon';

<Icon name="dashboard" size={18} />
<Icon name="group" size={20} />
```

### Advanced Usage

```jsx
// Icon with custom weight (bolder)
<Icon name="warning" size={24} weight={600} />

// Icon with fill (filled style instead of outlined)
<Icon name="star" size={24} fill={1} />

// Icon with custom grade (more emphasis)
<Icon name="error" size={24} grade={200} />

// Combining multiple properties
<Icon 
  name="notifications" 
  size={24} 
  weight={500} 
  className="text-primary hover:text-primary-dim transition-colors"
  ariaLabel="View notifications"
/>
```

## Security Notes

The `Icon` component includes built-in security features:

1. **Whitelist Validation**: Only approved icon names can be rendered
2. **Input Sanitization**: Icon names are sanitized to remove special characters
3. **Fallback Handling**: Invalid icons default to `more_horiz` with console warning

If you need to add a new icon to the whitelist, edit the `ICON_WHITELIST` Set in `Icon.jsx`.

## Adding New Icons

To add a new Material Symbol icon:

1. Find the icon name at [Google Fonts Material Symbols](https://fonts.google.com/icons)
2. Add the icon name to the `ICON_WHITELIST` Set in `Icon.jsx`
3. Update this mapping document with the new icon
4. Test the icon renders correctly with default settings

## Migration Checklist

When migrating a page from AppIcon to Material Symbols:

- [ ] Identify all `<AppIcon>` usages in the page
- [ ] Look up Material Symbol equivalents in this mapping table
- [ ] Replace `<AppIcon name="X">` with `<Icon name="Y">`
- [ ] Adjust size if needed (AppIcon default was 18px, Material Symbols default is 24px)
- [ ] Test icon rendering and visual consistency
- [ ] Verify accessibility (aria-label for interactive icons)
- [ ] Remove AppIcon import if no longer used

## Resources

- [Material Symbols Documentation](https://fonts.google.com/icons)
- [Material Symbols Guidelines](https://m3.material.io/styles/icons/overview)
- [Icon Component Source](./Icon.jsx)
- [Design System Documentation](../../../.kiro/specs/patchmaster-ui-redesign/design.md)

## Notes

- Material Symbols provides over 2,500 icons, so most use cases are covered
- The outlined style (fill=0) is used for consistency with the design system
- Icon sizes should be 16px, 20px, or 24px for optimal rendering
- Always use the `Icon` component wrapper instead of direct Material Symbols classes for security and consistency
