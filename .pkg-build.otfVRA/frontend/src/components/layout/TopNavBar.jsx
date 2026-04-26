import React, { useState } from 'react';
/**
 * Legacy page-level shell component.
 *
 * The live Stitch replica top bar is rendered once in App.js for the whole app.
 * Older page modules still import this component, so we keep the export in place
 * and intentionally render nothing to avoid duplicate headers.
 */
export function TopNavBar() {
  return null;
}

export default TopNavBar;
