/**
 * CHDesignSystemAdapter
 * 
 * Injects Command Horizon V2 design system into Stitch-generated code.
 * Transforms generic components to use CH.jsx components and design tokens.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

/**
 * Injects CH.jsx component imports into generated code
 * @param {string} code - Generated JSX/TSX code
 * @returns {string} Code with CH imports added
 */
export function injectCHImports(code) {
  if (!code || typeof code !== 'string') {
    return code;
  }

  // Check if CH imports already exist
  if (code.includes("from './CH.jsx'") || code.includes('from "./CH.jsx"')) {
    return code;
  }

  // Find the last import statement
  const importRegex = /^import\s+.*?;?\s*$/gm;
  const imports = code.match(importRegex);
  
  if (!imports || imports.length === 0) {
    // No imports found, add at the beginning after React import or at top
    const reactImportMatch = code.match(/import\s+React.*?;/);
    if (reactImportMatch) {
      const insertPos = reactImportMatch.index + reactImportMatch[0].length;
      return code.slice(0, insertPos) + 
        "\nimport { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHDot, CHBtn, CHTable, CHTR, CHLoading, CHEmpty, CHInput, CHSelect, CHProgress, CH } from './CH.jsx';" +
        code.slice(insertPos);
    }
    // Add at very beginning
    return "import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHDot, CHBtn, CHTable, CHTR, CHLoading, CHEmpty, CHInput, CHSelect, CHProgress, CH } from './CH.jsx';\n" + code;
  }

  // Insert after the last import
  const lastImport = imports[imports.length - 1];
  const lastImportIndex = code.lastIndexOf(lastImport);
  const insertPos = lastImportIndex + lastImport.length;

  return code.slice(0, insertPos) + 
    "\nimport { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHDot, CHBtn, CHTable, CHTR, CHLoading, CHEmpty, CHInput, CHSelect, CHProgress, CH } from './CH.jsx';" +
    code.slice(insertPos);
}

/**
 * Replaces generic placeholder components with CH equivalents
 * @param {string} code - Generated JSX/TSX code
 * @returns {string} Code with CH components
 */
export function replacePlaceholderComponents(code) {
  if (!code || typeof code !== 'string') {
    return code;
  }

  let transformed = code;

  // Replace common generic components with CH equivalents
  // Note: These are basic replacements - more sophisticated AST-based replacement
  // could be added in future iterations
  
  // Replace button elements with CHBtn
  transformed = transformed.replace(
    /<button\s+([^>]*?)className="([^"]*?)"\s*([^>]*?)>/g,
    '<CHBtn $1$3>'
  );
  transformed = transformed.replace(/<button>/g, '<CHBtn>');
  transformed = transformed.replace(/<\/button>/g, '</CHBtn>');

  // Replace input elements with CHInput
  transformed = transformed.replace(
    /<input\s+type="text"\s+([^>]*?)\/>/g,
    '<CHInput $1/>'
  );

  return transformed;
}

/**
 * Applies CH color tokens to generated code
 * @param {string} code - Generated JSX/TSX code
 * @returns {string} Code with CH color tokens applied
 */
export function applyCHColorTokens(code) {
  if (!code || typeof code !== 'string') {
    return code;
  }

  let transformed = code;

  // Replace common color values with CH tokens
  const colorMappings = {
    '#060e20': 'CH.bg',
    '#06122d': 'CH.surface',
    '#05183c': 'CH.surfaceMd',
    '#00225a': 'CH.surfaceHi',
    '#7bd0ff': 'CH.accent',
    '#dee5ff': 'CH.text',
    '#91aaeb': 'CH.textSub',
    '#10b981': 'CH.green',
    '#ef4444': 'CH.red',
    '#fbbf24': 'CH.yellow',
  };

  // Replace hex colors in style attributes
  for (const [hex, token] of Object.entries(colorMappings)) {
    // Replace in style objects: color: '#060e20' -> color: CH.bg
    const styleRegex = new RegExp(`(['"])(${hex})\\1`, 'gi');
    transformed = transformed.replace(styleRegex, token);
    
    // Replace in inline styles: style={{ color: '#060e20' }} -> style={{ color: CH.bg }}
    const inlineStyleRegex = new RegExp(`:\\s*['"]${hex}['"]`, 'gi');
    transformed = transformed.replace(inlineStyleRegex, `: ${token}`);
  }

  return transformed;
}

/**
 * Ensures generated content is wrapped in CHPage component
 * @param {string} code - Generated JSX/TSX code
 * @returns {string} Code with CHPage wrapper
 */
