import React from 'react';

/**
 * FormInput component for text input fields with consistent styling
 * 
 * This component provides a styled text input with label, validation, and error handling
 * following the Stitch design system. It supports various input types and includes
 * a required indicator when needed.
 * 
 * @param {Object} props
 * @param {string} props.label - The label text for the input field
 * @param {string} props.value - The current value of the input
 * @param {function} props.onChange - Callback function when value changes
 * @param {string} [props.placeholder] - Placeholder text for the input
 * @param {string} [props.error] - Error message to display below the input
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {string} [props.type='text'] - Input type: 'text', 'email', 'password', 'number'
 * @param {string} [props.className] - Additional CSS classes for the container
 * 
 * @example
 * <FormInput 
 *   label="Email Address" 
 *   value={email} 
 *   onChange={setEmail}
 *   type="email"
 *   required
 * />
 * 
 * @example
 * <FormInput 
 *   label="Password" 
 *   value={password} 
 *   onChange={setPassword}
 *   type="password"
 *   error="Password must be at least 8 characters"
 * />
 * 
 * **Validates: Requirements 4.5, 7.4**
 */
export function FormInput({
  label,
  value,
  onChange,
  placeholder = '',
  error = '',
  required = false,
  type = 'text',
  className = '',
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  // Generate a unique ID for the input based on the label
  const inputId = `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`${className}`}>
      <label htmlFor={inputId} className="block text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
        {label}
        {required && <span className="text-[#ee7d77] ml-1">*</span>}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-[#05183c] border border-[#2b4680]/20 rounded-lg py-2 px-4 text-sm text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none transition-colors placeholder:text-[#91aaeb]/50"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-[#ee7d77] text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormInput;
