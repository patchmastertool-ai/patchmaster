import React from 'react';
import Icon from '../Icon';

/**
 * EmptyState Component
 * 
 * Displays a centered message when there is no data to show.
 * Includes an icon, title, description, and optional action button.
 * 
 * @param {Object} props
 * @param {string} props.icon - Material Symbol icon name
 * @param {string} props.title - Main empty state title
 * @param {string} [props.description] - Optional description text
 * @param {React.ReactNode} [props.action] - Optional action button or element
 * @param {string} [props.className] - Additional CSS classes
 * 
 * @example
 * <EmptyState
 *   icon="dns"
 *   title="No hosts found"
 *   description="Get started by adding your first host to the fleet."
 *   action={
 *     <ActionButton
 *       label="Add Host"
 *       onClick={() => navigate('/onboarding')}
 *       variant="primary"
 *       icon="add"
 *     />
 *   }
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center 
        py-16 px-8 text-center
        ${className}
      `}
    >
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-[#05183c] border border-[#2b4680]/20 flex items-center justify-center mb-6">
        <Icon
          name={icon}
          size={40}
          className="text-[#91aaeb]"
        />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-[#dee5ff] mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-[#91aaeb] max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
