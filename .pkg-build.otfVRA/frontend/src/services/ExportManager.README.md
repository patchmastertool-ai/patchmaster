# ExportManager Service

## Overview

The ExportManager service handles exporting generated screens to the PatchMaster filesystem with comprehensive security controls. It implements robust path traversal prevention, file validation, backup functionality, and navigation registration.

## Security Features

### Path Traversal Prevention (Requirement 16.3)

The ExportManager implements multiple layers of defense against directory traversal attacks:

#### 1. Path Safety Validation (`isPathSafe`)

Blocks the following attack vectors:

- **Parent directory traversal**: `..`, `../`, `..\`, `/../`, `\..\`
- **Absolute paths**: 
  - Unix: `/etc/passwd`, `/var/www/html/index.php`
  - Windows: `C:\Windows\System32\config.sys`, `D:\secrets\data.txt`
- **UNC paths**: `\\server\share\file.txt`, `\\192.168.1.1\admin$\file.txt`
- **Null bytes**: `file.txt\0`, `test.jsx\0/../../etc/passwd`
- **URL-encoded traversal**: `frontend%2F..%2F..%2Fetc%2Fpasswd`
- **Paths starting with separators**: `/frontend/src/test.jsx`, `\frontend\src\test.jsx`
- **Invalid input types**: `null`, `undefined`, empty strings, non-string values

#### 2. Directory Whitelist (`isPathInAllowedDirectory`)

Only allows exports to specific directories:

- `frontend/src`
- `frontend/src/components`
- `frontend/src/pages`

Any path outside these directories is rejected, even if it passes the safety checks.

#### 3. Safe Path Resolution (`resolveSafePath`)

Combines both safety validation and directory whitelist checking:

1. Validates the path is safe from traversal attacks
2. Normalizes the path to resolve relative segments
3. Resolves the absolute path
4. Verifies the resolved path is still within allowed directories
5. Returns `null` if any check fails

### Example Attack Prevention

```javascript
const exportManager = new ExportManager();

// ❌ BLOCKED: Parent directory traversal
exportManager.isPathSafe('../etc/passwd'); // false
exportManager.isPathSafe('frontend/src/../../etc/passwd'); // false

// ❌ BLOCKED: Absolute paths
exportManager.isPathSafe('/etc/passwd'); // false
exportManager.isPathSafe('C:\\Windows\\System32\\config.sys'); // false

// ❌ BLOCKED: UNC paths
exportManager.isPathSafe('\\\\server\\share\\file.txt'); // false

// ❌ BLOCKED: Null byte injection
exportManager.isPathSafe('test.jsx\0/../../etc/passwd'); // false

// ❌ BLOCKED: URL-encoded traversal
exportManager.isPathSafe('frontend%2F..%2F..%2Fetc%2Fpasswd'); // false

// ❌ BLOCKED: Outside allowed directories
exportManager.isPathInAllowedDirectory('backend/config.js'); // false
exportManager.isPathInAllowedDirectory('etc/passwd'); // false

// ✅ ALLOWED: Valid paths in allowed directories
exportManager.isPathSafe('frontend/src/TestPage.jsx'); // true
exportManager.isPathInAllowedDirectory('frontend/src/TestPage.jsx'); // true
```

## Export Validation

### Path Validation (Requirements 9.1-9.3)

The `validateExport` method performs comprehensive validation:

1. **Security validation**: Checks for directory traversal attacks
2. **Directory whitelist**: Ensures path is in allowed directories
3. **File extension**: Must be `.jsx` or `.tsx`
4. **Naming convention**: Must follow `*Page.jsx`, `*OpsPage.jsx`, `*Page.tsx`, or `*OpsPage.tsx`

```javascript
const result = exportManager.validateExport('frontend/src/CustomPage.jsx');
// { isValid: true, errors: [] }

const result = exportManager.validateExport('../etc/passwd');
// { 
//   isValid: false, 
//   errors: [
//     'Invalid path: Directory traversal detected...',
//     'Target path must be within allowed directories...',
//     'File must have .jsx or .tsx extension',
//     'File name should follow *Page.jsx or *OpsPage.jsx convention'
//   ]
// }
```

### Code Validation (Requirements 9.4-9.5)

The `validateCode` method validates generated code:

1. **JSX syntax validation**: Uses `@babel/parser` to parse and validate JSX
2. **React import check**: Ensures code imports React

```javascript
const code = `
  import React from 'react';
  const TestPage = () => <div>Test</div>;
  export default TestPage;
`;

const result = exportManager.validateCode(code);
// { isValid: true, errors: [] }
```

## File Operations

### Check File Exists

```javascript
const exists = await exportManager.checkFileExists('frontend/src/TestPage.jsx');
// Returns: true or false
```

### Backup Existing File

Creates timestamped backups before overwriting:

```javascript
const backupPath = await exportManager.backupExistingFile('frontend/src/TestPage.jsx');
// Returns: 'frontend/src/TestPage.backup.2024-01-01T12-00-00-000Z.jsx'
```

### Write File

Writes content to a file with security validation:

```javascript
await exportManager.writeFile('frontend/src/TestPage.jsx', code);
```

All file operations:
- Validate paths for security before execution
- Reject paths outside allowed directories
- Use backend API for actual filesystem operations

## Export Screen

The main export workflow:

```javascript
const screen = {
  code: `
    import React from 'react';
    const TestPage = () => <div>Test</div>;
    export default TestPage;
  `
};

