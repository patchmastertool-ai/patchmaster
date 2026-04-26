import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormInput } from './FormInput';

describe('FormInput', () => {
  describe('Rendering', () => {
    it('renders with label text', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders with input value', () => {
      render(<FormInput label="Email" value="test@example.com" onChange={() => {}} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('test@example.com');
    });

    it('renders with placeholder', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} placeholder="Enter email" />);
      const input = screen.getByPlaceholderText('Enter email');
      expect(input).toBeInTheDocument();
    });

    it('renders required indicator when required is true', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} required />);
      const asterisk = screen.getByText('*');
      expect(asterisk).toBeInTheDocument();
      expect(asterisk).toHaveClass('text-[#ee7d77]');
    });

    it('does not render required indicator when required is false', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      const asterisk = screen.queryByText('*');
      expect(asterisk).not.toBeInTheDocument();
    });
  });

  describe('Input Types', () => {
    it('renders text input by default', () => {
      render(<FormInput label="Name" value="" onChange={() => {}} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders email input', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders password input', () => {
      render(<FormInput label="Password" value="" onChange={() => {}} type="password" />);
      const input = screen.getByLabelText(/Password/i);
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders number input', () => {
      render(<FormInput label="Age" value="" onChange={() => {}} type="number" />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when error prop is provided', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} error="Invalid email" />);
      const errorMessage = screen.getByText('Invalid email');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-[#ee7d77]');
    });

    it('does not display error message when error prop is empty', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      const errorMessage = screen.queryByText(/Invalid/);
      expect(errorMessage).not.toBeInTheDocument();
    });

    it('sets aria-invalid to true when error is present', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} error="Invalid email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-invalid to false when no error', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('links error message with aria-describedby', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} error="Invalid email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'input-email-error');
    });
  });

  describe('User Interaction', () => {
    it('calls onChange when input value changes', () => {
      let capturedValue = '';
      const handleChange = (value) => { capturedValue = value; };
      render(<FormInput label="Email" value="" onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test@example.com' } });
      
      expect(capturedValue).toBe('test@example.com');
    });

    it('updates value on multiple changes', () => {
      const values = [];
      const handleChange = (value) => { values.push(value); };
      render(<FormInput label="Email" value="" onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });
      
      expect(values).toHaveLength(3);
      expect(values[values.length - 1]).toBe('abc');
    });
  });

  describe('Styling', () => {
    it('applies label styling', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      const label = screen.getByText('Email').closest('label');
      expect(label).toHaveClass('block');
      expect(label).toHaveClass('text-[10px]');
      expect(label).toHaveClass('uppercase');
      expect(label).toHaveClass('tracking-widest');
      expect(label).toHaveClass('font-bold');
      expect(label).toHaveClass('text-[#91aaeb]');
      expect(label).toHaveClass('mb-2');
    });

    it('applies input styling', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('w-full');
      expect(input).toHaveClass('bg-[#05183c]');
      expect(input).toHaveClass('border');
      expect(input).toHaveClass('border-[#2b4680]/20');
      expect(input).toHaveClass('rounded-lg');
      expect(input).toHaveClass('py-2');
      expect(input).toHaveClass('px-4');
      expect(input).toHaveClass('text-sm');
      expect(input).toHaveClass('text-[#dee5ff]');
      expect(input).toHaveClass('focus:ring-1');
      expect(input).toHaveClass('focus:ring-[#7bd0ff]');
      expect(input).toHaveClass('focus:border-[#7bd0ff]');
      expect(input).toHaveClass('focus:outline-none');
      expect(input).toHaveClass('transition-colors');
      expect(input).toHaveClass('placeholder:text-[#91aaeb]/50');
    });

    it('applies error message styling', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} error="Invalid email" />);
      const errorMessage = screen.getByText('Invalid email');
      expect(errorMessage).toHaveClass('text-[#ee7d77]');
      expect(errorMessage).toHaveClass('text-xs');
      expect(errorMessage).toHaveClass('mt-1');
    });

    it('applies custom className to container', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} className="mb-4" />);
      const container = screen.getByText('Email').closest('div');
      expect(container).toHaveClass('mb-4');
    });
  });

  describe('Requirements Validation', () => {
    it('validates Requirement 4.5: FormInput component with validation', () => {
      render(
        <FormInput 
          label="Email" 
          value="test@example.com" 
          onChange={() => {}} 
          placeholder="Enter email"
          error="Invalid format"
          required
          type="email"
        />
      );
      
      // Check all required props are supported
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('test@example.com');
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
      expect(screen.getByText('Invalid format')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('validates Requirement 7.4: Consistent form input styling', () => {
      render(<FormInput label="Email" value="" onChange={() => {}} />);
      
      const label = screen.getByText('Email').closest('label');
      expect(label).toHaveClass('text-[10px]');
      expect(label).toHaveClass('uppercase');
      expect(label).toHaveClass('tracking-widest');
      expect(label).toHaveClass('font-bold');
      expect(label).toHaveClass('text-[#91aaeb]');
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-[#05183c]');
      expect(input).toHaveClass('border-[#2b4680]/20');
      expect(input).toHaveClass('rounded-lg');
      expect(input).toHaveClass('text-[#dee5ff]');
      expect(input).toHaveClass('focus:ring-[#7bd0ff]');
      expect(input).toHaveClass('focus:border-[#7bd0ff]');
    });
  });
});
