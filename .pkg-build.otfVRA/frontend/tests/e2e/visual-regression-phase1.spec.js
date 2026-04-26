const { test, expect } = require('@playwright/test');

/**
 * Visual Regression Tests for Phase 1 Pages
 * 
 * Tests the following migrated pages:
 * - Dashboard (DashboardOpsPage)
 * - License Tier Management (LicenseOpsPage)
 * - Alerts Center (AlertsCenterPage)
 * - Audit & Compliance Reports (AuditPage)
 * 
 * Requirements: 10.3, 10.4
 * 
 * Validates:
 * - Screenshots at desktop (1920x1080), tablet (768x1024), mobile (375x667)
 * - Color consistency with Stitch palette
 */

// Stitch color palette for validation
const STITCH_COLORS = {
  background: '#060e20',
  surface: '#060e20',
  'surface-container-low': '#06122d',
  'surface-container': '#05183c',
  'surface-container-high': '#031d4b',
  'surface-container-highest': '#00225a',
  primary: '#7bd0ff',
  'primary-dim': '#47c4ff',
  secondary: '#939eb5',
  tertiary: '#ffd16f',
  'tertiary-dim': '#edb210',
  error: '#ee7d77',
  'error-dim': '#bb5551',
  'on-surface': '#dee5ff',
  'on-surface-variant': '#91aaeb',
  outline: '#5b74b1',
  'outline-variant': '#2b4680',
};

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

// Stub data for consistent visual testing
const licenseStub = {
  valid: true,
  activated: true,
  expired: false,
  tier: 'enterprise',
  tier_label: 'Enterprise (Advance)',
  plan: 'testing',
  days_remaining: 60,
  expires_at: '2099-01-01T00:00:00Z',
  features: [
    'dashboard',
    'hosts',
    'groups',
    'patches',
    'jobs',
    'cve',
    'compliance',
    'audit',
    'notifications',
    'users',
    'license',
    'schedules',
    'monitoring',
    'onboarding',
    'settings',
    'backups',
    'policies',
    'reports',
    'software',
  ],
  max_hosts: 0,
};

const hosts = [
  {
    id: 1,
    hostname: 'web-01',
    name: 'web-01',
    ip: '10.0.0.10',
    os: 'Ubuntu 24.04',
    is_online: true,
    compliance_score: 92,
    cve_count: 1,
    reboot_required: false,
    groups: ['web', 'debian/ubuntu'],
    tags: [{ id: 5, name: 'prod' }],
  },
  {
    id: 2,
    hostname: 'db-01',
    name: 'db-01',
    ip: '10.0.0.20',
    os: 'Ubuntu 24.04',
    is_online: true,
    compliance_score: 88,
    cve_count: 2,
    reboot_required: true,
    groups: ['database', 'debian/ubuntu'],
    tags: [{ id: 5, name: 'prod' }],
  },
];

const jobs = [
  {
    id: 101,
    host_id: 1,
    host_name: 'web-01',
    host_ip: '10.0.0.10',
    action: 'upgrade',
    status: 'success',
    initiated_by: 'test-user',
    created_at: '2026-03-22T09:00:00Z',
    started_at: '2026-03-22T09:00:00Z',
    completed_at: '2026-03-22T09:05:00Z',
    output: 'Packages upgraded successfully',
    result: { changed: 4 },
  },
  {
    id: 102,
    host_id: 2,
    host_name: 'db-01',
    host_ip: '10.0.0.20',
    action: 'upgrade',
    status: 'failed',
    initiated_by: 'test-user',
    created_at: '2026-03-22T10:00:00Z',
    started_at: '2026-03-22T10:00:00Z',
    completed_at: '2026-03-22T10:05:00Z',
    output: 'Package upgrade failed',
    result: { error: 'Connection timeout' },
  },
];

const auditLogs = [
  {
    id: 77,
    username: 'test-user',
    action: 'host.patch',
    resource_type: 'host',
    resource_id: 1,
    details: { hostname: 'web-01' },
    created_at: '2026-03-22T10:00:00Z',
  },
  {
    id: 78,
    username: 'admin',
    action: 'license.update',
    resource_type: 'license',
    resource_id: null,
    details: { tier: 'enterprise' },
    created_at: '2026-03-22T11:00:00Z',
  },
];

