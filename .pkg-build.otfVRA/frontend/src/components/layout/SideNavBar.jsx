import React from 'react';
/**
 * Legacy page-level shell component.
 *
 * The live Stitch replica shell is now rendered once in App.js for the whole app.
 * Older page modules still import this component, so we keep the export in place
 * and intentionally render nothing to avoid duplicate sidebars.
 */
export function SideNavBar() {
  return null;
}

export default SideNavBar;
