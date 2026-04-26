/**
 * Migration Verification Test Suite
 * 
 * This test suite verifies that all pages have been successfully migrated
 * from CH.jsx components to Stitch design system components.
 * 
 * Test Coverage:
 * 1. No CH.jsx imports in migrated pages
 * 2. All pages use Stitch layout components (SideNavBar, TopNavBar, MainContent)
 * 3. All pages use Stitch UI components (StatCard, DataTable, StatusBadge, etc.)
 * 4. Material Symbols icons are used instead of Lucide icons
 * 5. Stitch color tokens are used instead of CH.jsx colors
 */

import fs from 'fs';
import path from 'path';

const MIGRATED_PAGES = [
  'BulkPatchPage.jsx',
  'RemediationPage.jsx',
  'ProvisioningPage.jsx',
  'SLAOpsPage.jsx',
  'PluginIntegrationsPage.jsx',
  'OnboardingOpsPage.jsx',
];

const PAGES_TO_MIGRATE = [
  'AgentUpdatePage.jsx',
  'RingRolloutPage.jsx',
  'RestoreDrillPage.jsx',
  'OpsQueuePage.jsx',
  'LocalRepoOpsPage.jsx',
];

const ALL_PAGES = [...MIGRATED_PAGES, ...PAGES_TO_MIGRATE];

const STITCH_LAYOUT_COMPONENTS = [
  'SideNavBar',
  'TopNavBar',
  'MainContent',
];

const STITCH_UI_COMPONENTS = [
  'StatCard',
  'DataTable',
  'StatusBadge',
  'ActionButton',
  'FormInput',
  'FormSelect',
];

const CH_IMPORTS = [
  'CHPage',
  'CHHeader',
  'CHCard',
  'CHStat',
  'CHLabel',
  'CHBadge',
  'CHBtn',
  'CHTable',
  'CHTR',
  'CH',
];

const LUCIDE_ICONS = [
  'RefreshCw',
  'Plus',
  'Trash2',
  'Play',
  'X',
  'Scan',
];

const STITCH_COLORS = [
  '#7bd0ff',  // primary
  '#060e20',  // background
  '#06122d',  // surface-1
  '#05183c',  // surface-2
  '#031d4b',  // surface-3
  '#00225a',  // surface-4
  '#dee5ff',  // text
  '#91aaeb',  // text-sub
  '#2b4680',  // border
  '#ee7d77',  // error
  '#ffd16f',  // warning
];

