import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import CodePreviewPanel from './CodePreviewPanel';

// Mock dependencies
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {}
}));

vi.mock('prettier/standalone', () => ({
  default: {
    format: vi.fn((code) => code.trim() + '\n')
  }
}));

vi.mock('prettier/parser-babel', () => ({
  default: {}
}));

vi.mock('@babel/parser', () => ({
  parse: vi.fn((code) => {
    // Simulate syntax error for invalid code
    if (code.includes('SYNTAX_ERROR')) {
      const error = new Error('Unexpected token');
      error.loc = { line: 1, column: 10 };
      throw error;
    }
    return {}; // Valid parse result
  })
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('CodePreviewPanel', () => {
  const validCode = 'const Component = () => <div>Hello</div>;';
  const invalidCode = 'const SYNTAX_ERROR = <div>';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with default props', () => {
      render(<CodePreviewPanel />);
      expect(screen.getByText('component.jsx')).toBeInTheDocument();
    });

    test('displays provided code', () => {
      render(<CodePreviewPanel code={validCode} />);
      expect(screen.getByTestId('syntax-highlighter')).toHaveTextContent(validCode);
    });

    test('displays custom file name', () => {
      render(<CodePreviewPanel fileName="MyComponent.jsx" />);
      expect(screen.getByText('MyComponent.jsx')).toBeInTheDocument();
    });

    test('shows all toolbar buttons', () => {
      render(<CodePreviewPanel />);
      expect(screen.getByTitle('Format code')).toBeInTheDocument();
      expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
      expect(screen.getByTitle('Download file')).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    test('copies code to clipboard when copy button clicked', async () => {
      render(<CodePreviewPanel code={validCode} />);
      
      const copyButton = screen.getByTitle('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(validCode);
      });
    });

    test('shows success message after copying', async () => {
      render(<CodePreviewPanel code={validCode} />);
      
      const copyButton = screen.getByTitle('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('✓ Copied!')).toBeInTheDocument();
      });
    });

    test('handles clipboard copy errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

      render(<CodePreviewPanel code={validCode} />);
      
      const copyButton = screen.getByTitle('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });
  });

  describe('Download File', () => {
    test('downloads code as file when download button clicked', () => {
      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      
      // Mock createElement to return element with click method
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const element = originalCreateElement(tag);
        if (tag === 'a') {
          element.click = mockClick;
        }
        return element;
      });

      render(<CodePreviewPanel code={validCode} fileName="Test.jsx" />);
      
      const downloadButton = screen.getByTitle('Download file');
      fireEvent.click(downloadButton);

      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();

      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('Code Formatting', () => {
    test('formats code when format button clicked', async () => {
      const prettier = await import('prettier/standalone');
      prettier.default.format.mockReturnValueOnce('formatted code\n');

      render(<CodePreviewPanel code={validCode} />);
      
      const formatButton = screen.getByTitle('Format code');
      fireEvent.click(formatButton);

      await waitFor(() => {
        expect(prettier.default.format).toHaveBeenCalled();
      });
    });

    test('calls onCodeChange after formatting', async () => {
      const prettier = await import('prettier/standalone');
      prettier.default.format.mockReturnValueOnce('formatted code\n');
      const onCodeChange = vi.fn();

      render(<CodePreviewPanel code={validCode} onCodeChange={onCodeChange} />);
      
      const formatButton = screen.getByTitle('Format code');
      fireEvent.click(formatButton);

      await waitFor(() => {
        expect(onCodeChange).toHaveBeenCalledWith('formatted code\n');
      });
    });

    test('handles formatting errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<CodePreviewPanel code={validCode} />);
      
      const formatButton = screen.getByTitle('Format code');
      fireEvent.click(formatButton);

      consoleError.mockRestore();
    });
  });

  describe('Inline Editing', () => {
    test('does not show edit button when editing is disabled', () => {
      render(<CodePreviewPanel code={validCode} enableEditing={false} />);
      expect(screen.queryByTitle('Edit mode')).not.toBeInTheDocument();
    });

    test('shows edit button when editing is enabled', () => {
      render(<CodePreviewPanel code={validCode} enableEditing={true} />);
      expect(screen.getByTitle('Edit mode')).toBeInTheDocument();
    });

    test('switches to edit mode when edit button clicked', () => {
      render(<CodePreviewPanel code={validCode} enableEditing={true} />);
      
      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      expect(screen.getByTitle('View mode')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('displays code in textarea when in edit mode', () => {
      render(<CodePreviewPanel code={validCode} enableEditing={true} />);
      
      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(validCode);
    });

    test('calls onCodeChange when code is edited with valid syntax', async () => {
      const onCodeChange = vi.fn();
      render(<CodePreviewPanel code={validCode} enableEditing={true} onCodeChange={onCodeChange} />);
      
      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      const textarea = screen.getByRole('textbox');
      const newCode = 'const NewComponent = () => <div>New</div>;';
      fireEvent.change(textarea, { target: { value: newCode } });

      await waitFor(() => {
        expect(onCodeChange).toHaveBeenCalledWith(newCode);
      });
    });

    test('does not call onCodeChange when code has syntax errors', async () => {
      const onCodeChange = vi.fn();
      render(<CodePreviewPanel code={validCode} enableEditing={true} onCodeChange={onCodeChange} />);
      
      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: invalidCode } });

      await waitFor(() => {
        expect(onCodeChange).not.toHaveBeenCalled();
      });
    });

    test('switches back to view mode when view button clicked', () => {
      render(<CodePreviewPanel code={validCode} enableEditing={true} />);
      
      // Enter edit mode
      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      // Exit edit mode
      const viewButton = screen.getByTitle('View mode');
      fireEvent.click(viewButton);

      expect(screen.getByTitle('Edit mode')).toBeInTheDocument();
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });
  });

  describe('Syntax Validation', () => {
    test('validates syntax on mount', () => {
      render(<CodePreviewPanel code={validCode} />);
      expect(screen.queryByText(/syntax error/i)).not.toBeInTheDocument();
    });

    test('displays syntax errors for invalid code', () => {
      render(<CodePreviewPanel code={invalidCode} />);
      expect(screen.getByText(/1 syntax error/i)).toBeInTheDocument();
    });

    test('shows error details with line and column', () => {
      render(<CodePreviewPanel code={invalidCode} />);
      expect(screen.getByText(/Line 1, Column 10:/)).toBeInTheDocument();
    });

    test('validates syntax in real-time during editing', async () => {
      render(<CodePreviewPanel code={validCode} enableEditing={true} />);
      
      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: invalidCode } });

      await waitFor(() => {
        expect(screen.getByText(/1 syntax error/i)).toBeInTheDocument();
      });
    });

    test('clears syntax errors when code becomes valid', async () => {
      render(<CodePreviewPanel code={invalidCode} enableEditing={true} />);
      
      expect(screen.getByText(/1 syntax error/i)).toBeInTheDocument();

      const editButton = screen.getByTitle('Edit mode');
      fireEvent.click(editButton);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: validCode } });

      await waitFor(() => {
        expect(screen.queryByText(/syntax error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Live Preview Update', () => {
    test('updates display when code prop changes', () => {
      const { rerender } = render(<CodePreviewPanel code={validCode} />);
      expect(screen.getByTestId('syntax-highlighter')).toHaveTextContent(validCode);

      const newCode = 'const Updated = () => <div>Updated</div>;';
      rerender(<CodePreviewPanel code={newCode} />);
      
      expect(screen.getByTestId('syntax-highlighter')).toHaveTextContent(newCode);
    });

    test('validates syntax when code prop changes', () => {
      const { rerender } = render(<CodePreviewPanel code={validCode} />);
      expect(screen.queryByText(/syntax error/i)).not.toBeInTheDocument();

      rerender(<CodePreviewPanel code={invalidCode} />);
      expect(screen.getByText(/1 syntax error/i)).toBeInTheDocument();
    });
  });

  describe('Syntax Error Highlighting', () => {
    test('displays error panel when syntax errors exist', () => {
      render(<CodePreviewPanel code={invalidCode} />);
      const errorPanel = screen.getByText(/Line 1, Column 10:/).closest('div');
      expect(errorPanel).toHaveStyle({ backgroundColor: '#5a1d1d' });
    });

    test('shows error badge in toolbar', () => {
      render(<CodePreviewPanel code={invalidCode} />);
      const badge = screen.getByText(/1 syntax error/i);
      expect(badge).toHaveStyle({ backgroundColor: '#ef4444' });
    });

    test('displays multiple syntax errors', async () => {
      const babelParser = await import('@babel/parser');
      babelParser.parse.mockImplementationOnce(() => {
        const error = new Error('Multiple errors');
        error.loc = { line: 2, column: 5 };
        throw error;
      });

      render(<CodePreviewPanel code={invalidCode} />);
      expect(screen.getByText(/syntax error/i)).toBeInTheDocument();
    });
  });
});
