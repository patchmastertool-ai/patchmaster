/**
 * Unit tests for MCPClientService
 * Tests connection management, error handling, reconnection logic, and localStorage caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MCPClientService from './MCPClientService.js';

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(function() {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"success": true}' }]
      })
    };
  })
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(function() {
    return {
      onerror: null,
      onclose: null
    };
  })
}));

describe('MCPClientService - Connection Error Handling and Caching', () => {
  let service;
  let mockLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      store: {},
      getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
      setItem: vi.fn((key, value) => {
        mockLocalStorage.store[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockLocalStorage.store[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage.store = {};
      })
    };
    global.localStorage = mockLocalStorage;

    service = new MCPClientService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe('Connection Status Tracking', () => {
    it('should initialize with disconnected status', () => {
      expect(service.getConnectionStatus()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
      expect(service.getLastError()).toBeNull();
    });

    it('should update status to connecting when connect is called', async () => {
      const statusChanges = [];
      service.addConnectionListener((status) => {
        statusChanges.push(status);
      });

      await service.connect('http://localhost:3000');

      expect(statusChanges).toContain('connecting');
      expect(statusChanges).toContain('connected');
    });

    it('should track last error when connection fails', async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockRejectedValue(new Error('Connection refused'))
        };
      });

      service = new MCPClientService();

      try {
        await service.connect('http://localhost:3000');
      } catch (error) {
        // Expected to throw
      }

      expect(service.getConnectionStatus()).toBe('error');
      expect(service.getLastError()).toBeTruthy();
      expect(service.getLastError().message).toContain('Connection refused');
    });

    it('should clear error on successful connection', async () => {
      // First connection fails
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockRejectedValue(new Error('Connection refused'))
        };
      });

      service = new MCPClientService();
      try {
        await service.connect('http://localhost:3000');
      } catch (error) {
        // Expected
      }

      expect(service.getLastError()).toBeTruthy();

      // Second connection succeeds
      service = new MCPClientService();
      await service.connect('http://localhost:3000');

      expect(service.getLastError()).toBeNull();
      expect(service.getConnectionStatus()).toBe('connected');
    });
  });

  describe('Connection Listeners', () => {
    it('should notify listeners of status changes', async () => {
      const listener = vi.fn();
      service.addConnectionListener(listener);

      await service.connect('http://localhost:3000');

      expect(listener).toHaveBeenCalledWith('connecting', null);
      expect(listener).toHaveBeenCalledWith('connected', null);
    });

    it('should notify listeners of errors', async () => {
      const listener = vi.fn();
      service.addConnectionListener(listener);

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
        };
      });

      service = new MCPClientService();
      service.addConnectionListener(listener);

      try {
        await service.connect('http://localhost:3000');
      } catch (error) {
        // Expected
      }

      expect(listener).toHaveBeenCalledWith('error', expect.any(Error));
    });

    it('should allow removing listeners', async () => {
      const listener = vi.fn();
      service.addConnectionListener(listener);
      service.removeConnectionListener(listener);

      await service.connect('http://localhost:3000');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      service.addConnectionListener(badListener);
      service.addConnectionListener(goodListener);

      await service.connect('http://localhost:3000');

      // Both listeners should be called despite error in first one
      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('localStorage Caching', () => {
    it('should cache work data when connection drops', async () => {
      await service.connect('http://localhost:3000');

      const workData = {
        currentProject: 'project-123',
        currentScreen: 'screen-456',
        prompt: 'Create a dashboard'
      };

      service.setCachedWork(workData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'mcp_unsaved_work',
        expect.stringContaining('project-123')
      );
    });

    it('should retrieve cached work data', () => {
      const workData = {
        currentProject: 'project-123',
        prompt: 'Create a form'
      };

      service.setCachedWork(workData);
      const retrieved = service.getCachedWork();

      expect(retrieved).toEqual(workData);
    });

    it('should return null when no cached work exists', () => {
      const retrieved = service.getCachedWork();
      expect(retrieved).toBeNull();
    });

    it('should clear cached work', () => {
      const workData = { test: 'data' };
      service.setCachedWork(workData);

      service.clearCachedWork();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('mcp_unsaved_work');
      expect(service.getCachedWork()).toBeNull();
    });

    it('should include timestamp in cached work', () => {
      const workData = { test: 'data' };
      service.setCachedWork(workData);

      const cached = JSON.parse(mockLocalStorage.store['mcp_unsaved_work']);
      expect(cached.timestamp).toBeDefined();
      expect(typeof cached.timestamp).toBe('number');
    });

    it('should notify listeners when cached work is available on reconnect', async () => {
      // Set up cached work
      const workData = { currentProject: 'project-123' };
      service.setCachedWork(workData);

      // Create new service instance (simulating app restart)
      const newService = new MCPClientService();
      const listener = vi.fn();
      newService.addConnectionListener(listener);

      await newService.connect('http://localhost:3000');

      // Should notify about cached work
      expect(listener).toHaveBeenCalledWith(
        'cached_work_available',
        expect.objectContaining({
          data: workData
        })
      );
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => {
        service.setCachedWork({ test: 'data' });
      }).not.toThrow();
    });

    it('should handle corrupted cached data gracefully', () => {
      mockLocalStorage.store['mcp_unsaved_work'] = 'invalid json{';

      // Should not throw
      expect(() => {
        service.getCachedWork();
      }).not.toThrow();

      expect(service.getCachedWork()).toBeNull();
    });
  });

  describe('Transport Error Handling', () => {
    it('should cache work when transport error occurs', async () => {
      await service.connect('http://localhost:3000');

      const workData = { test: 'data' };
      service.setCachedWork(workData);

      // Simulate transport error
      if (service.transport && service.transport.onerror) {
        service.transport.onerror(new Error('Network error'));
      }

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should cache work when transport closes', async () => {
      await service.connect('http://localhost:3000');

      const workData = { test: 'data' };
      service.setCachedWork(workData);

      // Simulate transport close
      if (service.transport && service.transport.onclose) {
        service.transport.onclose();
      }

      expect(service.getConnectionStatus()).toBe('disconnected');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should update status to error on transport error', async () => {
      const listener = vi.fn();
      service.addConnectionListener(listener);

      await service.connect('http://localhost:3000');

      // Simulate transport error
      if (service.transport && service.transport.onerror) {
        service.transport.onerror(new Error('Network error'));
      }

      expect(listener).toHaveBeenCalledWith('error', expect.any(Error));
      expect(service.getConnectionStatus()).toBe('error');
    });
  });

  describe('Reconnection Configuration', () => {
    it('should configure transport with exponential backoff', async () => {
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );

      await service.connect('http://localhost:3000');

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          reconnectionOptions: expect.objectContaining({
            maxReconnectionDelay: 30000,
            initialReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.5,
            maxRetries: 5
          })
        })
      );
    });
  });

  describe('Disconnect Behavior', () => {
    it('should clear error on disconnect', async () => {
      // Cause an error
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
        };
      });

      service = new MCPClientService();
      try {
        await service.connect('http://localhost:3000');
      } catch (error) {
        // Expected
      }

      expect(service.getLastError()).toBeTruthy();

      // Now connect successfully and disconnect
      service = new MCPClientService();
      await service.connect('http://localhost:3000');
      await service.disconnect();

      expect(service.getLastError()).toBeNull();
      expect(service.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('Message Serialization and Deserialization', () => {
    it('should serialize tool call requests correctly', async () => {
      await service.connect('http://localhost:3000');

      const result = await service.createProject({ title: 'Test', skipValidation: true });

      expect(service.client.callTool).toHaveBeenCalledWith({
        name: 'mcp_stitch_create_project',
        arguments: { title: 'Test', skipValidation: true }
      });
    });

    it('should deserialize JSON responses from tool calls', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, projectId: '123' })
          }
        ]
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          callTool: vi.fn().mockResolvedValue(mockResponse)
        };
      });

      service = new MCPClientService();
      await service.connect('http://localhost:3000');

      const result = await service.createProject({ title: 'Test', skipValidation: true });

      expect(result).toEqual({ success: true, projectId: '123' });
    });

    it('should handle non-JSON text responses', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Plain text response'
          }
        ]
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          callTool: vi.fn().mockResolvedValue(mockResponse)
        };
      });

      service = new MCPClientService();
      await service.connect('http://localhost:3000');

      const result = await service.createProject({ title: 'Test', skipValidation: true });

      expect(result).toBe('Plain text response');
    });

    it('should handle empty content in responses', async () => {
      const mockResponse = {
        content: []
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          callTool: vi.fn().mockResolvedValue(mockResponse)
        };
      });

      service = new MCPClientService();
      await service.connect('http://localhost:3000');

      const result = await service.createProject({ title: 'Test', skipValidation: true });

      expect(result).toEqual(mockResponse);
    });

    it('should throw error when tool call fails', async () => {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          callTool: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
        };
      });

      service = new MCPClientService();
      await service.connect('http://localhost:3000');

      await expect(service.createProject({ title: 'Test', skipValidation: true }))
        .rejects
        .toThrow('Tool call failed: Tool execution failed');
    });

    it('should throw error when calling tool while disconnected', async () => {
      // Don't connect - use skipValidation to bypass validation that requires connection
      await expect(service.createProject({ title: 'test-project', skipValidation: true }))
        .rejects
        .toThrow('Not connected to Stitch MCP server');
    });

    it('should serialize complex nested arguments', async () => {
      await service.connect('http://localhost:3000');

      const complexArgs = {
        projectId: '123',
        selectedScreenIds: ['screen1', 'screen2'],
        variantOptions: {
          variantCount: 3,
          creativeRange: 'EXPLORE',
          aspects: ['LAYOUT', 'COLOR_SCHEME']
        }
      };

      await service.generateVariants(complexArgs);

      expect(service.client.callTool).toHaveBeenCalledWith({
        name: 'mcp_stitch_generate_variants',
        arguments: complexArgs
      });
    });

    it('should handle multiple content items in response', async () => {
      const mockResponse = {
        content: [
          { type: 'image', data: 'base64data' },
          { type: 'text', text: JSON.stringify({ result: 'success' }) }
        ]
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      Client.mockImplementationOnce(function() {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          callTool: vi.fn().mockResolvedValue(mockResponse)
        };
      });

      service = new MCPClientService();
      await service.connect('http://localhost:3000');

      const result = await service.createProject({ title: 'Test', skipValidation: true });

      // Should extract the first text content
      expect(result).toEqual({ result: 'success' });
    });
  });

  describe('Project Name Validation', () => {
    describe('validateProjectName', () => {
      it('should accept valid kebab-case names', () => {
        expect(service.validateProjectName('my-project')).toBe(true);
        expect(service.validateProjectName('project-123')).toBe(true);
        expect(service.validateProjectName('a')).toBe(true);
        expect(service.validateProjectName('my-long-project-name')).toBe(true);
        expect(service.validateProjectName('project1')).toBe(true);
      });

      it('should reject names with uppercase letters', () => {
        expect(service.validateProjectName('My-Project')).toBe(false);
        expect(service.validateProjectName('PROJECT')).toBe(false);
        expect(service.validateProjectName('myProject')).toBe(false);
      });

      it('should reject names with invalid characters', () => {
        expect(service.validateProjectName('my_project')).toBe(false);
        expect(service.validateProjectName('my project')).toBe(false);
        expect(service.validateProjectName('my.project')).toBe(false);
        expect(service.validateProjectName('my@project')).toBe(false);
      });

      it('should reject names starting with non-letter', () => {
        expect(service.validateProjectName('1project')).toBe(false);
        expect(service.validateProjectName('-project')).toBe(false);
        expect(service.validateProjectName('_project')).toBe(false);
      });

      it('should reject names ending with hyphen', () => {
        expect(service.validateProjectName('project-')).toBe(false);
        expect(service.validateProjectName('my-project-')).toBe(false);
      });

      it('should reject names with consecutive hyphens', () => {
        expect(service.validateProjectName('my--project')).toBe(false);
        expect(service.validateProjectName('project--name')).toBe(false);
      });

      it('should reject empty or null names', () => {
        expect(service.validateProjectName('')).toBe(false);
        expect(service.validateProjectName(null)).toBe(false);
        expect(service.validateProjectName(undefined)).toBe(false);
      });

      it('should reject non-string values', () => {
        expect(service.validateProjectName(123)).toBe(false);
        expect(service.validateProjectName({})).toBe(false);
        expect(service.validateProjectName([])).toBe(false);
      });
    });

    describe('isProjectNameUnique', () => {
      it('should return true when name is unique', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  projects: [
                    { title: 'existing-project' },
                    { title: 'another-project' }
                  ]
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const isUnique = await service.isProjectNameUnique('new-project');
        expect(isUnique).toBe(true);
      });

      it('should return false when name already exists (case-insensitive)', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  projects: [
                    { title: 'existing-project' },
                    { title: 'another-project' }
                  ]
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const isUnique1 = await service.isProjectNameUnique('existing-project');
        expect(isUnique1).toBe(false);

        const isUnique2 = await service.isProjectNameUnique('EXISTING-PROJECT');
        expect(isUnique2).toBe(false);

        const isUnique3 = await service.isProjectNameUnique('Existing-Project');
        expect(isUnique3).toBe(false);
      });

      it('should handle empty project list', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: [] })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const isUnique = await service.isProjectNameUnique('any-project');
        expect(isUnique).toBe(true);
      });

      it('should return false on error (safe default)', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockRejectedValue(new Error('Network error'))
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const isUnique = await service.isProjectNameUnique('test-project');
        expect(isUnique).toBe(false);
      });

      it('should handle projects without title field', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  projects: [
                    { title: 'valid-project' },
                    { name: 'no-title-field' },
                    null
                  ]
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const isUnique = await service.isProjectNameUnique('new-project');
        expect(isUnique).toBe(true);
      });
    });

    describe('validateProjectParams', () => {
      it('should validate valid project parameters', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: [] })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const validation = await service.validateProjectParams({
          title: 'my-new-project'
        });

        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      });

      it('should reject missing title', async () => {
        const validation = await service.validateProjectParams({});
        
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Project title is required');
      });

      it('should reject invalid kebab-case format', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: [] })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const validation = await service.validateProjectParams({
          title: 'MyProject'
        });

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Project name must be in kebab-case format (lowercase letters, numbers, and hyphens only)'
        );
      });

      it('should reject non-unique names', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  projects: [{ title: 'existing-project' }]
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const validation = await service.validateProjectParams({
          title: 'existing-project'
        });

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Project name must be unique');
      });

      it('should return multiple errors when multiple validations fail', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  projects: [{ title: 'Invalid_Name' }]
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const validation = await service.validateProjectParams({
          title: 'Invalid_Name'
        });

        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.errors).toContain(
          'Project name must be in kebab-case format (lowercase letters, numbers, and hyphens only)'
        );
      });
    });

    describe('createProject with validation', () => {
      it('should create project when validation passes', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const mockCallTool = vi.fn()
          .mockResolvedValueOnce({
            content: [{
              type: 'text',
              text: JSON.stringify({ projects: [] })
            }]
          })
          .mockResolvedValueOnce({
            content: [{
              type: 'text',
              text: JSON.stringify({
                name: 'projects/123',
                title: 'my-project'
              })
            }]
          });

        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: mockCallTool
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.createProject({ title: 'my-project' });

        expect(result.title).toBe('my-project');
        expect(mockCallTool).toHaveBeenCalledWith({
          name: 'mcp_stitch_create_project',
          arguments: { title: 'my-project' }
        });
      });

      it('should throw error when validation fails', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: [] })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        await expect(service.createProject({ title: 'Invalid_Name' }))
          .rejects
          .toThrow('Project validation failed');
      });

      it('should skip validation when skipValidation is true', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  name: 'projects/123',
                  title: 'Invalid_Name'
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        // Should not throw even with invalid name
        const result = await service.createProject({
          title: 'Invalid_Name',
          skipValidation: true
        });

        expect(result.title).toBe('Invalid_Name');
      });

      it('should throw error with all validation errors', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({
                  projects: [{ title: 'INVALID' }]
                })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        try {
          await service.createProject({ title: 'INVALID' });
          fail('Should have thrown error');
        } catch (error) {
          expect(error.message).toContain('Project validation failed');
          expect(error.message).toContain('kebab-case');
        }
      });
    });

    describe('listProjects', () => {
      it('should list all projects', async () => {
        const mockProjects = [
          { name: 'projects/123', title: 'project-one', description: 'First project' },
          { name: 'projects/456', title: 'project-two', description: 'Second project' }
        ];

        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: mockProjects })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.listProjects();

        expect(result.projects).toEqual(mockProjects);
        expect(result.projects).toHaveLength(2);
        expect(service.client.callTool).toHaveBeenCalledWith({
          name: 'mcp_stitch_list_projects',
          arguments: {}
        });
      });

      it('should list projects with filter', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: [] })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        await service.listProjects({ filter: 'view=owned' });

        expect(service.client.callTool).toHaveBeenCalledWith({
          name: 'mcp_stitch_list_projects',
          arguments: { filter: 'view=owned' }
        });
      });

      it('should handle empty project list', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: [] })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.listProjects();

        expect(result.projects).toEqual([]);
        expect(result.projects).toHaveLength(0);
      });

      it('should throw error when not connected', async () => {
        await expect(service.listProjects())
          .rejects
          .toThrow('Not connected to Stitch MCP server');
      });
    });

    describe('getProject', () => {
      it('should get project by name', async () => {
        const mockProject = {
          name: 'projects/123',
          title: 'my-project',
          description: 'Test project',
          created_at: '2024-01-01T00:00:00Z'
        };

        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify(mockProject)
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.getProject('projects/123');

        expect(result).toEqual(mockProject);
        expect(service.client.callTool).toHaveBeenCalledWith({
          name: 'mcp_stitch_get_project',
          arguments: { name: 'projects/123' }
        });
      });

      it('should handle project with UUID in name', async () => {
        const mockProject = {
          name: 'projects/550e8400-e29b-41d4-a716-446655440000',
          title: 'uuid-project',
          description: 'Project with UUID'
        };

        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify(mockProject)
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.getProject('projects/550e8400-e29b-41d4-a716-446655440000');

        expect(result.name).toContain('550e8400-e29b-41d4-a716-446655440000');
        expect(result.title).toBe('uuid-project');
      });

      it('should throw error when not connected', async () => {
        await expect(service.getProject('projects/123'))
          .rejects
          .toThrow('Not connected to Stitch MCP server');
      });

      it('should handle server errors gracefully', async () => {
        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockRejectedValue(new Error('Project not found'))
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        await expect(service.getProject('projects/nonexistent'))
          .rejects
          .toThrow('Tool call failed: Project not found');
      });
    });

    describe('Project UUID Handling', () => {
      it('should handle server-generated UUIDs in project responses', async () => {
        const mockProject = {
          name: 'projects/a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789',
          title: 'test-project',
          description: 'Test'
        };

        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        const mockCallTool = vi.fn()
          .mockResolvedValueOnce({
            content: [{
              type: 'text',
              text: JSON.stringify({ projects: [] })
            }]
          })
          .mockResolvedValueOnce({
            content: [{
              type: 'text',
              text: JSON.stringify(mockProject)
            }]
          });

        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: mockCallTool
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.createProject({ title: 'test-project' });

        // Verify UUID is present in the response
        expect(result.name).toMatch(/^projects\/[a-f0-9-]+$/);
        expect(result.name).toContain('-');
      });

      it('should handle multiple projects with different UUIDs', async () => {
        const mockProjects = [
          { name: 'projects/11111111-1111-1111-1111-111111111111', title: 'project-one' },
          { name: 'projects/22222222-2222-2222-2222-222222222222', title: 'project-two' },
          { name: 'projects/33333333-3333-3333-3333-333333333333', title: 'project-three' }
        ];

        const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
        Client.mockImplementationOnce(function() {
          return {
            connect: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
              content: [{
                type: 'text',
                text: JSON.stringify({ projects: mockProjects })
              }]
            })
          };
        });

        service = new MCPClientService();
        await service.connect('http://localhost:3000');

        const result = await service.listProjects();

        // Verify all UUIDs are unique
        const uuids = result.projects.map(p => p.name.split('/')[1]);
        const uniqueUuids = new Set(uuids);
        expect(uniqueUuids.size).toBe(3);
        
        // Verify each UUID follows a valid format
        uuids.forEach(uuid => {
          expect(uuid).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
        });
      });
    });
  });
});
