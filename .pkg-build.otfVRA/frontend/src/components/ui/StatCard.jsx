import React from 'react';
import Icon from '../Icon';

/**
 * StatCard Component
 * 
 * Displays a metric with icon, value, and optional trend information.
 * Part of the Bento Grid layout system for dashboard statistics.
 * 
 * @param {Object} props
 * @param {string} props.label - Metric label (e.g., "Total Hosts")
 * @param {string|number} props.value - Main metric value (e.g., "1,248")
 * @param {string} props.icon - Material Symbol icon name
 * @param {Object} [props.trend] - Optional trend information
 * @param {string|number} props.trend.value - Trend value (e.g., "+12" or "99.5%")
 * @param {string} props.trend.label - Trend label (e.g., "since yesterday")
 * @param {'primary'|'error'|'tertiary'} [props.variant='primary'] - Border-top color variant
 * @param {Function} [props.onClick] - Click handler
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <StatCard
 *   label="Total Hosts"
 *   value="1,248"
 *   icon="dns"
 *   trend={{ value: '+12', label: 'since yesterday' }}
 *   variant="primary"
 *   onClick={() => navigate('/hosts')}
 * />
 */
export function StatCard({
  label,
  value,
  icon,
  trend,
  variant = 'primary',
  onClick,
  className = '',
}) {
  // Determine border-top color based on variant
  const getBorderColor = () => {
    switch (variant) {
      case 'error':
        return 'border-t-2 border-[#ee7d77]';
      case 'tertiary':
        return 'border-t-2 border-[#ffd16f]';
      case 'primary':
      default:
        return 'border-t-2 border-[#7bd0ff]';
    }
  };

  // Determine icon color based on variant
  const getIconColor = () => {
    switch (variant) {
      case 'error':
        return 'text-[#ee7d77]';
      case 'tertiary':
        return 'text-[#ffd16f]';
      case 'primary':
      default:
        return 'text-[#7bd0ff]';
    }
  };

  return (
    <div
      className={`
        group relative overflow-hidden bg-[#05183c] p-6 rounded-xl 
        transition-all duration-300 hover:bg-[#031d4b] cursor-pointer
        ${getBorderColor()}
        ${className}
      `}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          onClick();
        }
      }}
    >
      {/* Glass gradient overlay effect */}
      <div className="absolute inset-0 glass-gradient opacity-50"></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header: Label and Icon */}
        <div className="flex justify-between items-start mb-4">
          <span className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">
            {label}
          </span>
          <Icon
            name={icon}
            size={24}
            className={getIconColor()}
          />
        </div>

        {/* Main Value */}
        <div className="text-[#dee5ff] text-4xl font-bold mt-2">
          {value}
        </div>

        {/* Optional Trend */}
        {trend && (
          <div className="mt-2 text-xs text-[#91aaeb]/80 flex items-center gap-1">
            <span className={`font-bold ${getIconColor()}`}>
              {trend.value}
            </span>
            {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
