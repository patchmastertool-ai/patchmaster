/**
 * MCPClientService - Abstraction layer for Stitch MCP server communication
 * 
 * This service provides a type-safe API for communicating with the Stitch MCP server
 * to generate UI components, manage projects, and handle design systems.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import ScreenCacheService from './ScreenCacheService.js';

class MCPClientService {
  constructor() {
    this.client = null;
    this.transport = null;
    this.connected = false;
    this.serverUrl = null;
    this.connectionListeners = [];
    this.connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'reconnecting', 'error'
    this.lastError = null;
    this.cacheKey = 'mcp_unsaved_work';
    this.screenCache = new ScreenCacheService();
    this.cacheEnabled = ScreenCacheService.isSupported();
    
    if (!this.cacheEnabled) {
      console.warn('MCPClientService: IndexedDB not supported, screen caching disabled');
    }
  }

  /**
   * Connect to the Stitch MCP server
   * @param {string} serverUrl - The URL of the Stitch MCP server (e.g., 'http://localhost:3000')
   * @returns {Promise<void>}
   */
  async connect(serverUrl) {
    if (this.connected) {
      console.warn('MCPClientService: Already connected');
      return;
    }

    try {
      this.serverUrl = serverUrl;
      this._updateConnectionStatus('connecting');

      // Create MCP client with Stitch client info
      this.client = new Client(
        {
          name: 'patchmaster-stitch-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            // Declare client capabilities for Stitch MCP
            sampling: {},
          },
        }
      );

      // Create StreamableHTTP transport for HTTP-based MCP communication
      // This is the recommended transport for browser-based clients
      this.transport = new StreamableHTTPClientTransport(
        new URL(serverUrl),
        {
          reconnectionOptions: {
            maxReconnectionDelay: 30000,
            initialReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.5,
            maxRetries: 5,
          },
        }
      );

      // Set up transport event handlers
      this.transport.onerror = (error) => {
        console.error('MCPClientService: Transport error:', error);
        this.lastError = error;
        this._updateConnectionStatus('error', error);
        
        // Cache unsaved work when connection error occurs
        this._cacheUnsavedWork();
      };

      this.transport.onclose = () => {
        console.log('MCPClientService: Transport closed');
        this.connected = false;
        this._updateConnectionStatus('disconnected');
        
        // Cache unsaved work when connection drops
        this._cacheUnsavedWork();
      };

      // Connect to the server
      await this.client.connect(this.transport);

      this.connected = true;
      this.lastError = null;
      this._updateConnectionStatus('connected');

      // Restore cached work after successful connection
      this._restoreCachedWork();

      console.log('MCPClientService: Connected to Stitch MCP server');
    } catch (error) {
      this.connected = false;
      this.lastError = error;
      this._updateConnectionStatus('error', error);
      throw new Error(`Failed to connect to Stitch MCP server: ${error.message}`);
    }
  }

  /**
   * Disconnect from the Stitch MCP server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected) {
      return;
    }

    try {
      if (this.client) {
        await this.client.close();
      }
      
      this.client = null;
      this.transport = null;
      this.connected = false;
      this.lastError = null;
      this._updateConnectionStatus('disconnected');

      console.log('MCPClientService: Disconnected from Stitch MCP server');
    } catch (error) {
      console.error('MCPClientService: Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Check if connected to the Stitch MCP server
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get current connection status
   * @returns {string} Status: 'disconnected', 'connecting', 'connected', 'reconnecting', 'error'
   */
  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Get last connection error
   * @returns {Error|null}
   */
  getLastError() {
    return this.lastError;
  }

  /**
   * Add a connection status listener
   * @param {Function} listener - Callback function (status, error?) => void
   */
  addConnectionListener(listener) {
    this.connectionListeners.push(listener);
  }

  /**
   * Remove a connection status listener
   * @param {Function} listener - The listener to remove
   */
  removeConnectionListener(listener) {
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
  }

  /**
   * Notify all connection listeners of status change
   * @private
   */
  _notifyConnectionListeners(status, error = null) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(status, error);
      } catch (err) {
        console.error('MCPClientService: Error in connection listener:', err);
      }
    });
  }

  /**
   * Update connection status and notify listeners
   * @private
   */
  _updateConnectionStatus(status, error = null) {
    this.connectionStatus = status;
    if (error) {
      this.lastError = error;
    }
    this._notifyConnectionListeners(status, error);
  }

  /**
   * Cache unsaved work to localStorage
   * @private
   */
  _cacheUnsavedWork() {
    try {
      // Get current work state from the application
      // This will be populated by the UI components
      const workState = {
        timestamp: Date.now(),
        serverUrl: this.serverUrl,
        // Placeholder for work data - will be set by UI components via setCachedWork()
      };
      
      localStorage.setItem(this.cacheKey, JSON.stringify(workState));
      console.log('MCPClientService: Cached unsaved work to localStorage');
    } catch (error) {
      console.error('MCPClientService: Failed to cache unsaved work:', error);
    }
  }

  /**
   * Restore cached work from localStorage
   * @private
   */
  _restoreCachedWork() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const workState = JSON.parse(cached);
        console.log('MCPClientService: Found cached work from', new Date(workState.timestamp));
        
        // Notify listeners that cached work is available
        this._notifyConnectionListeners('cached_work_available', workState);
      }
    } catch (error) {
      console.error('MCPClientService: Failed to restore cached work:', error);
    }
  }

  /**
   * Set work data to be cached
   * @param {object} workData - Work data to cache (e.g., current project, screen, prompt)
   */
  setCachedWork(workData) {
    try {
      const workState = {
        timestamp: Date.now(),
        serverUrl: this.serverUrl,
        data: workData,
      };
      
      localStorage.setItem(this.cacheKey, JSON.stringify(workState));
      console.log('MCPClientService: Updated cached work');
    } catch (error) {
      console.error('MCPClientService: Failed to set cached work:', error);
    }
  }

  /**
   * Get cached work data
   * @returns {object|null} Cached work data or null if none exists
   */
  getCachedWork() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const workState = JSON.parse(cached);
        return workState.data || null;
      }
      return null;
    } catch (error) {
      console.error('MCPClientService: Failed to get cached work:', error);
      return null;
    }
  }

  /**
   * Clear cached work from localStorage
   */
  clearCachedWork() {
    try {
      localStorage.removeItem(this.cacheKey);
      console.log('MCPClientService: Cleared cached work');
    } catch (error) {
      console.error('MCPClientService: Failed to clear cached work:', error);
    }
  }

  /**
   * Enable or disable screen caching
   * @param {boolean} enabled - Whether to enable caching
   */
  setCacheEnabled(enabled) {
    if (!ScreenCacheService.isSupported()) {
      console.warn('MCPClientService: Cannot enable caching, IndexedDB not supported');
      return;
    }
    this.cacheEnabled = enabled;
    console.log(`MCPClientService: Screen caching ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if screen caching is enabled
   * @returns {boolean}
   */
  isCacheEnabled() {
    return this.cacheEnabled;
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache statistics
   */
  async getCacheStats() {
    if (!this.cacheEnabled) {
      return { enabled: false };
    }
    const stats = await this.screenCache.getCacheStats();
    return { enabled: true, ...stats };
  }

  /**
   * Clear all cached screens
   * @returns {Promise<void>}
   */
  async clearScreenCache() {
    if (!this.cacheEnabled) {
      return;
    }
    await this.screenCache.clearAll();
  }

  /**
   * Clear expired cache entries
   * @returns {Promise<number>} Number of entries cleared
   */
  async clearExpiredCache() {
    if (!this.cacheEnabled) {
      return 0;
    }
    return await this.screenCache.clearExpiredEntries();
  }

  /**
   * Assert that the client is connected before making requests
   * @private
   */
  _assertConnected() {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to Stitch MCP server. Call connect() first.');
    }
  }

  /**
   * Call a tool on the Stitch MCP server
   * @private
   * @param {string} toolName - Name of the tool to call
   * @param {object} args - Arguments for the tool
   * @returns {Promise<any>}
   */
  async _callTool(toolName, args = {}) {
    this._assertConnected();

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Extract content from MCP response
      if (result.content && result.content.length > 0) {
        const textContent = result.content.find(c => c.type === 'text');
        if (textContent) {
          // Parse JSON response from tool
          try {
            return JSON.parse(textContent.text);
          } catch {
            // If not JSON, return raw text
            return textContent.text;
          }
        }
      }

      return result;
    } catch (error) {
      console.error(`MCPClientService: Error calling tool ${toolName}:`, error);
      throw new Error(`Tool call failed: ${error.message}`);
    }
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  /**
   * Validate project name follows kebab-case pattern
   * @param {string} name - Project name to validate
   * @returns {boolean} True if valid kebab-case
   */
  validateProjectName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    
    // Kebab-case pattern: lowercase letters, numbers, and hyphens only
    // Must start with a letter, cannot end with hyphen, no consecutive hyphens
    const kebabCasePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    return kebabCasePattern.test(name);
  }

  /**
   * Check if project name is unique among existing projects
   * @param {string} name - Project name to check
   * @returns {Promise<boolean>} True if name is unique
   */
  async isProjectNameUnique(name) {
    try {
      const result = await this.listProjects();
      const projects = result.projects || [];
      
      // Check if any existing project has the same title (case-insensitive)
      return !projects.some(project => 
        project && project.title && project.title.toLowerCase() === name.toLowerCase()
      );
    } catch (error) {
      console.error('MCPClientService: Error checking project name uniqueness:', error);
      // If we can't check, assume it's not unique to be safe
      return false;
    }
  }

  /**
   * Validate project parameters before creation
   * @param {object} params - Project parameters
   * @param {string} params.title - Project title
   * @returns {Promise<{valid: boolean, errors: string[]}>} Validation result
   */
  async validateProjectParams(params) {
    const errors = [];
    
    if (!params || !params.title) {
      errors.push('Project title is required');
      return { valid: false, errors };
    }
    
    // Validate kebab-case format
    if (!this.validateProjectName(params.title)) {
      errors.push('Project name must be in kebab-case format (lowercase letters, numbers, and hyphens only)');
    }
    
    // Check uniqueness
    const isUnique = await this.isProjectNameUnique(params.title);
    if (!isUnique) {
      errors.push('Project name must be unique');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new Stitch project
   * @param {object} params - Project parameters
   * @param {string} params.title - Project title
   * @param {boolean} params.skipValidation - Skip validation (default: false)
   * @returns {Promise<object>} Created project
   */
  async createProject(params) {
    // Validate parameters unless explicitly skipped
    if (!params.skipValidation) {
      const validation = await this.validateProjectParams(params);
      if (!validation.valid) {
        throw new Error(`Project validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    return await this._callTool('mcp_stitch_create_project', params);
  }

  /**
   * Get a specific project by name
   * @param {string} projectName - Project resource name (e.g., 'projects/123')
   * @returns {Promise<object>} Project details
   */
  async getProject(projectName) {
    return await this._callTool('mcp_stitch_get_project', { name: projectName });
  }

  /**
   * List all projects
   * @param {object} params - List parameters
   * @param {string} params.filter - Optional filter (e.g., 'view=owned')
   * @returns {Promise<object>} List of projects
   */
  async listProjects(params = {}) {
    return await this._callTool('mcp_stitch_list_projects', params);
  }

  // ============================================================================
  // Screen Operations
  // ============================================================================

  /**
   * List all screens in a project
   * @param {string} projectId - Project ID (without 'projects/' prefix)
   * @param {boolean} useCache - Whether to use cache (default: false for lists)
   * @returns {Promise<object>} List of screens
   */
  async listScreens(projectId, useCache = false) {
    // Try to get from cache first if enabled and requested
    if (this.cacheEnabled && useCache) {
      const cachedScreens = await this.screenCache.getCachedScreensByProject(projectId);
      if (cachedScreens && cachedScreens.length > 0) {
        console.log(`MCPClientService: Using ${cachedScreens.length} cached screens for project ${projectId}`);
        return { screens: cachedScreens };
      }
    }
    
    // Fetch from server
    const result = await this._callTool('mcp_stitch_list_screens', { projectId });
    
    // Cache the screens if enabled
    if (this.cacheEnabled && result && result.screens) {
      for (const screen of result.screens) {
        if (screen && screen.id) {
          await this.screenCache.cacheScreen(screen).catch(err => {
            console.error('MCPClientService: Failed to cache screen from list:', err);
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Get a specific screen
   * @param {object} params - Screen parameters
   * @param {string} params.name - Screen resource name (e.g., 'projects/123/screens/abc')
   * @param {string} params.projectId - Project ID
   * @param {string} params.screenId - Screen ID
   * @param {boolean} params.useCache - Whether to use cache (default: true)
   * @returns {Promise<object>} Screen details
   */
  async getScreen(params) {
    const { screenId, useCache = true } = params;
    
    // Try to get from cache first if enabled
    if (this.cacheEnabled && useCache && screenId) {
      const cachedScreen = await this.screenCache.getCachedScreen(screenId);
      if (cachedScreen) {
        console.log(`MCPClientService: Using cached screen ${screenId}`);
        return cachedScreen;
      }
    }
    
    // Fetch from server
    const screen = await this._callTool('mcp_stitch_get_screen', params);
    
    // Cache the screen if enabled
    if (this.cacheEnabled && screen && screen.id) {
      await this.screenCache.cacheScreen(screen).catch(err => {
        console.error('MCPClientService: Failed to cache screen:', err);
      });
    }
    
    return screen;
  }

  /**
   * Generate a new screen from text prompt
   * @param {object} params - Generation parameters
   * @param {string} params.projectId - Project ID (without 'projects/' prefix)
   * @param {string} params.prompt - Text prompt describing the desired UI
   * @param {string} params.deviceType - Device type (MOBILE, DESKTOP, TABLET, AGNOSTIC)
   * @param {string} params.modelId - Optional model ID
   * @returns {Promise<object>} Generated screen
   */
  async generateScreen(params) {
    const screen = await this._callTool('mcp_stitch_generate_screen_from_text', params);
    
    // Cache the generated screen if enabled
    if (this.cacheEnabled && screen && screen.id) {
      await this.screenCache.cacheScreen(screen).catch(err => {
        console.error('MCPClientService: Failed to cache generated screen:', err);
      });
    }
    
    return screen;
  }

  /**
   * Edit existing screens with a text prompt
   * @param {object} params - Edit parameters
   * @param {string} params.projectId - Project ID (without 'projects/' prefix)
   * @param {string[]} params.selectedScreenIds - Array of screen IDs to edit
   * @param {string} params.prompt - Text prompt describing the modifications
   * @param {string} params.deviceType - Optional device type
   * @param {string} params.modelId - Optional model ID
   * @returns {Promise<object>} Edited screens
   */
  async editScreens(params) {
    const result = await this._callTool('mcp_stitch_edit_screens', params);
    
    // Invalidate cache for edited screens
    if (this.cacheEnabled && params.selectedScreenIds) {
      for (const screenId of params.selectedScreenIds) {
        await this.screenCache.invalidateScreen(screenId).catch(err => {
          console.error('MCPClientService: Failed to invalidate screen cache:', err);
        });
      }
    }
    
    // Cache the edited screens if they're returned
    if (this.cacheEnabled && result && result.screens) {
      for (const screen of result.screens) {
        if (screen && screen.id) {
          await this.screenCache.cacheScreen(screen).catch(err => {
            console.error('MCPClientService: Failed to cache edited screen:', err);
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Generate design variants of existing screens
   * @param {object} params - Variant parameters
   * @param {string} params.projectId - Project ID (without 'projects/' prefix)
   * @param {string[]} params.selectedScreenIds - Array of screen IDs
   * @param {string} params.prompt - Text prompt for variant generation
   * @param {object} params.variantOptions - Variant configuration
   * @param {string} params.deviceType - Optional device type
   * @param {string} params.modelId - Optional model ID
   * @returns {Promise<object>} Generated variants
   */
  async generateVariants(params) {
    const result = await this._callTool('mcp_stitch_generate_variants', params);
    
    // Cache the generated variants if they're returned
    if (this.cacheEnabled && result && result.screens) {
      for (const screen of result.screens) {
        if (screen && screen.id) {
          await this.screenCache.cacheScreen(screen).catch(err => {
            console.error('MCPClientService: Failed to cache variant screen:', err);
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Fetch the HTML/code content of a screen
   * @param {object} params - Fetch parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.screenId - Screen ID
   * @returns {Promise<string>} Screen code
   */
  async fetchScreenCode(params) {
    return await this._callTool('mcp_stitch_fetch_screen_code', params);
  }

  /**
   * Fetch the screenshot/preview image of a screen
   * @param {object} params - Fetch parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.screenId - Screen ID
   * @returns {Promise<Blob>} Screen image
   */
  async fetchScreenImage(params) {
    return await this._callTool('mcp_stitch_fetch_screen_image', params);
  }

  // ============================================================================
  // Design System Operations
  // ============================================================================

  /**
   * Create a new design system
   * @param {object} params - Design system parameters
   * @param {object} params.designSystem - Design system configuration
   * @param {string} params.projectId - Optional project ID
   * @returns {Promise<object>} Created design system
   */
  async createDesignSystem(params) {
    return await this._callTool('mcp_stitch_create_design_system', params);
  }

  /**
   * Update an existing design system
   * @param {object} params - Update parameters
   * @param {string} params.name - Design system resource name (e.g., 'assets/123')
   * @param {string} params.projectId - Project ID
   * @param {object} params.designSystem - Updated design system configuration
   * @returns {Promise<object>} Updated design system
   */
  async updateDesignSystem(params) {
    return await this._callTool('mcp_stitch_update_design_system', params);
  }

  /**
   * List all design systems for a project
   * @param {object} params - List parameters
   * @param {string} params.projectId - Optional project ID
   * @returns {Promise<object>} List of design systems
   */
  async listDesignSystems(params = {}) {
    return await this._callTool('mcp_stitch_list_design_systems', params);
  }

  /**
   * Apply a design system to screens
   * @param {object} params - Apply parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.assetId - Design system asset ID
   * @param {Array} params.selectedScreenInstances - Screen instances to apply to
   * @returns {Promise<object>} Application result
   */
  async applyDesignSystem(params) {
    return await this._callTool('mcp_stitch_apply_design_system', params);
  }
}

export default MCPClientService;
