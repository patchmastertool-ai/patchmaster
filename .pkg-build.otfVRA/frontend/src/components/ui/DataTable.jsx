import React, { useState } from 'react';
import Icon from '../Icon';

/**
 * DataTable Component
 * 
 * Displays tabular data with sorting, filtering, and row actions.
 * Supports custom cell rendering and responsive behavior.
 * 
 * @param {Object} props
 * @param {Array} props.columns - Column definitions
 * @param {string} props.columns[].key - Unique column identifier
 * @param {string} props.columns[].label - Column header label
 * @param {boolean} [props.columns[].sortable=false] - Whether column is sortable
 * @param {Function} [props.columns[].render] - Custom cell renderer function
 * @param {Array} props.data - Row data array
 * @param {Function} [props.onSort] - Sort handler (key, direction)
 * @param {Function} [props.onRowClick] - Row click handler
 * @param {Array} [props.actions] - Row action buttons
 * @param {string} props.actions[].label - Action label
 * @param {string} props.actions[].icon - Material Symbol icon name
 * @param {Function} props.actions[].onClick - Action click handler (row)
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'hostname', label: 'Hostname', sortable: true },
 *     { key: 'status', label: 'Status', render: (value) => <Badge>{value}</Badge> }
 *   ]}
 *   data={hosts}
 *   onSort={(key, dir) => setSort({ key, dir })}
 *   actions={[
 *     { label: 'Terminal', icon: 'terminal', onClick: (row) => openTerminal(row) }
 *   ]}
 * />
 */
export function DataTable({
  columns = [],
  data = [],
  onSort,
  onRowClick,
  actions = [],
  className = '',
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (columnKey) => {
    const newDirection =
      sortConfig.key === columnKey && sortConfig.direction === 'asc'
        ? 'desc'
        : 'asc';

    setSortConfig({ key: columnKey, direction: newDirection });

    if (onSort) {
      onSort(columnKey, newDirection);
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-sm text-left border-collapse">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-[#2b4680]">
            {columns.map((column) => (
              <th
                key={column.key}
                className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3"
                onClick={() => column.sortable && handleSort(column.key)}
                style={{ cursor: column.sortable ? 'pointer' : 'default' }}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && getSortIcon(column.key) && (
                    <Icon
                      name={getSortIcon(column.key)}
                      size={16}
                      className="text-[#7bd0ff]"
                    />
                  )}
                </div>
              </th>
            ))}
            {actions.length > 0 && (
              <th className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3 text-right">
                Actions
              </th>
            )}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                className="px-4 py-8 text-center text-[#91aaeb]"
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-[#2b4680]/30 hover:bg-[#05183c] transition-colors cursor-pointer"
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column.key}`}
                    className="px-4 py-3 text-[#dee5ff]"
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          className="p-2 rounded-lg hover:bg-[#031d4b] hover:text-[#7bd0ff] transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          title={action.label}
                        >
                          <Icon
                            name={action.icon}
                            size={20}
                            className="text-[#91aaeb]"
                          />
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
