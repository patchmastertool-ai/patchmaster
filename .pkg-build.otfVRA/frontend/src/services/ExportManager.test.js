/**
 * ExportManager Unit Tests
 * 
 * Tests path traversal prevention, export validation, and file operations
 * Requirements: 9.1-9.6, 10.2, 10.3, 16.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExportManager from './ExportManager';

describe('ExportManager', () => {
  let exportManager;

  beforeEach(() => {
    exportManager = new ExportManager();
    // Mock fetch for API calls
    global.fetch = vi.fn();
  });

  describe('Path Traversal Prevention (Requirement 16.3)', () => {
    describe('isPathSafe', () => {
      it('should allow valid relative paths', () => {
        expect(exportManager.isPathSafe('frontend/src/TestPage.jsx')).toBe(true);
        expect(exportManager.isPathSafe('frontend/src/components/Button.jsx')).toBe(true);
      });

      it('should block paths with .. (parent directory)', () => {
        expect(exportManager.isPathSafe('../etc/passwd')).toBe(false);
        expect(exportManager.isPathSafe('frontend/../backend/config.js')).toBe(false);
        expect(exportManager.isPathSafe('frontend/src/../../etc/passwd')).toBe(false);
      });

      it('should block paths with ../ traversal', () => {
        expect(exportManager.isPathSafe('frontend/src/../../../etc/passwd')).toBe(false);
        expect(exportManager.isPathSafe('./../../sensitive.txt')).toBe(false);
      });

      it('should block paths with ..\\ traversal (Windows)', () => {
        expect(exportManager.isPathSafe('frontend\\src\\..\\..\\config.js')).toBe(false);
      });

      it('should block absolute Unix paths', () => {
        expect(exportManager.isPathSafe('/etc/passwd')).toBe(false);
        expect(exportManager.isPathSafe('/var/www/html/index.php')).toBe(false);
      });

      it('should block absolute Windows paths', () => {
        expect(exportManager.isPathSafe('C:\\Windows\\System32\\config.sys')).toBe(false);
        expect(exportManager.isPathSafe('D:\\secrets\\data.txt')).toBe(false);
      });

      it('should block UNC paths', () => {
        expect(exportManager.isPathSafe('\\\\server\\share\\file.txt')).toBe(false);
        expect(exportManager.isPathSafe('\\\\192.168.1.1\\admin$\\file.txt')).toBe(false);
      });

      it('should block null bytes', () => {
        expect(exportManager.isPathSafe('frontend/src/test\0.jsx')).toBe(false);
        expect(exportManager.isPathSafe('frontend/src/test.jsx\0/../../etc/passwd')).toBe(false);
      });

      it('should block URL-encoded traversal attempts', () => {
        expect(exportManager.isPathSafe('frontend%2F..%2F..%2Fetc%2Fpasswd')).toBe(false);
        expect(exportManager.isPathSafe('frontend%2Fsrc%2F..%2F..%2Fconfig.js')).toBe(false);
      });

      it('should block paths starting with / or \\', () => {
        expect(exportManager.isPathSafe('/frontend/src/test.jsx')).toBe(false);
        expect(exportManager.isPathSafe('\\frontend\\src\\test.jsx')).toBe(false);
      });

      it('should reject null or empty paths', () => {
        expect(exportManager.isPathSafe(null)).toBe(false);
        expect(exportManager.isPathSafe('')).toBe(false);
        expect(exportManager.isPathSafe(undefined)).toBe(false);
      });

      it('should reject non-string paths', () => {
        expect(exportManager.isPathSafe(123)).toBe(false);
        expect(exportManager.isPathSafe({})).toBe(false);
        expect(exportManager.isPathSafe([])).toBe(false);
      });
    });

    describe('isPathInAllowedDirectory', () => {
      it('should allow paths in frontend/src', () => {
        expect(exportManager.isPathInAllowedDirectory('frontend/src/TestPage.jsx')).toBe(true);
        expect(exportManager.isPathInAllowedDirectory('frontend/src/components/Button.jsx')).toBe(true);
      });

      it('should allow paths in frontend/src/components', () => {
        expect(exportManager.isPathInAllowedDirectory('frontend/src/components/Card.jsx')).toBe(true);
      });

      it('should allow paths in frontend/src/pages', () => {
        expect(exportManager.isPathInAllowedDirectory('frontend/src/pages/HomePage.jsx')).toBe(true);
      });

      it('should block paths outside allowed directories', () => {
        expect(exportManager.isPathInAllowedDirectory('backend/config.js')).toBe(false);
        expect(exportManager.isPathInAllowedDirectory('etc/passwd')).toBe(false);
        expect(exportManager.isPathInAllowedDirectory('frontend/public/index.html')).toBe(false);
      });
    });

    describe('resolveSafePath', () => {
      it('should resolve safe paths within allowed directories', () => {
        const result = exportManager.resolveSafePath('frontend/src/TestPage.jsx');
        expect(result).toBeTruthy();
        expect(result).toContain('frontend/src/TestPage.jsx');
      });

      it('should return null for unsafe paths', () => {
        expect(exportManager.resolveSafePath('../etc/passwd')).toBeNull();
        expect(exportManager.resolveSafePath('/etc/passwd')).toBeNull();
        expect(exportManager.resolveSafePath('C:\\Windows\\System32\\file.txt')).toBeNull();
      });

      it('should return null for paths outside allowed directories', () => {
        expect(exportManager.resolveSafePath('backend/config.js')).toBeNull();
        expect(exportManager.resolveSafePath('etc/passwd')).toBeNull();
      });
    });
  });

  describe('Export Path Validation (Requirements 9.1-9.3)', () => {
    describe('validateExport', () => {
      it('should validate correct paths', () => {
        const result = exportManager.validateExport('frontend/src/TestPage.jsx');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate correct OpsPage paths', () => {
        const result = exportManager.validateExport('frontend/src/TestOpsPage.jsx');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate TypeScript files', () => {
        const result = exportManager.validateExport('frontend/src/TestPage.tsx');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject paths with directory traversal', () => {
        const result = exportManager.validateExport('../etc/passwd');
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Directory traversal'))).toBe(true);
      });

      it('should reject paths outside allowed directories', () => {
        const result = exportManager.validateExport('backend/config.js');
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('must be within allowed directories'))).toBe(true);
      });

      it('should reject files without .jsx or .tsx extension', () => {
        const result = exportManager.validateExport('frontend/src/TestPage.js');
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('.jsx or .tsx extension'))).toBe(true);
      });

      it('should reject files not following naming convention', () => {
        const result = exportManager.validateExport('frontend/src/test.jsx');
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('naming convention') || e.includes('should follow'))).toBe(true);
      });

      it('should accept files following *Page.jsx convention', () => {
        const result = exportManager.validateExport('frontend/src/CustomPage.jsx');
        expect(result.isValid).toBe(true);
      });

      it('should accept files following *OpsPage.jsx convention', () => {
        const result = exportManager.validateExport('frontend/src/CustomOpsPage.jsx');
        expect(result.isValid).toBe(true);
      });

      it('should accumulate multiple validation errors', () => {
        const result = exportManager.validateExport('../backend/test.js');
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Code Validation (Requirements 9.4-9.5)', () => {
    describe('validateCode', () => {
      it('should validate correct JSX code', () => {
        const code = `
          import React from 'react';
          
          const TestPage = () => {
            return <div>Hello World</div>;
          };
          
          export default TestPage;
        `;
        
        const result = exportManager.validateCode(code);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate code with React namespace import', () => {
        const code = `
          import * as React from 'react';
          
          const TestPage = () => {
            return <div>Hello World</div>;
          };
          
          export default TestPage;
        `;
        
        const result = exportManager.validateCode(code);
        expect(result.isValid).toBe(true);
      });

      it('should reject code without React import', () => {
        const code = `
          const TestPage = () => {
            return <div>Hello World</div>;
          };
          
          export default TestPage;
        `;
        
        const result = exportManager.validateCode(code);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('import React'))).toBe(true);
      });

      it('should reject code with syntax errors', () => {
        const code = `
          import React from 'react';
          
          const TestPage = () => {
            return <div>Hello World;
          };
        `;
        
        const result = exportManager.validateCode(code);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('syntax errors'))).toBe(true);
      });

      it('should reject code with unclosed JSX tags', () => {
        const code = `
          import React from 'react';
          
          const TestPage = () => {
            return <div>Hello World;
          };
        `;
        
        const result = exportManager.validateCode(code);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('File Operations', () => {
    describe('checkFileExists', () => {
      it('should check if file exists via API', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ exists: true })
        });

        const exists = await exportManager.checkFileExists('frontend/src/TestPage.jsx');
        expect(exists).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/exists',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('frontend/src/TestPage.jsx')
          })
        );
      });

      it('should reject unsafe paths', async () => {
        await expect(
          exportManager.checkFileExists('../etc/passwd')
        ).rejects.toThrow('Security validation failed');
      });

      it('should handle API errors gracefully', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        const exists = await exportManager.checkFileExists('frontend/src/TestPage.jsx');
        expect(exists).toBe(false);
      });
    });

    describe('backupExistingFile', () => {
      it('should create timestamped backup via API', async () => {
        const mockBackupPath = 'frontend/src/TestPage.backup.2024-01-01T12-00-00-000Z.jsx';
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ backupPath: mockBackupPath })
        });

        const backupPath = await exportManager.backupExistingFile('frontend/src/TestPage.jsx');
        expect(backupPath).toBe(mockBackupPath);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/backup',
          expect.objectContaining({
            method: 'POST'
          })
        );
      });

      it('should reject unsafe paths', async () => {
        await expect(
          exportManager.backupExistingFile('../etc/passwd')
        ).rejects.toThrow('Security validation failed');
      });

      it('should handle backup failures', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Permission denied'
        });

        await expect(
          exportManager.backupExistingFile('frontend/src/TestPage.jsx')
        ).rejects.toThrow('Backup failed');
      });
    });

    describe('writeFile', () => {
      it('should write file via API', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

        await exportManager.writeFile('frontend/src/TestPage.jsx', 'content');
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/write',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('TestPage.jsx')
          })
        );
      });

      it('should reject unsafe paths', async () => {
        await expect(
          exportManager.writeFile('../etc/passwd', 'malicious')
        ).rejects.toThrow('Security validation failed');
      });

      it('should reject paths outside allowed directories', async () => {
        await expect(
          exportManager.writeFile('backend/config.js', 'content')
        ).rejects.toThrow('outside allowed directories');
      });

      it('should handle write failures', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Permission denied' })
        });

        await expect(
          exportManager.writeFile('frontend/src/TestPage.jsx', 'content')
        ).rejects.toThrow('Permission denied');
      });
    });
  });

  describe('exportScreen', () => {
    const validScreen = {
      code: `
        import React from 'react';
        const TestPage = () => <div>Test</div>;
        export default TestPage;
      `
    };

    const validOptions = {
      targetPath: 'frontend/src/TestPage.jsx',
      overwrite: true,
      createBackup: false,
      updateNavigation: false
    };

    it('should export screen successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: false })
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await exportManager.exportScreen(validScreen, validOptions);
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('frontend/src/TestPage.jsx');
    });

    it('should reject export with invalid path', async () => {
      const result = await exportManager.exportScreen(validScreen, {
        ...validOptions,
        targetPath: '../etc/passwd'
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Directory traversal'))).toBe(true);
    });

    it('should reject export with invalid code', async () => {
      const invalidScreen = {
        code: 'const broken = () => <div>test'
      };

      const result = await exportManager.exportScreen(invalidScreen, validOptions);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should create backup when file exists and backup is enabled', async () => {
      const mockBackupPath = 'frontend/src/TestPage.backup.2024-01-01.jsx';
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true })
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ backupPath: mockBackupPath })
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await exportManager.exportScreen(validScreen, {
        ...validOptions,
        createBackup: true
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(mockBackupPath);
    });

    it('should reject overwrite when file exists and overwrite is false', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exists: true })
      });

      const result = await exportManager.exportScreen(validScreen, {
        ...validOptions,
        overwrite: false
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('already exists'))).toBe(true);
    });
  });

  describe('Navigation Registration', () => {
    describe('updateNavigation', () => {
      it('should update navigation via API', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

        const config = {
          icon: 'test-icon',
          label: 'Test Page',
          route: 'test-page'
        };

        const result = await exportManager.updateNavigation(config);
        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/update-navigation',
          expect.objectContaining({
            method: 'POST'
          })
        );
      });

      it('should include permission and feature flags', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

        const config = {
          icon: 'test-icon',
          label: 'Test Page',
          route: 'test-page',
          requiredPermission: 'admin',
          requiredFeature: 'advanced'
        };

        await exportManager.updateNavigation(config);
        
        const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(callBody.requiredPermission).toBe('admin');
        expect(callBody.requiredFeature).toBe('advanced');
      });
    });

    describe('getManualNavigationSteps', () => {
      it('should generate manual steps', () => {
        const config = {
          icon: 'test-icon',
          label: 'Test Page',
          route: 'test-page'
        };

        const steps = exportManager.getManualNavigationSteps(config);
        expect(steps).toContain('App.js');
        expect(steps).toContain('test-page');
        expect(steps).toContain('Test Page');
        expect(steps).toContain('test-icon');
      });

      it('should include permission in manual steps', () => {
        const config = {
          icon: 'test-icon',
          label: 'Test Page',
          route: 'test-page',
          requiredPermission: 'admin'
        };

        const steps = exportManager.getManualNavigationSteps(config);
        expect(steps).toContain('requiredPermission');
        expect(steps).toContain('admin');
      });

      it('should include feature flag in manual steps', () => {
        const config = {
          icon: 'test-icon',
          label: 'Test Page',
          route: 'test-page',
          requiredFeature: 'advanced'
        };

        const steps = exportManager.getManualNavigationSteps(config);
        expect(steps).toContain('requiredFeature');
        expect(steps).toContain('advanced');
      });
    });
  });
});
