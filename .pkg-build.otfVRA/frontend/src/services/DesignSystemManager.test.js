/**
 * Unit tests for DesignSystemManager
 * Tests design system application to projects and screens, and color token injection
 * Requirements: 12.5, 12.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DesignSystemManager } from './DesignSystemManager.js';

describe('DesignSystemManager', () => {
  let manager;
  let mockMCPClient;

  beforeEach(() => {
    // Create mock MCP client
    mockMCPClient = {
      isConnected: vi.fn(() => true),
      getProject: vi.fn(),
      applyDesignSystem: vi.fn()
    };

    manager = new DesignSystemManager(mockMCPClient);
  });

  describe('applyDesignSystemToProject', () => {
    it('should apply design system to all screens in a project', async () => {
      // Requirement 12.5: Apply design system to all screens in project
      const projectId = '123';
      const designSystemId = '456';
      
      const mockProject = {
        name: 'projects/123',
        screenInstances: [
          { id: 'screen1', sourceScreen: 'projects/123/screens/abc' },
          { id: 'screen2', sourceScreen: 'projects/123/screens/def' }
        ]
      };

      mockMCPClient.getProject.mockResolvedValue(mockProject);
      mockMCPClient.applyDesignSystem.mockResolvedValue({ success: true });

      const result = await manager.applyDesignSystemToProject(projectId, designSystemId);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(2);
      expect(result.screens).toHaveLength(2);
      expect(mockMCPClient.getProject).toHaveBeenCalledWith('projects/123');
      expect(mockMCPClient.applyDesignSystem).toHaveBeenCalledWith({
        projectId,
        assetId: designSystemId,
        selectedScreenInstances: [
          { id: 'screen1', sourceScreen: 'projects/123/screens/abc' },
          { id: 'screen2', sourceScreen: 'projects/123/screens/def' }
        ]
      });
    });

    it('should handle project with no screens', async () => {
      const projectId = '123';
      const designSystemId = '456';
      
      const mockProject = {
        name: 'projects/123',
        screenInstances: []
      };

      mockMCPClient.getProject.mockResolvedValue(mockProject);

      const result = await manager.applyDesignSystemToProject(projectId, designSystemId);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(0);
      expect(result.message).toBe('No screens found in project');
      expect(mockMCPClient.applyDesignSystem).not.toHaveBeenCalled();
    });

    it('should throw error when MCP client is not connected', async () => {
      mockMCPClient.isConnected.mockReturnValue(false);

      await expect(
        manager.applyDesignSystemToProject('123', '456')
      ).rejects.toThrow('MCP client is not connected');
    });

    it('should throw error when project ID is missing', async () => {
      await expect(
        manager.applyDesignSystemToProject('', '456')
      ).rejects.toThrow('Project ID and Design System ID are required');
    });

    it('should throw error when design system ID is missing', async () => {
      await expect(
        manager.applyDesignSystemToProject('123', '')
      ).rejects.toThrow('Project ID and Design System ID are required');
    });

    it('should handle MCP client errors gracefully', async () => {
      mockMCPClient.getProject.mockRejectedValue(new Error('Network error'));

      await expect(
        manager.applyDesignSystemToProject('123', '456')
      ).rejects.toThrow('Failed to apply design system: Network error');
    });
  });

  describe('applyDesignSystemToScreens', () => {
    it('should apply design system to specific screens', async () => {
      const projectId = '123';
      const designSystemId = '456';
      const screenInstances = [
        { id: 'screen1', sourceScreen: 'projects/123/screens/abc' }
      ];

      mockMCPClient.applyDesignSystem.mockResolvedValue({ success: true });

      const result = await manager.applyDesignSystemToScreens(
        projectId,
        designSystemId,
        screenInstances
      );

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(result.screens).toEqual(screenInstances);
      expect(mockMCPClient.applyDesignSystem).toHaveBeenCalledWith({
        projectId,
        assetId: designSystemId,
        selectedScreenInstances: screenInstances
      });
    });

    it('should throw error when screen instances are empty', async () => {
      await expect(
        manager.applyDesignSystemToScreens('123', '456', [])
      ).rejects.toThrow('Project ID, Design System ID, and screen instances are required');
    });

    it('should throw error when MCP client is not connected', async () => {
      mockMCPClient.isConnected.mockReturnValue(false);

      await expect(
        manager.applyDesignSystemToScreens('123', '456', [{ id: 'screen1', sourceScreen: 'test' }])
      ).rejects.toThrow('MCP client is not connected');
    });
  });

  describe('injectDesignSystemTokens', () => {
    it('should inject design system color tokens into code', () => {
      // Requirement 12.6: Inject design system color tokens into generated code
      const code = `
        function MyComponent() {
          return (
            <div style={{ backgroundColor: '#ff0000', color: '#00ff00' }}>
              <span style={{ borderColor: '#0000ff' }}>Text</span>
            </div>
          );
        }
      `;

      const designSystem = {
        theme: {
          customColor: '#ff0000',
          overrideSecondaryColor: '#00ff00',
          overrideTertiaryColor: '#0000ff'
        }
      };

      const result = manager.injectDesignSystemTokens(code, designSystem);

      expect(result).toContain("'var(--ds-primary)'");
      expect(result).toContain("'var(--ds-secondary)'");
      expect(result).toContain("'var(--ds-tertiary)'");
    });

    it('should use CH color tokens when no design system provided', () => {
      const code = `
        function MyComponent() {
          return <div style={{ backgroundColor: '#060e20' }}>Content</div>;
        }
      `;

      const result = manager.injectDesignSystemTokens(code, null);

      expect(result).toContain('CH.bg');
    });

    it('should handle code without color values', () => {
      const code = `
        function MyComponent() {
          return <div>Content</div>;
        }
      `;

      const designSystem = {
        theme: {
          customColor: '#ff0000'
        }
      };

      const result = manager.injectDesignSystemTokens(code, designSystem);

      expect(result).toBe(code);
    });

    it('should handle empty or invalid code', () => {
      expect(manager.injectDesignSystemTokens('', {})).toBe('');
      expect(manager.injectDesignSystemTokens(null, {})).toBe(null);
      expect(manager.injectDesignSystemTokens(undefined, {})).toBe(undefined);
    });

    it('should inject multiple color tokens from design system', () => {
      const code = `
        function MyComponent() {
          return (
            <div style={{ 
              backgroundColor: '#ff0000',
              color: '#00ff00',
              borderColor: '#0000ff',
              outlineColor: '#ffff00'
            }}>
              Content
            </div>
          );
        }
      `;

      const designSystem = {
        theme: {
          customColor: '#ff0000',
          overridePrimaryColor: '#ff0000',
          overrideSecondaryColor: '#00ff00',
          overrideTertiaryColor: '#0000ff',
          overrideNeutralColor: '#ffff00'
        }
      };

      const result = manager.injectDesignSystemTokens(code, designSystem);

      expect(result).toContain("'var(--ds-primary)'");
      expect(result).toContain("'var(--ds-secondary)'");
      expect(result).toContain("'var(--ds-tertiary)'");
      expect(result).toContain("'var(--ds-neutral)'");
    });
  });

  describe('transformCodeWithDesignSystem', () => {
    it('should apply full design system transformation', () => {
      const code = `
        import React from 'react';
        
        function MyComponent() {
          return (
            <div style={{ backgroundColor: '#060e20' }}>
              <button>Click me</button>
            </div>
          );
        }
      `;

      const result = manager.transformCodeWithDesignSystem(code);

      // Should have CH imports
      expect(result).toContain("from './CH.jsx'");
      
      // Should have CH color tokens
      expect(result).toContain('CH.bg');
      
      // Should have CHPage wrapper
      expect(result).toContain('<CHPage>');
    });

    it('should apply design system with custom colors', () => {
      const code = `
        import React from 'react';
        
        function MyComponent() {
          return <div style={{ backgroundColor: '#ff0000' }}>Content</div>;
        }
      `;

      const designSystem = {
        theme: {
          customColor: '#ff0000'
        }
      };

      const result = manager.transformCodeWithDesignSystem(code, designSystem);

      expect(result).toContain("'var(--ds-primary)'");
    });
  });

  describe('validateDesignSystem', () => {
    it('should validate a complete design system', () => {
      const designSystem = {
        displayName: 'My Design System',
        theme: {
          colorMode: 'LIGHT',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: '#ff0000'
        }
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation when design system is missing', () => {
      const result = manager.validateDesignSystem(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Design system is required');
    });

    it('should fail validation when display name is missing', () => {
      const designSystem = {
        theme: {
          colorMode: 'LIGHT',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: '#ff0000'
        }
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Design system display name is required');
    });

    it('should fail validation when theme is missing', () => {
      const designSystem = {
        displayName: 'My Design System'
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Design system theme is required');
    });

    it('should fail validation when required theme properties are missing', () => {
      const designSystem = {
        displayName: 'My Design System',
        theme: {}
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Color mode is required');
      expect(result.errors).toContain('Headline font is required');
      expect(result.errors).toContain('Body font is required');
      expect(result.errors).toContain('Roundness is required');
      expect(result.errors).toContain('Custom color is required');
    });

    it('should fail validation when custom color is invalid', () => {
      const designSystem = {
        displayName: 'My Design System',
        theme: {
          colorMode: 'LIGHT',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: 'not-a-color'
        }
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Custom color must be a valid CSS color');
    });

    it('should validate hex colors', () => {
      const designSystem = {
        displayName: 'My Design System',
        theme: {
          colorMode: 'LIGHT',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: '#ff0000',
          overridePrimaryColor: '#00ff00',
          overrideSecondaryColor: '#0000ff'
        }
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(true);
    });

    it('should validate rgb colors', () => {
      const designSystem = {
        displayName: 'My Design System',
        theme: {
          colorMode: 'LIGHT',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: 'rgb(255, 0, 0)',
          overridePrimaryColor: 'rgba(0, 255, 0, 0.5)'
        }
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(true);
    });

    it('should fail validation when override colors are invalid', () => {
      const designSystem = {
        displayName: 'My Design System',
        theme: {
          colorMode: 'LIGHT',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_EIGHT',
          customColor: '#ff0000',
          overridePrimaryColor: 'invalid-color'
        }
      };

      const result = manager.validateDesignSystem(designSystem);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Override primary color must be a valid CSS color');
    });
  });

  describe('_isValidCSSColor', () => {
    it('should validate hex colors', () => {
      expect(manager._isValidCSSColor('#ff0000')).toBe(true);
      expect(manager._isValidCSSColor('#f00')).toBe(true);
      expect(manager._isValidCSSColor('#FF0000')).toBe(true);
    });

    it('should validate rgb/rgba colors', () => {
      expect(manager._isValidCSSColor('rgb(255, 0, 0)')).toBe(true);
      expect(manager._isValidCSSColor('rgba(255, 0, 0, 0.5)')).toBe(true);
    });

    it('should validate hsl/hsla colors', () => {
      expect(manager._isValidCSSColor('hsl(0, 100%, 50%)')).toBe(true);
      expect(manager._isValidCSSColor('hsla(0, 100%, 50%, 0.5)')).toBe(true);
    });

    it('should validate named colors', () => {
      expect(manager._isValidCSSColor('red')).toBe(true);
      expect(manager._isValidCSSColor('blue')).toBe(true);
      expect(manager._isValidCSSColor('transparent')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(manager._isValidCSSColor('not-a-color')).toBe(false);
      expect(manager._isValidCSSColor('#gggggg')).toBe(false);
      expect(manager._isValidCSSColor('')).toBe(false);
      expect(manager._isValidCSSColor(null)).toBe(false);
      expect(manager._isValidCSSColor(undefined)).toBe(false);
    });
  });
});
