import React from 'react';

/**
 * StatusBadge Component
 * 
 * Displays a small colored label indicating status.
 * Used for quick visual identification of states across the application.
 * 
 * @param {Object} props
 * @param {'success'|'warning'|'error'|'info'|'pending'} props.status - Status type
 * @param {string} props.label - Badge text label
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Badge size
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <StatusBadge status="success" label="Completed" />
 * <StatusBadge status="error" label="Failed" size="lg" />
 * <StatusBadge status="pending" label="In Progress" size="sm" />
 */
export function StatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}) {
  // Get background and text colors based on status
  const getStatusColors = () => {
    switch (status) {
      case 'success':
        return 'bg-[#7bd0ff]/20 text-[#7bd0ff]';
      case 'warning':
        return 'bg-[#ffd16f]/20 text-[#ffd16f]';
      case 'error':
        return 'bg-[#ee7d77]/20 text-[#ee7d77]';
      case 'info':
        return 'bg-[#939eb5]/20 text-[#939eb5]';
      case 'pending':
        return 'bg-[#5b74b1]/20 text-[#5b74b1]';
      default:
        return 'bg-[#939eb5]/20 text-[#939eb5]';
    }
  };

  // Get font size based on size prop
  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 'text-[8px]';
      case 'lg':
        return 'text-[10px]';
      case 'md':
      default:
        return 'text-[9px]';
    }
  };

  return (
    <span
      className={`
        px-1.5 py-0.5 rounded text-[9px] font-bold uppercase 
        tracking-tighter inline-block
        ${getStatusColors()}
        ${getFontSize()}
        ${className}
      `}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