export function ensureCHPageWrapper(code) {
  if (!code || typeof code !== 'string') {
    return code;
  }

  // Check if CHPage wrapper already exists
  if (code.includes('<CHPage')) {
    return code;
  }

  // Find the main component's return statement
  const returnMatch = code.match(/return\s*\(/);
  if (!returnMatch) {
    // Try to find JSX return without parentheses
    const jsxReturnMatch = code.match(/return\s+</);
    if (!jsxReturnMatch) {
      return code; // Can't find return statement
    }
  }

  // Find the outermost JSX element in the return
  const returnIndex = code.indexOf('return');
  const afterReturn = code.slice(returnIndex);
  
  // Find the opening tag after return
  const openTagMatch = afterReturn.match(/return\s*\(?\s*(<\w+)/);
  if (!openTagMatch) {
    return code;
  }

  const openTag = openTagMatch[1];
  const tagName = openTag.match(/<(\w+)/)[1];

  // Don't wrap if already a CH component
  if (tagName.startsWith('CH')) {
    return code;
  }

  // Wrap the return content with CHPage
  // Find the matching closing tag
  let depth = 0;
  let startPos = returnIndex + afterReturn.indexOf(openTag);
  let endPos = startPos;
  let inTag = false;
  
  for (let i = startPos; i < code.length; i++) {
    if (code[i] === '<') {
      if (code[i + 1] === '/') {
        depth--;
        if (depth === 0) {
          // Find the end of this closing tag
          endPos = code.indexOf('>', i) + 1;
          break;
        }
      } else if (code[i + 1] !== '!' && code[i + 1] !== '?') {
        depth++;
      }
    }
  }

  if (endPos > startPos) {
    const beforeContent = code.slice(0, startPos);
    const content = code.slice(startPos, endPos);
    const afterContent = code.slice(endPos);

    return beforeContent + '<CHPage>\n      ' + content + '\n    </CHPage>' + afterContent;
  }

  return code;
}

/**
 * CHDesignSystemAdapter class
 * Provides all design system transformation methods
 */
export class CHDesignSystemAdapter {
  /**
   * Inject CH.jsx component imports
   */
  injectCHImports(code) {
    return injectCHImports(code);
  }

  /**
   * Replace placeholder components with CH equivalents
   */
  replacePlaceholderComponents(code) {
    return replacePlaceholderComponents(code);
  }

  /**
   * Apply CH color tokens to code
   */
  applyCHColorTokens(code) {
    return applyCHColorTokens(code);
  }

  /**
   * Ensure CHPage wrapper around content
   */
  ensureCHPageWrapper(code) {
    return ensureCHPageWrapper(code);
  }

  /**
   * Apply all transformations in sequence
   * @param {string} code - Generated JSX/TSX code
   * @returns {string} Fully transformed code with CH design system
   */
  transformCode(code) {
    let transformed = code;
    transformed = this.injectCHImports(transformed);
    transformed = this.replacePlaceholderComponents(transformed);
    transformed = this.applyCHColorTokens(transformed);
    transformed = this.ensureCHPageWrapper(transformed);
    return transformed;
  }

  /**
   * Validates that generated code complies with CH design system
   * Requirements: 5.5, 5.6
   * @param {string} code - Generated JSX/TSX code
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateCHCompliance(code) {
    if (!code || typeof code !== 'string') {
      return { isValid: false, errors: ['Code is empty or invalid'] };
    }

    const errors = [];

    // Requirement 5.5: Check for CH component imports
    const hasCHImport = code.includes("from './CH.jsx'") || code.includes('from "./CH.jsx"');
    if (!hasCHImport) {
      errors.push('Missing CH.jsx component imports');
    }

    // Requirement 5.6: Check for CH color token usage
    const hasCHColorTokens = /CH\.(bg|surface|surfaceMd|surfaceHi|border|accent|text|textSub|green|red|yellow)/.test(code);
    if (!hasCHColorTokens) {
      errors.push('No CH color tokens found in code');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Suggests CH component replacements for generic components
   * Requirements: 5.6
   * @param {string} code - Generated JSX/TSX code
   * @returns {Array} Array of suggestion objects
   */
  suggestCHReplacements(code) {
    if (!code || typeof code !== 'string') {
      return [];
    }

    const suggestions = [];

    // Suggest button -> CHBtn
    if (/<button[\s>]/.test(code) && !code.includes('CHBtn')) {
      suggestions.push({
        component: 'button',
        replacement: 'CHBtn',
        description: 'Replace <button> elements with <CHBtn> for consistent styling'
      });
    }

    // Suggest input -> CHInput
    if (/<input[\s>]/.test(code) && !code.includes('CHInput')) {
      suggestions.push({
        component: 'input',
        replacement: 'CHInput',
        description: 'Replace <input> elements with <CHInput> for consistent styling'
      });
    }

    // Suggest div cards -> CHCard
    if (/className=["'][^"']*card[^"']*["']/.test(code) && !code.includes('CHCard')) {
      suggestions.push({
        component: 'div.card',
        replacement: 'CHCard',
        description: 'Replace card divs with <CHCard> for consistent card styling'
      });
    }

    return suggestions;
  }
}

export default CHDesignSystemAdapter;
