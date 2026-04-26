import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge Component', () => {
  describe('Rendering', () => {
    it('should render label text', () => {
      render(<StatusBadge status="success" label="Completed" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should render with uppercase text', () => {
      const { container } = render(
        <StatusBadge status="success" label="completed" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('uppercase');
    });
  });

  describe('Status Variants', () => {
    it('should apply success colors', () => {
      const { container } = render(
        <StatusBadge status="success" label="Success" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-[#7bd0ff]/20', 'text-[#7bd0ff]');
    });

    it('should apply warning colors', () => {
      const { container } = render(
        <StatusBadge status="warning" label="Warning" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-[#ffd16f]/20', 'text-[#ffd16f]');
    });

    it('should apply error colors', () => {
      const { container } = render(
        <StatusBadge status="error" label="Error" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-[#ee7d77]/20', 'text-[#ee7d77]');
    });

    it('should apply info colors', () => {
      const { container } = render(
        <StatusBadge status="info" label="Info" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-[#939eb5]/20', 'text-[#939eb5]');
    });

    it('should apply pending colors', () => {
      const { container } = render(
        <StatusBadge status="pending" label="Pending" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-[#5b74b1]/20', 'text-[#5b74b1]');
    });

    it('should apply default colors for unknown status', () => {
      const { container } = render(
        <StatusBadge status="unknown" label="Unknown" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-[#939eb5]/20', 'text-[#939eb5]');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size', () => {
      const { container } = render(
        <StatusBadge status="success" label="Small" size="sm" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('text-[8px]');
    });

    it('should apply medium size by default', () => {
      const { container } = render(
        <StatusBadge status="success" label="Medium" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('text-[9px]');
    });

    it('should apply large size', () => {
      const { container } = render(
        <StatusBadge status="success" label="Large" size="lg" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('text-[10px]');
    });
  });

  describe('Styling', () => {
    it('should have correct base styling', () => {
      const { container } = render(
        <StatusBadge status="success" label="Test" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass(
        'px-1.5',
        'py-0.5',
        'rounded',
        'font-bold',
        'uppercase',
        'tracking-tighter',
        'inline-block'
      );
    });

    it('should apply custom className', () => {
      const { container } = render(
        <StatusBadge
          status="success"
          label="Test"
          className="custom-class"
        />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Text Transformation', () => {
    it('should transform text to uppercase', () => {
      render(<StatusBadge status="success" label="completed" />);
      const badge = screen.getByText('completed');
      expect(badge).toHaveClass('uppercase');
    });

    it('should maintain uppercase for already uppercase text', () => {
      render(<StatusBadge status="success" label="COMPLETED" />);
      const badge = screen.getByText('COMPLETED');
      expect(badge).toHaveClass('uppercase');
    });
  });

  describe('Letter Spacing', () => {
    it('should have tighter letter spacing', () => {
      const { container } = render(
        <StatusBadge status="success" label="Test" />
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('tracking-tighter');
    });
  });

  describe('Accessibility', () => {
    it('should render as a span element', () => {
      const { container } = render(
        <StatusBadge status="success" label="Test" />
      );
      expect(container.firstChild.tagName).toBe('SPAN');
    });

    it('should contain readable text', () => {
      render(<StatusBadge status="success" label="Completed" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('Multiple Badges', () => {
    it('should render multiple badges with different statuses', () => {
      const { container } = render(
        <>
          <StatusBadge status="success" label="Success" />
          <StatusBadge status="error" label="Error" />
          <StatusBadge status="warning" label="Warning" />
        </>
      );
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should render multiple badges with different sizes', () => {
      const { container } = render(
        <>
          <StatusBadge status="success" label="Small" size="sm" />
          <StatusBadge status="success" label="Medium" size="md" />
          <StatusBadge status="success" label="Large" size="lg" />
        </>
      );
      const badges = container.querySelectorAll('span');
      expect(badges[0]).toHaveClass('text-[8px]');
      expect(badges[1]).toHaveClass('text-[9px]');
      expect(badges[2]).toHaveClass('text-[10px]');
    });
  });
});
