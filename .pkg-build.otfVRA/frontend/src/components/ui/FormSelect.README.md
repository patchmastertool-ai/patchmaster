# FormSelect Component

A styled dropdown select component with label, validation, and error handling following the Stitch design system.

## Features

- Consistent styling with Stitch color palette
- Support for standard options and optgroup (grouped options)
- Required field indicator
- Error message display
- Accessible with ARIA attributes
- Keyboard navigation support
- Focus states with ring effect

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | Yes | - | The label text for the select field |
| `value` | `string` | Yes | - | The current selected value |
| `onChange` | `function` | Yes | - | Callback function when value changes, receives new value as parameter |
| `options` | `Array<{value: string, label: string, group?: string}>` | Yes | `[]` | Array of option objects. Include `group` property for optgroup support |
| `error` | `string` | No | `''` | Error message to display below the select |
| `required` | `boolean` | No | `false` | Whether the field is required (shows asterisk) |
| `className` | `string` | No | `''` | Additional CSS classes for the container |

## Usage

### Basic Select

```jsx
import { FormSelect } from './components/ui/FormSelect';

function MyComponent() {
  const [os, setOs] = React.useState('');
  
  const options = [
    { value: 'ubuntu', label: 'Ubuntu' },
    { value: 'centos', label: 'CentOS' },
    { value: 'debian', label: 'Debian' }
  ];
  
  return (
    <FormSelect 
      label="Operating System" 
      value={os} 
      onChange={setOs}
      options={options}
    />
  );
}
```

### Grouped Options (optgroup)

```jsx
const packageManagers = [
  { value: 'apt', label: 'APT', group: 'Debian-based' },
  { value: 'dpkg', label: 'DPKG', group: 'Debian-based' },
  { value: 'yum', label: 'YUM', group: 'RedHat-based' },
  { value: 'dnf', label: 'DNF', group: 'RedHat-based' }
];

<FormSelect 
  label="Package Manager" 
  value={pm} 
  onChange={setPm}
  options={packageManagers}
/>
```

### Required Field

```jsx
<FormSelect 
  label="Priority Level" 
  value={priority} 
  onChange={setPriority}
  options={priorityOptions}
  required
/>
```

### With Error Message

```jsx
<FormSelect 
  label="Operating System" 
  value={os} 
  onChange={setOs}
  options={osOptions}
  error="Please select an operating system"
  required
/>
```

### With Validation

```jsx
function MyForm() {
  const [os, setOs] = React.useState('');
  
  const validateRequired = (value) => {
    return value ? '' : 'This field is required';
  };
  
  return (
    <FormSelect 
      label="Operating System" 
      value={os} 
      onChange={setOs}
      options={osOptions}
      error={validateRequired(os)}
      required
    />
  );
}
```

## Styling

The component uses the following Stitch design system colors:

- **Label**: `#91aaeb` (on-surface-variant)
- **Select Background**: `#05183c` (surface-container)
- **Select Text**: `#dee5ff` (on-surface)
- **Border**: `#2b4680/20` (outline-variant with opacity)
- **Focus Ring**: `#7bd0ff` (primary)
- **Error Text**: `#ee7d77` (error)
- **Required Indicator**: `#ee7d77` (error)

### Label Styling

```
text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2
```

### Select Styling

```
w-full bg-[#05183c] border border-[#2b4680]/20 rounded-lg py-2 px-4 
text-sm text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] 
focus:border-[#7bd0ff] focus:outline-none transition-colors
```

### Option Styling

```
bg-[#05183c] text-[#dee5ff]
```

### Error Message Styling

```
text-[#ee7d77] text-xs mt-1
```

## Accessibility

The component follows accessibility best practices:

- Uses semantic `<label>` and `<select>` elements
- Links label to select with `htmlFor` and `id` attributes
- Sets `aria-invalid` when error is present
- Links error message with `aria-describedby`
- Supports keyboard navigation (arrow keys, Enter, Escape)
- Required fields indicated visually and semantically

## Examples

See `FormSelect.example.jsx` for comprehensive examples including:

- Basic select dropdowns
- Grouped options with optgroup
- Required fields
- Error states
- Host configuration form
- Patch policy configuration
- Backup configuration
- Live validation
- Complete multi-select forms
- Custom styling
- Edge cases (empty options)

## Testing

The component includes comprehensive tests in `FormSelect.test.jsx`:

- Rendering with various props
- Grouped options (optgroup)
- Error handling and validation
- User interaction (onChange events)
- Styling verification
- Edge cases
- Requirements validation (4.5, 7.4)

Run tests with:

```bash
npm test FormSelect.test.jsx
```

## Requirements

**Validates: Requirements 4.5, 7.4**

- **Requirement 4.5**: FormSelect component with validation support
- **Requirement 7.4**: Consistent form component styling across the application

## Browser Support

The component works in all modern browsers that support:
- CSS custom properties
- Flexbox
- ES6+ JavaScript
- React 16.8+ (Hooks)

## Notes

- The `onChange` callback receives the new value directly (not the event object)
- Options with a `group` property will be rendered inside `<optgroup>` elements
- Options without a `group` property will be rendered as standard `<option>` elements
- When mixing grouped and ungrouped options, ungrouped options appear first
- Empty options array is supported (renders empty select)
- The component generates unique IDs based on the label for accessibility
