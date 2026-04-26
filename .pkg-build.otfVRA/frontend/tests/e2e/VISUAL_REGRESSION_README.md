# Visual Regression Testing for PatchMaster UI Redesign

## Overview

This directory contains visual regression tests for the PatchMaster UI redesign project. The tests validate that Phase 1 pages (Dashboard, License, Alerts Center, and Audit & Compliance) maintain visual consistency across different viewports and use the Stitch design system color palette correctly.

## Test Coverage

### Phase 1 Pages Tested

1. **Dashboard** (DashboardOpsPage.jsx)
2. **License Tier Management** (LicenseOpsPage.jsx)
3. **Alerts Center** (AlertsCenterPage.jsx)
4. **Audit & Compliance Reports** (AuditPage.jsx)

### Viewports Tested

- **Desktop**: 1920x1080
- **Tablet**: 768x1024
- **Mobile**: 375x667

### Validations

- Screenshot comparison at all three viewports
- Color consistency with Stitch palette
- Background color verification (#060e20)
- Responsive layout behavior

## Requirements Validated

- **Requirement 10.3**: Visual regression tests for all pages
- **Requirement 10.4**: Screenshots at desktop, tablet, and mobile viewports

## Running the Tests

### Run all visual regression tests

```bash
npm run test:e2e -- visual-regression-phase1.spec.js
```

### Run tests for a specific viewport

```bash
# Desktop only
npm run test:e2e -- visual-regression-phase1.spec.js -g "desktop"

# Tablet only
npm run test:e2e -- visual-regression-phase1.spec.js -g "tablet"

# Mobile only
npm run test:e2e -- visual-regression-phase1.spec.js -g "mobile"
```

### Run tests for a specific page

```bash
# Dashboard only
npm run test:e2e -- visual-regression-phase1.spec.js -g "Dashboard"

# License only
npm run test:e2e -- visual-regression-phase1.spec.js -g "License"

# Alerts only
npm run test:e2e -- visual-regression-phase1.spec.js -g "Alerts"

# Audit only
npm run test:e2e -- visual-regression-phase1.spec.js -g "Audit"
```

### Update baseline screenshots

When you make intentional visual changes to the UI, update the baseline screenshots:

```bash
npm run test:e2e -- visual-regression-phase1.spec.js --update-snapshots
```

**Warning**: Only update snapshots when you've verified the visual changes are correct and intentional.

## Test Structure

### Test File

- `visual-regression-phase1.spec.js` - Main test file containing all Phase 1 visual regression tests

### Baseline Screenshots

Baseline screenshots are stored in:
```
frontend/tests/e2e/visual-regression-phase1.spec.js-snapshots/
```

Screenshot naming convention:
- `{page}-{viewport}-{platform}.png`
- Example: `dashboard-desktop-win32.png`

### Test Reports

Test reports are generated in:
```
../reports/playwright/{timestamp}/html/
```

View the latest report:
```bash
npx playwright show-report ../reports/playwright/{timestamp}/html
```

## Color Validation

The tests validate that pages use colors from the Stitch palette:

### Primary Colors
- **Primary**: #7bd0ff
- **Background**: #060e20
- **Surface Container Low**: #06122d
- **Surface Container**: #05183c
- **Surface Container High**: #031d4b

### Text Colors
- **On Surface**: #dee5ff
- **On Surface Variant**: #91aaeb

### Accent Colors
- **Tertiary**: #ffd16f (yellow/gold)
- **Error**: #ee7d77 (red)
- **Secondary**: #939eb5 (gray)

### Border Colors
- **Outline**: #5b74b1
- **Outline Variant**: #2b4680

## Troubleshooting

### Tests fail with "snapshot doesn't exist"

This is expected on the first run. Create baseline snapshots:
```bash
npm run test:e2e -- visual-regression-phase1.spec.js --update-snapshots
```

### Tests fail with visual differences

1. Review the diff images in the test report
2. Determine if the changes are intentional
3. If intentional, update the baselines:
   ```bash
   npm run test:e2e -- visual-regression-phase1.spec.js --update-snapshots
   ```
4. If unintentional, fix the UI code and re-run tests

### Tests fail with "strict mode violation"

This indicates multiple elements match the selector. The tests use `.first()` to handle duplicate headings, but if you see this error:
1. Check if the page structure has changed
2. Update the test selectors to be more specific

### Color validation fails

If the color consistency test fails:
1. Check if hardcoded colors are being used instead of Tailwind classes
2. Verify Tailwind config has the correct Stitch color tokens
3. Ensure components use the correct color classes (e.g., `bg-background`, `text-on-surface`)

## CI/CD Integration

These tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Visual Regression Tests
  run: |
    cd frontend
    npm run test:e2e -- visual-regression-phase1.spec.js
```

For CI environments, you may want to:
1. Store baseline screenshots in version control
2. Use a visual regression service (Percy, Chromatic) for cross-browser testing
3. Set up automatic baseline updates on main branch merges

## Best Practices

1. **Review diffs carefully** - Always review visual diffs before updating baselines
2. **Test locally first** - Run tests locally before pushing changes
3. **Update baselines intentionally** - Only update when visual changes are verified
4. **Document changes** - Add comments explaining why baselines were updated
5. **Test all viewports** - Ensure responsive design works across all breakpoints

## Future Enhancements

- Add Phase 2 pages (Host Management, Patch Manager, CVE Tracker, etc.)
- Add Phase 3 pages (CI/CD Pipelines, Monitoring, Backup Manager, etc.)
- Add cross-browser testing (Chrome, Firefox, Safari)
- Add accessibility testing (color contrast, ARIA labels)
- Add performance testing (Core Web Vitals)
- Integrate with visual regression service (Percy, Chromatic)

## Related Documentation

- [Design Document](../../../.kiro/specs/patchmaster-ui-redesign/design.md)
- [Requirements Document](../../../.kiro/specs/patchmaster-ui-redesign/requirements.md)
- [Tasks Document](../../../.kiro/specs/patchmaster-ui-redesign/tasks.md)
- [Playwright Documentation](https://playwright.dev/docs/test-snapshots)
