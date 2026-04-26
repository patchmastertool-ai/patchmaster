# FormInput Component

A reusable text input component with label, validation, and error handling following the Stitch design system.

## Overview

The `FormInput` component provides a styled text input field with consistent styling across PatchMaster. It supports various input types (text, email, password, number), displays validation errors, and includes a required field indicator.

## Requirements

**Validates:**
- **Requirement 4.5**: FormInput component with validation
- **Requirement 7.4**: Consistent form input styling

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | Yes | - | Label text displayed above the input |
| `value` | `string` | Yes | - | Current value of the input field |
| `onChange` | `function` | Yes | - | Callback function called when value changes, receives new value as string |
| `placeholder` | `string` | No | `''` | Placeholder text shown when input is empty |
| `error` | `string` | No | `''` | Error message displayed below the input |
| `required` | `boolean` | No | `false` | Whether the field is required (shows red asterisk) |
| `type` | `'text' \| 'email' \| 'password' \| 'number'` | No | `'text'` | HTML input type |
| `className` | `string` | No | `''` | Additional CSS classes for the container |

## Styling Details

### Label Styling
- **Font Size**: 10px (`text-[10px]`)
- **Text Transform**: Uppercase
- **Letter Spacing**: Widest (`tracking-widest`)
- **Font Weight**: Bold (700)
- **Color**: `#91aaeb` (on-surface-variant)
- **Margin Bottom**: 8px (`mb-2`)

### Input Styling
- **Width**: Full width (`w-full`)
- **Background**: `#05183c` (surface-container)
- **Border**: 1px solid `#2b4680` at 20% opacity
- **Border Radius**: 8px (`rounded-lg`)
- **Padding**: 8px vertical, 16px horizontal (`py-2 px-4`)
- **Font Size**: 14px (`text-sm`)
- **Text Color**: `#dee5ff` (on-surface)
- **Focus Ring**: 1px `#7bd0ff` (primary)
- **Focus Border**: `#7bd0ff` (primary)
- **Transition**: Color transitions on focus

### Placeholder Styling
- **Color**: `#91aaeb` at 50% opacity (`placeholder:text-[#91aaeb]/50`)

### Error Message Styling
- **Color**: `#ee7d77` (error)
- **Font Size**: 12px (`text-xs`)
- **Margin Top**: 4px (`mt-1`)

### Required Indicator
- **Color**: `#ee7d77` (error)
- **Symbol**: Red asterisk (*)
- **Position**: After label text

## Usage Examples

### Basic Text Input

```jsx
import { FormInput } from './components/ui/FormInput';

function UserForm() {
  const [name, setName] = React.useState('');

  return (
    <FormInput 
      label="Full Name" 
      value={name} 
      onChange={setName}
      placeholder="Enter your full name"
    />
  );
}
```

### Email Input with Validation

```jsx
function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [emailError, setEmailError] = React.useState('');

  const validateEmail = (value) => {
    if (!value.includes('@')) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  return (
    <FormInput 
      label="Email Address" 
      value={email} 
      onChange={(value) => {
        setEmail(value);
        validateEmail(value);
      }}
      type="email"
      placeholder="user@example.com"
      error={emailError}
      required
    />
  );
}
```

### Password Input

```jsx
function PasswordField() {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const validatePassword = (value) => {
    if (value.length < 8) {
      setError('Password must be at least 8 characters');
    } else {
      setError('');
    }
  };

  return (
    <FormInput 
      label="Password" 
      value={password} 
      onChange={(value) => {
        setPassword(value);
        validatePassword(value);
      }}
      type="password"
      placeholder="Enter password"
      error={error}
      required
    />
  );
}
```

### Number Input

```jsx
function PortConfiguration() {
  const [port, setPort] = React.useState('');
  const [error, setError] = React.useState('');

  const validatePort = (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 65535) {
      setError('Port must be between 1 and 65535');
    } else {
      setError('');
    }
  };

  return (
    <FormInput 
      label="Port Number" 
      value={port} 
      onChange={(value) => {
        setPort(value);
        validatePort(value);
      }}
      type="number"
      placeholder="8080"
      error={error}
      required
    />
  );
}
```

### Form with Multiple Inputs

```jsx
function HostRegistrationForm() {
  const [hostname, setHostname] = React.useState('');
  const [ipAddress, setIpAddress] = React.useState('');
  const [sshPort, setSshPort] = React.useState('22');
  const [errors, setErrors] = React.useState({});

  return (
    <div className="space-y-4">
      <FormInput 
        label="Hostname" 
        value={hostname} 
        onChange={setHostname}
        placeholder="server-01"
        error={errors.hostname}
        required
      />
      
      <FormInput 
        label="IP Address" 
        value={ipAddress} 
        onChange={setIpAddress}
        placeholder="192.168.1.100"
        error={errors.ipAddress}
        required
      />
      
      <FormInput 
        label="SSH Port" 
        value={sshPort} 
        onChange={setSshPort}
        type="number"
        placeholder="22"
        error={errors.sshPort}
      />
    </div>
  );
}
```

### With Custom Container Styling

