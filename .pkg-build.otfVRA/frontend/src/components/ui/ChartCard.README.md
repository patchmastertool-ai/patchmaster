# ChartCard Component

A reusable container component for wrapping chart visualizations with consistent headers, legends, and action buttons. Part of the PatchMaster UI Redesign using the Stitch design system.

## Overview

The ChartCard component provides a standardized wrapper for charts and data visualizations. It includes support for:
- Title and optional subtitle
- Legend with color-coded items
- Action buttons (filter, export, etc.)
- Flexible content area for any chart type

## Design System Compliance

This component follows the Stitch design system specifications:

### Colors
- **Container Background**: `#05183c` (surface-container)
- **Title Text**: `#dee5ff` (on-surface)
- **Subtitle Text**: `#91aaeb` (on-surface-variant)
- **Legend Text**: `#91aaeb` (on-surface-variant)

### Typography
- **Title**: 24px (text-2xl), bold, tight tracking
- **Subtitle**: 10px (text-[10px]), bold, uppercase, wide tracking (0.15em)
- **Legend Labels**: 12px (text-xs)

### Spacing
- **Container Padding**: 32px (p-8)
- **Border Radius**: 12px (rounded-xl)
- **Subtitle Margin**: 16px bottom (mb-4)
- **Legend Margin**: 24px bottom (mb-6)

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | Yes | - | The chart title displayed prominently |
| `subtitle` | `string` | No | - | Optional subtitle displayed above title in uppercase |
| `legend` | `Array<{label: string, color: string}>` | No | - | Array of legend items with labels and colors |
| `children` | `React.ReactNode` | Yes | - | Chart content (SVG, canvas, or other visualization) |
| `actions` | `React.ReactNode` | No | - | Optional action buttons displayed in top-right |
| `className` | `string` | No | `''` | Additional CSS classes to apply |

## Usage Examples

### Basic Chart Card

```jsx
import { ChartCard } from './components/ui/ChartCard';

function MyChart() {
  return (
    <ChartCard title="System Performance">
      <svg className="w-full h-64">
        {/* Your chart SVG content */}
      </svg>
    </ChartCard>
  );
}
```

### With Subtitle

```jsx
<ChartCard 
  title="Network Traffic" 
  subtitle="Last 24 Hours"
>
  <div className="h-64">
    {/* Chart content */}
  </div>
</ChartCard>
```

### With Legend

```jsx
<ChartCard
  title="CPU & Memory Usage"
  legend={[
    { label: 'CPU Usage', color: '#7bd0ff' },
    { label: 'Memory Usage', color: '#a2dcff' },
  ]}
>
  <div className="h-64">
    {/* Multi-series chart */}
  </div>
</ChartCard>
```

### With Actions

```jsx
<ChartCard
  title="Storage Capacity"
  actions={
    <>
      <button className="px-3 py-1.5 text-xs text-[#7bd0ff]">
        Filter
      </button>
      <button className="px-3 py-1.5 text-xs text-[#7bd0ff]">
        Export
      </button>
    </>
  }
>
  <div className="h-64">
    {/* Chart content */}
  </div>
</ChartCard>
```

### Complete Example

```jsx
<ChartCard
  title="Infrastructure Metrics"
  subtitle="Real-time Monitoring"
  legend={[
    { label: 'Inbound Traffic', color: '#7bd0ff' },
    { label: 'Outbound Traffic', color: '#ffd16f' },
    { label: 'Error Rate', color: '#ee7d77' },
  ]}
  actions={
    <>
      <button className="px-3 py-1.5 text-xs bg-[#05183c] text-[#7bd0ff] rounded">
        Last 24h
      </button>
      <button className="px-3 py-1.5 text-xs text-[#7bd0ff]">
        Export CSV
      </button>
    </>
  }
>
  <svg className="w-full h-80">
    {/* Complex chart visualization */}
  </svg>
</ChartCard>
```

## Integration with Chart Libraries

The ChartCard component works with any chart library or custom visualization:

