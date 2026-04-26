import React from 'react';
import Icon from '../Icon';

/**
 * ActionButton component for consistent button styling across the application
 * 
 * This component provides styled action buttons with multiple variants, icon support,
 * loading states, and disabled states. It follows the Stitch design system with
 * consistent sizing, colors, and transitions.
 * 
 * @param {Object} props
 * @param {string} props.label - The button text label
 * @param {function} props.onClick - Click handler function
 * @param {string} [props.variant='primary'] - Button variant: 'primary', 'secondary', 'tertiary', 'danger'
 * @param {string} [props.icon] - Optional Material Symbol icon name
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 * @param {boolean} [props.loading=false] - Whether the button is in loading state
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <ActionButton 
 *   label="Save Changes" 
 *   onClick={handleSave}
 *   variant="primary"
 *   icon="save"
 * />
 * 
 * @example
 * <ActionButton 
 *   label="Delete Host" 
 *   onClick={handleDelete}
 *   variant="danger"
 *   icon="delete"
 *   disabled={!canDelete}
 * />
 * 
 * @example
 * <ActionButton 
 *   label="Processing..." 
 *   onClick={() => {}}
 *   variant="primary"
 *   loading
 * />
 * 
 * **Validates: Requirements 4.6, 4.9, 7.5**
 */
export function ActionButton({
  label,
  onClick,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  className = '',
}) {
  // Determine variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-[#7bd0ff] text-[#004560] hover:brightness-110';
      case 'secondary':
        return 'bg-[#5b74b1]/10 text-[#dee5ff] border border-[#5b74b1]/20 hover:bg-[#5b74b1]/20';
      case 'tertiary':
        return 'bg-transparent text-[#7bd0ff] hover:bg-[#7bd0ff]/10';
      case 'danger':
        return 'bg-[#ee7d77] text-white hover:brightness-110';
      default:
        return 'bg-[#7bd0ff] text-[#004560] hover:brightness-110';
    }
  };

  const variantStyles = getVariantStyles();
  const disabledStyles = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    onClick(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${variantStyles} ${disabledStyles} ${className}`}
      aria-disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? (
        <Icon name="refresh" size={16} className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={16} />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

export default ActionButton;
