import React from 'react';

/**
 * FormSelect component for dropdown selection fields with consistent styling
 * 
 * This component provides a styled select dropdown with label, validation, and error handling
 * following the Stitch design system. It supports standard options and optgroup for grouped options,
 * with a required indicator when needed.
 * 
 * @param {Object} props
 * @param {string} props.label - The label text for the select field
 * @param {string} props.value - The current selected value
 * @param {function} props.onChange - Callback function when value changes
 * @param {Array<{value: string, label: string, group?: string}>} props.options - Array of option objects
 * @param {string} [props.error] - Error message to display below the select
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {string} [props.className] - Additional CSS classes for the container
 * 
 * @example
 * <FormSelect 
 *   label="Operating System" 
 *   value={os} 
 *   onChange={setOs}
 *   options={[
 *     { value: 'ubuntu', label: 'Ubuntu' },
 *     { value: 'centos', label: 'CentOS' }
 *   ]}
 *   required
 * />
 * 
 * @example
 * // With optgroup support
 * <FormSelect 
 *   label="Package Manager" 
 *   value={pm} 
 *   onChange={setPm}
 *   options={[
 *     { value: 'apt', label: 'APT', group: 'Debian-based' },
 *     { value: 'dpkg', label: 'DPKG', group: 'Debian-based' },
 *     { value: 'yum', label: 'YUM', group: 'RedHat-based' },
 *     { value: 'dnf', label: 'DNF', group: 'RedHat-based' }
 *   ]}
 * />
 * 
 * **Validates: Requirements 4.5, 7.4**
 */
export function FormSelect({
  label,
  value,
  onChange,
  options = [],
  error = '',
  required = false,
  className = '',
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  // Generate a unique ID for the select based on the label
  const selectId = `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  // Group options by their group property
  const groupedOptions = options.reduce((acc, option) => {
    if (option.group) {
      if (!acc[option.group]) {
        acc[option.group] = [];
      }
      acc[option.group].push(option);
    } else {
      if (!acc['__ungrouped__']) {
        acc['__ungrouped__'] = [];
      }
      acc['__ungrouped__'].push(option);
    }
    return acc;
  }, {});

  const hasGroups = Object.keys(groupedOptions).length > 1 || !groupedOptions['__ungrouped__'];

  return (
    <div className={`${className}`}>
      <label htmlFor={selectId} className="block text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
        {label}
        {required && <span className="text-[#ee7d77] ml-1">*</span>}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={handleChange}
        className="w-full bg-[#05183c] border border-[#2b4680]/20 rounded-lg py-2 px-4 text-sm text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none transition-colors"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : undefined}
      >
        {hasGroups ? (
          // Render with optgroups
          Object.entries(groupedOptions).map(([groupName, groupOptions]) => {
            if (groupName === '__ungrouped__') {
              return groupOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#05183c] text-[#dee5ff]">
                  {option.label}
                </option>
              ));
            }
            return (
              <optgroup key={groupName} label={groupName}>
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#05183c] text-[#dee5ff]">
                    {option.label}
                  </option>
                ))}
              </optgroup>
            );
          })
        ) : (
          // Render without optgroups
          options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#05183c] text-[#dee5ff]">
              {option.label}
            </option>
          ))
        )}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="text-[#ee7d77] text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormSelect;