```jsx
<FormInput 
  label="Username" 
  value={username} 
  onChange={setUsername}
  className="mb-6"
/>
```

## Common Use Cases

### User Authentication
```jsx
<FormInput label="Username" value={username} onChange={setUsername} required />
<FormInput label="Password" value={password} onChange={setPassword} type="password" required />
```

### Host Configuration
```jsx
<FormInput label="Hostname" value={hostname} onChange={setHostname} required />
<FormInput label="IP Address" value={ip} onChange={setIp} required />
<FormInput label="SSH Port" value={port} onChange={setPort} type="number" />
```

### User Profile
```jsx
<FormInput label="Full Name" value={name} onChange={setName} required />
<FormInput label="Email" value={email} onChange={setEmail} type="email" required />
```

### Policy Configuration
```jsx
<FormInput label="Policy Name" value={policyName} onChange={setPolicyName} required />
<FormInput label="Description" value={description} onChange={setDescription} />
```

### LDAP Settings
```jsx
<FormInput label="LDAP Server" value={server} onChange={setServer} placeholder="ldap.example.com" required />
<FormInput label="Port" value={port} onChange={setPort} type="number" placeholder="389" />
<FormInput label="Bind DN" value={bindDn} onChange={setBindDn} required />
<FormInput label="Bind Password" value={bindPassword} onChange={setBindPassword} type="password" required />
```

## Validation Patterns

### Email Validation
```jsx
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? '' : 'Invalid email format';
};
```

### Required Field Validation
```jsx
const validateRequired = (value, fieldName) => {
  return value.trim() ? '' : `${fieldName} is required`;
};
```

### IP Address Validation
```jsx
const validateIP = (ip) => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return 'Invalid IP address format';
  
  const parts = ip.split('.');
  const valid = parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
  return valid ? '' : 'IP address octets must be 0-255';
};
```

### Port Number Validation
```jsx
const validatePort = (port) => {
  const num = parseInt(port);
  if (isNaN(num)) return 'Port must be a number';
  if (num < 1 || num > 65535) return 'Port must be between 1 and 65535';
  return '';
};
```

## Accessibility

The FormInput component follows accessibility best practices:

- **Semantic HTML**: Uses proper `<label>` and `<input>` elements
- **Label Association**: Label is properly associated with input
- **Error Announcement**: Uses `aria-invalid` and `aria-describedby` for error messages
- **Keyboard Navigation**: Fully keyboard accessible
- **Screen Reader Support**: Error messages are announced to screen readers
- **Color Contrast**: Meets WCAG 2.1 AA standards
- **Focus Indicators**: Clear focus ring on keyboard navigation

### ARIA Attributes

- `aria-invalid`: Set to `"true"` when error is present, `"false"` otherwise
- `aria-describedby`: Links input to error message element when error exists

## Design System Compliance

This component adheres to the Stitch design system:

- ✅ Uses Stitch color palette exclusively
- ✅ Follows typography scale (10px label, 14px input)
- ✅ Applies consistent spacing and padding
- ✅ Uses uppercase label text transformation
- ✅ Implements focus states with primary color
- ✅ Consistent border radius (8px)
- ✅ Smooth color transitions

## Testing

The component includes comprehensive unit tests covering:

- Rendering with label and value
- All input types (text, email, password, number)
- Required field indicator
- Error message display
- User interaction (onChange callback)
- Accessibility attributes (aria-invalid, aria-describedby)
- All styling classes
- Requirements validation

Run tests with:
```bash
npm test FormInput.test.jsx
```

## Related Components

- **FormSelect**: Dropdown select component with similar styling
- **FormTextarea**: Multi-line text input component
- **ActionButton**: Submit buttons for forms
- **StatusBadge**: Can be used to show validation status

## Migration Notes

When migrating from CH.jsx components:

1. Replace `<CHInput>` or `<CHTextField>` with `<FormInput>`
2. Update prop names:
   - `onChange` now receives the value directly (not event object)
   - `errorText` → `error`
   - `isRequired` → `required`
3. Remove manual label styling (handled by component)
4. Update color references to use Stitch palette
5. Ensure validation logic passes string values to onChange

### Before (CH.jsx)
```jsx
<CHInput 
  label="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  errorText={error}
  isRequired={true}
/>
```

### After (Tailwind)
```jsx
<FormInput 
  label="Email"
  value={email}
  onChange={setEmail}
  error={error}
  required
/>
```

## File Location

```
frontend/src/components/ui/FormInput.jsx
frontend/src/components/ui/FormInput.test.jsx
frontend/src/components/ui/FormInput.example.jsx
frontend/src/components/ui/FormInput.README.md
```

## Best Practices

1. **Always provide a label**: Labels improve accessibility and usability
2. **Use appropriate input types**: Use `type="email"` for emails, `type="password"` for passwords
3. **Validate on blur or submit**: Avoid validating on every keystroke for better UX
4. **Clear error messages**: Provide specific, actionable error messages
5. **Mark required fields**: Use the `required` prop to show the asterisk indicator
6. **Consistent validation**: Use the same validation logic on frontend and backend
7. **Accessible errors**: Always use the `error` prop for validation messages (not custom elements)