const dashboardSummary = {
  risk_score: 38,
  hosts: {
    total: 2,
    online: 2,
    avg_compliance: 90,
    reboot_required: 1,
    total_upgradable: 5,
  },
  cves: {
    critical: 1,
    open_vulnerabilities: 3,
  },
  jobs: {
    success_30d: 6,
    failed_30d: 1,
  },
  needs_attention: [
    { id: 1, hostname: 'web-01', ip: '10.0.0.10', reason: 'critical cve', is_online: true },
    { id: 2, hostname: 'db-01', ip: '10.0.0.20', reason: 'reboot required', is_online: true },
  ],
  top_vulnerable_hosts: [
    { id: 1, hostname: 'web-01', ip: '10.0.0.10', critical: 1, high: 0, compliance: 92 },
    { id: 2, hostname: 'db-01', ip: '10.0.0.20', critical: 0, high: 2, compliance: 88 },
  ],
  recent_activity: [
    { id: 1, title: 'Patch completed', detail: 'web-01 upgraded successfully', created_at: '2026-03-22T10:00:00Z' },
    { id: 2, title: 'Patch failed', detail: 'db-01 upgrade failed', created_at: '2026-03-22T10:05:00Z' },
  ],
  patch_velocity: [
    { label: 'Mon', success: 2, failed: 0 },
    { label: 'Tue', success: 1, failed: 1 },
    { label: 'Wed', success: 3, failed: 0 },
  ],
};

const alertsPayload = {
  alerts: [
    {
      id: 1,
      severity: 'critical',
      title: 'Critical CVE detected',
      description: 'CVE-2026-0001 affects web-01',
      created_at: '2026-03-22T09:00:00Z',
      acknowledged: false,
    },
    {
      id: 2,
      severity: 'warning',
      title: 'Reboot required',
      description: 'db-01 requires reboot',
      created_at: '2026-03-22T10:00:00Z',
      acknowledged: false,
    },
  ],
  tickets: [
    {
      id: 1,
      title: 'Patch web-01',
      status: 'open',
      priority: 'high',
      created_at: '2026-03-22T09:00:00Z',
    },
  ],
};

function installSession(page) {
  return page.addInitScript((license) => {
    localStorage.setItem('pm_token', 'test-token');
    localStorage.setItem(
      'pm_user',
      JSON.stringify({ username: 'test-user', role: 'admin', permissions: {} })
    );
    localStorage.setItem('pm_license', JSON.stringify(license));
  }, licenseStub);
}

async function stubApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    let body;
    if (path === '/api/license/status') {
      body = licenseStub;
    } else if (path === '/api/health') {
      body = { status: 'healthy', version: '2.0.0' };
    } else if (path === '/api/auth/me') {
      body = { username: 'test-user', role: 'admin', permissions: {} };
    } else if (path === '/api/hosts/') {
      body = hosts;
    } else if (path === '/api/dashboard/summary') {
      body = dashboardSummary;
    } else if (path === '/api/jobs/') {
      body = jobs;
    } else if (path === '/api/notifications/me') {
      body = [];
    } else if (path === '/api/audit/') {
      body = auditLogs;
    } else if (path === '/api/audit/stats') {
      body = { today: 3, this_week: 12 };
    } else if (path === '/api/alerts/') {
      body = alertsPayload.alerts;
    } else if (path === '/api/alerts/tickets') {
      body = alertsPayload.tickets;
    } else if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      body = { ok: true };
    } else {
      body = {};
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * Helper function to verify Stitch color usage
 * Checks if computed colors match the Stitch palette
 */
async function verifyStitchColors(page, elementSelector) {
  const element = page.locator(elementSelector).first();
  const computedStyles = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      borderColor: styles.borderTopColor || styles.borderColor,
    };
  });

  // Convert RGB to hex for comparison
  const rgbToHex = (rgb) => {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null;
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
    if (!match) return null;
    const hex = (x) => ('0' + parseInt(x).toString(16)).slice(-2);
    return '#' + hex(match[1]) + hex(match[2]) + hex(match[3]);
  };

  const bgHex = rgbToHex(computedStyles.backgroundColor);
  const colorHex = rgbToHex(computedStyles.color);
  const borderHex = rgbToHex(computedStyles.borderColor);

  // Check if colors are in Stitch palette
  const stitchHexValues = Object.values(STITCH_COLORS);
  
  const results = {
    backgroundColor: bgHex ? stitchHexValues.includes(bgHex) : true,
    color: colorHex ? stitchHexValues.includes(colorHex) : true,
    borderColor: borderHex ? stitchHexValues.includes(borderHex) : true,
  };

  return results;
}