const options = {
  targetPath: 'frontend/src/TestPage.jsx',
  overwrite: true,
  createBackup: true,
  updateNavigation: true,
  navigationConfig: {
    icon: 'test-icon',
    label: 'Test Page',
    route: 'test-page',
    requiredPermission: 'admin',
    requiredFeature: 'advanced'
  }
};

const result = await exportManager.exportScreen(screen, options);
// {
//   success: true,
//   filePath: 'frontend/src/TestPage.jsx',
//   backupPath: 'frontend/src/TestPage.backup.2024-01-01.jsx',
//   navigationResult: { success: true }
// }
```

### Export Workflow

1. **Validate export path**: Security and naming convention checks
2. **Validate generated code**: Syntax and import checks
3. **Check file exists**: Determine if backup is needed
4. **Create backup**: If file exists and backup is enabled
5. **Write file**: Save generated code to filesystem
6. **Update navigation**: Register route in App.js (if requested)

## Navigation Registration

### Update Navigation

```javascript
const config = {
  icon: 'test-icon',
  label: 'Test Page',
  route: 'test-page',
  requiredPermission: 'admin',
  requiredFeature: 'advanced'
};

await exportManager.updateNavigation(config);
```

### Manual Navigation Steps

If automatic navigation update fails, get manual steps:

```javascript
const steps = exportManager.getManualNavigationSteps(config);
console.log(steps);
// Outputs:
// Manual Navigation Registration Steps:
// 
// 1. Open frontend/src/App.js
// 
// 2. Add the following route to the routes array:
// 
// {
//   path: '/test-page',
//   label: 'Test Page',
//   icon: 'test-icon',
//   requiredPermission: 'admin',
//   requiredFeature: 'advanced'
// }
```

## Browser Compatibility

The ExportManager is designed for browser environments and does not rely on Node.js-specific modules:

- **No external path library**: Uses custom path manipulation functions
- **API-based file operations**: All filesystem operations go through backend API
- **Pure JavaScript**: No Node.js dependencies

### Custom Path Functions

- `normalizePath(path)`: Normalizes paths by resolving `.` and `..` segments
- `getBasename(path)`: Extracts filename from path
- `getDirname(path)`: Extracts directory from path
- `getExtension(path)`: Extracts file extension
- `joinPath(...segments)`: Joins path segments

## Testing

Comprehensive test suite with 54 tests covering:

- Path traversal prevention (20+ attack vectors)
- Export path validation
- Code validation
- File operations
- Export workflow
- Navigation registration

Run tests:

```bash
npm test -- ExportManager.test.js
```

## Security Best Practices

1. **Defense in depth**: Multiple layers of validation
2. **Whitelist approach**: Only allow specific directories
3. **Input validation**: Validate all user inputs
4. **Safe defaults**: Reject by default, allow explicitly
5. **Comprehensive testing**: Test all attack vectors

## Requirements Traceability

- **Requirement 9.1**: Validate target path starts with 'frontend/src/'
- **Requirement 9.2**: Validate file extension is .jsx or .tsx
- **Requirement 9.3**: Validate naming convention (*Page.jsx or *OpsPage.jsx)
- **Requirement 9.4**: Validate JSX syntax
- **Requirement 9.5**: Validate React imports
- **Requirement 9.6**: Return error messages on validation failure
- **Requirement 10.2**: Preserve exact content in backups
- **Requirement 10.3**: Generate timestamped backup file names
- **Requirement 16.3**: Prevent directory traversal attacks
- **Requirement 16.5**: Verify write permissions before writing

## API Reference

### Constructor

```javascript
const exportManager = new ExportManager();
```

### Methods

#### `validateExport(targetPath: string): { isValid: boolean, errors: string[] }`

Validates export path for security and naming conventions.

#### `validateCode(code: string): { isValid: boolean, errors: string[] }`

Validates generated code for syntax and required imports.

#### `isPathSafe(targetPath: string): boolean`

Checks if a path is safe from directory traversal attacks.

#### `isPathInAllowedDirectory(targetPath: string): boolean`

Checks if a path is within allowed export directories.

#### `resolveSafePath(targetPath: string): string | null`

Resolves a path safely within allowed directories.

#### `checkFileExists(filePath: string): Promise<boolean>`

Checks if a file exists at the given path.

#### `backupExistingFile(filePath: string): Promise<string>`

Creates a timestamped backup of an existing file.

#### `writeFile(filePath: string, content: string, options?: object): Promise<void>`

Writes content to a file with security validation.

#### `exportScreen(screen: object, options: object): Promise<object>`

Exports a screen to the filesystem with full validation and backup.

#### `updateNavigation(config: object): Promise<object>`

Updates application navigation to include new route.

#### `getManualNavigationSteps(config: object): string`

Generates manual steps for navigation registration.

## License

Part of the PatchMaster Stitch UI Integration project.
