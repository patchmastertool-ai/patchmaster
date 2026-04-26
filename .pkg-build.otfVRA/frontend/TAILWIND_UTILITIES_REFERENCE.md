# Tailwind CSS Utilities Reference

## Quick Reference Guide for PatchMaster UI Redesign

This document provides a quick reference for all available Tailwind CSS utilities configured for the PatchMaster UI redesign.

---

## Color Utilities

### Background Colors

```jsx
// Primary backgrounds
<div className="bg-primary">Primary background</div>
<div className="bg-primary-dim">Primary dim</div>
<div className="bg-primary-container">Primary container</div>

// Surface backgrounds
<div className="bg-surface">Surface</div>
<div className="bg-surface-container">Surface container</div>
<div className="bg-surface-container-low">Surface container low</div>
<div className="bg-surface-container-high">Surface container high</div>
<div className="bg-surface-container-highest">Surface container highest</div>

// Secondary backgrounds
<div className="bg-secondary">Secondary</div>
<div className="bg-secondary-container">Secondary container</div>

// Tertiary backgrounds
<div className="bg-tertiary">Tertiary (warning)</div>
<div className="bg-tertiary-container">Tertiary container</div>

// Error backgrounds
<div className="bg-error">Error</div>
<div className="bg-error-container">Error container</div>

// Inverse backgrounds
<div className="bg-inverse-surface">Inverse surface</div>
```

### Text Colors

```jsx
// Primary text
<p className="text-on-surface">Primary text</p>
<p className="text-on-surface-variant">Secondary text</p>

// On specific backgrounds
<p className="text-on-primary">Text on primary</p>
<p className="text-on-secondary">Text on secondary</p>
<p className="text-on-tertiary">Text on tertiary</p>
<p className="text-on-error">Text on error</p>

// Inverse text
<p className="text-inverse-on-surface">Inverse text</p>
```

### Border Colors

```jsx
// Outline borders
<div className="border border-outline">Outline border</div>
<div className="border border-outline-variant">Outline variant border</div>

// Colored borders
<div className="border-t-2 border-primary">Primary top border</div>
<div className="border-l-4 border-error">Error left border</div>
<div className="border-b border-tertiary">Tertiary bottom border</div>
```

---

## Typography Utilities

### Font Families

```jsx
// Headline font
<h1 className="font-headline">Headline</h1>

// Body font
<p className="font-body">Body text</p>

// Label font
<label className="font-label">Label</label>

// Default sans-serif
<div className="font-sans">Default sans-serif</div>
```

### Font Sizes

```jsx
<p className="text-xs">Extra small (10px)</p>
<p className="text-sm">Small (11px)</p>
<p className="text-base">Base (13px)</p>
<p className="text-md">Medium (14px)</p>
<p className="text-lg">Large (18px)</p>
<p className="text-xl">Extra large (24px)</p>
<p className="text-2xl">2XL (32px)</p>
<p className="text-4xl">4XL (40px)</p>
```

### Font Weights

```jsx
<p className="font-light">Light (300)</p>
<p className="font-normal">Normal (400)</p>
<p className="font-medium">Medium (500)</p>
<p className="font-semibold">Semibold (600)</p>
<p className="font-bold">Bold (700)</p>
<p className="font-extrabold">Extrabold (800)</p>
```

### Letter Spacing

```jsx
<p className="tracking-tighter">Tighter (-0.02em)</p>
<p className="tracking-tight">Tight (-0.01em)</p>
<p className="tracking-normal">Normal (0)</p>
<p className="tracking-wide">Wide (0.02em)</p>
<p className="tracking-wider">Wider (0.15em)</p>
<p className="tracking-widest">Widest (0.2em)</p>
```

---

## Glass-Morphism Utilities

### Glass Effects

```jsx
// Full glass effect with backdrop blur
<div className="glass-morphism p-6 rounded-xl">
  Glass card with blur
</div>

// Primary gradient overlay
<div className="glass-gradient p-6 rounded-xl">
  Primary gradient glass
</div>

// Secondary gradient overlay
<div className="glass-gradient-secondary p-6 rounded-xl">
  Secondary gradient glass
</div>

// Tertiary gradient overlay
<div className="glass-gradient-tertiary p-6 rounded-xl">
  Tertiary gradient glass
</div>
```