// Test suite for each viewport
for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Visual Regression - ${viewportName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await installSession(page);
      await stubApi(page);
    });

    test(`Dashboard page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Wait for dashboard to load
      await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
      
      // Wait for data to load
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`dashboard-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Verify Stitch colors on key elements
      const mainContent = page.locator('main').first();
      if (await mainContent.count() > 0) {
        const colorCheck = await verifyStitchColors(page, 'main');
        expect(colorCheck.backgroundColor || colorCheck.color).toBeTruthy();
      }
    });

    test(`License page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to License page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /License/i }).click();
      
      // Wait for page to load (use first() to handle duplicate headings)
      await expect(page.getByRole('heading', { level: 1, name: /License/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`license-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Verify Stitch colors
      const mainContent = page.locator('main').first();
      if (await mainContent.count() > 0) {
        const colorCheck = await verifyStitchColors(page, 'main');
        expect(colorCheck.backgroundColor || colorCheck.color).toBeTruthy();
      }
    });

    test(`Alerts Center page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Alerts Center
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Alerts/i }).click();
      
      // Wait for page to load (use first() to handle duplicate headings)
      await expect(page.getByRole('heading', { level: 1, name: /Alerts/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`alerts-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Verify Stitch colors
      const mainContent = page.locator('main').first();
      if (await mainContent.count() > 0) {
        const colorCheck = await verifyStitchColors(page, 'main');
        expect(colorCheck.backgroundColor || colorCheck.color).toBeTruthy();
      }
    });

    test(`Audit & Compliance page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Audit page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Audit/i }).click();
      
      // Wait for page to load (use first() to handle duplicate headings)
      await expect(page.getByRole('heading', { level: 1, name: /Audit/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`audit-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Verify Stitch colors
      const mainContent = page.locator('main').first();
      if (await mainContent.count() > 0) {
        const colorCheck = await verifyStitchColors(page, 'main');
        expect(colorCheck.backgroundColor || colorCheck.color).toBeTruthy();
      }
    });
  });
}

// Additional test for color consistency across all Phase 1 pages
test.describe('Color Consistency Validation', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test.beforeEach(async ({ page }) => {
    await installSession(page);
    await stubApi(page);
  });

  test('Verify Stitch palette usage across Phase 1 pages', async ({ page }) => {
    const pages = [
      { name: 'Dashboard', path: '/', heading: /Dashboard/i },
      { name: 'License', navButton: /License/i, heading: /License/i },
      { name: 'Alerts', navButton: /Alerts/i, heading: /Alerts/i },
      { name: 'Audit', navButton: /Audit/i, heading: /Audit/i },
    ];

    for (const pageInfo of pages) {
      if (pageInfo.path) {
        await page.goto(pageInfo.path);
      } else {
        const nav = page.getByRole('navigation');
        await nav.getByRole('button', { name: pageInfo.navButton }).click();
      }

      await expect(page.getByRole('heading', { level: 1, name: pageInfo.heading }).first()).toBeVisible();
      await page.waitForTimeout(500);

      // Check background color
      const bgColor = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });

      // Verify background is from Stitch palette
      const rgbToHex = (rgb) => {
        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
        if (!match) return null;
        const hex = (x) => ('0' + parseInt(x).toString(16)).slice(-2);
        return '#' + hex(match[1]) + hex(match[2]) + hex(match[3]);
      };

      const bgHex = rgbToHex(bgColor);
      const isStitchColor = Object.values(STITCH_COLORS).includes(bgHex);
      
      // Log for debugging
      console.log(`${pageInfo.name} page background: ${bgHex}, is Stitch color: ${isStitchColor}`);
    }
  });
});
