# Stitch UI Builder Demo - Visual Guide

## Demo Interface Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Stitch UI Builder                                                       │
│ Generate modern React pages with AI-powered design                     │
├─────────────────────────────────────────────────────────────────────────┤
│ ● Connected to Stitch MCP Server (Demo Mode)              [Ready]      │
├──────────────────────────┬──────────────────────────────────────────────┤
│ LEFT PANEL (1/3 width)   │ RIGHT PANEL (2/3 width)                     │
│                          │                                              │
│ ┌──────────────────────┐ │ ┌──────────────────────────────────────────┐│
│ │ Projects (3)         │ │ │ Code Preview                             ││
│ │ ┌──────────────────┐ │ │ │ [React + CH.jsx] [Valid JSX]            ││
│ │ │ PatchMaster UI   │ │ │ │                                          ││
│ │ │ Redesign         │ │ │ │ ┌──────────────────────────────────────┐││
│ │ │ [Selected]       │ │ │ │ │ GeneratedPage.jsx                    │││
│ │ │ Modern redesign  │ │ │ │ │ [👁️ View] [✨ Format] [📋 Copy]      │││
│ │ │ Created: Jan 15  │ │ │ │ │ [💾 Download]                        │││
│ │ └──────────────────┘ │ │ │ ├──────────────────────────────────────┤││
│ │ ┌──────────────────┐ │ │ │ │ 1  import React from 'react';        │││
│ │ │ Dashboard        │ │ │ │ │ 2  import { CHPage, CHHeader, ...    │││
│ │ │ Components       │ │ │ │ │ 3                                     │││
│ │ │ Collection of    │ │ │ │ │ 4  export default function ...       │││
│ │ │ dashboard widgets│ │ │ │ │ 5    return (                        │││
│ │ │ Created: Jan 18  │ │ │ │ │ 6      <CHPage>                      │││
│ │ └──────────────────┘ │ │ │ │ 7        <CHHeader title="..." />    │││
│ │ ┌──────────────────┐ │ │ │ │ 8        <CHCard>                    │││
│ │ │ Admin Panel      │ │ │ │ │ 9          ...                       │││
│ │ │ Administrative   │ │ │ │ │ 10       </CHCard>                   │││
│ │ │ interface        │ │ │ │ │ 11     </CHPage>                     │││
│ │ │ Created: Jan 10  │ │ │ │ │ 12   );                              │││
│ │ └──────────────────┘ │ │ │ │ 13 }                                 │││
│ └──────────────────────┘ │ │ │ └──────────────────────────────────────┘││
│                          │ │ └──────────────────────────────────────────┘│
│ ┌──────────────────────┐ │                                              │
│ │ Generate Screen      │ │ ┌──────────────────────────────────────────┐│
│ │ Describe the page    │ │ │ Export Options                           ││
│ │ you want to create   │ │ │ Target Path: frontend/src/GeneratedPage  ││
│ │ ┌──────────────────┐ │ │ │ Route Name: generated-page               ││
│ │ │ Create a         │ │ │ │ ☑ Create backup  ☑ Update navigation    ││
│ │ │ dashboard page   │ │ │ │ [💾 Export to PatchMaster] [🔄 Variant] ││
│ │ │ with stats...    │ │ │ └──────────────────────────────────────────┘│
│ │ └──────────────────┘ │ │                                              │
│ │ [✨ Generate]        │ │                                              │
│ │                      │ │                                              │
│ │ Quick examples:      │ │                                              │
│ │ • Dashboard with     │ │                                              │
│ │   stats              │ │                                              │
│ │ • User management    │ │                                              │
│ │ • Reports page       │ │                                              │
│ └──────────────────────┘ │                                              │
└──────────────────────────┴──────────────────────────────────────────────┘
```

## Key UI Elements

### 1. Connection Status Banner (Top)
```
┌─────────────────────────────────────────────────────────────┐
│ ● Connected to Stitch MCP Server (Demo Mode)      [Ready]  │
└─────────────────────────────────────────────────────────────┘
```
- Green dot indicates connected status
- "Demo Mode" label shows this is a demo
- "Ready" badge shows system is ready to generate

### 2. Project List (Left Panel)
```
┌──────────────────────────────────────┐
│ Projects (3)                [Refresh]│
│ ┌──────────────────────────────────┐ │
│ │ PatchMaster UI Redesign          │ │
│ │ [Selected]                       │ │
│ │ Modern redesign of all pages     │ │
│ │ Created: Jan 15  Updated: Jan 20 │ │
│ │ ID: 12345678...                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- Shows all available projects
- Selected project is highlighted with cyan border
- Displays metadata: title, description, dates, ID
- Refresh button to reload projects

### 3. Prompt Input (Left Panel)
```
┌──────────────────────────────────────┐
│ Generate Screen                      │
│ Describe the page you want to create│
│ ┌──────────────────────────────────┐ │
│ │ Example: Create a dashboard page │ │
│ │ with stats cards and recent      │ │
│ │ activity...                      │ │
│ └──────────────────────────────────┘ │
│ [✨ Generate]                        │
│                                      │
│ Quick examples:                      │
│ • Dashboard with stats               │
│ • User management                    │
│ • Reports page                       │
└──────────────────────────────────────┘
```
- Text area for entering prompts
- Generate button (disabled when empty)
- Quick example buttons for common pages

