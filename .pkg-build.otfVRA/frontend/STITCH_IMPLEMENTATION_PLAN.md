# Stitch Implementation Plan

## Overview
This document outlines the systematic implementation of the Stitch design system into the PatchMaster frontend. The goal is to create an exact visual replica of the Stitch designs while preserving all existing functionality.

## Foundation Status ✅
- **Tailwind Configuration**: Complete with all Stitch colors
- **Material Symbols Icons**: Loaded in index.html
- **Inter Font**: Loaded with all required weights (300-800)
- **Custom CSS Utilities**: glass-gradient, no-scrollbar, and other utilities defined
- **Color System**: All 60+ color tokens from Stitch implemented

## Implementation Approach

### Phase 1: Core Component Library (Priority 1)
Create reusable components that match Stitch designs exactly:

1. **Layout Components**
   - `SideNavBar.jsx` - Left navigation with PatchMaster branding
   - `TopNavBar.jsx` - Top bar with search, notifications, user menu
   - `MainContent.jsx` - Content wrapper with proper spacing
   - `PageHeader.jsx` - Page title with breadcrumbs and actions

2. **Data Display Components**
   - `StatCard.jsx` - Summary statistics cards with glass gradient
   - `DataTable.jsx` - Enterprise-grade table with sorting, filtering
   - `StatusBadge.jsx` - Status indicators (success, warning, error, etc.)
   - `ChartCard.jsx` - Chart containers with proper styling

3. **Form Components**
   - `FormInput.jsx` - Styled input fields
   - `FormSelect.jsx` - Dropdown selects
   - `ActionButton.jsx` - Primary, secondary, danger buttons
   - `SearchBar.jsx` - Global search component

4. **Utility Components**
   - `EmptyState.jsx` - Actionable empty states
   - `LoadingSpinner.jsx` - Loading indicators
   - `Toast.jsx` - Notification toasts
   - `Modal.jsx` - Modal dialogs

### Phase 2: Page Migration (Priority 2)
Migrate pages in order of complexity, starting with simpler pages:

#### Simple Pages (4 pages)
1. **Dashboard** (`DashboardOpsPage.jsx`)
   - Stitch source: `stitch/patchmaster_dashboard/`
   - 4 stat cards, heartbeat chart, recent operations, license widget
   
2. **License Management** (`LicenseOpsPage.jsx`)
   - Stitch source: `stitch/license_tier_management/`
   - License status, tier information, usage metrics

3. **Alerts Center** (`AlertsCenterPage.jsx`)
   - Stitch source: `stitch/alerts_center/`
   - Alert list, filtering, priority indicators

4. **Audit & Compliance** (`AuditPage.jsx`)
   - Stitch source: `stitch/audit_compliance_reports/`
   - Compliance scores, audit trail, reports

#### Medium Complexity (7 pages)
5. **Host Management** (`HostsOpsPage.jsx`)
   - Stitch source: `stitch/host_management/`
   
6. **Patch Manager** (`PatchManagerOpsPage.jsx`)
   - Stitch source: `stitch/patch_manager/`
   
7. **CVE Tracker** (`CVEOpsPage.jsx`)
   - Stitch source: `stitch/cve_tracker_remediation/`
   
8. **Software Kiosk** (`SoftwarePage.jsx`)
   - Stitch source: `stitch/software_kiosk/`
   
9. **Network Boot** (`NetworkBootPage.jsx`)
   - Stitch source: `stitch/network_boot_manager/`
   
10. **Mirror Repositories** (`MirrorRepoOpsPage.jsx`)
    - Stitch source: `stitch/mirror_repositories/`
    
11. **Maintenance Windows** (`MaintenanceWindowsPage.jsx`)
    - Stitch source: `stitch/maintenance_windows/`

#### Complex Pages (8 pages)
12. **CI/CD Pipelines** (`CICDOpsPage.jsx`)
    - Stitch source: `stitch/ci_cd_pipelines/`
    
13. **Monitoring Operations** (`MonitoringOpsPage.jsx`)
    - Stitch source: `stitch/monitoring_operations_v2/`
    
14. **Backup & DR** (`BackupManagerPage.jsx`)
    - Stitch source: `stitch/backup_dr_manager/`
    
15. **Policy Editor** (`PolicyManagerPage.jsx`)
    - Stitch source: `stitch/policy_yaml_editor/`
    
16. **User RBAC** (`UsersOpsPage.jsx`)
    - Stitch source: `stitch/user_rbac_management/`
    
17. **Live Terminal** (`LiveCommandPage.jsx`)
    - Stitch source: `stitch/live_command_terminal/`
    
18. **Host Timeline** (`HostTimelinePage.jsx`)
    - Stitch source: `stitch/host_timeline/`
    
