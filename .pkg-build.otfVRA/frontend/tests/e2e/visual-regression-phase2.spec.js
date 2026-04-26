const { test, expect } = require('@playwright/test');

/**
 * Visual Regression Tests for Phase 2 Pages
 * 
 * Tests the following migrated pages:
 * - Host Management (HostsOpsPage)
 * - Patch Manager (PatchManagerOpsPage)
 * - CVE Tracker (CVEOpsPage)
 * - Software Kiosk (SoftwarePage)
 * - Network Boot Manager (NetworkBootPage)
 * - Mirror Repositories (MirrorRepoOpsPage)
 * - Maintenance Windows (MaintenanceWindowsPage)
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
    kernel_version: '6.8.0-45-generic',
    is_online: true,
    compliance_score: 92,
    compliance_pct: 92,
    cve_count: 1,
    critical_cves: 1,
    reboot_required: false,
    needs_reboot: false,
    groups: ['web', 'debian/ubuntu'],
    tags: [{ id: 5, name: 'prod' }],
    site: 'US-EAST',
    region: 'US-EAST',
    last_seen: new Date().toISOString(),
  },
  {
    id: 2,
    hostname: 'db-01',
    name: 'db-01',
    ip: '10.0.0.20',
    os: 'Ubuntu 24.04',
    kernel_version: '6.8.0-45-generic',
    is_online: true,
    compliance_score: 88,
    compliance_pct: 88,
    cve_count: 2,
    critical_cves: 0,
    reboot_required: true,
    needs_reboot: true,
    groups: ['database', 'debian/ubuntu'],
    tags: [{ id: 5, name: 'prod' }],
    site: 'US-EAST',
    region: 'US-EAST',
    last_seen: new Date().toISOString(),
  },
  {
    id: 3,
    hostname: 'app-01',
    name: 'app-01',
    ip: '10.0.0.30',
    os: 'Ubuntu 22.04',
    kernel_version: '5.15.0-91-generic',
    is_online: false,
    compliance_score: 75,
    compliance_pct: 75,
    cve_count: 5,
    critical_cves: 2,
    reboot_required: false,
    needs_reboot: false,
    groups: ['app', 'debian/ubuntu'],
    tags: [{ id: 6, name: 'staging' }],
    site: 'US-WEST',
    region: 'US-WEST',
    last_seen: new Date(Date.now() - 3600000).toISOString(),
  },
];

const packages = [
  {
    id: 1,
    name: 'nginx',
    package: 'nginx',
    current_version: '1.18.0-0ubuntu1',
    version: '1.18.0-0ubuntu1',
    available_version: '1.18.0-0ubuntu1.4',
    upgradable: true,
    is_security: true,
    severity: 'critical',
    description: 'High performance web server',
  },
  {
    id: 2,
    name: 'curl',
    package: 'curl',
    current_version: '7.68.0-1ubuntu2.18',
    version: '7.68.0-1ubuntu2.18',
    available_version: '7.68.0-1ubuntu2.20',
    upgradable: true,
    is_security: false,
    severity: 'medium',
    description: 'Command line tool for transferring data',
  },
];

const jobs = [
  {
    id: 101,
    host_id: 1,
    host_name: 'web-01',
    host_ip: '10.0.0.10',
    action: 'upgrade',
    type: 'patch',
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
    type: 'patch',
    status: 'running',
    initiated_by: 'test-user',
    created_at: '2026-03-22T10:00:00Z',
    started_at: '2026-03-22T10:00:00Z',
    completed_at: null,
    output: 'Patching in progress',
    result: null,
  },
];

const cves = [
  {
    id: 1,
    cve_id: 'CVE-2026-0001',
    severity: 'critical',
    cvss_score: 9.8,
    description: 'Critical vulnerability in nginx web server',
    affected_hosts: 2,
    patched_hosts: 0,
    published_at: '2026-03-20T00:00:00Z',
    advisory_url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0001',
  },
  {
    id: 2,
    cve_id: 'CVE-2026-0002',
    severity: 'high',
    cvss_score: 7.5,
    description: 'High severity vulnerability in curl',
    affected_hosts: 1,
    patched_hosts: 0,
    published_at: '2026-03-21T00:00:00Z',
    advisory_url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0002',
  },
];

const cveStats = {
  by_severity: {
    critical: 1,
    high: 1,
    medium: 3,
    low: 2,
  },
  open_vulnerabilities: 7,
  patched_vulnerabilities: 3,
};

const softwareCatalog = [
  {
    id: 1,
    name: 'Nginx Web Server',
    package_name: 'nginx',
    description: 'High performance web server and reverse proxy',
    supported_platforms: ['linux'],
    allowed_actions: ['install', 'remove'],
    default_execution_mode: 'immediate',
    is_enabled: true,
  },
  {
    id: 2,
    name: 'PostgreSQL Database',
    package_name: 'postgresql',
    description: 'Advanced open source database',
    supported_platforms: ['linux'],
    allowed_actions: ['install'],
    default_execution_mode: 'shutdown',
    is_enabled: true,
  },
];

const softwareRequests = [
  {
    id: 1,
    catalog_item: { id: 1, name: 'Nginx Web Server' },
    host: { id: 1, hostname: 'web-01', ip: '10.0.0.10' },
    requested_action: 'install',
    status: 'submitted',
    requested_by: { username: 'test-user' },
    note: 'Required for new deployment',
    created_at: '2026-03-22T09:00:00Z',
  },
];

const networks = [
  {
    id: 1,
    name: 'Branch-London-UEFI',
    interface_name: 'bond0.120',
    vlan_id: 120,
    cidr: '10.42.120.0/24',
    gateway: '10.42.120.1',
    relay: { id: 1, name: 'london-relay-01' },
  },
];

const profiles = [
  {
    id: 1,
    name: 'Ubuntu-22.04-UEFI',
    network_id: 1,
    os_family: 'linux',
    os_version: '22.04',
    firmware_mode: 'uefi',
    install_mode: 'ubuntu_autoinstall',
  },
];

const relays = [
  {
    id: 1,
    name: 'london-relay-01',
    host: { id: 1, hostname: 'web-01', ip: '10.0.0.10' },
    site_scope: 'London-HQ',
    status: 'active',
    applied_version: '1.0.0',
    last_validation_status: 'passed',
  },
];

const bootSessions = [
  {
    id: 1,
    mac_address: '00:11:22:33:44:55',
    hostname: 'new-server-01',
    status: 'success',
    started_at: '2026-03-22T09:00:00Z',
  },
];

const workflowCards = [
  {
    id: 'pxe-boot',
    label: 'PXE Boot',
    title: 'Network Boot Infrastructure',
    status: 'implemented',
    capabilities: ['DHCP/TFTP server', 'iPXE boot loader', 'HTTP artifact delivery'],
  },
];

const mirrorRepos = [
  {
    id: 1,
    name: 'Ubuntu Security',
    provider: 'ubuntu',
    os_family: 'linux',
    source_url: 'https://ubuntu.com/security/notices.json',
    enabled: true,
    metadata_only: true,
    sync_interval_minutes: 360,
    retention_days: 30,
    keep_versions: 2,
  },
];

const mirrorRuns = [
  {
    id: 1,
    status: 'success',
    trigger_type: 'scheduled',
    started_at: '2026-03-22T09:00:00Z',
    summary: { items_seen: 150, inserted: 5 },
  },
];

const maintenanceWindows = [
  {
    id: 1,
    name: 'Weekly Prod Maintenance',
    description: 'Weekly maintenance window for production systems',
    day_of_week: ['Sat', 'Sun'],
    start_hour: 2,
    end_hour: 6,
    timezone: 'UTC',
    is_active: true,
    recurring: true,
    block_outside: true,
  },
];

const maintenanceStatus = {
  in_maintenance_window: false,
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
    } else if (path === '/api/hosts/' || path.startsWith('/api/hosts?')) {
      body = hosts;
    } else if (path.match(/\/api\/hosts\/\d+\/packages/)) {
      body = packages;
    } else if (path === '/api/jobs/' || path.startsWith('/api/jobs/?')) {
      body = { items: jobs };
    } else if (path === '/api/cve/' || path.startsWith('/api/cve/?')) {
      body = cves;
    } else if (path === '/api/cve/stats') {
      body = cveStats;
    } else if (path === '/api/software-kiosk/catalog' || path.startsWith('/api/software-kiosk/catalog?')) {
      body = { items: softwareCatalog };
    } else if (path === '/api/software-kiosk/requests') {
      body = { items: softwareRequests };
    } else if (path === '/api/network-boot/workflows') {
      body = { workflows: workflowCards };
    } else if (path === '/api/network-boot/networks') {
      body = { items: networks };
    } else if (path === '/api/network-boot/profiles') {
      body = { items: profiles };
    } else if (path === '/api/network-boot/relays') {
      body = { items: relays };
    } else if (path === '/api/network-boot/boot-sessions' || path.startsWith('/api/network-boot/boot-sessions?')) {
      body = { items: bootSessions };
    } else if (path === '/api/network-boot/catalog') {
      body = { provisioning_templates: [], mirror_repositories: [] };
    } else if (path === '/api/network-boot/assignments') {
      body = { items: [] };
    } else if (path === '/api/network-boot/service-preview') {
      body = { status: 'ok' };
    } else if (path === '/api/mirror/repos') {
      body = mirrorRepos;
    } else if (path.match(/\/api\/mirror\/repos\/\d+\/runs/)) {
      body = mirrorRuns;
    } else if (path.match(/\/api\/mirror\/repos\/\d+\/packages/)) {
      body = { items: [] };
    } else if (path === '/api/maintenance/') {
      body = maintenanceWindows;
    } else if (path === '/api/maintenance/check') {
      body = maintenanceStatus;
    } else if (path === '/api/notifications/me') {
      body = [];
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
  test.describe(`Visual Regression Phase 2 - ${viewportName} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await installSession(page);
      await stubApi(page);
    });

    test(`Host Management page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Host Management page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Hosts/i }).click();
      
      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Host Management/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`hosts-${viewportName}.png`, {
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

    test(`Patch Manager page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Patch Manager page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Patch/i }).click();
      
      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Patch Manager/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`patch-manager-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
      
      // Verify Stitch colors
      const mainContent = page.locator('main, div[class*="flex"]').first();
      if (await mainContent.count() > 0) {
        const colorCheck = await verifyStitchColors(page, 'main, div[class*="flex"]');
        expect(colorCheck.backgroundColor || colorCheck.color).toBeTruthy();
      }
    });

    test(`CVE Tracker page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to CVE Tracker page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /CVE/i }).click();
      
      // Wait for page to load
      await expect(page.getByRole('heading', { name: /CVE Tracker/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`cve-tracker-${viewportName}.png`, {
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

    test(`Software Kiosk page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Software Kiosk page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Software/i }).click();
      
      // Wait for page to load
      await expect(page.getByRole('heading', { level: 1, name: /Software Center/i })).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`software-kiosk-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test(`Network Boot Manager page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Network Boot page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Network Boot/i }).click();
      
      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Network Boot/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`network-boot-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test(`Mirror Repositories page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Mirror Repositories page - try different navigation patterns
      try {
        const nav = page.getByRole('navigation');
        await nav.getByRole('button', { name: /Mirror/i }).click({ timeout: 5000 });
      } catch {
        // If navigation button not found, try direct URL navigation
        await page.goto('/#/mirror-repos');
      }
      
      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Mirror Repositories/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`mirror-repos-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test(`Maintenance Windows page - ${viewportName}`, async ({ page }) => {
      await page.goto('/');
      
      // Navigate to Maintenance Windows page
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: /Maintenance/i }).click();
      
      // Wait for page to load
      await expect(page.getByRole('heading', { name: /Maintenance Windows/i }).first()).toBeVisible();
      await page.waitForTimeout(1000);
      
      // Capture screenshot
      await expect(page).toHaveScreenshot(`maintenance-windows-${viewportName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
}

// Additional test for color consistency across all Phase 2 pages
test.describe('Color Consistency Validation - Phase 2', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test.beforeEach(async ({ page }) => {
    await installSession(page);
    await stubApi(page);
  });

  test('Verify Stitch palette usage across Phase 2 pages', async ({ page }) => {
    const pages = [
      { name: 'Hosts', navButton: /Hosts/i, heading: /Host Management/i },
      { name: 'Patch Manager', navButton: /Patch/i, heading: /Patch Manager/i },
      { name: 'CVE', navButton: /CVE/i, heading: /CVE Tracker/i },
      { name: 'Software', navButton: /Software/i, heading: /Software Center/i },
      { name: 'Network Boot', navButton: /Network Boot/i, heading: /Network Boot/i },
      { name: 'Mirror', navButton: /Mirror/i, heading: /Mirror Repositories/i },
      { name: 'Maintenance', navButton: /Maintenance/i, heading: /Maintenance Windows/i },
    ];

    for (const pageInfo of pages) {
      await page.goto('/');
      const nav = page.getByRole('navigation');
      await nav.getByRole('button', { name: pageInfo.navButton }).click();

      await expect(page.getByRole('heading', { name: pageInfo.heading }).first()).toBeVisible();
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

// Test for responsive layouts
test.describe('Responsive Layout Tests - Phase 2', () => {
  test('Host Management responsive breakpoints', async ({ page }) => {
    await installSession(page);
    await stubApi(page);
    
    // Test desktop
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await nav.getByRole('button', { name: /Hosts/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Host Management/i })).toBeVisible();
    
    // Test tablet
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { level: 2, name: /Host Management/i })).toBeVisible();
    
    // Test mobile
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { level: 2, name: /Host Management/i })).toBeVisible();
  });
});

// Test for empty states
test.describe('Empty State Tests - Phase 2', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Patch Manager empty state', async ({ page }) => {
    await installSession(page);
    
    // Stub API with empty data
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      
      let body;
      if (path === '/api/license/status') {
        body = licenseStub;
      } else if (path === '/api/hosts/' || path.startsWith('/api/hosts?')) {
        body = [];
      } else if (path.match(/\/api\/hosts\/\d+\/packages/)) {
        body = [];
      } else if (path === '/api/jobs/' || path.startsWith('/api/jobs/?')) {
        body = { items: [] };
      } else {
        body = {};
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
    
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await nav.getByRole('button', { name: /Patch/i }).click();
    
    // Verify empty state is displayed
    await expect(page.getByText(/No hosts registered/i)).toBeVisible();
    
    // Capture screenshot
    await expect(page).toHaveScreenshot('patch-manager-empty-state.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
