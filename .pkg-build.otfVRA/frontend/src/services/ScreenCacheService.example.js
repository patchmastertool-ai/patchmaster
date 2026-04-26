/**
 * ScreenCacheService Usage Examples
 * 
 * Demonstrates how to use screen caching for offline access and performance optimization
 */

import MCPClientService from './MCPClientService';
import ScreenCacheService from './ScreenCacheService';

// ============================================================================
// Example 1: Basic Usage with MCPClientService (Recommended)
// ============================================================================

async function example1_BasicUsage() {
  console.log('=== Example 1: Basic Usage ===');
  
  const mcpClient = new MCPClientService();
  
  // Connect to Stitch MCP server
  await mcpClient.connect('http://localhost:3000');
  
  // Generate a screen (automatically cached)
  const screen = await mcpClient.generateScreen({
    projectId: 'my-project',
    prompt: 'Create a modern dashboard with stats cards',
    deviceType: 'DESKTOP'
  });
  
  console.log('Generated screen:', screen.id);
  
  // Later, retrieve the screen (uses cache if available)
  const cachedScreen = await mcpClient.getScreen({
    projectId: 'my-project',
    screenId: screen.id,
    useCache: true  // default
  });
  
  console.log('Retrieved from cache:', cachedScreen.id);
}

// ============================================================================
// Example 2: Offline Access
// ============================================================================

async function example2_OfflineAccess() {
  console.log('=== Example 2: Offline Access ===');
  
  const mcpClient = new MCPClientService();
  
  // While online: generate and cache screens
  await mcpClient.connect('http://localhost:3000');
  
  const screens = [];
  for (let i = 0; i < 5; i++) {
    const screen = await mcpClient.generateScreen({
      projectId: 'my-project',
      prompt: `Create page ${i + 1}`,
      deviceType: 'DESKTOP'
    });
    screens.push(screen);
  }
  
  console.log(`Cached ${screens.length} screens`);
  
  // Simulate going offline
  await mcpClient.disconnect();
  
  // Access cached screens while offline
  const cacheService = mcpClient.screenCache;
  const cachedScreens = await cacheService.getCachedScreensByProject('my-project');
  
  console.log(`Available offline: ${cachedScreens.length} screens`);
  
  cachedScreens.forEach(screen => {
    console.log(`- ${screen.name} (${screen.id})`);
  });
}

// ============================================================================
// Example 3: Cache Management
// ============================================================================

