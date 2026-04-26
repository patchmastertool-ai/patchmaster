/**
 * DesignSystemManager
 * 
 * Manages design system application to projects and screens.
 * Handles batch application of design systems and color token injection.
 * 
 * Requirements: 12.5, 12.6
 */

import { CHDesignSystemAdapter } from './CHDesignSystemAdapter.js';

/**
 * DesignSystemManager class
 * Coordinates design system application across multiple screens
 */
export class DesignSystemManager {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
    this.chAdapter = new CHDesignSystemAdapter();
  }

  /**
   * Apply design system to all screens in a project
   * Requirement 12.5: Apply design system to all screens in project
   * 
   * @param {string} projectId - Project ID (without 'projects/' prefix)
   * @param {string} designSystemId - Design system asset ID (without 'assets/' prefix)
   * @returns {Promise<Object>} Result with applied screens and any errors
   */
  async applyDesignSystemToProject(projectId, designSystemId) {
    if (!this.mcpClient.isConnected()) {
      throw new Error('MCP client is not connected');
    }

    if (!projectId || !designSystemId) {
      throw new Error('Project ID and Design System ID are required');
    }

    try {
      // Step 1: Get the project to access screen instances
      const project = await this.mcpClient.getProject(`projects/${projectId}`);
      
      if (!project || !project.screenInstances || project.screenInstances.length === 0) {
        return {
          success: true,
          appliedCount: 0,
          message: 'No screens found in project',
          screens: []
        };
      }

      // Step 2: Prepare screen instances for design system application
      const selectedScreenInstances = project.screenInstances.map(instance => ({
        id: instance.id,
        sourceScreen: instance.sourceScreen
      }));

      // Step 3: Apply design system to all screen instances
      const result = await this.mcpClient.applyDesignSystem({
        projectId,
        assetId: designSystemId,
        selectedScreenInstances
      });

      return {
        success: true,
        appliedCount: selectedScreenInstances.length,
        message: `Design system applied to ${selectedScreenInstances.length} screen(s)`,
        screens: selectedScreenInstances,
        result
      };
    } catch (error) {
      console.error('DesignSystemManager: Error applying design system to project:', error);
      throw new Error(`Failed to apply design system: ${error.message}`);
    }
  }

  /**
   * Apply design system to specific screens
   * 
   * @param {string} projectId - Project ID (without 'projects/' prefix)
   * @param {string} designSystemId - Design system asset ID (without 'assets/' prefix)
   * @param {Array} screenInstances - Array of screen instances {id, sourceScreen}
   * @returns {Promise<Object>} Result with applied screens
   */
  async applyDesignSystemToScreens(projectId, designSystemId, screenInstances) {
    if (!this.mcpClient.isConnected()) {
      throw new Error('MCP client is not connected');
    }

    if (!projectId || !designSystemId || !screenInstances || screenInstances.length === 0) {
      throw new Error('Project ID, Design System ID, and screen instances are required');
    }

    try {
      const result = await this.mcpClient.applyDesignSystem({
        projectId,
        assetId: designSystemId,
        selectedScreenInstances: screenInstances
      });

      return {
        success: true,
        appliedCount: screenInstances.length,
        message: `Design system applied to ${screenInstances.length} screen(s)`,
        screens: screenInstances,
        result
      };
    } catch (error) {
      console.error('DesignSystemManager: Error applying design system to screens:', error);
      throw new Error(`Failed to apply design system: ${error.message}`);
    }
  }

  /**
   * Inject design system color tokens into generated code
   * Requirement 12.6: Inject design system color tokens into generated code
   * 
   * @param {string} code - Generated JSX/TSX code
   * @param {Object} designSystem - Design system configuration
   * @returns {string} Code with design system color tokens injected
   */
  injectDesignSystemTokens(code, designSystem) {
    if (!code || typeof code !== 'string') {
      return code;
    }

    if (!designSystem || !designSystem.theme || !designSystem.theme.customColor) {
      // If no design system provided, use CH design system
      return this.chAdapter.applyCHColorTokens(code);
    }

    let transformed = code;

    // Extract colors from design system theme
    const colors = {
      primary: designSystem.theme.customColor,
      ...(designSystem.theme.overridePrimaryColor && { primaryOverride: designSystem.theme.overridePrimaryColor }),
      ...(designSystem.theme.overrideSecondaryColor && { secondary: designSystem.theme.overrideSecondaryColor }),
      ...(designSystem.theme.overrideTertiaryColor && { tertiary: designSystem.theme.overrideTertiaryColor }),
      ...(designSystem.theme.overrideNeutralColor && { neutral: designSystem.theme.overrideNeutralColor })
    };

    // Replace hex color values with design system tokens
    for (const [tokenName, colorValue] of Object.entries(colors)) {
      if (!colorValue) continue;

      // Replace in style attributes: color: '#060e20' -> color: 'var(--ds-primary)'
      const hexRegex = new RegExp(`(['"])(${colorValue})\\1`, 'gi');
      transformed = transformed.replace(hexRegex, `'var(--ds-${tokenName})'`);
      
      // Replace in inline styles
      const inlineStyleRegex = new RegExp(`:\\s*['"]${colorValue}['"]`, 'gi');
      transformed = transformed.replace(inlineStyleRegex, `: 'var(--ds-${tokenName})'`);
    }

    return transformed;
  }

  /**
   * Apply full design system transformation to code
   * Combines CH adapter transformations with design system token injection
   * 
   * @param {string} code - Generated JSX/TSX code
   * @param {Object} designSystem - Optional design system configuration
   * @returns {string} Fully transformed code
   */
  transformCodeWithDesignSystem(code, designSystem = null) {
    let transformed = code;

    // Apply CH design system transformations
    transformed = this.chAdapter.injectCHImports(transformed);
    transformed = this.chAdapter.replacePlaceholderComponents(transformed);
    
    // Apply design system color tokens
    if (designSystem) {
      transformed = this.injectDesignSystemTokens(transformed, designSystem);
    } else {
      // Use default CH color tokens
      transformed = this.chAdapter.applyCHColorTokens(transformed);
    }
    
    transformed = this.chAdapter.ensureCHPageWrapper(transformed);

    return transformed;
  }

  /**
   * Validate design system configuration
   * 
   * @param {Object} designSystem - Design system to validate
   * @returns {Object} Validation result {valid: boolean, errors: string[]}
   */
  validateDesignSystem(designSystem) {
    const errors = [];

    if (!designSystem) {
      errors.push('Design system is required');
      return { valid: false, errors };
    }

    if (!designSystem.displayName) {
      errors.push('Design system display name is required');
    }

    if (!designSystem.theme) {
      errors.push('Design system theme is required');
      return { valid: false, errors };
    }

    const theme = designSystem.theme;

    // Validate required theme properties
    if (!theme.colorMode) {
      errors.push('Color mode is required');
    }

    if (!theme.headlineFont) {
      errors.push('Headline font is required');
    }

    if (!theme.bodyFont) {
      errors.push('Body font is required');
    }

    if (!theme.roundness) {
      errors.push('Roundness is required');
    }

    if (!theme.customColor) {
      errors.push('Custom color is required');
    } else if (!this._isValidCSSColor(theme.customColor)) {
      errors.push('Custom color must be a valid CSS color');
    }

    // Validate optional color overrides
    if (theme.overridePrimaryColor && !this._isValidCSSColor(theme.overridePrimaryColor)) {
      errors.push('Override primary color must be a valid CSS color');
    }

    if (theme.overrideSecondaryColor && !this._isValidCSSColor(theme.overrideSecondaryColor)) {
      errors.push('Override secondary color must be a valid CSS color');
    }

    if (theme.overrideTertiaryColor && !this._isValidCSSColor(theme.overrideTertiaryColor)) {
      errors.push('Override tertiary color must be a valid CSS color');
    }

    if (theme.overrideNeutralColor && !this._isValidCSSColor(theme.overrideNeutralColor)) {
      errors.push('Override neutral color must be a valid CSS color');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a string is a valid CSS color
   * @private
   */
  _isValidCSSColor(color) {
    if (!color || typeof color !== 'string') {
      return false;
    }

    // Check for hex colors
    if (/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
      return true;
    }

    // Check for rgb/rgba
    if (/^rgba?\(/.test(color)) {
      return true;
    }

    // Check for hsl/hsla
    if (/^hsla?\(/.test(color)) {
      return true;
    }

    // Check for named colors (basic check)
    const namedColors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'transparent'];
    if (namedColors.includes(color.toLowerCase())) {
      return true;
    }

    return false;
  }
}

export default DesignSystemManager;
