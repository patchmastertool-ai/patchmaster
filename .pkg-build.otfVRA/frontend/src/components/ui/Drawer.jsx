import React, { useEffect } from 'react';
import Icon from '../Icon';

/**
 * Drawer Component
 * 
 * A slide-over panel that appears from the right side of the screen.
 * Used for detailed views, forms, and contextual information.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the drawer is open
 * @param {Function} props.onClose - Callback when drawer should close
 * @param {string} props.title - Drawer title
 * @param {React.ReactNode} props.children - Drawer content
 * @param {React.ReactNode} [props.footer] - Optional footer content (typically action buttons)
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md'] - Drawer width
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <Drawer
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Host Details"
 *   footer={
 *     <ActionButton label="Save" onClick={handleSave} variant="primary" />
 *   }
 * >
 *   <div>Host information here...</div>
 * </Drawer>
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
}) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Get drawer width based on size
  const getDrawerWidth = () => {
    switch (size) {
      case 'sm':
        return 'w-80';
      case 'lg':
        return 'w-[600px]';
      case 'xl':
        return 'w-[800px]';
      case 'md':
      default:
        return 'w-96';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={`fixed right-0 top-0 h-full ${getDrawerWidth()} bg-[#06122d] shadow-2xl z-50 flex flex-col border-l border-[#2b4680]/20 ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2b4680]/20">
          <h2
            id="drawer-title"
            className="text-xl font-bold text-[#dee5ff] tracking-tight"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#031d4b] transition-colors"
            aria-label="Close drawer"
          >
            <Icon name="close" size={24} className="text-[#91aaeb]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-[#2b4680]/20 bg-[#05183c]">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

export default Drawer;