async function example3_CacheManagement() {
  console.log('=== Example 3: Cache Management ===');
  
  const mcpClient = new MCPClientService();
  await mcpClient.connect('http://localhost:3000');
  
  // Check cache status
  console.log('Cache enabled:', mcpClient.isCacheEnabled());
  
  // Get cache statistics
  const stats = await mcpClient.getCacheStats();
  console.log('Cache stats:', {
    totalEntries: stats.totalEntries,
    validEntries: stats.validEntries,
    expiredEntries: stats.expiredEntries,
    totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`
  });
  
  // Clear expired entries
  const clearedCount = await mcpClient.clearExpiredCache();
  console.log(`Cleared ${clearedCount} expired entries`);
  
  // Disable caching temporarily
  mcpClient.setCacheEnabled(false);
  console.log('Cache disabled');
  
  // Re-enable caching
  mcpClient.setCacheEnabled(true);
  console.log('Cache re-enabled');
  
  // Clear all cached screens
  await mcpClient.clearScreenCache();
  console.log('Cache cleared');
}

// ============================================================================
// Example 4: Custom Cache Configuration
// ============================================================================

async function example4_CustomConfiguration() {
  console.log('=== Example 4: Custom Configuration ===');
  
  const cacheService = new ScreenCacheService();
  
  // Customize cache settings
  cacheService.maxCacheAge = 3 * 24 * 60 * 60 * 1000; // 3 days instead of 7
  cacheService.maxCacheSize = 50; // 50 entries instead of 100
  
  console.log('Custom cache config:', {
    maxAge: `${cacheService.maxCacheAge / (24 * 60 * 60 * 1000)} days`,
    maxSize: cacheService.maxCacheSize
  });
  
  // Initialize with custom config
  await cacheService.init();
  
  // Use the cache
  await cacheService.cacheScreen({
    id: 'screen-123',
    projectId: 'project-456',
    name: 'CustomPage',
    code: '<div>Custom content</div>',
    metadata: { framework: 'react' }
  });
  
  console.log('Screen cached with custom configuration');
}

// ============================================================================
// Example 5: Cache Invalidation
// ============================================================================

async function example5_CacheInvalidation() {
  console.log('=== Example 5: Cache Invalidation ===');
  
  const mcpClient = new MCPClientService();
  await mcpClient.connect('http://localhost:3000');
  
  // Generate a screen
  const screen = await mcpClient.generateScreen({
    projectId: 'my-project',
    prompt: 'Create a settings page',
    deviceType: 'DESKTOP'
  });
  
  console.log('Generated and cached:', screen.id);
  
  // Edit the screen (automatically invalidates old cache)
  const editedScreens = await mcpClient.editScreens({
    projectId: 'my-project',
    selectedScreenIds: [screen.id],
    prompt: 'Add a dark mode toggle'
  });
  
  console.log('Screen edited, cache updated');
  
  // Manually invalidate a specific screen
  await mcpClient.screenCache.invalidateScreen(screen.id);
  console.log('Screen cache invalidated');
  
  // Invalidate all screens in a project
  await mcpClient.screenCache.invalidateProject('my-project');
  console.log('Project cache invalidated');
}

// ============================================================================
// Example 6: Performance Monitoring
// ============================================================================

async function example6_PerformanceMonitoring() {
  console.log('=== Example 6: Performance Monitoring ===');
  
  const mcpClient = new MCPClientService();
  await mcpClient.connect('http://localhost:3000');
  
  const screenId = 'screen-123';
  
  // Measure cache hit performance
  console.time('Cache Hit');
  const cachedScreen = await mcpClient.getScreen({
    projectId: 'my-project',
    screenId: screenId,
    useCache: true
  });
  console.timeEnd('Cache Hit');
  
  // Measure server fetch performance
  console.time('Server Fetch');
  const freshScreen = await mcpClient.getScreen({
    projectId: 'my-project',
    screenId: screenId,
    useCache: false
  });
  console.timeEnd('Server Fetch');
  
  // Monitor cache size
  const stats = await mcpClient.getCacheStats();
  const sizeMB = stats.totalSize / (1024 * 1024);
  
  if (sizeMB > 10) {
    console.warn(`Cache size (${sizeMB.toFixed(2)} MB) exceeds 10MB threshold`);
    console.log('Consider clearing expired entries');
  }
}

// ============================================================================
// Example 7: Error Handling
// ============================================================================

async function example7_ErrorHandling() {
  console.log('=== Example 7: Error Handling ===');
  
  const mcpClient = new MCPClientService();
  
  try {
    await mcpClient.connect('http://localhost:3000');
    
    // Generate a screen
    const screen = await mcpClient.generateScreen({
      projectId: 'my-project',
      prompt: 'Create a user profile page',
      deviceType: 'DESKTOP'
    });
    
    console.log('Screen generated:', screen.id);
    
  } catch (error) {
    console.error('Generation failed:', error.message);
    
    // Try to use cached screens as fallback
    if (mcpClient.isCacheEnabled()) {
      console.log('Attempting to use cached screens...');
      
      try {
        const cachedScreens = await mcpClient.screenCache.getCachedScreensByProject('my-project');
        console.log(`Found ${cachedScreens.length} cached screens`);
        
        // Use cached screens as fallback
        return cachedScreens;
      } catch (cacheError) {
        console.error('Cache access failed:', cacheError.message);
      }
    }
  }
}

// ============================================================================
// Example 8: Periodic Cache Maintenance
// ============================================================================

async function example8_PeriodicMaintenance() {
  console.log('=== Example 8: Periodic Cache Maintenance ===');
  
  const mcpClient = new MCPClientService();
  await mcpClient.connect('http://localhost:3000');
  
  // Set up daily cache cleanup
  const cleanupInterval = setInterval(async () => {
    console.log('Running scheduled cache cleanup...');
    
    const clearedCount = await mcpClient.clearExpiredCache();
    console.log(`Cleared ${clearedCount} expired entries`);
    
    const stats = await mcpClient.getCacheStats();
    console.log(`Cache now has ${stats.validEntries} valid entries`);
    
  }, 24 * 60 * 60 * 1000); // Run daily
  
  // Clean up interval on app shutdown
  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    console.log('Cache maintenance stopped');
  });
  
  console.log('Periodic cache maintenance scheduled');
}

// ============================================================================
// Example 9: Browser Compatibility Check
// ============================================================================

function example9_CompatibilityCheck() {
  console.log('=== Example 9: Browser Compatibility Check ===');
  
  if (ScreenCacheService.isSupported()) {
    console.log('✓ IndexedDB is supported');
    console.log('Screen caching is available');
    
    const mcpClient = new MCPClientService();
    console.log('Cache enabled:', mcpClient.isCacheEnabled());
    
  } else {
    console.warn('✗ IndexedDB is not supported');
    console.log('Screen caching is disabled');
    console.log('Application will work without caching');
  }
}

// ============================================================================
// Example 10: Integration with React Component
// ============================================================================

// Example React component using screen caching
const ExampleReactComponent = () => {
  const [mcpClient] = React.useState(() => new MCPClientService());
  const [screens, setScreens] = React.useState([]);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  
  React.useEffect(() => {
    // Initialize MCP client
    const init = async () => {
      try {
        await mcpClient.connect('http://localhost:3000');
      } catch (error) {
        console.error('Connection failed, using cached data');
      }
    };
    
    init();
    
    // Handle online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const loadScreens = async (projectId) => {
    try {
      if (isOnline) {
        // Fetch from server (automatically caches)
        const result = await mcpClient.listScreens(projectId);
        setScreens(result.screens || []);
      } else {
        // Use cached screens when offline
        const cachedScreens = await mcpClient.screenCache.getCachedScreensByProject(projectId);
        setScreens(cachedScreens);
      }
    } catch (error) {
      console.error('Failed to load screens:', error);
    }
  };
  
  return (
    <div>
      <div className="status">
        {isOnline ? '🟢 Online' : '🔴 Offline'}
        {!isOnline && ' (Using cached data)'}
      </div>
      
      <button onClick={() => loadScreens('my-project')}>
        Load Screens
      </button>
      
      <div className="screens">
        {screens.map(screen => (
          <div key={screen.id}>
            {screen.name}
            {!isOnline && ' (cached)'}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  try {
    await example1_BasicUsage();
    await example2_OfflineAccess();
    await example3_CacheManagement();
    await example4_CustomConfiguration();
    await example5_CacheInvalidation();
    await example6_PerformanceMonitoring();
    await example7_ErrorHandling();
    await example8_PeriodicMaintenance();
    example9_CompatibilityCheck();
    
    console.log('\n✓ All examples completed');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Uncomment to run examples
// runAllExamples();

export {
  example1_BasicUsage,
  example2_OfflineAccess,
  example3_CacheManagement,
  example4_CustomConfiguration,
  example5_CacheInvalidation,
  example6_PerformanceMonitoring,
  example7_ErrorHandling,
  example8_PeriodicMaintenance,
  example9_CompatibilityCheck,
  ExampleReactComponent
};
