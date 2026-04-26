/**
 * Unit tests for CHDesignSystemAdapter validation methods
 * Tests validateCHCompliance() and suggestCHReplacements()
 * Requirements: 5.5, 5.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CHDesignSystemAdapter } from './CHDesignSystemAdapter.js';

describe('CHDesignSystemAdapter - Validation Methods', () => {
  let adapter;

  beforeEach(() => {
    adapter = new CHDesignSystemAdapter();
  });

  describe('validateCHCompliance', () => {
    it('should validate code with CH imports and color tokens', () => {
      const code = `
        import React from 'react';
        import { CHPage, CHCard, CH } from './CH.jsx';
        
        function MyPage() {
          return (
            <CHPage>
              <div style={{ backgroundColor: CH.bg }}>
                <CHCard>Content</CHCard>
              </div>
            </CHPage>
          );
        }
      `;

      const result = adapter.validateCHCompliance(code);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation when CH imports are missing', () => {
      const code = `
        import React from 'react';
        
        function MyPage() {
          return <div>Content</div>;
        }
      `;

      const result = adapter.validateCHCompliance(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing CH.jsx component imports');
    });

    it('should fail validation when CH color tokens are missing', () => {
      const code = `
        import React from 'react';
        import { CHPage } from './CH.jsx';
        
        function MyPage() {
          return <CHPage>Content</CHPage>;
        }
      `;

      const result = adapter.validateCHCompliance(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No CH color tokens found in code');
    });

    it('should fail validation when both imports and tokens are missing', () => {
      const code = `
        import React from 'react';
        
        function MyPage() {
          return <div>Content</div>;
        }
      `;

      const result = adapter.validateCHCompliance(code);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Missing CH.jsx component imports');
      expect(result.errors).toContain('No CH color tokens found in code');
    });

    it('should handle empty or invalid code', () => {
      expect(adapter.validateCHCompliance('').isValid).toBe(false);
      expect(adapter.validateCHCompliance(null).isValid).toBe(false);
      expect(adapter.validateCHCompliance(undefined).isValid).toBe(false);
    });

    it('should recognize various CH color tokens', () => {
      const tokens = ['bg', 'surface', 'surfaceMd', 'surfaceHi', 'accent', 'text', 'textSub', 'green', 'red', 'yellow'];
      
      tokens.forEach(token => {
        const code = `
          import { CH } from './CH.jsx';
          const color = CH.${token};
        `;
        
        const result = adapter.validateCHCompliance(code);
        expect(result.errors).not.toContain('No CH color tokens found in code');
      });
    });
  });

  describe('suggestCHReplacements', () => {
    it('should suggest CHBtn for button elements', () => {
      const code = `
        function MyComponent() {
          return <button onClick={handleClick}>Click me</button>;
        }
      `;

      const suggestions = adapter.suggestCHReplacements(code);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        component: 'button',
        replacement: 'CHBtn',
        description: 'Replace <button> elements with <CHBtn> for consistent styling'
      });
    });

    it('should suggest CHInput for input elements', () => {
      const code = `
        function MyForm() {
          return <input type="text" placeholder="Enter name" />;
        }
      `;

      const suggestions = adapter.suggestCHReplacements(code);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        component: 'input',
        replacement: 'CHInput',
        description: 'Replace <input> elements with <CHInput> for consistent styling'
      });
    });

    it('should suggest CHCard for card divs', () => {
      const code = `
        function MyComponent() {
          return <div className="card">Content</div>;
        }
      `;

      const suggestions = adapter.suggestCHReplacements(code);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        component: 'div.card',
        replacement: 'CHCard',
        description: 'Replace card divs with <CHCard> for consistent card styling'
      });
    });

    it('should return multiple suggestions when multiple replacements are possible', () => {
      const code = `
        function MyComponent() {
          return (
            <div className="card">
              <input type="text" />
              <button>Submit</button>
            </div>
          );
        }
      `;

      const suggestions = adapter.suggestCHReplacements(code);

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.some(s => s.replacement === 'CHBtn')).toBe(true);
      expect(suggestions.some(s => s.replacement === 'CHInput')).toBe(true);
    });

    it('should not suggest replacements when CH components are already used', () => {
      const code = `
        import { CHBtn, CHInput, CHCard } from './CH.jsx';
        
        function MyComponent() {
          return (
            <CHCard>
              <CHInput type="text" />
              <CHBtn>Submit</CHBtn>
            </CHCard>
          );
        }
      `;

      const suggestions = adapter.suggestCHReplacements(code);

      expect(suggestions).toEqual([]);
    });

    it('should handle empty or invalid code', () => {
      expect(adapter.suggestCHReplacements('')).toEqual([]);
      expect(adapter.suggestCHReplacements(null)).toEqual([]);
      expect(adapter.suggestCHReplacements(undefined)).toEqual([]);
    });
  });
});
