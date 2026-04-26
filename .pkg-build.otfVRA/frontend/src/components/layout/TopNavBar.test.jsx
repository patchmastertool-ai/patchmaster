import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopNavBar } from './TopNavBar';

describe('TopNavBar Component', () => {
  // Default props for testing
  const defaultProps = {
    pageTitle: 'Dashboard',
    pageIcon: 'dashboard',
    onSearch: vi.fn(),
    notificationCount: 3,
    licenseStatus: {
      active: true,
      label: 'License Active',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders the header with correct structure', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('fixed', 'top-0', 'right-0', 'left-64', 'h-16');
    });

    it('applies correct positioning classes', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('fixed', 'top-0', 'right-0', 'left-64');
    });

    it('applies backdrop blur effect', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('backdrop-blur-xl', 'bg-[#060e20]/80');
    });

    it('has correct z-index for layering', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('z-40');
    });

    it('has correct height (h-16 = 64px)', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('h-16');
    });
  });

  describe('Search Functionality', () => {
    it('renders search input with correct placeholder', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      expect(searchInput).toBeInTheDocument();
    });

    it('renders search icon', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const searchIcon = container.querySelector('.material-symbols-outlined');
      
      expect(searchIcon).toBeInTheDocument();
      expect(searchIcon).toHaveTextContent('search');
    });

    it('applies correct styling to search input', () => {
      render(<TopNavBar {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      
      expect(searchInput).toHaveClass(
        'w-full',
        'bg-[#05183c]',
        'border-none',
        'rounded-lg',
        'py-2',
        'pl-10',
        'pr-4',
        'text-sm'
      );
    });

    it('calls onSearch when input value changes', () => {
      const onSearch = vi.fn();
      render(<TopNavBar {...defaultProps} onSearch={onSearch} />);
      
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });
      
      expect(onSearch).toHaveBeenCalledWith('test query');
    });

    it('updates input value when typing', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      fireEvent.change(searchInput, { target: { value: 'ubuntu' } });
      
      expect(searchInput).toHaveValue('ubuntu');
    });

    it('calls onSearch on form submission', () => {
      const onSearch = vi.fn();
      render(<TopNavBar {...defaultProps} onSearch={onSearch} />);
      
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      const form = searchInput.closest('form');
      
      fireEvent.change(searchInput, { target: { value: 'test' } });
      fireEvent.submit(form);
      
      // Should be called twice: once on change, once on submit
      expect(onSearch).toHaveBeenCalledTimes(2);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('does not crash if onSearch is not provided', () => {
      const props = { ...defaultProps, onSearch: undefined };
      
      expect(() => {
        render(<TopNavBar {...props} />);
        const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
        fireEvent.change(searchInput, { target: { value: 'test' } });
      }).not.toThrow();
    });

    it('has correct aria-label for accessibility', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const searchInput = screen.getByLabelText('Global search');
      expect(searchInput).toBeInTheDocument();
    });

    it('positions search icon absolutely on the left', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const searchIcon = container.querySelector('.material-symbols-outlined');
      
      expect(searchIcon).toHaveClass('absolute', 'left-3', 'top-1/2', '-translate-y-1/2');
    });

    it('applies focus ring on search input focus', () => {
      render(<TopNavBar {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      
      expect(searchInput).toHaveClass('focus:ring-1', 'focus:ring-[#7bd0ff]');
    });
  });

  describe('License Status Indicator', () => {
    it('displays license status label', () => {
      render(<TopNavBar {...defaultProps} />);
      
      expect(screen.getByText('License Active')).toBeInTheDocument();
    });

    it('displays active license with correct styling', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const statusElement = screen.getByText('License Active').closest('div');
      expect(statusElement).toHaveClass('bg-[#004c69]/20', 'text-[#7bd0ff]');
    });

    it('displays expired license with error styling', () => {
      const props = {
        ...defaultProps,
        licenseStatus: {
          active: false,
          label: 'License Expired',
        },
      };
      
      render(<TopNavBar {...props} />);
      
      const statusElement = screen.getByText('License Expired').closest('div');
      expect(statusElement).toHaveClass('bg-[#7f2927]/20', 'text-[#ee7d77]');
    });

    it('displays default status when licenseStatus is not provided', () => {
      const props = { ...defaultProps, licenseStatus: undefined };
      
      render(<TopNavBar {...props} />);
      
      expect(screen.getByText('License Status')).toBeInTheDocument();
    });

    it('shows pulsing indicator for active license', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      
      const statusElement = screen.getByText('License Active').closest('div');
      const indicator = statusElement.querySelector('.w-2.h-2');
      
      expect(indicator).toHaveClass('bg-[#7bd0ff]', 'animate-pulse');
    });

    it('shows static indicator for expired license', () => {
      const props = {
        ...defaultProps,
        licenseStatus: {
          active: false,
          label: 'License Expired',
        },
      };
      
      const { container } = render(<TopNavBar {...props} />);
      
      const statusElement = screen.getByText('License Expired').closest('div');
      const indicator = statusElement.querySelector('.w-2.h-2');
      
      expect(indicator).toHaveClass('bg-[#ee7d77]');
      expect(indicator).not.toHaveClass('animate-pulse');
    });

    it('applies uppercase and tracking to license status text', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const statusElement = screen.getByText('License Active').closest('div');
      expect(statusElement).toHaveClass('uppercase', 'tracking-widest');
    });

    it('has role="status" for accessibility', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const statusElement = screen.getByText('License Active').closest('div');
      expect(statusElement).toHaveAttribute('role', 'status');
    });

    it('has aria-live="polite" for screen readers', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const statusElement = screen.getByText('License Active').closest('div');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Notification Bell', () => {
    it('renders notification bell button', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const notificationButton = screen.getByRole('button', { name: /Notifications/ });
      expect(notificationButton).toBeInTheDocument();
    });

    it('displays unread count badge when notifications exist', () => {
      const { container } = render(<TopNavBar {...defaultProps} notificationCount={5} />);
      
      const badge = container.querySelector('.bg-\\[\\#ee7d77\\].rounded-full');
      expect(badge).toBeInTheDocument();
    });

    it('does not display badge when notification count is 0', () => {
      const { container } = render(<TopNavBar {...defaultProps} notificationCount={0} />);
      
      const badge = container.querySelector('.bg-\\[\\#ee7d77\\].rounded-full');
      expect(badge).not.toBeInTheDocument();
    });

    it('includes notification count in aria-label', () => {
      render(<TopNavBar {...defaultProps} notificationCount={3} />);
      
      const notificationButton = screen.getByLabelText('Notifications, 3 unread');
      expect(notificationButton).toBeInTheDocument();
    });

    it('has simple aria-label when no notifications', () => {
      render(<TopNavBar {...defaultProps} notificationCount={0} />);
      
      const notificationButton = screen.getByRole('button', { name: 'Notifications' });
      expect(notificationButton).toBeInTheDocument();
    });

    it('applies hover transition to notification button', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const notificationButton = screen.getByRole('button', { name: /Notifications/ });
      expect(notificationButton).toHaveClass('transition-colors');
    });

    it('positions badge absolutely at top-right', () => {
      const { container } = render(<TopNavBar {...defaultProps} notificationCount={1} />);
      
      const badge = container.querySelector('.bg-\\[\\#ee7d77\\].rounded-full');
      expect(badge).toHaveClass('absolute', 'top-0', 'right-0');
    });

    it('uses error color for notification badge', () => {
      const { container } = render(<TopNavBar {...defaultProps} notificationCount={1} />);
      
      const badge = container.querySelector('.bg-\\[\\#ee7d77\\].rounded-full');
      expect(badge).toHaveClass('bg-[#ee7d77]');
    });
  });

  describe('User Account Menu', () => {
    it('renders user account button', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const accountButton = screen.getByLabelText('User account menu');
      expect(accountButton).toBeInTheDocument();
    });

    it('uses account_circle icon', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const accountIcon = screen.getByLabelText('Account');
      expect(accountIcon).toBeInTheDocument();
    });

    it('applies hover transition to account button', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const accountButton = screen.getByLabelText('User account menu');
      expect(accountButton).toHaveClass('transition-colors');
    });

    it('uses correct color classes', () => {
      render(<TopNavBar {...defaultProps} />);
      
      const accountButton = screen.getByLabelText('User account menu');
      expect(accountButton).toHaveClass('text-[#91aaeb]', 'hover:text-[#dee5ff]');
    });
  });

  describe('Responsive Behavior', () => {
    it('applies flex layout to header', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('flex', 'justify-between', 'items-center');
    });

    it('applies correct padding', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('px-8');
    });

    it('limits search input width', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const searchForm = container.querySelector('form');
      
      expect(searchForm).toHaveClass('max-w-md', 'w-full');
    });

    it('applies flex-1 to left section for proper spacing', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const leftSection = container.querySelector('.flex-1');
      
      expect(leftSection).toBeInTheDocument();
    });

    it('groups action buttons with correct spacing', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const actionButtons = container.querySelectorAll('.flex.items-center.gap-4');
      
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Color Tokens', () => {
    it('uses Stitch color palette for background', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      // Background: #060e20 with 80% opacity
      expect(header).toHaveClass('bg-[#060e20]/80');
    });

    it('uses Stitch color palette for search input', () => {
      render(<TopNavBar {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      
      // Surface container: #05183c
      expect(searchInput).toHaveClass('bg-[#05183c]');
      // Text: #dee5ff (on-surface)
      expect(searchInput).toHaveClass('text-[#dee5ff]');
    });

    it('uses Stitch color palette for search icon', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const searchIcon = container.querySelector('.material-symbols-outlined');
      
      // On-surface-variant: #91aaeb
      expect(searchIcon).toHaveClass('text-[#91aaeb]');
    });

    it('uses Stitch color palette for focus ring', () => {
      render(<TopNavBar {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('Search hosts, patches, or CVEs...');
      
      // Primary: #7bd0ff
      expect(searchInput).toHaveClass('focus:ring-[#7bd0ff]');
    });

    it('uses Stitch color palette for active license', () => {
      render(<TopNavBar {...defaultProps} />);
      const statusElement = screen.getByText('License Active').closest('div');
      
      // Primary container: #004c69 with 20% opacity
      // Primary: #7bd0ff
      expect(statusElement).toHaveClass('bg-[#004c69]/20', 'text-[#7bd0ff]');
    });

    it('uses Stitch color palette for expired license', () => {
      const props = {
        ...defaultProps,
        licenseStatus: {
          active: false,
          label: 'License Expired',
        },
      };
      
      render(<TopNavBar {...props} />);
      const statusElement = screen.getByText('License Expired').closest('div');
      
      // Error container: #7f2927 with 20% opacity
      // Error: #ee7d77
      expect(statusElement).toHaveClass('bg-[#7f2927]/20', 'text-[#ee7d77]');
    });

    it('uses Stitch color palette for notification badge', () => {
      const { container } = render(<TopNavBar {...defaultProps} notificationCount={1} />);
      const badge = container.querySelector('.bg-\\[\\#ee7d77\\].rounded-full');
      
      // Error: #ee7d77
      expect(badge).toHaveClass('bg-[#ee7d77]');
    });
  });

  describe('Accessibility', () => {
    it('uses semantic header element', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toBeInTheDocument();
    });

    it('provides aria-label for search input', () => {
      render(<TopNavBar {...defaultProps} />);
      
      expect(screen.getByLabelText('Global search')).toBeInTheDocument();
    });

    it('provides aria-label for notification button', () => {
      render(<TopNavBar {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
    });

    it('provides aria-label for account button', () => {
      render(<TopNavBar {...defaultProps} />);
      
      expect(screen.getByLabelText('User account menu')).toBeInTheDocument();
    });

    it('uses role="status" for license indicator', () => {
      render(<TopNavBar {...defaultProps} />);
      const statusElement = screen.getByText('License Active').closest('div');
      
      expect(statusElement).toHaveAttribute('role', 'status');
    });

    it('uses aria-live for license status updates', () => {
      render(<TopNavBar {...defaultProps} />);
      const statusElement = screen.getByText('License Active').closest('div');
      
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('hides decorative elements from screen readers', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const decorativeElements = container.querySelectorAll('[aria-hidden="true"]');
      
      expect(decorativeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Layout and Positioning', () => {
    it('offsets from sidebar width (left-64 = 256px)', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('left-64');
    });

    it('spans full width from sidebar to right edge', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('right-0');
    });

    it('is positioned at the top', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('top-0');
    });

    it('has lower z-index than sidebar (z-40 vs z-50)', () => {
      const { container } = render(<TopNavBar {...defaultProps} />);
      const header = container.querySelector('header');
      
      expect(header).toHaveClass('z-40');
    });
  });
});
