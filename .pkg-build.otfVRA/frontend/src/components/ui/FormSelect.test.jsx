import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormSelect } from './FormSelect';

describe('FormSelect', () => {
  const basicOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const groupedOptions = [
    { value: 'ubuntu', label: 'Ubuntu', group: 'Debian-based' },
    { value: 'debian', label: 'Debian', group: 'Debian-based' },
    { value: 'centos', label: 'CentOS', group: 'RedHat-based' },
    { value: 'fedora', label: 'Fedora', group: 'RedHat-based' },
  ];

  describe('Rendering', () => {
    it('renders with label text', () => {
      render(<FormSelect label="Operating System" value="" onChange={() => {}} options={basicOptions} />);
      expect(screen.getByText('Operating System')).toBeInTheDocument();
    });

    it('renders with selected value', () => {
      render(<FormSelect label="OS" value="option2" onChange={() => {}} options={basicOptions} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('option2');
    });

    it('renders all options', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('renders required indicator when required is true', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} required />);
      const asterisk = screen.getByText('*');
      expect(asterisk).toBeInTheDocument();
      expect(asterisk).toHaveClass('text-[#ee7d77]');
    });

    it('does not render required indicator when required is false', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const asterisk = screen.queryByText('*');
      expect(asterisk).not.toBeInTheDocument();
    });
  });

  describe('Grouped Options', () => {
    it('renders optgroups when options have group property', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={groupedOptions} />);
      
      // Check that optgroups exist
      const debianGroup = screen.getByRole('group', { name: 'Debian-based' });
      const redhatGroup = screen.getByRole('group', { name: 'RedHat-based' });
      
      expect(debianGroup).toBeInTheDocument();
      expect(redhatGroup).toBeInTheDocument();
    });

    it('renders options within correct optgroups', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={groupedOptions} />);
      
      expect(screen.getByText('Ubuntu')).toBeInTheDocument();
      expect(screen.getByText('Debian')).toBeInTheDocument();
      expect(screen.getByText('CentOS')).toBeInTheDocument();
      expect(screen.getByText('Fedora')).toBeInTheDocument();
    });

    it('renders ungrouped options without optgroup', () => {
      const mixedOptions = [
        { value: 'opt1', label: 'Ungrouped Option' },
        { value: 'opt2', label: 'Grouped Option', group: 'Group A' },
      ];
      
      render(<FormSelect label="Mixed" value="" onChange={() => {}} options={mixedOptions} />);
      
      expect(screen.getByText('Ungrouped Option')).toBeInTheDocument();
      expect(screen.getByText('Grouped Option')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when error prop is provided', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} error="Please select an option" />);
      const errorMessage = screen.getByText('Please select an option');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-[#ee7d77]');
    });

    it('does not display error message when error prop is empty', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const errorMessage = screen.queryByText(/Please select/);
      expect(errorMessage).not.toBeInTheDocument();
    });

    it('sets aria-invalid to true when error is present', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} error="Invalid selection" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-invalid to false when no error', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'false');
    });

    it('links error message with aria-describedby', () => {
      render(<FormSelect label="Operating System" value="" onChange={() => {}} options={basicOptions} error="Invalid" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'select-operating-system-error');
    });
  });

  describe('User Interaction', () => {
    it('calls onChange when selection changes', () => {
      let capturedValue = '';
      const handleChange = (value) => { capturedValue = value; };
      render(<FormSelect label="OS" value="" onChange={handleChange} options={basicOptions} />);
      const select = screen.getByRole('combobox');
      
      fireEvent.change(select, { target: { value: 'option2' } });
      
      expect(capturedValue).toBe('option2');
    });

    it('updates value on multiple changes', () => {
      const values = [];
      const handleChange = (value) => { values.push(value); };
      render(<FormSelect label="OS" value="" onChange={handleChange} options={basicOptions} />);
      const select = screen.getByRole('combobox');
      
      fireEvent.change(select, { target: { value: 'option1' } });
      fireEvent.change(select, { target: { value: 'option2' } });
      fireEvent.change(select, { target: { value: 'option3' } });
      
      expect(values).toHaveLength(3);
      expect(values[values.length - 1]).toBe('option3');
    });
  });

  describe('Styling', () => {
    it('applies label styling', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const label = screen.getByText('OS').closest('label');
      expect(label).toHaveClass('block');
      expect(label).toHaveClass('text-[10px]');
      expect(label).toHaveClass('uppercase');
      expect(label).toHaveClass('tracking-widest');
      expect(label).toHaveClass('font-bold');
      expect(label).toHaveClass('text-[#91aaeb]');
      expect(label).toHaveClass('mb-2');
    });

    it('applies select styling', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('w-full');
      expect(select).toHaveClass('bg-[#05183c]');
      expect(select).toHaveClass('border');
      expect(select).toHaveClass('border-[#2b4680]/20');
      expect(select).toHaveClass('rounded-lg');
      expect(select).toHaveClass('py-2');
      expect(select).toHaveClass('px-4');
      expect(select).toHaveClass('text-sm');
      expect(select).toHaveClass('text-[#dee5ff]');
      expect(select).toHaveClass('focus:ring-1');
      expect(select).toHaveClass('focus:ring-[#7bd0ff]');
      expect(select).toHaveClass('focus:border-[#7bd0ff]');
      expect(select).toHaveClass('focus:outline-none');
      expect(select).toHaveClass('transition-colors');
    });

    it('applies option styling', () => {
      const { container } = render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const options = container.querySelectorAll('option');
      
      options.forEach(option => {
        expect(option).toHaveClass('bg-[#05183c]');
        expect(option).toHaveClass('text-[#dee5ff]');
      });
    });

    it('applies error message styling', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} error="Invalid selection" />);
      const errorMessage = screen.getByText('Invalid selection');
      expect(errorMessage).toHaveClass('text-[#ee7d77]');
      expect(errorMessage).toHaveClass('text-xs');
      expect(errorMessage).toHaveClass('mt-1');
    });

    it('applies custom className to container', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} className="mb-4" />);
      const container = screen.getByText('OS').closest('div');
      expect(container).toHaveClass('mb-4');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty options array', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={[]} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.children).toHaveLength(0);
    });

    it('handles options without group property', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });

    it('handles single option', () => {
      const singleOption = [{ value: 'only', label: 'Only Option' }];
      render(<FormSelect label="OS" value="only" onChange={() => {}} options={singleOption} />);
      expect(screen.getByText('Only Option')).toBeInTheDocument();
    });
  });

  describe('Requirements Validation', () => {
    it('validates Requirement 4.5: FormSelect component with validation', () => {
      render(
        <FormSelect 
          label="Operating System" 
          value="ubuntu" 
          onChange={() => {}} 
          options={groupedOptions}
          error="Invalid selection"
          required
        />
      );
      
      // Check all required props are supported
      expect(screen.getByText('Operating System')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('ubuntu');
      expect(screen.getByText('Invalid selection')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
      
      // Check options are rendered
      expect(screen.getByText('Ubuntu')).toBeInTheDocument();
      expect(screen.getByText('CentOS')).toBeInTheDocument();
    });

    it('validates Requirement 7.4: Consistent form select styling', () => {
      render(<FormSelect label="OS" value="" onChange={() => {}} options={basicOptions} />);
      
      const label = screen.getByText('OS').closest('label');
      expect(label).toHaveClass('text-[10px]');
      expect(label).toHaveClass('uppercase');
      expect(label).toHaveClass('tracking-widest');
      expect(label).toHaveClass('font-bold');
      expect(label).toHaveClass('text-[#91aaeb]');
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('bg-[#05183c]');
      expect(select).toHaveClass('border-[#2b4680]/20');
      expect(select).toHaveClass('rounded-lg');
      expect(select).toHaveClass('text-[#dee5ff]');
      expect(select).toHaveClass('focus:ring-[#7bd0ff]');
      expect(select).toHaveClass('focus:border-[#7bd0ff]');
    });
  });
});
