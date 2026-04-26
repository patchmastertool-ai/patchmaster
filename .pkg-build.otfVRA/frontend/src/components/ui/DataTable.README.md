# DataTable Component

A flexible and reusable table component for displaying tabular data with sorting, custom rendering, and row actions. Built following the Stitch design system with the established color palette and Material Symbols icons.

**Validates: Requirements 4.2, 7.4**

## Features

- ✅ Sortable columns with visual indicators
- ✅ Custom cell rendering via render functions
- ✅ Row action buttons with icons
- ✅ Row click handlers for navigation
- ✅ Empty state display
- ✅ Responsive design with horizontal scrolling
- ✅ Stitch design system colors
- ✅ Material Symbols icons
- ✅ Accessibility support (ARIA labels, keyboard navigation)

## Installation

The component is located at `frontend/src/components/ui/DataTable.jsx` and can be imported as:

```jsx
import { DataTable } from './components/ui/DataTable';
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `columns` | `Array<Column>` | Yes | `[]` | Column definitions (see Column interface below) |
| `data` | `Array<Object>` | Yes | `[]` | Array of data objects to display |
| `onSort` | `Function` | No | - | Callback when column is sorted: `(key, direction) => void` |
| `onRowClick` | `Function` | No | - | Callback when row is clicked: `(row) => void` |
| `actions` | `Array<Action>` | No | `[]` | Row action button definitions (see Action interface below) |
| `className` | `string` | No | `''` | Additional CSS classes for the wrapper |

### Column Interface

```typescript
interface Column {
  key: string;                                    // Data key to display
  label: string;                                  // Column header label
  sortable?: boolean;                             // Enable sorting for this column
  render?: (value: any, row: Object) => ReactNode; // Custom cell renderer
}
```

### Action Interface

```typescript
interface Action {
  label: string;           // Action button label (for accessibility)
  icon: string;            // Material Symbol icon name
  onClick: (row: Object) => void; // Click handler receiving row data
}
```

## Usage Examples

### Basic Table

```jsx
import { DataTable } from './components/ui/DataTable';

function HostList() {
  const columns = [
    { key: 'hostname', label: 'Hostname', sortable: true },
    { key: 'ip', label: 'IP Address', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
  ];

  const data = [
    { hostname: 'prod-db-01', ip: '10.0.4.12', status: 'healthy' },
    { hostname: 'win-node-sec', ip: '192.168.1.45', status: 'critical' },
  ];

  return <DataTable columns={columns} data={data} />;
}
```

### Table with Custom Cell Rendering

```jsx
const columns = [
  { 
    key: 'hostname', 
    label: 'Hostname', 
    sortable: true,
    render: (value, row) => (
      <div className="flex flex-col">
        <span className="text-sm font-bold text-[#dee5ff]">{value}</span>
        <span className="text-[10px] text-[#91aaeb]">{row.cluster}</span>
      </div>
    )
  },
  { 
    key: 'status', 
    label: 'Status',
    render: (value) => (
      <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
        value === 'healthy' ? 'bg-[#7bd0ff]/20 text-[#7bd0ff]' : 'bg-[#ee7d77]/20 text-[#ee7d77]'
      }`}>
        {value}
      </span>
    )
  },
];
```

### Table with Sorting

```jsx
function SortableTable() {
  const [sortedData, setSortedData] = useState(initialData);

  const handleSort = (key, direction) => {
    if (!direction) {
      setSortedData(initialData); // Reset to original order
      return;
    }

    const sorted = [...sortedData].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setSortedData(sorted);
  };

  return (
    <DataTable 
      columns={columns} 
      data={sortedData} 
      onSort={handleSort} 
    />
  );
}
```

### Table with Row Actions

```jsx
const actions = [
  {
    label: 'Terminal',
    icon: 'terminal',
    onClick: (row) => openTerminal(row.hostname),
  },
  {
    label: 'Reboot',
    icon: 'restart_alt',
    onClick: (row) => rebootHost(row.id),
  },
  {
    label: 'Monitor',
    icon: 'monitoring',
    onClick: (row) => navigate(`/host/${row.id}/monitor`),
  },
];

<DataTable columns={columns} data={data} actions={actions} />
```

### Table with Row Click

```jsx
function ClickableTable() {
  const handleRowClick = (row) => {
    navigate(`/host/${row.id}`);
  };

  return (
    <DataTable 
      columns={columns} 
      data={data} 
      onRowClick={handleRowClick} 
    />
  );
}
```

## Styling

The DataTable component uses Tailwind CSS classes following the Stitch design system:

### Color Palette

- **Background**: `#060e20` (surface)
- **Container**: `#06122d` (surface-container-low)
- **Hover**: `#05183c` (surface-container)
- **Primary**: `#7bd0ff` (primary)
- **Text**: `#dee5ff` (on-surface)
- **Text Variant**: `#91aaeb` (on-surface-variant)
- **Border**: `#2b4680` (outline-variant)

### Key Classes

- **Table Wrapper**: `w-full overflow-x-auto`
- **Table**: `w-full text-sm text-left border-collapse`
- **Header Row**: `border-b border-[#2b4680]`
- **Header Cell**: `text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3`
- **Body Row**: `border-b border-[#2b4680]/30 hover:bg-[#05183c] transition-colors`
- **Body Cell**: `px-4 py-3 text-[#dee5ff]`

## Accessibility

The DataTable component includes accessibility features:

- **Semantic HTML**: Uses proper `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` elements
- **ARIA Labels**: Action buttons include `aria-label` attributes
- **Keyboard Navigation**: Sortable columns are keyboard accessible
- **Screen Reader Support**: Empty state includes descriptive text

## Testing

The component includes comprehensive unit tests covering:

- Rendering with correct structure and classes
- Custom cell rendering
- Sorting functionality (asc → desc → null cycle)
- Row actions with event propagation
- Row click handlers
- Empty state display
- Edge cases (empty data, missing props)

Run tests with:

```bash
npm test -- DataTable.test.jsx --run
```

## Design Reference

The DataTable component is based on the table design from `frontend/stitch_hosts_raw.html` and follows the specifications in:

- `.kiro/specs/patchmaster-ui-redesign/requirements.md` (Requirements 4.2, 7.4)
- `.kiro/specs/patchmaster-ui-redesign/design.md` (DataTable component section)

## Examples

See `DataTable.example.jsx` for complete usage examples including:

1. Basic table
2. Custom cell rendering
3. Sortable table
4. Table with row actions
5. Table with row click
6. Complete example (matching stitch_hosts_raw.html)

## Browser Support

The component supports all modern browsers:

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance Considerations

- Uses React's built-in rendering optimization
- Minimal re-renders with proper key usage
- Efficient event handling with event delegation
- No external dependencies beyond React and Icon component

## Future Enhancements

Potential future improvements:

- Column resizing
- Column reordering
- Row selection (checkboxes)
- Pagination integration
- Virtual scrolling for large datasets
- Column filtering
- Export to CSV/Excel
- Sticky headers
- Expandable rows

## Related Components

- **Icon**: Material Symbols icon wrapper (`frontend/src/components/Icon.jsx`)
- **StatusBadge**: Status indicator component (to be created in Task 3.4)
- **StatCard**: Metric card component (to be created in Task 3.2)

## License

Part of the PatchMaster UI Redesign project.
