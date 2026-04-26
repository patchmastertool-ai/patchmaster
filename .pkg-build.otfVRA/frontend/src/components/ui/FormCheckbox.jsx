import React from 'react';

/**
 * FormCheckbox component for checkbox input fields with consistent styling
 * 
 * This component provides a styled checkbox with label and error handling
 * following the Stitch design system. It supports custom styling and
 * includes proper accessibility attributes.
 * 
 * @param {Object} props
 * @param {string} props.label - The label text for the checkbox
 * @param {boolean} props.checked - Whether the checkbox is checked
 * @param {function} props.onChange - Callback function when checked state changes
 * @param {string} [props.error] - Error message to display below the checkbox
 * @param {boolean} [props.disabled=false] - Whether the checkbox is disabled
 * @param {string} [props.className] - Additional CSS classes for the container
 * 
 * @example
 * <FormCheckbox 
 *   label="Enable automatic updates" 
 *   checked={autoUpdate} 
 *   onChange={setAutoUpdate}
 * />
 * 
 * @example
 * <FormCheckbox 
 *   label="I agree to the terms and conditions" 
 *   checked={agreed} 
 *   onChange={setAgreed}
 *   error="You must agree to continue"
 * />
 */
export function FormCheckbox({
  label,
  checked,
  onChange,
  error = '',
  disabled = false,
  className = '',
}) {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };

  // Generate a unique ID for the checkbox based on the label
  const checkboxId = `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`${className}`}>
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="mt-0.5 w-4 h-4 bg-[#05183c] border border-[#2b4680]/20 rounded text-[#7bd0ff] focus:ring-1 focus:ring-[#7bd0ff] focus:ring-offset-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${checkboxId}-error` : undefined}
        />
        <label
          htmlFor={checkboxId}
          className={`text-sm text-[#dee5ff] cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {label}
        </label>
      </div>
      {error && (
        <p id={`${checkboxId}-error`} className="text-[#ee7d77] text-xs mt-1 ml-7">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormCheckbox;
