import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MainContent from './MainContent';

describe('MainContent Component', () => {
  describe('Basic Rendering', () => {
    it('should render children content', () => {
      render(
        <MainContent>
          <div data-testid="test-content">Test Content</div>
        </MainContent>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render as a main element', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toBeInTheDocument();
    });
  });

  describe('Tailwind Classes', () => {
    it('should apply correct base Tailwind classes', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('ml-64'); // Left margin for sidebar
      expect(mainElement).toHaveClass('pt-24'); // Top padding for header
      expect(mainElement).toHaveClass('px-8'); // Horizontal padding
      expect(mainElement).toHaveClass('min-h-screen'); // Full viewport height
      expect(mainElement).toHaveClass('bg-[#060e20]'); // Stitch background color
      expect(mainElement).toHaveClass('overflow-y-auto'); // Scrollable content
    });

    it('should apply additional className when provided', () => {
      const { container } = render(
        <MainContent className="pb-16 custom-class">
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('pb-16');
      expect(mainElement).toHaveClass('custom-class');
      // Should still have base classes
      expect(mainElement).toHaveClass('ml-64');
      expect(mainElement).toHaveClass('pt-24');
    });
  });

  describe('Max-Width Container', () => {
    it('should not render inner container when maxWidth is not provided', () => {
      const { container } = render(
        <MainContent>
          <div data-testid="test-content">Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      const innerDiv = mainElement.querySelector('div');
      
      // The only div should be our test content
      expect(innerDiv).toHaveAttribute('data-testid', 'test-content');
    });

    it('should render inner container with max-width when maxWidth is provided', () => {
      const { container } = render(
        <MainContent maxWidth="max-w-7xl">
          <div data-testid="test-content">Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      const innerContainer = mainElement.querySelector('div:not([data-testid])');
      
      expect(innerContainer).toBeInTheDocument();
      expect(innerContainer).toHaveClass('max-w-7xl');
      expect(innerContainer).toHaveClass('mx-auto');
    });

    it('should support different max-width values', () => {
      const maxWidthValues = ['max-w-5xl', 'max-w-6xl', 'max-w-7xl', 'max-w-full'];

      maxWidthValues.forEach((maxWidth) => {
        const { container } = render(
          <MainContent maxWidth={maxWidth}>
            <div>Content</div>
          </MainContent>
        );

        const innerContainer = container.querySelector('main > div');
        expect(innerContainer).toHaveClass(maxWidth);
        expect(innerContainer).toHaveClass('mx-auto');
      });
    });
  });

  describe('Layout Integration', () => {
    it('should have correct spacing for sidebar integration', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      // ml-64 = 256px, matching sidebar width from task 2.1
      expect(mainElement).toHaveClass('ml-64');
    });

    it('should have correct spacing for header integration', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      // pt-24 = 96px, accounting for 64px header + spacing
      expect(mainElement).toHaveClass('pt-24');
    });

    it('should use Stitch design system background color', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      // #060e20 is the Stitch background color token
      expect(mainElement).toHaveClass('bg-[#060e20]');
    });
  });

  describe('Scrollable Behavior', () => {
    it('should have overflow-y-auto for scrollable content', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('overflow-y-auto');
    });

    it('should have min-h-screen to fill viewport', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('min-h-screen');
    });
  });

  describe('Content Rendering', () => {
    it('should render multiple children', () => {
      render(
        <MainContent>
          <h1 data-testid="heading">Title</h1>
          <p data-testid="paragraph">Paragraph</p>
          <div data-testid="div">Div</div>
        </MainContent>
      );

      expect(screen.getByTestId('heading')).toBeInTheDocument();
      expect(screen.getByTestId('paragraph')).toBeInTheDocument();
      expect(screen.getByTestId('div')).toBeInTheDocument();
    });

    it('should render complex nested content', () => {
      render(
        <MainContent>
          <div>
            <header>
              <h1>Page Title</h1>
            </header>
            <section>
              <article>
                <p>Article content</p>
              </article>
            </section>
          </div>
        </MainContent>
      );

      expect(screen.getByText('Page Title')).toBeInTheDocument();
      expect(screen.getByText('Article content')).toBeInTheDocument();
    });
  });

  describe('Requirements Validation', () => {
    it('should satisfy Requirement 2.3 - main content area with correct spacing', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      // Requirement 2.3: left margin 256px (ml-64) and top padding 96px (pt-24)
      expect(mainElement).toHaveClass('ml-64');
      expect(mainElement).toHaveClass('pt-24');
    });

    it('should satisfy Requirement 2.4 - consistent layout structure', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      // Consistent classes applied to all pages
      expect(mainElement).toHaveClass('ml-64');
      expect(mainElement).toHaveClass('pt-24');
      expect(mainElement).toHaveClass('px-8');
      expect(mainElement).toHaveClass('min-h-screen');
      expect(mainElement).toHaveClass('bg-[#060e20]');
    });

    it('should satisfy Requirement 2.6 - scrollable content area', () => {
      const { container } = render(
        <MainContent>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      // Requirement 2.6: scrollable with consistent background
      expect(mainElement).toHaveClass('overflow-y-auto');
      expect(mainElement).toHaveClass('bg-[#060e20]');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      const { container } = render(
        <MainContent>
          {null}
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toBeInTheDocument();
      expect(mainElement).toHaveClass('ml-64');
    });

    it('should handle undefined className', () => {
      const { container } = render(
        <MainContent className={undefined}>
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toBeInTheDocument();
      expect(mainElement).toHaveClass('ml-64');
    });

    it('should handle empty string className', () => {
      const { container } = render(
        <MainContent className="">
          <div>Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toBeInTheDocument();
      expect(mainElement).toHaveClass('ml-64');
    });

    it('should handle maxWidth with additional className', () => {
      const { container } = render(
        <MainContent maxWidth="max-w-7xl" className="pb-16">
          <div data-testid="test-content">Content</div>
        </MainContent>
      );

      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('pb-16');
      
      const innerContainer = mainElement.querySelector('div:not([data-testid])');
      expect(innerContainer).toHaveClass('max-w-7xl');
      expect(innerContainer).toHaveClass('mx-auto');
    });
  });
});
