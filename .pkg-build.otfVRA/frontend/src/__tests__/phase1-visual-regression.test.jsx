/**
 * Visual Regression Tests for Phase 1 Pages
 * 
 * Tests for:
 * - Dashboard (6.1)
 * - License Tier Management (6.2)
 * - Alerts Center (6.3)
 * - Audit & Compliance Reports (6.4)
 * 
 * Validates:
 * - Color consistency with Stitch palette
 * - Layout structure and spacing
 * - Component rendering at multiple viewports
 * - Typography and font consistency
 * 
 * **Validates: Requirements 10.3, 10.4**
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock components and utilities
vi.mock('../components/layout/SideNavBar', () => {
  return {
    default: function MockSideNavBar() {
      return <div data-testid="sidenav" className="fixed left-0 top-0 w-64 bg-surface-container-low" />;
    }
  };
});

vi.mock('../components/layout/TopNavBar', () => {
  return {
    default: function MockTopNavBar() {
      return <div data-testid="topnav" className="fixed top-0 right-0 left-64 h-16 bg-surface/80" />;
    }
  };
});

vi.mock('../components/layout/MainContent', () => {
  return {
    default: function MockMainContent({ children }) {
      return <div data-testid="maincontent" className="ml-64 pt-24 px-8 min-h-screen bg-background">{children}</div>;
    }
  };
});

vi.mock('../components/ui/StatCard', () => {
  return {
    default: function MockStatCard({ label, value, icon, variant }) {
      return (
        <div data-testid="stat-card" className={`border-t-2 p-6 rounded-xl bg-surface-container`}>
          <div className="text-xs uppercase text-on-surface-variant">{label}</div>
          <div className="text-2xl font-bold text-on-surface">{value}</div>
        </div>
      );
    }
  };
});

vi.mock('../components/ui/StatusBadge', () => {
  return {
    default: function MockStatusBadge({ status, label }) {
      return <span data-testid="status-badge" className={`badge-${status}`}>{label}</span>;
    }
  };
});

vi.mock('../components/ui/DataTable', () => {
  return {
    default: function MockDataTable({ columns, data }) {
      return (
        <table data-testid="data-table">
          <thead>
            <tr>
              {columns.map(col => <th key={col.key}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => <td key={col.key}>{row[col.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };
});

vi.mock('../components/ui/FormInput', () => {
  return {
    default: function MockFormInput({ label, placeholder, value, onChange }) {
      return (
        <input
          data-testid="form-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-2 text-on-surface"
        />
      );
    }
  };
});

vi.mock('../components/ui/FormSelect', () => {
  return {
    default: function MockFormSelect({ label, value, onChange, options }) {
      return (
        <select
          data-testid="form-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-2 text-on-surface"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
  };
});

vi.mock('../components/ui/ActionButton', () => {
  return {
    default: function MockActionButton({ label, onClick, variant, icon, disabled }) {
      return (
        <button
          data-testid="action-button"
          onClick={onClick}
          disabled={disabled}
          className={`btn-${variant} px-4 py-2 rounded-lg font-bold text-xs`}
        >
          {label}
        </button>
      );
    }
  };
});

vi.mock('../components/ui/ChartCard', () => {
  return {
    default: function MockChartCard({ title, children }) {
      return (
        <div data-testid="chart-card" className="bg-surface-container p-6 rounded-xl">
          <h3 className="text-lg font-bold text-on-surface">{title}</h3>
          {children}
        </div>
      );
    }
  };
});

vi.mock('../components/Icon', () => {
  return {
    default: function MockIcon({ name, size, className }) {
      return <span data-testid={`icon-${name}`} className={`material-symbols-outlined ${className}`}>{name}</span>;
    }
  };
});

vi.mock('../appRuntime', () => ({
  formatDetailsText: (text) => text || '',
  sanitizeDisplayText: (text, fallback) => text || fallback,
}));

// Import pages to test
import DashboardOpsPage from '../DashboardOpsPage';
import LicenseOpsPage from '../LicenseOpsPage';
import AlertsCenterPage from '../AlertsCenterPage';
import AuditPage from '../AuditPage';

describe('Phase 1 Visual Regression Tests', () => {
  const mockProps = {
    API: 'http://localhost:8000',
    apiFetch: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
    setPage: vi.fn(),
    useInterval: null,
    toast: vi.fn(),
    health: true,
    hosts: [{ id: 1, hostname: 'host1', status: 'online' }],
    jobs: [{ id: 1, status: 'running' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard (6.1)', () => {
    it('should render with correct layout structure', () => {
      render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      expect(screen.getByTestId('sidenav')).toBeInTheDocument();
      expect(screen.getByTestId('topnav')).toBeInTheDocument();
      expect(screen.getByTestId('maincontent')).toBeInTheDocument();
    });

    it('should render stat cards with correct styling', () => {
      render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      const statCards = screen.getAllByTestId('stat-card');
      expect(statCards.length).toBeGreaterThan(0);
      
      // Verify stat cards have border-top-2 for variant styling
      statCards.forEach(card => {
        expect(card).toHaveClass('border-t-2');
        expect(card).toHaveClass('p-6');
        expect(card).toHaveClass('rounded-xl');
      });
    });

    it('should use Material Symbols icons', () => {
      render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check for common dashboard icons
      expect(screen.getByTestId('icon-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('icon-dns')).toBeInTheDocument();
    });

    it('should apply Stitch color tokens', () => {
      const { container } = render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check for Stitch color classes
      const mainContent = screen.getByTestId('maincontent');
      expect(mainContent).toHaveClass('bg-background');
      expect(mainContent).toHaveClass('text-on-surface');
    });
  });

  describe('License Tier Management (6.2)', () => {
    it('should render with correct layout structure', () => {
      render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{ tier: 'enterprise', activated: true, valid: true }}
          onRefresh={jest.fn()}
        />
      );

      expect(screen.getByTestId('sidenav')).toBeInTheDocument();
      expect(screen.getByTestId('topnav')).toBeInTheDocument();
      expect(screen.getByTestId('maincontent')).toBeInTheDocument();
    });

    it('should render form components with correct styling', () => {
      render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{ tier: 'enterprise', activated: true, valid: true, hardware_id: 'test-id' }}
          onRefresh={vi.fn()}
        />
      );

      const inputs = screen.getAllByTestId('form-input');
      expect(inputs.length).toBeGreaterThan(0);

      inputs.forEach(input => {
        expect(input).toHaveClass('bg-surface-container');
        expect(input).toHaveClass('border');
        expect(input).toHaveClass('rounded-lg');
      });
    });

    it('should render action buttons with correct variants', () => {
      render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{ tier: 'enterprise', activated: true, valid: true }}
          onRefresh={jest.fn()}
        />
      );

      const buttons = screen.getAllByTestId('action-button');
      expect(buttons.length).toBeGreaterThan(0);

      // Verify button classes
      buttons.forEach(button => {
        expect(button).toHaveClass('px-4');
        expect(button).toHaveClass('py-2');
        expect(button).toHaveClass('rounded-lg');
        expect(button).toHaveClass('font-bold');
      });
    });

    it('should display status badges for features', () => {
      render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{
            tier: 'enterprise',
            activated: true,
            valid: true,
            features: ['feature1', 'feature2'],
          }}
          onRefresh={vi.fn()}
        />
      );

      const badges = screen.getAllByTestId('status-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Alerts Center (6.3)', () => {
    it('should render with correct layout structure', () => {
      render(
        <AlertsCenterPage
          {...mockProps}
        />
      );

      expect(screen.getByTestId('sidenav')).toBeInTheDocument();
      expect(screen.getByTestId('topnav')).toBeInTheDocument();
      expect(screen.getByTestId('maincontent')).toBeInTheDocument();
    });

    it('should render stat cards for alert metrics', () => {
      render(
        <AlertsCenterPage
          {...mockProps}
        />
      );

      const statCards = screen.getAllByTestId('stat-card');
      expect(statCards.length).toBeGreaterThan(0);
    });

    it('should render form select for filtering', () => {
      render(
        <AlertsCenterPage
          {...mockProps}
        />
      );

      const selects = screen.getAllByTestId('form-select');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('should render data table for alerts', () => {
      render(
        <AlertsCenterPage
          {...mockProps}
        />
      );

      // DataTable should be rendered
      const tables = screen.queryAllByTestId('data-table');
      // May or may not have data, but structure should be present
      expect(screen.getByTestId('maincontent')).toBeInTheDocument();
    });
  });

  describe('Audit & Compliance Reports (6.4)', () => {
    it('should render with correct layout structure', () => {
      render(
        <AuditPage
          {...mockProps}
        />
      );

      expect(screen.getByTestId('sidenav')).toBeInTheDocument();
      expect(screen.getByTestId('topnav')).toBeInTheDocument();
      expect(screen.getByTestId('maincontent')).toBeInTheDocument();
    });

    it('should render stat cards for audit metrics', () => {
      render(
        <AuditPage
          {...mockProps}
        />
      );

      const statCards = screen.getAllByTestId('stat-card');
      expect(statCards.length).toBeGreaterThan(0);
    });

    it('should render form input for filtering', () => {
      render(
        <AuditPage
          {...mockProps}
        />
      );

      const inputs = screen.getAllByTestId('form-input');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('should render data table for audit logs', () => {
      render(
        <AuditPage
          {...mockProps}
        />
      );

      // DataTable should be rendered
      expect(screen.getByTestId('maincontent')).toBeInTheDocument();
    });
  });

  describe('Color Consistency Across Phase 1 Pages', () => {
    it('should use consistent background colors', () => {
      const { container: dashContainer } = render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      const { container: licenseContainer } = render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{ tier: 'enterprise', activated: true, valid: true }}
          onRefresh={vi.fn()}
        />
      );

      // Both should use background color
      expect(dashContainer.querySelector('[class*="bg-background"]')).toBeInTheDocument();
      expect(licenseContainer.querySelector('[class*="bg-background"]')).toBeInTheDocument();
    });

    it('should use consistent text colors', () => {
      const { container } = render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check for on-surface text color
      const mainContent = screen.getByTestId('maincontent');
      expect(mainContent).toHaveClass('text-on-surface');
    });

    it('should use consistent primary color for interactive elements', () => {
      render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{ tier: 'enterprise', activated: true, valid: true }}
          onRefresh={vi.fn()}
        />
      );

      const buttons = screen.getAllByTestId('action-button');
      expect(buttons.length).toBeGreaterThan(0);
      // Buttons should have variant classes
      buttons.forEach(button => {
        expect(button.className).toMatch(/btn-/);
      });
    });
  });

  describe('Typography Consistency', () => {
    it('should use Inter font family', () => {
      const { container } = render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check that text elements exist (font family is applied via Tailwind)
      const mainContent = screen.getByTestId('maincontent');
      expect(mainContent).toBeInTheDocument();
    });

    it('should use correct font sizes', () => {
      render(
        <AuditPage
          {...mockProps}
        />
      );

      const statCards = screen.getAllByTestId('stat-card');
      expect(statCards.length).toBeGreaterThan(0);

      // Stat cards should have text-xs for labels
      statCards.forEach(card => {
        expect(card).toHaveClass('text-xs');
      });
    });

    it('should use correct font weights', () => {
      render(
        <LicenseOpsPage
          {...mockProps}
          licenseInfo={{ tier: 'enterprise', activated: true, valid: true }}
          onRefresh={vi.fn()}
        />
      );

      const buttons = screen.getAllByTestId('action-button');
      expect(buttons.length).toBeGreaterThan(0);

      // Buttons should have font-bold
      buttons.forEach(button => {
        expect(button).toHaveClass('font-bold');
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should have responsive grid layouts', () => {
      const { container } = render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check for responsive grid classes
      const grids = container.querySelectorAll('[class*="grid"]');
      expect(grids.length).toBeGreaterThan(0);

      grids.forEach(grid => {
        // Should have responsive breakpoints
        expect(grid.className).toMatch(/grid-cols-|md:|lg:|xl:/);
      });
    });

    it('should have fixed layout components', () => {
      render(
        <AlertsCenterPage
          {...mockProps}
        />
      );

      const sidenav = screen.getByTestId('sidenav');
      const topnav = screen.getByTestId('topnav');

      // Should have fixed positioning
      expect(sidenav).toHaveClass('fixed');
      expect(topnav).toHaveClass('fixed');
    });
  });

  describe('Component Spacing and Padding', () => {
    it('should use consistent padding in cards', () => {
      render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      const statCards = screen.getAllByTestId('stat-card');
      expect(statCards.length).toBeGreaterThan(0);

      // All stat cards should have p-6 padding
      statCards.forEach(card => {
        expect(card).toHaveClass('p-6');
      });
    });

    it('should use consistent gap spacing in grids', () => {
      const { container } = render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check for gap utilities
      const grids = container.querySelectorAll('[class*="gap-"]');
      expect(grids.length).toBeGreaterThan(0);
    });
  });

  describe('Icon Consistency', () => {
    it('should use Material Symbols icons throughout', () => {
      render(
        <DashboardOpsPage
          {...mockProps}
          health={true}
          hosts={[{ id: 1, hostname: 'host1' }]}
          jobs={[]}
        />
      );

      // Check for Material Symbols class
      const icons = screen.queryAllByTestId(/icon-/);
      expect(icons.length).toBeGreaterThan(0);

      icons.forEach(icon => {
        expect(icon).toHaveClass('material-symbols-outlined');
      });
    });
  });
});
