import React from 'react';
import Icon from '../Icon';

/**
 * ChartCard Component
 * 
 * Container for chart visualizations with title, legend, and actions.
 * Provides consistent styling for all chart-based widgets.
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string} [props.subtitle] - Optional subtitle/description
 * @param {Array} [props.legend] - Legend items
 * @param {string} props.legend[].label - Legend label
 * @param {string} props.legend[].color - Color class (e.g., 'bg-primary', 'bg-tertiary')
 * @param {React.ReactNode} props.children - Chart content
 * @param {Array} [props.actions] - Action buttons
 * @param {string} props.actions[].label - Action label
 * @param {string} props.actions[].icon - Material Symbol icon name
 * @param {Function} props.actions[].onClick - Action click handler
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <ChartCard
 *   title="Heartbeat Activity"
 *   subtitle="Live Metrics"
 *   legend={[
 *     { label: 'Core Fleet', color: 'bg-primary' },
 *     { label: 'Edge Nodes', color: 'bg-outline' }
 *   ]}
 *   actions={[
 *     { label: 'Export', icon: 'download', onClick: () => {} }
 *   ]}
 * >
 *   Chart content here
 * </ChartCard>
 */
export function ChartCard({
  title,
  subtitle,
  legend = [],
  children,
  actions = [],
  className = '',
}) {
  return (
    <div
      className={`
        bg-[#05183c] p-8 rounded-xl relative overflow-hidden
        ${className}
      `}
    >
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          {/* Subtitle */}
          {subtitle && (
            <div className="text-[#91aaeb] uppercase tracking-[0.15em] text-[10px] font-bold mb-1">
              {subtitle}
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold tracking-tight text-[#dee5ff]">
            {title}
          </h2>
        </div>

        {/* Actions Section (Top-Right) */}
        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map((action, index) => (
              <button
                key={index}
                className="p-2 rounded-lg hover:bg-[#031d4b] hover:text-[#7bd0ff] transition-all"
                onClick={action.onClick}
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
        )}
      </div>

      {/* Legend Section */}
      {legend.length > 0 && (
        <div className="flex gap-4 mb-6">
          {legend.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${item.color}`}
              ></span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

export default ChartCard;