describe('Migration Verification Test Suite', () => {
  describe('File Existence', () => {
    test.each(ALL_PAGES)('%s exists in frontend/src/', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('CH.jsx Import Removal', () => {
    test.each(MIGRATED_PAGES)('%s should not import from CH.jsx', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).not.toMatch(/from ['"]\.\/CH\.jsx['"]/);
      expect(content).not.toMatch(/import.*CH\.jsx/);
    });

    test.each(MIGRATED_PAGES)('%s should not use CH.jsx components', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      CH_IMPORTS.forEach(component => {
        // Allow in comments but not in actual code
        const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
        const regex = new RegExp(`<${component}[\\s>]`, 'g');
        expect(codeWithoutComments).not.toMatch(regex);
      });
    });
  });

  describe('Stitch Layout Components', () => {
    test.each(MIGRATED_PAGES)('%s should use SideNavBar', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toMatch(/import.*SideNavBar.*from.*['"]\.\/components\/layout\/SideNavBar['"]/);
      expect(content).toMatch(/<SideNavBar/);
    });

    test.each(MIGRATED_PAGES)('%s should use TopNavBar', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toMatch(/import.*TopNavBar.*from.*['"]\.\/components\/layout\/TopNavBar['"]/);
      expect(content).toMatch(/<TopNavBar/);
    });

    test.each(MIGRATED_PAGES)('%s should use MainContent', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toMatch(/import.*MainContent.*from.*['"]\.\/components\/layout\/MainContent['"]/);
      expect(content).toMatch(/<MainContent/);
    });

    test.each(MIGRATED_PAGES)('%s should use flex layout wrapper', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toMatch(/<div className="flex">/);
    });
  });

  describe('Stitch UI Components', () => {
    test.each(MIGRATED_PAGES)('%s should import Stitch UI components', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // At least some Stitch UI components should be imported
      const hasStitchImports = STITCH_UI_COMPONENTS.some(component => 
        content.includes(`import.*${component}.*from.*['"]./components/ui/`)
      );
      
      expect(hasStitchImports).toBe(true);
    });

    test.each(MIGRATED_PAGES)('%s should use StatCard for metrics', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // If page has metrics/stats, it should use StatCard
      if (content.includes('grid-cols-2 md:grid-cols-4') || content.includes('KPI')) {
        expect(content).toMatch(/<StatCard/);
      }
    });

    test.each(MIGRATED_PAGES)('%s should use ActionButton for actions', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // If page has buttons, should use ActionButton
      if (content.includes('onClick') && content.includes('button')) {
        expect(content).toMatch(/<ActionButton/);
      }
    });
  });

  describe('Material Symbols Icons', () => {
    test.each(MIGRATED_PAGES)('%s should not import Lucide icons', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).not.toMatch(/from ['"]lucide-react['"]/);
    });

    test.each(MIGRATED_PAGES)('%s should import Icon component', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Icon component should be imported if icons are used
      if (content.includes('icon=')) {
        expect(content).toMatch(/import.*Icon.*from.*['"]\.\/components\/Icon['"]/);
      }
    });
  });

  describe('Stitch Color Tokens', () => {
    test.each(MIGRATED_PAGES)('%s should use Stitch color tokens', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should use at least some Stitch colors
      const hasStitchColors = STITCH_COLORS.some(color => content.includes(color));
      expect(hasStitchColors).toBe(true);
    });

    test.each(MIGRATED_PAGES)('%s should not use CH.jsx color references', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).not.toMatch(/CH\.text/);
      expect(content).not.toMatch(/CH\.textSub/);
      expect(content).not.toMatch(/CH\.accent/);
      expect(content).not.toMatch(/CH\.border/);
      expect(content).not.toMatch(/CH\.red/);
      expect(content).not.toMatch(/CH\.green/);
      expect(content).not.toMatch(/CH\.yellow/);
    });
  });

  describe('Responsive Design', () => {
    test.each(MIGRATED_PAGES)('%s should use responsive grid classes', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should have responsive breakpoints
      const hasResponsive = 
        content.includes('md:') || 
        content.includes('lg:') || 
        content.includes('sm:');
      
      expect(hasResponsive).toBe(true);
    });

    test.each(MIGRATED_PAGES)('%s should use proper spacing classes', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should use gap-6 or gap-8 for consistent spacing
      expect(content).toMatch(/gap-[468]/);
    });
  });

  describe('Component Props Integrity', () => {
    test.each(MIGRATED_PAGES)('%s should pass required props to layout components', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // SideNavBar should have required props
      if (content.includes('<SideNavBar')) {
        expect(content).toMatch(/currentPage=/);
        expect(content).toMatch(/user=/);
        expect(content).toMatch(/licenseInfo=/);
      }
      
      // TopNavBar should have required props
      if (content.includes('<TopNavBar')) {
        expect(content).toMatch(/pageTitle=/);
        expect(content).toMatch(/pageIcon=/);
      }
    });

    test.each(MIGRATED_PAGES)('%s should initialize state for layout components', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should have currentPage state
      expect(content).toMatch(/useState.*currentPage/);
      
      // Should have user state
      expect(content).toMatch(/useState.*user/);
      
      // Should have licenseInfo state
      expect(content).toMatch(/useState.*licenseInfo/);
    });
  });

  describe('Functionality Preservation', () => {
    test.each(MIGRATED_PAGES)('%s should preserve API calls', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should still have API integration
      if (content.includes('API') || content.includes('apiFetch')) {
        expect(content).toMatch(/apiFetch/);
      }
    });

    test.each(MIGRATED_PAGES)('%s should preserve event handlers', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should have onClick handlers
      expect(content).toMatch(/onClick/);
    });

    test.each(MIGRATED_PAGES)('%s should preserve state management', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should use useState
      expect(content).toMatch(/useState/);
    });
  });

  describe('Code Quality', () => {
    test.each(MIGRATED_PAGES)('%s should not have inline styles', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should not use style={{ }} except for specific cases
      const styleMatches = content.match(/style=\{\{/g);
      
      // Allow minimal inline styles (e.g., for dynamic colors)
      if (styleMatches) {
        expect(styleMatches.length).toBeLessThan(5);
      }
    });

    test.each(MIGRATED_PAGES)('%s should use Tailwind classes', (pageName) => {
      const filePath = path.join(process.cwd(), 'frontend', 'src', pageName);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should use className with Tailwind
      expect(content).toMatch(/className="/);
      expect(content).toMatch(/bg-\[#/);
      expect(content).toMatch(/text-\[#/);
    });
  });
});

describe('Migration Progress Tracking', () => {
  test('should track migration completion percentage', () => {
    const totalPages = ALL_PAGES.length;
    const migratedPages = MIGRATED_PAGES.length;
    const percentage = Math.round((migratedPages / totalPages) * 100);
    
    console.log(`\n📊 Migration Progress: ${migratedPages}/${totalPages} pages (${percentage}%)`);
    console.log(`✅ Migrated: ${MIGRATED_PAGES.join(', ')}`);
    console.log(`⏳ Remaining: ${PAGES_TO_MIGRATE.join(', ')}\n`);
    
    expect(migratedPages).toBeGreaterThan(0);
  });

  test('should list all pages requiring migration', () => {
    const srcDir = path.join(process.cwd(), 'frontend', 'src');
    
    PAGES_TO_MIGRATE.forEach(pageName => {
      const filePath = path.join(srcDir, pageName);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const hasCHImport = content.includes("from './CH.jsx'");
        
        if (hasCHImport) {
          console.log(`⚠️  ${pageName} still uses CH.jsx`);
        }
      }
    });
  });
});