### 4. Code Preview Panel (Right Panel)
```
┌────────────────────────────────────────────────────────────┐
│ Code Preview                                               │
│ [React + CH.jsx] [Valid JSX]                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ GeneratedPage.jsx                                      │ │
│ │ [👁️ View] [✨ Format] [📋 Copy] [💾 Download]         │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ 1  import React from 'react';                          │ │
│ │ 2  import { CHPage, CHHeader, CHCard } from './CH.jsx';│ │
│ │ 3                                                       │ │
│ │ 4  export default function DashboardPage() {           │ │
│ │ 5    return (                                          │ │
│ │ 6      <CHPage>                                        │ │
│ │ 7        <CHHeader title="Dashboard" />               │ │
│ │ 8        <CHCard>                                      │ │
│ │ 9          <p>Dashboard content</p>                    │ │
│ │ 10       </CHCard>                                     │ │
│ │ 11     </CHPage>                                       │ │
│ │ 12   );                                                │ │
│ │ 13 }                                                   │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```
- Syntax-highlighted JSX code
- Line numbers on the left
- Toolbar with actions:
  - 👁️ View / ✏️ Edit: Toggle edit mode
  - ✨ Format: Auto-format with Prettier
  - 📋 Copy: Copy to clipboard
  - 💾 Download: Save as file
- Badges showing framework and validation status

### 5. Export Options (Right Panel, Bottom)
```
┌────────────────────────────────────────────────────────────┐
│ Export Options                                             │
│ Target Path: [frontend/src/GeneratedPage.jsx            ] │
│ Route Name:  [generated-page                            ] │
│ ☑ Create backup of existing file                          │
│ ☑ Update navigation                                        │
│ [💾 Export to PatchMaster] [🔄 Generate Variant]          │
└────────────────────────────────────────────────────────────┘
```
- Input fields for target path and route name
- Checkboxes for backup and navigation options
- Export and variant generation buttons

### 6. Features Overview (Bottom)
```
┌──────────────────┬──────────────────┬──────────────────┐
│ 🚀               │ 🎨               │ ✏️               │
│ Fast Generation  │ Design System    │ Live Editing     │
│ Generate pages   │ Automatically    │ Edit code with   │
│ in seconds       │ applies CH V2    │ syntax validation│
└──────────────────┴──────────────────┴──────────────────┘
```
- Three cards highlighting key features
- Icons and descriptions

## Color Scheme (Command Horizon V2)

- **Background**: Dark blue (#060e20)
- **Surface**: Slightly lighter blue (#06122d)
- **Accent**: Cyan (#7bd0ff)
- **Text**: Light blue-white (#dee5ff)
- **Text Secondary**: Muted blue (#91aaeb)
- **Success**: Green (#10b981)
- **Error**: Red (#ef4444)
- **Warning**: Yellow (#fbbf24)

## Interactive States

### Project Selection
```
Unselected:
┌──────────────────────────────────┐
│ Dashboard Components             │  ← Gray border, darker background
│ Collection of dashboard widgets  │
└──────────────────────────────────┘

Hover:
┌──────────────────────────────────┐
│ Dashboard Components             │  ← Lighter background
│ Collection of dashboard widgets  │
└──────────────────────────────────┘

Selected:
┌──────────────────────────────────┐
│ Dashboard Components   [Selected]│  ← Cyan border, cyan badge
│ Collection of dashboard widgets  │
└──────────────────────────────────┘
```

### Generate Button States
```
Disabled (no prompt):
[✨ Generate]  ← Grayed out, not clickable

Enabled:
[✨ Generate]  ← Cyan background, clickable

Loading:
[⏳ Generating...]  ← Animated, disabled
```

### Code Editor States
```
View Mode:
[👁️ View] [✨ Format] [📋 Copy] [💾 Download]
└─ Syntax-highlighted, read-only

Edit Mode:
[✏️ Edit] [✨ Format] [📋 Copy] [💾 Download]
└─ Plain textarea, editable, syntax validation
```

## Empty States

### No Code Generated
```
┌────────────────────────────────────────────────────────────┐
│                          🎨                                │
│                                                            │
│              No Code Generated Yet                         │
│                                                            │
│   Enter a prompt describing the page you want to create,  │
│   then click Generate to see the magic happen!            │
│                                                            │
│   ✓ Syntax Highlighting  ✓ Live Editing  ✓ Copy & Download│
└────────────────────────────────────────────────────────────┘
```

### No Projects
```
┌──────────────────────────────────┐
│ Projects (0)                     │
│                                  │
│ No projects found                │
│ Create a new project to get      │
│ started.                         │
└──────────────────────────────────┘
```

## Workflow Example

1. **User enters prompt**: "Create a dashboard page with stats cards"
2. **User clicks Generate**: Button shows "⏳ Generating..."
3. **After 1.5 seconds**: Code appears in preview panel
4. **User clicks Edit**: Code becomes editable
5. **User modifies code**: Syntax validation runs in real-time
6. **User clicks Format**: Code is auto-formatted with Prettier
7. **User clicks Copy**: Code is copied to clipboard
8. **User configures export**: Sets target path and route name
9. **User clicks Export**: Demo message appears (no actual file write)

## Responsive Behavior

- **Desktop (>1024px)**: 3-column layout (sidebar + 1/3 left + 2/3 right)
- **Tablet (768-1024px)**: 2-column layout (left and right panels stack)
- **Mobile (<768px)**: Single column (all panels stack vertically)

## Accessibility

- All interactive elements have proper focus states
- Keyboard navigation supported
- ARIA labels on icon buttons
- Color contrast meets WCAG AA standards
- Screen reader friendly

## Performance

- Lazy loading for code syntax highlighter
- Debounced syntax validation (300ms)
- Virtualized code rendering for large files
- Optimized re-renders with React.memo

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- IE11: Not supported (uses modern ES6+ features)