### Backdrop Blur

```jsx
// Blur effects
<div className="backdrop-blur-xl">Blur 20px</div>
<div className="backdrop-blur-2xl">Blur 40px</div>
```

---

## Spacing Utilities

### Padding

```jsx
<div className="p-4">Padding all sides</div>
<div className="px-6">Padding horizontal</div>
<div className="py-4">Padding vertical</div>
<div className="pt-2 pb-4 pl-6 pr-8">Individual sides</div>
```

### Margin

```jsx
<div className="m-4">Margin all sides</div>
<div className="mx-auto">Margin horizontal auto (center)</div>
<div className="my-6">Margin vertical</div>
<div className="mt-2 mb-4 ml-6 mr-8">Individual sides</div>
```

### Gap

```jsx
<div className="flex gap-4">Flex gap</div>
<div className="grid gap-6">Grid gap</div>
<div className="grid gap-x-4 gap-y-6">Individual gaps</div>
```

---

## Border Radius Utilities

```jsx
<div className="rounded">Default (2px)</div>
<div className="rounded-lg">Large (4px)</div>
<div className="rounded-xl">Extra large (8px)</div>
<div className="rounded-full">Full (12px)</div>

// Individual corners
<div className="rounded-t-xl">Top corners</div>
<div className="rounded-b-lg">Bottom corners</div>
<div className="rounded-l-xl">Left corners</div>
<div className="rounded-r-lg">Right corners</div>
```

---

## Layout Utilities

### Display

```jsx
<div className="flex">Flex container</div>
<div className="grid">Grid container</div>
<div className="block">Block display</div>
<div className="inline-flex">Inline flex</div>
```

### Flexbox

```jsx
<div className="flex items-center justify-between gap-4">
  Flex with alignment
</div>

<div className="flex flex-col gap-2">
  Flex column
</div>

<div className="flex flex-wrap gap-4">
  Flex wrap
</div>
```

### Grid

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  Responsive grid
</div>

<div className="grid grid-cols-2 gap-4">
  2-column grid
</div>
```

### Width & Height

```jsx
<div className="w-full">Full width</div>
<div className="w-1/2">Half width</div>
<div className="w-64">256px width</div>
<div className="h-screen">Full height</div>
<div className="h-16">64px height</div>
```

---

## Responsive Utilities

### Breakpoints

```jsx
// Mobile first approach
<div className="text-sm md:text-base lg:text-lg">
  Responsive text size
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  Responsive grid
</div>

<div className="hidden md:block">
  Hidden on mobile, visible on tablet+
</div>

<div className="block md:hidden">
  Visible on mobile, hidden on tablet+
</div>
```

### Breakpoint Sizes
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

---

## Component Patterns

### Stat Card

```jsx
<div className="bg-surface-container-low p-6 rounded-xl border-t-2 border-primary">
  <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
    Label
  </div>
  <div className="text-4xl font-extrabold text-on-surface mb-2">
    42
  </div>
  <div className="text-sm text-on-surface-variant">
    Subtitle
  </div>
</div>
```

### Button - Primary

```jsx
<button className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 transition-all">
  Primary Button
</button>
```

### Button - Secondary

```jsx
<button className="px-4 py-2 bg-outline/10 text-on-surface text-xs font-bold rounded-lg border border-outline/20 hover:bg-outline/20">
  Secondary Button
</button>
```

### Button - Danger

```jsx
<button className="px-4 py-2 bg-error text-white text-xs font-bold rounded-lg hover:brightness-110">
  Danger Button
</button>
```

### Status Badge

```jsx
<span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-tighter bg-primary/20 text-primary">
  Success
</span>

<span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-tighter bg-error/20 text-error">
  Error
</span>

<span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-tighter bg-tertiary/20 text-tertiary">
  Warning
</span>
```

### Input Field

```jsx
<input 
  type="text"
  className="w-full bg-surface-container border border-outline-variant/20 rounded-lg py-2 px-4 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary"
  placeholder="Enter text..."
