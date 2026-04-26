// Playwright configuration for frontend smoke tests.
// These tests stub backend `/api/**` responses so the UI can be validated
// without running PatchMaster backend in the test environment.
const path = require('path');
const { defineConfig } = require('@playwright/test');

const runId = process.env.REPORT_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const reportsDir = path.join(__dirname, '..', 'reports', 'playwright', runId);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  outputDir: path.join(reportsDir, 'artifacts'),
  reporter: [
    ['html', { outputFolder: path.join(reportsDir, 'html') }],
    ['junit', { outputFile: path.join(reportsDir, 'junit.xml') }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
