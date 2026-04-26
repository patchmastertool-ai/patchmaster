import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard Component', () => {
  const defaultProps = {
    label: 'Total Hosts',
    value: '1,248',
    icon: 'dns',
  };

  describe('Rendering', () => {
    it('should render label and value', () => {
      render(<StatCard {...defaultProps} />);
      expect(screen.getByText('Total Hosts')).toBeInTheDocument();
      expect(screen.getByText('1,248')).toBeInTheDocument();
    });

    it('should render icon', () => {
      render(<StatCard {...defaultProps} />);
      const icon = screen.getByText('dns');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('material-symbols-outlined');
    });

    it('should render trend information when provided', () => {
      const trend = { value: '+12', label: 'since yesterday' };
      render(<StatCard {...defaultProps} trend={trend} />);
      expect(screen.getByText('+12')).toBeInTheDocument();
      expect(screen.getByText('since yesterday')).toBeInTheDocument();
    });

    it('should not render trend when not provided', () => {
      render(<StatCard {...defaultProps} />);
      expect(screen.queryByText('since yesterday')).not.toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should apply primary border color by default', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveClass('border-t-2', 'border-[#7bd0ff]');
    });

    it('should apply error border color for error variant', () => {
      const { container } = render(
        <StatCard {...defaultProps} variant="error" />
      );
      const card = container.firstChild;
      expect(card).toHaveClass('border-t-2', 'border-[#ee7d77]');
    });

    it('should apply tertiary border color for tertiary variant', () => {
      const { container } = render(
        <StatCard {...defaultProps} variant="tertiary" />
      );
      const card = container.firstChild;
      expect(card).toHaveClass('border-t-2', 'border-[#ffd16f]');
    });

    it('should apply correct icon color for primary variant', () => {
      render(<StatCard {...defaultProps} variant="primary" />);
      const icon = screen.getByText('dns');
      expect(icon).toHaveClass('text-[#7bd0ff]');
    });

    it('should apply correct icon color for error variant', () => {
      render(<StatCard {...defaultProps} variant="error" />);
      const icon = screen.getByText('dns');
      expect(icon).toHaveClass('text-[#ee7d77]');
    });

    it('should apply correct icon color for tertiary variant', () => {
      render(<StatCard {...defaultProps} variant="tertiary" />);
      const icon = screen.getByText('dns');
      expect(icon).toHaveClass('text-[#ffd16f]');
    });
  });

  describe('Interactions', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <StatCard {...defaultProps} onClick={handleClick} />
      );
      const card = container.firstChild;
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick handler on Enter key press', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <StatCard {...defaultProps} onClick={handleClick} />
      );
      const card = container.firstChild;
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick handler on Space key press', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <StatCard {...defaultProps} onClick={handleClick} />
      );
      const card = container.firstChild;
      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick on other key presses', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <StatCard {...defaultProps} onClick={handleClick} />
      );
      const card = container.firstChild;
      fireEvent.keyDown(card, { key: 'Escape' });
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should apply hover state classes', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveClass('hover:bg-[#031d4b]');
    });
  });

  describe('Accessibility', () => {
    it('should have role="button"', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveAttribute('role', 'button');
    });

    it('should be keyboard accessible with tabIndex', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <StatCard {...defaultProps} className="custom-class" />
      );
      const card = container.firstChild;
      expect(card).toHaveClass('custom-class');
    });

    it('should have glass-gradient overlay', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const overlay = container.querySelector('.glass-gradient');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('opacity-50');
    });

    it('should have correct base styling', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveClass(
        'bg-[#05183c]',
        'p-6',
        'rounded-xl',
        'transition-all',
        'duration-300',
        'cursor-pointer'
      );
    });
  });

  describe('Trend Display', () => {
    it('should display trend value with correct color for primary variant', () => {
      const trend = { value: '+12', label: 'since yesterday' };
      render(
        <StatCard {...defaultProps} trend={trend} variant="primary" />
      );
      const trendValue = screen.getByText('+12');
      expect(trendValue).toHaveClass('text-[#7bd0ff]');
    });

    it('should display trend value with correct color for error variant', () => {
      const trend = { value: '+12', label: 'since yesterday' };
      render(
        <StatCard {...defaultProps} trend={trend} variant="error" />
      );
      const trendValue = screen.getByText('+12');
      expect(trendValue).toHaveClass('text-[#ee7d77]');
    });

    it('should display trend value with correct color for tertiary variant', () => {
      const trend = { value: '+12', label: 'since yesterday' };
      render(
        <StatCard {...defaultProps} trend={trend} variant="tertiary" />
      );
      const trendValue = screen.getByText('+12');
      expect(trendValue).toHaveClass('text-[#ffd16f]');
    });
  });
});
