import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { ActionButton } from './ActionButton';

describe('ActionButton', () => {
  describe('Rendering', () => {
    it('renders with label text', () => {
      render(<ActionButton label="Save" onClick={() => {}} />);
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders with icon when icon prop is provided', () => {
      render(<ActionButton label="Save" onClick={() => {}} icon="save" />);
      const button = screen.getByRole('button');
      expect(button.querySelector('.material-symbols-outlined')).toBeInTheDocument();
    });

    it('does not render icon when icon prop is not provided', () => {
      render(<ActionButton label="Save" onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button.querySelector('.material-symbols-outlined')).not.toBeInTheDocument();
    });

    it('renders loading spinner when loading is true', () => {
      render(<ActionButton label="Save" onClick={() => {}} loading />);
      const button = screen.getByRole('button');
      const spinner = button.querySelector('.material-symbols-outlined');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('renders icon instead of spinner when loading is false', () => {
      render(<ActionButton label="Save" onClick={() => {}} icon="save" loading={false} />);
      const button = screen.getByRole('button');
      const icon = button.querySelector('.material-symbols-outlined');
      expect(icon).toBeInTheDocument();
      expect(icon).not.toHaveClass('animate-spin');
    });
  });

  describe('Variants', () => {
    it('applies primary variant styles by default', () => {
      render(<ActionButton label="Save" onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-[#7bd0ff]');
      expect(button).toHaveClass('text-[#004560]');
      expect(button).toHaveClass('hover:brightness-110');
    });

    it('applies primary variant styles when variant is primary', () => {
      render(<ActionButton label="Save" onClick={() => {}} variant="primary" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-[#7bd0ff]');
      expect(button).toHaveClass('text-[#004560]');
      expect(button).toHaveClass('hover:brightness-110');
    });

    it('applies secondary variant styles', () => {
      render(<ActionButton label="Cancel" onClick={() => {}} variant="secondary" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-[#5b74b1]/10');
      expect(button).toHaveClass('text-[#dee5ff]');
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('border-[#5b74b1]/20');
      expect(button).toHaveClass('hover:bg-[#5b74b1]/20');
    });

    it('applies tertiary variant styles', () => {
      render(<ActionButton label="View" onClick={() => {}} variant="tertiary" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent');
      expect(button).toHaveClass('text-[#7bd0ff]');
      expect(button).toHaveClass('hover:bg-[#7bd0ff]/10');
    });

    it('applies danger variant styles', () => {
      render(<ActionButton label="Delete" onClick={() => {}} variant="danger" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-[#ee7d77]');
      expect(button).toHaveClass('text-white');
      expect(button).toHaveClass('hover:brightness-110');
    });
  });

  describe('Disabled State', () => {
    it('applies disabled styles when disabled is true', () => {
      render(<ActionButton label="Save" onClick={() => {}} disabled />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
      expect(button).toBeDisabled();
    });

    it('does not apply disabled styles when disabled is false', () => {
      render(<ActionButton label="Save" onClick={() => {}} disabled={false} />);
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('opacity-50');
      expect(button).not.toHaveClass('cursor-not-allowed');
      expect(button).not.toBeDisabled();
    });

    it('sets aria-disabled to true when disabled', () => {
      render(<ActionButton label="Save" onClick={() => {}} disabled />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} disabled />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('applies disabled styles when loading is true', () => {
      render(<ActionButton label="Save" onClick={() => {}} loading />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
      expect(button).toBeDisabled();
    });

    it('sets aria-busy to true when loading', () => {
      render(<ActionButton label="Save" onClick={() => {}} loading />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} loading />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('shows spinner icon when loading', () => {
      render(<ActionButton label="Save" onClick={() => {}} loading />);
      const button = screen.getByRole('button');
      const spinner = button.querySelector('.material-symbols-outlined');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('User Interaction', () => {
    it('calls onClick when button is clicked', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Enter key is pressed', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} />);
      const button = screen.getByRole('button');
      
      fireEvent.keyDown(button, { key: 'Enter' });
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} />);
      const button = screen.getByRole('button');
      
      fireEvent.keyDown(button, { key: ' ' });
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick for other keys', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} />);
      const button = screen.getByRole('button');
      
      fireEvent.keyDown(button, { key: 'a' });
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('can be clicked multiple times', () => {
      const handleClick = vi.fn();
      render(<ActionButton label="Save" onClick={handleClick} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Styling', () => {
    it('applies base className styles', () => {
      render(<ActionButton label="Save" onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4');
      expect(button).toHaveClass('py-2');
      expect(button).toHaveClass('text-xs');
      expect(button).toHaveClass('font-bold');
      expect(button).toHaveClass('rounded-lg');
      expect(button).toHaveClass('transition-all');
      expect(button).toHaveClass('duration-200');
      expect(button).toHaveClass('flex');
      expect(button).toHaveClass('items-center');
      expect(button).toHaveClass('gap-2');
    });

    it('applies custom className', () => {
      render(<ActionButton label="Save" onClick={() => {}} className="mt-4" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('mt-4');
    });

    it('renders icon with 16px size', () => {
      render(<ActionButton label="Save" onClick={() => {}} icon="save" />);
      const button = screen.getByRole('button');
      const icon = button.querySelector('.material-symbols-outlined');
      expect(icon).toHaveStyle({ fontSize: '16px' });
    });
  });

  describe('Requirements Validation', () => {
    it('validates Requirement 4.6: ActionButton component with variants', () => {
      const { rerender } = render(
        <ActionButton 
          label="Test" 
          onClick={() => {}} 
          variant="primary"
          icon="save"
          disabled={false}
          loading={false}
        />
      );
      
      // Check all required props are supported
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
      
      // Test all variants
      rerender(<ActionButton label="Test" onClick={() => {}} variant="primary" />);
      expect(screen.getByRole('button')).toHaveClass('bg-[#7bd0ff]');
      
      rerender(<ActionButton label="Test" onClick={() => {}} variant="secondary" />);
      expect(screen.getByRole('button')).toHaveClass('bg-[#5b74b1]/10');
      
      rerender(<ActionButton label="Test" onClick={() => {}} variant="tertiary" />);
      expect(screen.getByRole('button')).toHaveClass('bg-transparent');
      
      rerender(<ActionButton label="Test" onClick={() => {}} variant="danger" />);
      expect(screen.getByRole('button')).toHaveClass('bg-[#ee7d77]');
    });

    it('validates Requirement 4.9: Disabled and loading states', () => {
      const { rerender } = render(
        <ActionButton label="Test" onClick={() => {}} disabled />
      );
      
      // Check disabled state
      expect(screen.getByRole('button')).toHaveClass('opacity-50');
      expect(screen.getByRole('button')).toHaveClass('cursor-not-allowed');
      
      // Check loading state
      rerender(<ActionButton label="Test" onClick={() => {}} loading />);
      expect(screen.getByRole('button')).toHaveClass('opacity-50');
      expect(screen.getByRole('button')).toHaveClass('cursor-not-allowed');
      expect(screen.getByRole('button').querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('validates Requirement 7.5: Consistent button styling', () => {
      render(<ActionButton label="Test" onClick={() => {}} />);
      
      const button = screen.getByRole('button');
      
      // Font size = 12px (text-xs)
      expect(button).toHaveClass('text-xs');
      
      // Font weight = 700 (font-bold)
      expect(button).toHaveClass('font-bold');
      
      // Padding and border radius
      expect(button).toHaveClass('px-4');
      expect(button).toHaveClass('py-2');
      expect(button).toHaveClass('rounded-lg');
      
      // Transition
      expect(button).toHaveClass('transition-all');
      expect(button).toHaveClass('duration-200');
      
      // Flex layout for icon + text
      expect(button).toHaveClass('flex');
      expect(button).toHaveClass('items-center');
      expect(button).toHaveClass('gap-2');
    });
  });
});
