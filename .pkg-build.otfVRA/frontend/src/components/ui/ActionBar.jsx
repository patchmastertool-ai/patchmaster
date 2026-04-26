import React from 'react';

/**
 * ActionBar Component
 * 
 * A fixed or sticky action bar typically placed at the bottom of forms or pages.
 * Contains primary and secondary action buttons with consistent spacing.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Action buttons or other content
 * @param {'fixed'|'sticky'|'static'} [props.position='static'] - Positioning behavior
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <ActionBar position="sticky">
 *   <ActionButton label="Cancel" onClick={handleCancel} variant="secondary" />
 *   <ActionButton label="Save Changes" onClick={handleSave} variant="primary" />
 * </ActionBar>
 */
export function ActionBar({
  children,
  position = 'static',
  className = '',
}) {
  const getPositionClasses = () => {
    switch (position) {
      case 'fixed':
        return 'fixed bottom-0 left-0 right-0 z-30';
      case 'sticky':
        return 'sticky bottom-0 z-20';
      case 'static':
      default:
        return '';
    }
  };

  return (
    <div
      className={`
        flex items-center justify-end gap-3 
        px-6 py-4 
        bg-[#05183c] border-t border-[#2b4680]/20
        ${getPositionClasses()}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export default ActionBar;
