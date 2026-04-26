/**
 * ScreenCacheService - IndexedDB caching for generated screens
 * 
 * This service provides offline access to generated screens by caching them
 * in IndexedDB. It implements cache invalidation strategies to ensure data freshness.
 * 
 * Requirements: 15.5
 */

class ScreenCacheService {
  constructor() {
    this.dbName = 'StitchScreenCache';
    this.dbVersion = 1;
    this.storeName = 'screens';
    this.db = null;
    this.maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.maxCacheSize = 100; // Maximum number of screens to cache
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to open IndexedDB:', request.error);
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('ScreenCacheService: IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for screens if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          objectStore.createIndex('projectId', 'projectId', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          
          console.log('ScreenCacheService: Object store created');
        }
      };
    });
  }

  /**
   * Cache a screen in IndexedDB
   * @param {object} screen - Screen object to cache
   * @param {string} screen.id - Screen ID
   * @param {string} screen.projectId - Project ID
   * @param {string} screen.code - Generated code
   * @param {string} screen.name - Screen name
   * @param {object} screen.metadata - Screen metadata
   * @returns {Promise<void>}
   */
  async cacheScreen(screen) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);

      const cacheEntry = {
        id: screen.id,
        projectId: screen.projectId,
        name: screen.name,
        code: screen.code,
        metadata: screen.metadata,
        prompt: screen.prompt,
        variant_of: screen.variant_of,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      };

      const request = objectStore.put(cacheEntry);

      request.onsuccess = async () => {
        console.log(`ScreenCacheService: Cached screen ${screen.id}`);
        
        // Enforce cache size limit
        await this._enforceCacheLimit();
        
        resolve();
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to cache screen:', request.error);
        reject(new Error(`Failed to cache screen: ${request.error}`));
      };
    });
  }

  /**
   * Retrieve a cached screen by ID
   * @param {string} screenId - Screen ID
   * @returns {Promise<object|null>} Cached screen or null if not found
   */
  async getCachedScreen(screenId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(screenId);

      request.onsuccess = () => {
        const screen = request.result;
        
        if (!screen) {
          resolve(null);
          return;
        }

        // Check if cache entry is expired
        const age = Date.now() - screen.timestamp;
        if (age > this.maxCacheAge) {
          console.log(`ScreenCacheService: Cache entry expired for screen ${screenId}`);
          this.invalidateScreen(screenId); // Remove expired entry
          resolve(null);
          return;
        }

        // Update last accessed timestamp
        this._updateLastAccessed(screenId);

        console.log(`ScreenCacheService: Retrieved cached screen ${screenId}`);
        resolve(screen);
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to retrieve cached screen:', request.error);
        reject(new Error(`Failed to retrieve cached screen: ${request.error}`));
      };
    });
  }

  /**
   * Get all cached screens for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of cached screens
   */
  async getCachedScreensByProject(projectId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const screens = request.result || [];
        
        // Filter out expired entries
        const validScreens = screens.filter(screen => {
          const age = Date.now() - screen.timestamp;
          return age <= this.maxCacheAge;
        });

        console.log(`ScreenCacheService: Retrieved ${validScreens.length} cached screens for project ${projectId}`);
        resolve(validScreens);
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to retrieve cached screens:', request.error);
        reject(new Error(`Failed to retrieve cached screens: ${request.error}`));
      };
    });
  }

  /**
   * Invalidate (remove) a cached screen
   * @param {string} screenId - Screen ID to invalidate
   * @returns {Promise<void>}
   */
  async invalidateScreen(screenId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(screenId);

      request.onsuccess = () => {
        console.log(`ScreenCacheService: Invalidated screen ${screenId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to invalidate screen:', request.error);
        reject(new Error(`Failed to invalidate screen: ${request.error}`));
      };
    });
  }

  /**
   * Invalidate all cached screens for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<void>}
   */
  async invalidateProject(projectId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('projectId');
      const request = index.openCursor(IDBKeyRange.only(projectId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log(`ScreenCacheService: Invalidated all screens for project ${projectId}`);
          resolve();
        }
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to invalidate project:', request.error);
        reject(new Error(`Failed to invalidate project: ${request.error}`));
      };
    });
  }

  /**
   * Clear all expired cache entries
   * @returns {Promise<number>} Number of entries cleared
   */
  async clearExpiredEntries() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.openCursor();
      let clearedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const screen = cursor.value;
          const age = Date.now() - screen.timestamp;
          
          if (age > this.maxCacheAge) {
            cursor.delete();
            clearedCount++;
          }
          
          cursor.continue();
        } else {
          console.log(`ScreenCacheService: Cleared ${clearedCount} expired entries`);
          resolve(clearedCount);
        }
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to clear expired entries:', request.error);
        reject(new Error(`Failed to clear expired entries: ${request.error}`));
      };
    });
  }

  /**
   * Clear all cached screens
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('ScreenCacheService: Cleared all cached screens');
        resolve();
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to clear cache:', request.error);
        reject(new Error(`Failed to clear cache: ${request.error}`));
      };
    });
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache statistics
   */
  async getCacheStats() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const screens = request.result || [];
        const now = Date.now();
        
        const stats = {
          totalEntries: screens.length,
          validEntries: 0,
          expiredEntries: 0,
          totalSize: 0,
          oldestEntry: null,
          newestEntry: null,
        };

        screens.forEach(screen => {
          const age = now - screen.timestamp;
          const size = JSON.stringify(screen).length;
          
          stats.totalSize += size;
          
          if (age > this.maxCacheAge) {
            stats.expiredEntries++;
          } else {
            stats.validEntries++;
          }

          if (!stats.oldestEntry || screen.timestamp < stats.oldestEntry) {
            stats.oldestEntry = screen.timestamp;
          }
          
          if (!stats.newestEntry || screen.timestamp > stats.newestEntry) {
            stats.newestEntry = screen.timestamp;
          }
        });

        resolve(stats);
      };

      request.onerror = () => {
        console.error('ScreenCacheService: Failed to get cache stats:', request.error);
        reject(new Error(`Failed to get cache stats: ${request.error}`));
      };
    });
  }

  /**
   * Update last accessed timestamp for a screen
   * @private
   * @param {string} screenId - Screen ID
   */
  async _updateLastAccessed(screenId) {
    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const getRequest = objectStore.get(screenId);

      getRequest.onsuccess = () => {
        const screen = getRequest.result;
        if (screen) {
          screen.lastAccessed = Date.now();
          objectStore.put(screen);
        }
      };
    } catch (error) {
      console.error('ScreenCacheService: Failed to update last accessed:', error);
    }
  }

  /**
   * Enforce cache size limit by removing least recently accessed entries
   * @private
   */
  async _enforceCacheLimit() {
    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const countRequest = objectStore.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        
        if (count > this.maxCacheSize) {
          const excessCount = count - this.maxCacheSize;
          
          // Get all entries sorted by last accessed
          const index = objectStore.index('lastAccessed');
          const cursorRequest = index.openCursor();
          let deletedCount = 0;

          cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && deletedCount < excessCount) {
              cursor.delete();
              deletedCount++;
              cursor.continue();
            } else if (deletedCount > 0) {
              console.log(`ScreenCacheService: Removed ${deletedCount} least recently accessed entries`);
            }
          };
        }
      };
    } catch (error) {
      console.error('ScreenCacheService: Failed to enforce cache limit:', error);
    }
  }

  /**
   * Check if IndexedDB is supported
   * @returns {boolean}
   */
  static isSupported() {
    return 'indexedDB' in window;
  }
}

export default ScreenCacheService;
