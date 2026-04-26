import React from 'react';

/**
 * FormTextarea component for multi-line text input fields with consistent styling
 * 
 * This component provides a styled textarea with label, validation, and error handling
 * following the Stitch design system. It supports configurable rows and includes
 * a required indicator when needed.
 * 
 * @param {Object} props
 * @param {string} props.label - The label text for the textarea field
 * @param {string} props.value - The current value of the textarea
 * @param {function} props.onChange - Callback function when value changes
 * @param {string} [props.placeholder] - Placeholder text for the textarea
 * @param {string} [props.error] - Error message to display below the textarea
 * @param {boolean} [props.required=false] - Whether the field is required
 * @param {number} [props.rows=4] - Number of visible text rows
 * @param {string} [props.className] - Additional CSS classes for the container
 * 
 * @example
 * <FormTextarea 
 *   label="Description" 
 *   value={description} 
 *   onChange={setDescription}
 *   rows={6}
 *   required
 * />
 * 
 * @example
 * <FormTextarea 
 *   label="Notes" 
 *   value={notes} 
 *   onChange={setNotes}
 *   placeholder="Add any additional notes..."
 *   error="Notes cannot exceed 500 characters"
 * />
 */
export function FormTextarea({
  label,
  value,
  onChange,
  placeholder = '',
  error = '',
  required = false,
  rows = 4,
  className = '',
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  // Generate a unique ID for the textarea based on the label
  const textareaId = `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={`${className}`}>
      <label htmlFor={textareaId} className="block text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
        {label}
        {required && <span className="text-[#ee7d77] ml-1">*</span>}
      </label>
      <textarea
        id={textareaId}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-[#05183c] border border-[#2b4680]/20 rounded-lg py-2 px-4 text-sm text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] focus:outline-none transition-colors placeholder:text-[#91aaeb]/50 resize-y"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : undefined}
      />
      {error && (
        <p id={`${textareaId}-error`} className="text-[#ee7d77] text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormTextarea;