/>
```

### Card

```jsx
<div className="bg-surface-container p-6 rounded-xl border-t border-outline/10">
  <h3 className="text-lg font-bold text-on-surface mb-4">
    Card Title
  </h3>
  <p className="text-sm text-on-surface-variant">
    Card content
  </p>
</div>
```

### Glass Card

```jsx
<div className="glass-morphism p-6 rounded-xl">
  <h3 className="text-lg font-bold text-on-surface mb-4">
    Glass Card
  </h3>
  <p className="text-sm text-on-surface-variant">
    Content with glass effect
  </p>
</div>
```

### Data Table

```jsx
<table className="w-full text-sm text-left">
  <thead>
    <tr>
      <th className="text-xs uppercase tracking-widest font-bold text-on-surface-variant px-4 py-3">
        Column 1
      </th>
      <th className="text-xs uppercase tracking-widest font-bold text-on-surface-variant px-4 py-3">
        Column 2
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="hover:bg-surface-container-high transition-colors">
      <td className="px-4 py-3 text-on-surface">Data 1</td>
      <td className="px-4 py-3 text-on-surface">Data 2</td>
    </tr>
  </tbody>
</table>
```

---

## Transition & Animation Utilities

### Transitions

```jsx
<div className="transition-all duration-300">
  Smooth transition
</div>

<div className="transition-colors duration-200">
  Color transition
</div>

<div className="hover:bg-surface-container-high transition-colors">
  Hover effect
</div>
```

### Opacity

```jsx
<div className="opacity-100">Fully opaque</div>
<div className="opacity-75">75% opacity</div>
<div className="opacity-50">50% opacity</div>
<div className="opacity-25">25% opacity</div>
<div className="opacity-0">Fully transparent</div>
```

---

## Utility Combinations

### Centered Container

```jsx
<div className="flex items-center justify-center min-h-screen">
  Centered content
</div>
```

### Sidebar Layout

```jsx
<div className="flex">
  <div className="w-64 bg-surface-container-low fixed h-screen">
    Sidebar
  </div>
  <div className="ml-64 flex-1">
    Main content
  </div>
</div>
```

### Header Layout

```jsx
<div className="fixed top-0 left-64 right-0 h-16 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-8 z-40">
  Header content
</div>
```

### Grid Layout

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
  {/* Grid items */}
</div>
```

---

## Dark Mode

All utilities are configured for dark mode (class strategy):

```jsx
// Dark mode is enabled by default
<div className="bg-surface text-on-surface">
  Dark mode content
</div>

// To toggle dark mode, add 'dark' class to html element
<html className="dark">
  {/* Content */}
</html>
```

---

## Performance Tips

1. **Use Tailwind Classes**: Prefer Tailwind utilities over custom CSS
2. **Avoid Inline Styles**: Use className instead of style prop
3. **Responsive First**: Use mobile-first approach (sm:, md:, lg:)
4. **Reuse Patterns**: Create component patterns for consistency
5. **Purge Unused**: Production builds automatically purge unused CSS

---

## Common Patterns

### Loading State

```jsx
<button disabled className="opacity-50 cursor-not-allowed">
  Loading...
</button>
```

### Disabled State

```jsx
<input disabled className="opacity-50 cursor-not-allowed" />
```

### Focus State

```jsx
<input className="focus:ring-2 focus:ring-primary focus:border-primary" />
```

### Hover State

```jsx
<div className="hover:bg-surface-container-high transition-colors cursor-pointer">
  Hover me
</div>
```

---

## Troubleshooting

### Colors Not Appearing
- Ensure content paths in tailwind.config.js include your files
- Check that class names are spelled correctly
- Verify dark mode is enabled in HTML

### Utilities Not Working
- Check that Tailwind CSS is properly installed
- Verify PostCSS configuration
- Clear node_modules and reinstall if needed

### Performance Issues
- Check bundle size with `npm run build`
- Verify unused CSS is being purged
- Use responsive utilities instead of multiple breakpoints

---

## Additional Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Configuration](https://tailwindcss.com/docs/configuration)
- [Tailwind CSS Utilities](https://tailwindcss.com/docs/utility-first)

---

**Last Updated**: 2025-01-01
**Tailwind CSS Version**: 4.2.2