19. **Bulk Patch Operations** (`BulkPatchPage.jsx`)
    - Stitch source: `stitch/bulk_patch_operations/`

#### Remaining Pages (5 pages)
20. **Operations Queue** (`OpsQueuePage.jsx`)
    - Stitch source: `stitch/operations_queue/`
    
21. **Local Repository** (`LocalRepoOpsPage.jsx`)
    - Stitch source: `stitch/local_repo_manager/`
    
22. **Analytics & SLA** (`AnalyticsOpsPage.jsx`)
    - Stitch source: `stitch/analytics_sla_ops/`
    
23. **Agent Updates** (`AgentUpdatePage.jsx`)
    - Stitch source: `stitch/agent_update_center/`
    
24. **Infrastructure Dashboard** (if needed)
    - Stitch source: `stitch/infrastructure_dashboard_v2/`

### Phase 3: Testing & Refinement (Priority 3)
1. Visual comparison with Stitch screen.png files
2. Responsive behavior testing
3. Accessibility compliance
4. Performance optimization
5. Cross-browser testing

## Implementation Standards

### For Each Page:
1. **Open Stitch Reference**
   - View `stitch/{page_name}/screen.png`
   - Read `stitch/{page_name}/code.html`

2. **Extract Structure**
   - Copy Tailwind classes from code.html
   - Note layout patterns (grid, flex, spacing)
   - Identify reusable components

3. **Build React Component**
   - Create JSX structure matching HTML
   - Use exact Tailwind classes from Stitch
   - Preserve glass-gradient effects
   - Maintain Material Symbols icons

4. **Integrate Backend**
   - Connect to existing API endpoints
   - Preserve all business logic
   - Maintain state management
   - Keep permission checks

5. **Verify Visual Match**
   - Compare rendered output with screen.png
   - Check colors, spacing, typography
   - Verify responsive behavior
   - Test interactions

## Design System Rules (from DESIGN.md)

### The "No-Line" Rule
- **No borders for sectioning** - use surface-container tiers instead
- Use background color shifts to define boundaries

### Surface Hierarchy
1. Level 0 (Base): `background` (#060e20)
2. Level 1 (Navigation): `surface-container-low` (#06122d)
3. Level 2 (Workspace): `surface-container` (#05183c)
4. Level 3 (Interactive): `surface-container-highest` (#00225a)

### Glass & Gradient Rule
- Apply 15% opacity primary gradient to hero widgets
- Use `backdrop-blur: 20px` on floating panels
- Glass gradient: `linear-gradient(135deg, rgba(123, 208, 255, 0.1) 0%, rgba(123, 208, 255, 0) 40%)`

### Typography Scale
- **Display-LG**: 3.5rem (56px) - System-critical metrics
- **Headline-SM**: 1.5rem (24px) - Section titles with -0.02em tracking
- **Label-MD/SM**: Uppercase with 0.05em tracking - Status indicators

### Status Badge Colors
- **Success**: primary (#7bd0ff) on primary-container (#004c69)
- **Warning**: tertiary (#ffd16f) with 2px glow
- **Error**: on-error-container (#ff9993) on error-container (#7f2927)

### Button Styles
- **Primary**: Solid primary (#7bd0ff) with on-primary (#004560) text
- **Secondary**: outline (#5b74b1) at 40% opacity
- **Tertiary**: Text-only with label-md styling

## Current Status

### ✅ Completed
- Tailwind configuration with all Stitch colors
- Material Symbols icon integration
- Inter font loading (weights 300-800)
- Custom CSS utilities (glass-gradient, no-scrollbar)
- Base layout structure

### 🚧 In Progress
- Component library creation
- Page-by-page migration

### ⏳ Pending
- All 24 page migrations
- Responsive testing
- Accessibility audit
- Performance optimization

## Success Criteria

The implementation is complete when:
1. ✅ Each page visually matches its Stitch screen.png
2. ✅ All Tailwind classes from code.html are used correctly
3. ✅ Material Symbols icons are properly configured
4. ✅ Glass gradient effects are applied to hero widgets
5. ✅ Surface hierarchy is maintained (no borders, use bg shifts)
6. ✅ Typography follows the editorial scale
7. ✅ All existing functionality is preserved
8. ✅ Backend APIs remain unchanged
9. ✅ Responsive behavior works on mobile/tablet
10. ✅ Accessibility standards are met

## Next Steps

1. Create shared component library in `frontend/src/components/stitch/`
2. Start with Dashboard migration (simplest page)
3. Extract reusable patterns into components
4. Migrate remaining pages systematically
5. Test and refine visual accuracy
6. Document component usage

## Notes

- This is a **visual replica**, not a reinterpretation
- Preserve all existing business logic and API contracts
- Use Stitch code.html as the structural source of truth
- Use Stitch screen.png as the visual source of truth
- When in doubt, match the Stitch design exactly
