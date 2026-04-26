import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/parser-babel';
import { parse } from '@babel/parser';

/**
 * CodePreviewPanel - Displays generated JSX/TSX code with syntax highlighting,
 * copy/download actions, and optional inline editing with live validation
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 14.2, 14.3
 */
const CodePreviewPanel = ({ 
  code = '', 
  language = 'jsx',
  enableEditing = false,
  onCodeChange = null,
  fileName = 'component.jsx'
}) => {
  const [displayCode, setDisplayCode] = useState(code);
  const [isEditing, setIsEditing] = useState(false);
  const [syntaxErrors, setSyntaxErrors] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const textareaRef = useRef(null);

  // Update display code when prop changes
  useEffect(() => {
    setDisplayCode(code);
    if (!isEditing) {
      validateSyntax(code);
    }
  }, [code, isEditing]);

  /**
   * Validate JSX syntax using Babel parser
   * Requirements: 14.2, 14.3
   */
  const validateSyntax = useCallback((codeToValidate) => {
    try {
      parse(codeToValidate, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      setSyntaxErrors([]);
      return true;
    } catch (error) {
      const errorInfo = {
        line: error.loc?.line || 0,
        column: error.loc?.column || 0,
        message: error.message
      };
      setSyntaxErrors([errorInfo]);
      return false;
    }
  }, []);

  /**
   * Handle code changes in edit mode
   * Requirements: 6.4, 6.5, 14.2
   */
  const handleCodeEdit = useCallback((e) => {
    const newCode = e.target.value;
    setDisplayCode(newCode);
    
    // Validate syntax in real-time
    const isValid = validateSyntax(newCode);
    
    // Notify parent of changes if validation passes
    if (isValid && onCodeChange) {
      onCodeChange(newCode);
    }
  }, [validateSyntax, onCodeChange]);

  /**
   * Copy code to clipboard
   * Requirements: 6.2
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }, [displayCode]);

  /**
   * Download code as file
   * Requirements: 6.3
   */
  const handleDownload = useCallback(() => {
    const blob = new Blob([displayCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [displayCode, fileName]);

  /**
   * Format code using Prettier
   * Requirements: 6.3
   */
  const handleFormat = useCallback(() => {
    try {
      const formatted = prettier.format(displayCode, {
        parser: 'babel',
        plugins: [parserBabel],
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5'
      });
      setDisplayCode(formatted);
      if (onCodeChange) {
        onCodeChange(formatted);
      }
    } catch (error) {
      console.error('Failed to format code:', error);
    }
  }, [displayCode, onCodeChange]);

  /**
   * Toggle edit mode
   * Requirements: 6.4
   */
  const toggleEditMode = useCallback(() => {
    if (!enableEditing) return;
    
    setIsEditing(prev => !prev);
    
    // Focus textarea when entering edit mode
    if (!isEditing) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [enableEditing, isEditing]);

  return (
    <div className="code-preview-panel" style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.fileName}>{fileName}</span>
          {syntaxErrors.length > 0 && (
            <span style={styles.errorBadge}>
              {syntaxErrors.length} syntax error{syntaxErrors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <div style={styles.toolbarRight}>
          {enableEditing && (
            <button 
              onClick={toggleEditMode}
              style={styles.button}
              title={isEditing ? 'View mode' : 'Edit mode'}
            >
              {isEditing ? '👁️ View' : '✏️ Edit'}
            </button>
          )}
          
          <button 
            onClick={handleFormat}
            style={styles.button}
            title="Format code"
          >
            ✨ Format
          </button>
          
          <button 
            onClick={handleCopy}
            style={styles.button}
            title="Copy to clipboard"
          >
            {copySuccess ? '✓ Copied!' : '📋 Copy'}
          </button>
          
          <button 
            onClick={handleDownload}
            style={styles.button}
            title="Download file"
          >
            💾 Download
          </button>
        </div>
      </div>

      {/* Syntax Errors Display */}
      {syntaxErrors.length > 0 && (
        <div style={styles.errorPanel}>
          {syntaxErrors.map((error, index) => (
            <div key={index} style={styles.errorMessage}>
              <strong>Line {error.line}, Column {error.column}:</strong> {error.message}
            </div>
          ))}
        </div>
      )}

      {/* Code Display/Editor */}
      <div style={styles.codeContainer}>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={displayCode}
            onChange={handleCodeEdit}
            style={styles.textarea}
            spellCheck={false}
          />
        ) : (
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            showLineNumbers={true}
            wrapLines={true}
            lineNumberStyle={styles.lineNumber}
            customStyle={styles.syntaxHighlighter}
          >
            {displayCode}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#1e1e1e',
    border: '1px solid #2b2b2b',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #2b2b2b'
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  toolbarRight: {
    display: 'flex',
    gap: '8px'
  },
  fileName: {
    color: '#cccccc',
    fontSize: '13px',
    fontFamily: 'monospace'
  },
  errorBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  button: {
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    transition: 'background-color 0.2s'
  },
  errorPanel: {
    backgroundColor: '#5a1d1d',
    borderBottom: '1px solid #ef4444',
    padding: '8px 12px'
  },
  errorMessage: {
    color: '#f48771',
    fontSize: '12px',
    fontFamily: 'monospace',
    marginBottom: '4px'
  },
  codeContainer: {
    flex: 1,
    overflow: 'auto',
    position: 'relative'
  },
  syntaxHighlighter: {
    margin: 0,
    padding: '16px',
    fontSize: '13px',
    lineHeight: '1.5',
    height: '100%'
  },
  lineNumber: {
    color: '#858585',
    paddingRight: '16px',
    userSelect: 'none'
  },
  textarea: {
    width: '100%',
    height: '100%',
    padding: '16px',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    lineHeight: '1.5',
    resize: 'none',
    tabSize: 2
  }
};

export default CodePreviewPanel;
