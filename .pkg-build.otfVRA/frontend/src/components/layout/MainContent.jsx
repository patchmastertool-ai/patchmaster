import React from 'react';

/**
 * MainContent - Main content wrapper component
 * 
 * This component provides the main content area wrapper that works with
 * SideNavBar (task 2.1) and TopNavBar (task 2.3) to create the complete
 * layout shell for all pages.
 * 
 * Layout Structure:
 * - Used only as a content wrapper inside the global App.js Stitch shell
 * - No sidebar/header offsets here
 * - Keeps a consistent max-width container when requested
 * 
 * Requirements: 2.3, 2.4, 2.6
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Page content to render
 * @param {string} [props.maxWidth] - Optional max-width constraint (e.g., 'max-w-7xl')
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element} Main content wrapper
 */
const MainContent = ({ children, maxWidth, className = '' }) => {
  return (
    <section className={`w-full ${className}`}>
      {maxWidth ? (
        <div className={`${maxWidth} mx-auto`}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
};

export default MainContent;
