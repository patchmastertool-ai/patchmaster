# Custom CSS Utilities

This directory contains custom CSS utilities for the PatchMaster UI Redesign.

## Glass-morphism Effects

### `.glass-gradient`
Creates a glass-morphism effect with backdrop blur and semi-transparent background.

**Usage:**
```jsx
<div className="glass-gradient p-6 rounded-xl">
  Content with glass effect
</div>
```

**Properties:**
- `backdrop-filter: blur(24px)`
- `background: rgba(6, 14, 32, 0.8)`

### `.frosted-glass`
Creates a frosted glass effect for modals and overlays.

**Usage:**
```jsx
<div className="frosted-glass p-8 rounded-lg">
  Modal content
</div>
```

## Border Utilities

Custom border utilities for stat card top borders:

- `.border-t-primary` - Primary color border (#7bd0ff)
- `.border-t-success` - Success color border (#10b981)
- `.border-t-warning` - Warning color border (#ffd16f)
- `.border-t-error` - Error color border (#ee7d77)
- `.border-t-info` - Info color border (#939eb5)

**Usage:**
```jsx
<div className="border-t-primary bg-surface-container p-6 rounded-xl">
  Stat card with primary border
</div>
```

## Shadow Utilities

Depth effect shadows:

- `.shadow-depth-sm` - Small depth shadow
- `.shadow-depth-md` - Medium depth shadow
- `.shadow-depth-lg` - Large depth shadow
- `.shadow-depth-xl` - Extra large depth shadow

Glow effects:

- `.shadow-glow-primary` - Primary color glow
- `.shadow-glow-success` - Success color glow
- `.shadow-glow-error` - Error color glow

**Usage:**
```jsx
<button className="shadow-depth-md hover:shadow-glow-primary">
  Button with depth and glow
</button>
```

## Transition Utilities

Smooth animation transitions:

- `.transition-all-300` - Transition all properties (300ms)
- `.transition-colors-300` - Transition colors only (300ms)
- `.transition-transform-300` - Transition transform only (300ms)

**Usage:**
```jsx
<div className="transition-all-300 hover:scale-105">
  Animated element
</div>
```

## Hover Effects

### `.hover-lift`
Creates a lift effect on hover with transform and shadow.

**Usage:**
```jsx
<div className="hover-lift bg-surface-container p-6 rounded-xl">
  Card that lifts on hover
</div>
```

## Gradient Effects

### `.gradient-overlay-top`
Adds a gradient overlay at the top of an element.

**Usage:**
```jsx
<div className="gradient-overlay-top">
  Content with gradient overlay
</div>
```

### `.gradient-border`
Creates an animated gradient border effect.

**Usage:**
```jsx
<div className="gradient-border p-6 rounded-xl">
  Content with gradient border
</div>
```

## Additional Utilities

### `.inner-glow`
Adds a subtle inner glow to containers.

**Usage:**
```jsx
<div className="inner-glow bg-surface-container p-6">
  Container with inner glow
</div>
```

## Requirements Satisfied

This implementation satisfies:
- **Requirement 1.1**: Glass-morphism effects for depth and modern aesthetics
- **Requirement 7.4**: Custom CSS utilities for consistent visual effects