### With Recharts

```jsx
import { LineChart, Line, XAxis, YAxis } from 'recharts';

<ChartCard
  title="Response Times"
  legend={[
    { label: 'API Response', color: '#7bd0ff' },
  ]}
>
  <LineChart width={600} height={300} data={data}>
    <XAxis dataKey="time" />
    <YAxis />
    <Line type="monotone" dataKey="value" stroke="#7bd0ff" />
  </LineChart>
</ChartCard>
```

### With Chart.js

```jsx
import { Line } from 'react-chartjs-2';

<ChartCard
  title="System Load"
  legend={[
    { label: 'Load Average', color: '#7bd0ff' },
  ]}
>
  <Line data={chartData} options={chartOptions} />
</ChartCard>
```

### With D3.js

```jsx
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

function D3Chart() {
  const svgRef = useRef();

  useEffect(() => {
    // D3 chart rendering logic
    const svg = d3.select(svgRef.current);
    // ... D3 code
  }, []);

  return (
    <ChartCard
      title="Custom Visualization"
      legend={[
        { label: 'Data Series', color: '#7bd0ff' },
      ]}
    >
      <svg ref={svgRef} className="w-full h-64" />
    </ChartCard>
  );
}
```

## Accessibility

The ChartCard component includes accessibility features:
- Semantic HTML structure with proper heading hierarchy
- Color dots in legend have `aria-hidden="true"` since they're decorative
- Legend labels provide text alternatives for colors
- Supports keyboard navigation through action buttons

## Responsive Design

The ChartCard component is responsive by default:
- Uses relative units for spacing
- Chart content area adapts to container width
- Legend items wrap on smaller screens
- Actions stack vertically on mobile if needed

For responsive chart content, ensure your chart library or SVG uses responsive sizing:

```jsx
<ChartCard title="Responsive Chart">
  <svg className="w-full h-64" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
    {/* Chart content */}
  </svg>
</ChartCard>
```

## Testing

The component includes comprehensive unit tests covering:
- Basic rendering with required props
- Optional props (subtitle, legend, actions)
- Tailwind class application
- Legend color rendering
- Custom className support

Run tests with:
```bash
npm test ChartCard.test.jsx
```

## Related Components

- **StatCard**: For displaying single metrics with icons
- **DataTable**: For tabular data display
- **StatusBadge**: For status indicators within charts

## Requirements Validation

This component satisfies the following requirements from the PatchMaster UI Redesign spec:

- **Requirement 4.4**: Provides a ChartCard component for wrapping visualizations
- **Requirement 7.4**: Uses only colors from the Stitch Color Token set

## Migration Notes

When migrating existing charts to use ChartCard:

1. Wrap your existing chart component with ChartCard
2. Move the chart title to the `title` prop
3. Convert any subtitle text to the `subtitle` prop
4. Extract legend data into the `legend` prop format
5. Move filter/export buttons to the `actions` prop
6. Remove any custom container styling (ChartCard provides it)

### Before (Old CH.jsx style)

```jsx
<div className="chart-container">
  <div className="chart-header">
    <h2>System Performance</h2>
    <div className="chart-legend">
      <span className="legend-item">CPU</span>
      <span className="legend-item">Memory</span>
    </div>
  </div>
  <svg>{/* chart */}</svg>
</div>
```

### After (New Tailwind style)

```jsx
<ChartCard
  title="System Performance"
  legend={[
    { label: 'CPU', color: '#7bd0ff' },
    { label: 'Memory', color: '#a2dcff' },
  ]}
>
  <svg>{/* chart */}</svg>
</ChartCard>
```

## Browser Support

The ChartCard component supports all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Considerations

- Uses static Tailwind classes for optimal performance
- No runtime CSS generation
- Minimal re-renders (only when props change)
- Supports React.memo() for optimization if needed

## Future Enhancements

Potential future additions:
- Built-in loading state
- Empty state placeholder
- Collapsible/expandable functionality
- Full-screen mode toggle
- Built-in time range selector
