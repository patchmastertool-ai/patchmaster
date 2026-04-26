/**
 * ExportManager Service
 * 
 * Handles exporting generated screens to the PatchMaster filesystem with security controls.
 * Implements path traversal prevention, file validation, backup functionality, and navigation registration.
 * 
 * Requirements: 9.1-9.6, 10.1-10.5, 16.3, 16.5
 */

import { parse } from '@babel/parser';

class ExportManager {
  constructor() {
    // Whitelist of allowed export directories (relative to workspace root)
    this.allowedDirectories = [
      'frontend/src',
      'frontend/src/components',
      'frontend/src/pages'
    ];
    
    // Base directory for all exports (workspace root)
    this.baseDirectory = process.cwd ? process.cwd() : '/workspace';
  }

  /**
   * Normalizes a path by resolving . and .. segments
   * Browser-compatible implementation without external dependencies
   * 
   * @param {string} inputPath - Path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(inputPath) {
    // Replace backslashes with forward slashes for consistency
    let normalized = inputPath.replace(/\\/g, '/');
    
    // Split into segments
    const segments = normalized.split('/').filter(seg => seg !== '.' && seg !== '');
    const result = [];
    
    for (const segment of segments) {
      if (segment === '..') {
        // Parent directory - pop from result if not at root
        if (result.length > 0 && result[result.length - 1] !== '..') {
          result.pop();
        } else {
          // Keep .. if we're at the beginning (will be caught by validation)
          result.push(segment);
        }
      } else {
        result.push(segment);
      }
    }
    
    return result.join('/');
  }

  /**
   * Gets the basename (filename) from a path
   * 
   * @param {string} filePath - Path to extract basename from
   * @returns {string} Basename
   */
  getBasename(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Gets the directory name from a path
   * 
   * @param {string} filePath - Path to extract dirname from
   * @returns {string} Directory name
   */
  getDirname(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    parts.pop();
    return parts.join('/');
  }

  /**
   * Gets the file extension from a path
   * 
   * @param {string} filePath - Path to extract extension from
   * @returns {string} Extension including the dot
   */
  getExtension(filePath) {
    const basename = this.getBasename(filePath);
    const lastDot = basename.lastIndexOf('.');
    return lastDot === -1 ? '' : basename.substring(lastDot);
  }

  /**
   * Joins path segments
   * 
   * @param {...string} segments - Path segments to join
   * @returns {string} Joined path
   */
  joinPath(...segments) {
    return segments.join('/').replace(/\/+/g, '/');
  }

  /**
   * Validates export path for security and naming conventions
   * Prevents directory traversal attacks
   * 
   * @param {string} targetPath - Target file path for export
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateExport(targetPath) {
    const errors = [];

    // Requirement 16.3: Prevent directory traversal attacks
    if (!this.isPathSafe(targetPath)) {
      errors.push('Invalid path: Directory traversal detected. Path must not contain "..", absolute paths, or symbolic links.');
    }

    // Requirement 9.1: Validate target path starts with allowed directory
    if (!this.isPathInAllowedDirectory(targetPath)) {
      errors.push(`Target path must be within allowed directories: ${this.allowedDirectories.join(', ')}`);
    }

    // Requirement 9.2: Validate file extension
    if (!targetPath.endsWith('.jsx') && !targetPath.endsWith('.tsx')) {
      errors.push('File must have .jsx or .tsx extension');
    }

    // Requirement 9.3: Validate naming convention
    const fileName = this.getBasename(targetPath);
    if (!fileName.endsWith('Page.jsx') && !fileName.endsWith('OpsPage.jsx') && 
        !fileName.endsWith('Page.tsx') && !fileName.endsWith('OpsPage.tsx')) {
      errors.push('File name should follow *Page.jsx, *OpsPage.jsx, *Page.tsx, or *OpsPage.tsx convention');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates generated code for syntax and required imports
   * 
   * @param {string} code - Generated JSX/TSX code
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateCode(code) {
    const errors = [];

    // Requirement 9.4: Validate JSX syntax
    try {
      parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
    } catch (error) {
      errors.push(`Generated code contains syntax errors: ${error.message}`);
    }

    // Requirement 9.5: Check for required imports
    if (!code.includes('import React') && !code.includes('import * as React')) {
      errors.push('Generated code must import React');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if a path is safe from directory traversal attacks
   * Implements comprehensive path traversal prevention
   * 
   * @param {string} targetPath - Path to validate
   * @returns {boolean} True if path is safe, false otherwise
   */
  isPathSafe(targetPath) {
    // Requirement 16.3: Prevent directory traversal attacks
    
    // Check for null or empty path
    if (!targetPath || typeof targetPath !== 'string') {
      return false;
    }

    // Normalize the path to resolve any relative segments
    const normalizedPath = this.normalizePath(targetPath);

    // Check for directory traversal patterns
    // Block: .., ../, ..\, /../, \..\, etc.
    if (normalizedPath.includes('..')) {
      return false;
    }

    // Block absolute paths (Unix and Windows)
    // Unix: starts with /
    // Windows: starts with drive letter (C:, D:, etc.)
    if (targetPath.startsWith('/') || targetPath.startsWith('\\')) {
      return false;
    }

    // Block Windows drive letters (C:, D:, etc.)
    if (/^[a-zA-Z]:/.test(targetPath)) {
      return false;
    }

    // Block UNC paths (\\server\share)
    if (targetPath.startsWith('\\\\')) {
      return false;
    }

    // Block null bytes (can be used to bypass filters)
    if (normalizedPath.includes('\0')) {
      return false;
    }

    // Block URL-encoded directory traversal attempts
    try {
      const decoded = decodeURIComponent(targetPath);
      if (decoded.includes('..') || decoded !== targetPath) {
        return false;
      }
    } catch (e) {
      // Invalid URI encoding
      return false;
    }

    return true;
  }

  /**
   * Checks if a path is within the allowed export directories
   * 
   * @param {string} targetPath - Path to check
   * @returns {boolean} True if path is in allowed directory, false otherwise
   */
  isPathInAllowedDirectory(targetPath) {
    const normalizedPath = this.normalizePath(targetPath);
    
    return this.allowedDirectories.some(allowedDir => {
      const normalizedAllowedDir = this.normalizePath(allowedDir);
      return normalizedPath.startsWith(normalizedAllowedDir + '/') || 
             normalizedPath === normalizedAllowedDir;
    });
  }

  /**
   * Resolves a path safely within the allowed directories
   * Returns null if the resolved path is outside allowed directories
   * 
   * @param {string} targetPath - Path to resolve
   * @returns {string|null} Resolved absolute path or null if unsafe
   */
  resolveSafePath(targetPath) {
    // First check if path is safe
    if (!this.isPathSafe(targetPath)) {
      return null;
    }

    // Normalize and resolve the path
    const normalizedPath = this.normalizePath(targetPath);
    const resolvedPath = this.joinPath(this.baseDirectory, normalizedPath);

    // Verify the resolved path is still within allowed directories
    const isAllowed = this.allowedDirectories.some(allowedDir => {
      const allowedAbsPath = this.joinPath(this.baseDirectory, allowedDir);
      return resolvedPath.startsWith(allowedAbsPath + '/') || 
             resolvedPath === allowedAbsPath;
    });

    return isAllowed ? resolvedPath : null;
  }

  /**
   * Checks if a file exists at the given path
   * 
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists, false otherwise
   */
  async checkFileExists(filePath) {
    // Validate path first
    if (!this.isPathSafe(filePath)) {
      throw new Error('Invalid file path: Security validation failed');
    }

    try {
      // In browser environment, we can't directly check filesystem
      // This would need to be implemented via backend API
      const response = await fetch('/api/files/exists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Creates a backup of an existing file
   * 
   * @param {string} filePath - Path to file to backup
   * @returns {Promise<string>} Path to backup file
   */
  async backupExistingFile(filePath) {
    // Validate path first
    if (!this.isPathSafe(filePath)) {
      throw new Error('Invalid file path: Security validation failed');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = this.getExtension(filePath);
    const base = this.getBasename(filePath).replace(ext, '');
    const dir = this.getDirname(filePath);
    const backupPath = this.joinPath(dir, `${base}.backup.${timestamp}${ext}`);

    try {
      // Backend API call to create backup
      const response = await fetch('/api/files/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourcePath: filePath,
          backupPath: backupPath
        })
      });

      if (!response.ok) {
        throw new Error(`Backup failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Writes content to a file
   * 
   * @param {string} filePath - Target file path
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   * @returns {Promise<void>}
   */
  async writeFile(filePath, content, options = {}) {
    // Requirement 16.3: Validate path for security
    if (!this.isPathSafe(filePath)) {
      throw new Error('Invalid file path: Security validation failed');
    }

    // Requirement 16.5: Verify write permissions
    const safePath = this.resolveSafePath(filePath);
    if (!safePath) {
      throw new Error('File path is outside allowed directories');
    }

    try {
      // Backend API call to write file
      const response = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content: content,
          options: options
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'File write failed');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Exports a screen to the filesystem
   * 
   * @param {Object} screen - Screen object with code and metadata
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportScreen(screen, options) {
    const {
      targetPath,
      overwrite = false,
      createBackup = true,
      updateNavigation = false,
      navigationConfig = null
    } = options;

    try {
      // Step 1: Validate export path
      const pathValidation = this.validateExport(targetPath);
      if (!pathValidation.isValid) {
        return {
          success: false,
          errors: pathValidation.errors
        };
      }

      // Step 2: Validate generated code
      const codeValidation = this.validateCode(screen.code);
      if (!codeValidation.isValid) {
        return {
          success: false,
          errors: codeValidation.errors
        };
      }

      // Step 3: Check if file exists
      const fileExists = await this.checkFileExists(targetPath);
      let backupPath = null;

      if (fileExists) {
        if (!overwrite) {
          return {
            success: false,
            errors: ['File already exists. Set overwrite option to replace it.']
          };
        }

        // Step 4: Create backup if requested
        if (createBackup) {
          backupPath = await this.backupExistingFile(targetPath);
        }
      }

      // Step 5: Write file
      await this.writeFile(targetPath, screen.code);

      // Step 6: Update navigation if requested
      let navigationResult = null;
      if (updateNavigation && navigationConfig) {
        try {
          navigationResult = await this.updateNavigation(navigationConfig);
        } catch (navError) {
          // Navigation update failed, but file was written successfully
          console.warn('Navigation update failed:', navError);
          navigationResult = {
            success: false,
            error: navError.message,
            manualSteps: this.getManualNavigationSteps(navigationConfig)
          };
        }
      }

      return {
        success: true,
        filePath: targetPath,
        backupPath: backupPath,
        navigationResult: navigationResult
      };

    } catch (error) {
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Updates application navigation to include new route
   * 
   * @param {Object} config - Navigation configuration
   * @returns {Promise<Object>} Update result
   */
  async updateNavigation(config) {
    const {
      icon,
      label,
      route,
      requiredPermission = null,
      requiredFeature = null
    } = config;

    try {
      const response = await fetch('/api/files/update-navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icon,
          label,
          route,
          requiredPermission,
          requiredFeature
        })
      });

      if (!response.ok) {
        throw new Error(`Navigation update failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to update navigation: ${error.message}`);
    }
  }

  /**
   * Generates manual steps for navigation registration
   * 
   * @param {Object} config - Navigation configuration
   * @returns {string} Manual steps as formatted text
   */
  getManualNavigationSteps(config) {
    const { icon, label, route, requiredPermission, requiredFeature } = config;
    
    let steps = `Manual Navigation Registration Steps:\n\n`;
    steps += `1. Open frontend/src/App.js\n\n`;
    steps += `2. Add the following route to the routes array:\n\n`;
    steps += `{\n`;
    steps += `  path: '/${route}',\n`;
    steps += `  label: '${label}',\n`;
    steps += `  icon: '${icon}'`;
    
    if (requiredPermission) {
      steps += `,\n  requiredPermission: '${requiredPermission}'`;
    }
    
    if (requiredFeature) {
      steps += `,\n  requiredFeature: '${requiredFeature}'`;
    }
    
    steps += `\n}\n`;
    
    return steps;
  }
}

export default ExportManager;
