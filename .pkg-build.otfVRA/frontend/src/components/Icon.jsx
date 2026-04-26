import React from 'react';

/**
 * Icon component wrapper for Material Symbols Outlined
 * 
 * This component provides a secure, validated interface for rendering Material Symbols icons
 * with consistent styling and security controls.
 * 
 * @param {Object} props
 * @param {string} props.name - The Material Symbol icon name (validated against whitelist)
 * @param {number} [props.size=24] - Icon size in pixels (optical size)
 * @param {number} [props.weight=400] - Icon weight (100-700)
 * @param {number} [props.fill=0] - Icon fill (0 for outlined, 1 for filled)
 * @param {number} [props.grade=0] - Icon grade (-50 to 200)
 * @param {string} [props.className] - Additional CSS classes
 * @param {Object} [props.style] - Additional inline styles
 * @param {string} [props.ariaLabel] - Accessible label for screen readers
 * 
 * @example
 * <Icon name="dashboard" size={24} />
 * <Icon name="settings" size={20} weight={500} className="text-primary" />
 */
export function Icon({ 
  name, 
  size = 24, 
  weight = 400, 
  fill = 0, 
  grade = 0,
  className = '',
  style = {},
  ariaLabel,
  ...props
}) {
  // Validate icon name against whitelist
  const validatedName = validateIconName(name);
  
  // Build the style object with Material Symbols variables
  const iconStyle = {
    fontFamily: 'Material Symbols Outlined',
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontSize: `${size}px`,
    lineHeight: 1,
    letterSpacing: 'normal',
    textTransform: 'none',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    wordWrap: 'normal',
    direction: 'ltr',
    fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${size}`,
    ...style,
  };

  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={iconStyle}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      {...props}
    >
      {validatedName}
    </span>
  );
}

/**
 * Whitelist of allowed Material Symbol icon names
 * This prevents injection attacks and ensures only valid icons are rendered
 */
const ICON_WHITELIST = new Set([
  // Navigation & Layout
  'dashboard',
  'dns',
  'system_update',
  'system_update_alt',
  'terminal',
  'security',
  'backup',
  'policy',
  'monitoring',
  'analytics',
  'settings',
  'group',
  'notifications',
  'search',
  'filter_list',
  'refresh',
  'menu',
  'close',
  'arrow_back',
  'arrow_forward',
  'expand_more',
  'expand_less',
  'chevron_left',
  'chevron_right',
  'arrow_upward',
  'arrow_downward',
  'restart_alt',
  'add_circle',
  'power_settings_new',
  
  // Actions
  'add',
  'edit',
  'delete',
  'download',
  'upload',
  'save',
  'cancel',
  'check',
  'more_vert',
  'more_horiz',
  'play_arrow',
  
  // Status & Indicators
  'check_circle',
  'warning',
  'error',
  'info',
  'pending',
  'schedule',
  'done',
  'close',
  'sensors',
  'shield',
  'cloud_off',
  
  // Content
  'folder',
  'description',
  'code',
  'bug_report',
  'build',
  'storage',
  'cloud',
  'cloud_off',
  'cloud_upload',
  'cloud_download',
  
  // Communication
  'mail',
  'chat',
  'comment',
  'feedback',
  
  // Media
  'play_arrow',
  'pause',
  'stop',
  'skip_next',
  'skip_previous',
  
  // Misc
  'visibility',
  'visibility_off',
  'lock',
  'lock_open',
  'key',
  'vpn_key',
  'help',
  'help_outline',
  'lightbulb',
  'star',
  'star_outline',
  'favorite',
  'favorite_border',
]);

/**
 * Validates icon name against whitelist and sanitizes input
 * 
 * @param {string} name - Icon name to validate
 * @returns {string} - Valid icon name or fallback
 */
function validateIconName(name) {
  // Return fallback for invalid input
  if (!name || typeof name !== 'string') {
    console.warn('Icon: Invalid icon name provided, using fallback');
    return 'more_horiz';
  }
  
  // Sanitize: remove special characters and convert to lowercase
  const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  
  // Check against whitelist
  if (!ICON_WHITELIST.has(sanitized)) {
    console.warn(`Icon: "${name}" not in whitelist, using fallback. Add to whitelist if this is a valid icon.`);
    return 'more_horiz';
  }
  
  return sanitized;
}

/**
 * Helper function to check if an icon name is valid
 * Useful for conditional rendering or validation
 * 
 * @param {string} name - Icon name to check
 * @returns {boolean} - True if icon is in whitelist
 */
export function isValidIcon(name) {
  if (!name || typeof name !== 'string') return false;
  const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  return ICON_WHITELIST.has(sanitized);
}

/**
 * Get all valid icon names from the whitelist
 * Useful for documentation or icon pickers
 * 
 * @returns {string[]} - Array of valid icon names
 */
export function getValidIconNames() {
  return Array.from(ICON_WHITELIST).sort();
}

export default Icon;
