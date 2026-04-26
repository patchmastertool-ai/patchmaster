import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ChartCard } from './ChartCard';

describe('ChartCard Component', () => {
  const defaultProps = {
    title: 'Heartbeat Activity',
    children: <div>Chart Content</div>,
  };

  describe('Rendering', () => {
    it('should render title', () => {
      render(<ChartCard {...defaultProps} />);
      expect(screen.getByText('Heartbeat Activity')).toBeInTheDocument();
    });

    it('should render subtitle when provided', () => {
      render(
        <ChartCard {...defaultProps} subtitle="Live Metrics" />
      );
      expect(screen.getByText('Live Metrics')).toBeInTheDocument();
    });

    it('should not render subtitle when not provided', () => {
      render(<ChartCard {...defaultProps} />);
      expect(screen.queryByText('Live Metrics')).not.toBeInTheDocument();
    });

    it('should render children content', () => {
      render(<ChartCard {...defaultProps} />);
      expect(screen.getByText('Chart Content')).toBeInTheDocument();
    });

    it('should render legend items', () => {
      const legend = [
        { label: 'Core Fleet', color: 'bg-primary' },
        { label: 'Edge Nodes', color: 'bg-outline' },
      ];
      render(<ChartCard {...defaultProps} legend={legend} />);
      expect(screen.getByText('Core Fleet')).toBeInTheDocument();
      expect(screen.getByText('Edge Nodes')).toBeInTheDocument();
    });

    it('should not render legend when empty', () => {
      render(<ChartCard {...defaultProps} legend={[]} />);
      expect(screen.queryByText('Core Fleet')).not.toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('should render legend color dots', () => {
      const legend = [
        { label: 'Core Fleet', color: 'bg-primary' },
        { label: 'Edge Nodes', color: 'bg-outline' },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} legend={legend} />
      );
      const dots = container.querySelectorAll('.w-2.h-2.rounded-full');
      expect(dots.length).toBe(2);
    });

    it('should apply correct color classes to legend dots', () => {
      const legend = [
        { label: 'Core Fleet', color: 'bg-primary' },
        { label: 'Edge Nodes', color: 'bg-outline' },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} legend={legend} />
      );
      const dots = container.querySelectorAll('.w-2.h-2.rounded-full');
      expect(dots[0]).toHaveClass('bg-primary');
      expect(dots[1]).toHaveClass('bg-outline');
    });

    it('should display legend labels with correct styling', () => {
      const legend = [
        { label: 'Core Fleet', color: 'bg-primary' },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} legend={legend} />
      );
      const label = screen.getByText('Core Fleet');
      expect(label).toHaveClass(
        'text-[10px]',
        'uppercase',
        'tracking-widest',
        'font-bold',
        'text-[#91aaeb]'
      );
    });
  });

  describe('Actions', () => {
    it('should render action buttons', () => {
      const actions = [
        { label: 'Export', icon: 'download', onClick: vi.fn() },
        { label: 'Refresh', icon: 'refresh', onClick: vi.fn() },
      ];
      render(<ChartCard {...defaultProps} actions={actions} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2);
    });

    it('should call action handler when clicked', () => {
      const handleExport = vi.fn();
      const actions = [
        { label: 'Export', icon: 'download', onClick: handleExport },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} actions={actions} />
      );
      const button = container.querySelector('button');
      fireEvent.click(button);
      expect(handleExport).toHaveBeenCalledTimes(1);
    });

    it('should set title attribute on action buttons', () => {
      const actions = [
        { label: 'Export', icon: 'download', onClick: vi.fn() },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} actions={actions} />
      );
      const button = container.querySelector('button');
      expect(button).toHaveAttribute('title', 'Export');
    });

    it('should not render actions section when empty', () => {
      render(<ChartCard {...defaultProps} actions={[]} />);
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('Styling', () => {
    it('should have correct base styling', () => {
      const { container } = render(<ChartCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveClass(
        'bg-[#05183c]',
        'p-8',
        'rounded-xl',
        'relative',
        'overflow-hidden'
      );
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ChartCard {...defaultProps} className="custom-class" />
      );
      const card = container.firstChild;
      expect(card).toHaveClass('custom-class');
    });

    it('should have correct title styling', () => {
      render(<ChartCard {...defaultProps} />);
      const title = screen.getByText('Heartbeat Activity');
      expect(title).toHaveClass(
        'text-2xl',
        'font-bold',
        'tracking-tight',
        'text-[#dee5ff]'
      );
    });

    it('should have correct subtitle styling', () => {
      render(
        <ChartCard {...defaultProps} subtitle="Live Metrics" />
      );
      const subtitle = screen.getByText('Live Metrics');
      expect(subtitle).toHaveClass(
        'text-[#91aaeb]',
        'uppercase',
        'tracking-[0.15em]',
        'text-[10px]',
        'font-bold'
      );
    });
  });

  describe('Layout', () => {
    it('should have header section with title and actions', () => {
      const actions = [
        { label: 'Export', icon: 'download', onClick: vi.fn() },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} actions={actions} />
      );
      const header = container.querySelector('.flex.justify-between');
      expect(header).toBeInTheDocument();
    });

    it('should position legend below header', () => {
      const legend = [
        { label: 'Core Fleet', color: 'bg-primary' },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} legend={legend} />
      );
      const legendContainer = container.querySelector('.flex.gap-4.mb-6');
      expect(legendContainer).toBeInTheDocument();
    });

    it('should position children below legend', () => {
      const { container } = render(<ChartCard {...defaultProps} />);
      const content = screen.getByText('Chart Content');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Multiple Legends', () => {
    it('should render multiple legend items', () => {
      const legend = [
        { label: 'Core Fleet', color: 'bg-primary' },
        { label: 'Edge Nodes', color: 'bg-outline' },
        { label: 'Backup', color: 'bg-tertiary' },
      ];
      render(<ChartCard {...defaultProps} legend={legend} />);
      expect(screen.getByText('Core Fleet')).toBeInTheDocument();
      expect(screen.getByText('Edge Nodes')).toBeInTheDocument();
      expect(screen.getByText('Backup')).toBeInTheDocument();
    });
  });

  describe('Multiple Actions', () => {
    it('should render multiple action buttons', () => {
      const actions = [
        { label: 'Export', icon: 'download', onClick: vi.fn() },
        { label: 'Refresh', icon: 'refresh', onClick: vi.fn() },
        { label: 'Settings', icon: 'settings', onClick: vi.fn() },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} actions={actions} />
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(3);
    });

    it('should call correct handler for each action', () => {
      const handleExport = vi.fn();
      const handleRefresh = vi.fn();
      const actions = [
        { label: 'Export', icon: 'download', onClick: handleExport },
        { label: 'Refresh', icon: 'refresh', onClick: handleRefresh },
      ];
      const { container } = render(
        <ChartCard {...defaultProps} actions={actions} />
      );
      const buttons = container.querySelectorAll('button');
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
      expect(handleExport).toHaveBeenCalledTimes(1);
      expect(handleRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complex Content', () => {
    it('should render complex children content', () => {
      const complexContent = (
        <div>
          <svg>
            <circle cx="50" cy="50" r="40" />
          </svg>
          <p>Chart Description</p>
        </div>
      );
      render(<ChartCard {...defaultProps} children={complexContent} />);
      expect(screen.getByText('Chart Description')).toBeInTheDocument();
    });
  });
});
