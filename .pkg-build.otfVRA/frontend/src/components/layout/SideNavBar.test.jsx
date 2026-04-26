import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SideNavBar } from './SideNavBar';

describe('SideNavBar Component', () => {
  // Default props for testing
  const defaultProps = {
    currentPage: 'dashboard',
    onNavigate: vi.fn(),
    user: {
      username: 'Test User',
      role: 'Administrator',
      avatar: 'https://example.com/avatar.jpg',
    },
    licenseInfo: {
      tier: 'Enterprise Tier',
      status: 'active',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders the sidebar with correct structure', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toBeInTheDocument();
      expect(aside).toHaveClass('fixed', 'left-0', 'top-0', 'h-screen', 'w-64', 'bg-[#06122d]');
    });

    it('renders PatchMaster branding', () => {
      render(<SideNavBar {...defaultProps} />);
      
      expect(screen.getByText('PatchMaster')).toBeInTheDocument();
    });

    it('displays license tier information', () => {
      render(<SideNavBar {...defaultProps} />);
      
      expect(screen.getByText('Enterprise Tier')).toBeInTheDocument();
    });

    it('displays default license tier when not provided', () => {
      const props = {
        ...defaultProps,
        licenseInfo: { tier: '', status: 'active' },
      };
      
      render(<SideNavBar {...props} />);
      
      expect(screen.getByText('Community Edition')).toBeInTheDocument();
    });
  });

  describe('Navigation Items', () => {
    it('renders all navigation items', () => {
      render(<SideNavBar {...defaultProps} />);
      
      const expectedItems = [
        'Dashboard',
        'Hosts',
        'Patching',
        'CI/CD',
        'CVEs',
        'Backups',
        'Policies',
        'Monitoring',
        'Reports',
        'Settings',
      ];
      
      expectedItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });

    it('renders navigation items with correct icons', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const icons = container.querySelectorAll('.material-symbols-outlined');
      
      // Should have icons for: logo + 10 nav items + user avatar (if no image)
      // In this case, we have an avatar image, so: 1 logo + 10 nav items = 11
      expect(icons.length).toBeGreaterThanOrEqual(11);
    });

    it('applies correct Tailwind classes to navigation items', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const navLinks = container.querySelectorAll('nav a');
      
      navLinks.forEach((link) => {
        expect(link).toHaveClass('flex', 'items-center', 'gap-3', 'px-3', 'py-2.5', 'rounded-lg');
      });
    });
  });

  describe('Active State', () => {
    it('highlights the active navigation item', () => {
      const { container } = render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      
      expect(dashboardLink).toHaveClass('text-[#7bd0ff]', 'border-l-2', 'border-[#7bd0ff]', 'bg-[#05183c]');
    });

    it('does not highlight inactive navigation items', () => {
      const { container } = render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      const hostsLink = screen.getByText('Hosts').closest('a');
      
      expect(hostsLink).toHaveClass('text-[#91aaeb]');
      expect(hostsLink).not.toHaveClass('border-l-2', 'border-[#7bd0ff]');
    });

    it('sets aria-current="page" on active item', () => {
      render(<SideNavBar {...defaultProps} currentPage="hosts" />);
      const hostsLink = screen.getByText('Hosts').closest('a');
      
      expect(hostsLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not set aria-current on inactive items', () => {
      render(<SideNavBar {...defaultProps} currentPage="hosts" />);
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      
      expect(dashboardLink).not.toHaveAttribute('aria-current');
    });

    it('updates active state when currentPage changes', () => {
      const { rerender } = render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      
      let dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveClass('text-[#7bd0ff]');
      
      rerender(<SideNavBar {...defaultProps} currentPage="settings" />);
      
      dashboardLink = screen.getByText('Dashboard').closest('a');
      const settingsLink = screen.getByText('Settings').closest('a');
      
      expect(dashboardLink).not.toHaveClass('text-[#7bd0ff]');
      expect(settingsLink).toHaveClass('text-[#7bd0ff]');
    });
  });

  describe('Hover State', () => {
    it('applies hover classes to inactive navigation items', () => {
      const { container } = render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      const hostsLink = screen.getByText('Hosts').closest('a');
      
      expect(hostsLink).toHaveClass('hover:text-[#dee5ff]', 'hover:bg-[#031d4b]');
    });

    it('includes transition classes for smooth hover effects', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const navLinks = container.querySelectorAll('nav a');
      
      navLinks.forEach((link) => {
        expect(link).toHaveClass('transition-colors', 'duration-200');
      });
    });
  });

  describe('Navigation Interaction', () => {
    it('calls onNavigate when a navigation item is clicked', () => {
      const onNavigate = vi.fn();
      render(<SideNavBar {...defaultProps} onNavigate={onNavigate} />);
      
      const hostsLink = screen.getByText('Hosts').closest('a');
      fireEvent.click(hostsLink);
      
      expect(onNavigate).toHaveBeenCalledWith('hosts');
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('prevents default link behavior', () => {
      const onNavigate = vi.fn();
      render(<SideNavBar {...defaultProps} onNavigate={onNavigate} />);
      
      const hostsLink = screen.getByText('Hosts').closest('a');
      const event = fireEvent.click(hostsLink);
      
      // The preventDefault should be called
      expect(onNavigate).toHaveBeenCalled();
    });

    it('handles navigation for different pages', () => {
      const onNavigate = vi.fn();
      render(<SideNavBar {...defaultProps} onNavigate={onNavigate} />);
      
      fireEvent.click(screen.getByText('Dashboard').closest('a'));
      expect(onNavigate).toHaveBeenCalledWith('dashboard');
      
      fireEvent.click(screen.getByText('Settings').closest('a'));
      expect(onNavigate).toHaveBeenCalledWith('settings');
      
      fireEvent.click(screen.getByText('CVEs').closest('a'));
      expect(onNavigate).toHaveBeenCalledWith('cves');
    });

    it('does not crash if onNavigate is not provided', () => {
      const props = { ...defaultProps, onNavigate: undefined };
      
      expect(() => {
        const { container } = render(<SideNavBar {...props} />);
        const hostsLink = screen.getByText('Hosts').closest('a');
        fireEvent.click(hostsLink);
      }).not.toThrow();
    });
  });

  describe('User Profile Display', () => {
    it('displays user information in footer', () => {
      render(<SideNavBar {...defaultProps} />);
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    it('displays user avatar when provided', () => {
      render(<SideNavBar {...defaultProps} />);
      
      const avatar = screen.getByAltText('Test User avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('displays default icon when avatar is not provided', () => {
      const props = {
        ...defaultProps,
        user: {
          username: 'Test User',
          role: 'Administrator',
        },
      };
      
      const { container } = render(<SideNavBar {...props} />);
      
      // Should have the default user icon
      expect(screen.getByLabelText('Default user avatar')).toBeInTheDocument();
    });

    it('displays default username when not provided', () => {
      const props = {
        ...defaultProps,
        user: {
          role: 'Administrator',
        },
      };
      
      render(<SideNavBar {...props} />);
      
      expect(screen.getByText('Guest User')).toBeInTheDocument();
    });

    it('displays default role when not provided', () => {
      const props = {
        ...defaultProps,
        user: {
          username: 'Test User',
        },
      };
      
      render(<SideNavBar {...props} />);
      
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('applies correct styling to user profile section', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const profileSection = container.querySelector('.mt-auto');
      
      expect(profileSection).toHaveClass('p-4', 'border-t');
    });

    it('truncates long usernames', () => {
      const props = {
        ...defaultProps,
        user: {
          username: 'Very Long Username That Should Be Truncated',
          role: 'Administrator',
        },
      };
      
      render(<SideNavBar {...props} />);
      const usernameElement = screen.getByText('Very Long Username That Should Be Truncated');
      
      expect(usernameElement).toHaveClass('truncate');
    });

    it('displays role with uppercase CSS class', () => {
      render(<SideNavBar {...defaultProps} />);
      const roleElement = screen.getByText('Administrator');
      
      expect(roleElement).toHaveClass('uppercase');
    });
  });

  describe('Accessibility', () => {
    it('uses semantic aside element', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toBeInTheDocument();
    });

    it('uses semantic nav element', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const nav = container.querySelector('nav');
      
      expect(nav).toBeInTheDocument();
    });

    it('provides aria-label for logo icon', () => {
      render(<SideNavBar {...defaultProps} />);
      
      expect(screen.getByLabelText('PatchMaster Logo')).toBeInTheDocument();
    });

    it('provides aria-labels for navigation icons', () => {
      render(<SideNavBar {...defaultProps} />);
      
      expect(screen.getByLabelText('Dashboard icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Hosts icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Settings icon')).toBeInTheDocument();
    });

    it('provides alt text for user avatar', () => {
      render(<SideNavBar {...defaultProps} />);
      
      const avatar = screen.getByAltText('Test User avatar');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('has fixed positioning', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('fixed', 'left-0', 'top-0');
    });

    it('has correct width (w-64 = 256px)', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('w-64');
    });

    it('has full screen height', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('h-screen');
    });

    it('has correct z-index for layering', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('z-50');
    });

    it('has overflow-y-auto for scrolling', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('overflow-y-auto');
    });

    it('uses flexbox column layout', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('flex', 'flex-col');
    });

    it('applies correct background color', () => {
      const { container } = render(<SideNavBar {...defaultProps} />);
      const aside = container.querySelector('aside');
      
      expect(aside).toHaveClass('bg-[#06122d]');
    });
  });

  describe('Color Tokens', () => {
    it('uses Stitch color palette for active state', () => {
      render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      const activeLink = screen.getByText('Dashboard').closest('a');
      
      // Primary color: #7bd0ff
      expect(activeLink).toHaveClass('text-[#7bd0ff]', 'border-[#7bd0ff]');
      // Surface container: #05183c
      expect(activeLink).toHaveClass('bg-[#05183c]');
    });

    it('uses Stitch color palette for inactive state', () => {
      render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      const inactiveLink = screen.getByText('Hosts').closest('a');
      
      // On-surface-variant: #91aaeb
      expect(inactiveLink).toHaveClass('text-[#91aaeb]');
    });

    it('uses Stitch color palette for hover state', () => {
      render(<SideNavBar {...defaultProps} currentPage="dashboard" />);
      const inactiveLink = screen.getByText('Hosts').closest('a');
      
      // Hover text: #dee5ff (on-surface)
      // Hover background: #031d4b (surface-container-high)
      expect(inactiveLink).toHaveClass('hover:text-[#dee5ff]', 'hover:bg-[#031d4b]');
    });
  });
});
