import React, { useState } from 'react';
import { ActionButton } from './ActionButton';

/**
 * ActionButton Component Examples
 * 
 * This file demonstrates various use cases for the ActionButton component
 * including all variants, states, and icon combinations.
 */

export function ActionButtonExamples() {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const handleClick = () => {
    console.log('Button clicked!');
  };

  const handleLoadingClick = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="p-8 bg-[#060e20] min-h-screen">
      <h1 className="text-2xl font-bold text-[#dee5ff] mb-8">ActionButton Examples</h1>

      {/* Variants */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">Variants</h2>
        <div className="flex flex-wrap gap-4">
          <ActionButton 
            label="Primary Button" 
            onClick={handleClick}
            variant="primary"
          />
          <ActionButton 
            label="Secondary Button" 
            onClick={handleClick}
            variant="secondary"
          />
          <ActionButton 
            label="Tertiary Button" 
            onClick={handleClick}
            variant="tertiary"
          />
          <ActionButton 
            label="Danger Button" 
            onClick={handleClick}
            variant="danger"
          />
        </div>
      </section>

      {/* With Icons */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">With Icons</h2>
        <div className="flex flex-wrap gap-4">
          <ActionButton 
            label="Save Changes" 
            onClick={handleClick}
            variant="primary"
            icon="save"
          />
          <ActionButton 
            label="Download Report" 
            onClick={handleClick}
            variant="secondary"
            icon="download"
          />
          <ActionButton 
            label="Edit Settings" 
            onClick={handleClick}
            variant="tertiary"
            icon="edit"
          />
          <ActionButton 
            label="Delete Host" 
            onClick={handleClick}
            variant="danger"
            icon="delete"
          />
        </div>
      </section>

      {/* Common Actions */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">Common Actions</h2>
        <div className="flex flex-wrap gap-4">
          <ActionButton 
            label="Add New" 
            onClick={handleClick}
            variant="primary"
            icon="add"
          />
          <ActionButton 
            label="Refresh" 
            onClick={handleClick}
            variant="secondary"
            icon="refresh"
          />
          <ActionButton 
            label="Upload File" 
            onClick={handleClick}
            variant="secondary"
            icon="upload"
          />
          <ActionButton 
            label="Search" 
            onClick={handleClick}
            variant="tertiary"
            icon="search"
          />
          <ActionButton 
            label="Filter" 
            onClick={handleClick}
            variant="tertiary"
            icon="filter_list"
          />
        </div>
      </section>

      {/* Disabled State */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">Disabled State</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <ActionButton 
            label="Disabled Primary" 
            onClick={handleClick}
            variant="primary"
            disabled
          />
          <ActionButton 
            label="Disabled Secondary" 
            onClick={handleClick}
            variant="secondary"
            disabled
          />
          <ActionButton 
            label="Disabled with Icon" 
            onClick={handleClick}
            variant="primary"
            icon="save"
            disabled
          />
        </div>
        <div className="flex items-center gap-4">
          <ActionButton 
            label={disabled ? "Disabled" : "Enabled"} 
            onClick={handleClick}
            variant="primary"
            disabled={disabled}
          />
          <button
            onClick={() => setDisabled(!disabled)}
            className="px-4 py-2 bg-[#5b74b1]/10 text-[#dee5ff] text-xs font-bold rounded-lg"
          >
            Toggle Disabled
          </button>
        </div>
      </section>

      {/* Loading State */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">Loading State</h2>
        <div className="flex flex-wrap gap-4">
          <ActionButton 
            label="Processing..." 
            onClick={() => {}}
            variant="primary"
            loading
          />
          <ActionButton 
            label="Loading..." 
            onClick={() => {}}
            variant="secondary"
            loading
          />
          <ActionButton 
            label="Click to Load" 
            onClick={handleLoadingClick}
            variant="primary"
            loading={loading}
          />
        </div>
      </section>

      {/* Button Groups */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">Button Groups</h2>
        
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[#91aaeb] mb-3">Form Actions</h3>
          <div className="flex gap-3">
            <ActionButton 
              label="Save" 
              onClick={handleClick}
              variant="primary"
              icon="save"
            />
            <ActionButton 
              label="Cancel" 
              onClick={handleClick}
              variant="secondary"
            />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-[#91aaeb] mb-3">Confirmation Dialog</h3>
          <div className="flex gap-3">
            <ActionButton 
              label="Confirm Delete" 
              onClick={handleClick}
              variant="danger"
              icon="delete"
            />
            <ActionButton 
              label="Cancel" 
              onClick={handleClick}
              variant="tertiary"
            />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-[#91aaeb] mb-3">Toolbar Actions</h3>
          <div className="flex gap-2">
            <ActionButton 
              label="Add" 
              onClick={handleClick}
              variant="primary"
              icon="add"
            />
            <ActionButton 
              label="Edit" 
              onClick={handleClick}
              variant="secondary"
              icon="edit"
            />
            <ActionButton 
              label="Delete" 
              onClick={handleClick}
              variant="secondary"
              icon="delete"
            />
            <ActionButton 
              label="Refresh" 
              onClick={handleClick}
              variant="tertiary"
              icon="refresh"
            />
          </div>
        </div>
      </section>

      {/* Real-world Examples */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-[#dee5ff] mb-4">Real-world Examples</h2>
        
        <div className="bg-[#06122d] p-6 rounded-xl mb-4">
          <h3 className="text-sm font-medium text-[#91aaeb] mb-4">Host Management</h3>
          <div className="flex gap-3">
            <ActionButton 
              label="Add Host" 
              onClick={handleClick}
              variant="primary"
              icon="add"
            />
            <ActionButton 
              label="Bulk Patch" 
              onClick={handleClick}
              variant="secondary"
              icon="system_update"
            />
            <ActionButton 
              label="Export List" 
              onClick={handleClick}
              variant="tertiary"
              icon="download"
            />
          </div>
        </div>

        <div className="bg-[#06122d] p-6 rounded-xl mb-4">
          <h3 className="text-sm font-medium text-[#91aaeb] mb-4">CVE Tracker</h3>
          <div className="flex gap-3">
            <ActionButton 
              label="Scan Now" 
              onClick={handleClick}
              variant="primary"
              icon="security"
            />
            <ActionButton 
              label="Generate Report" 
              onClick={handleClick}
              variant="secondary"
              icon="analytics"
            />
            <ActionButton 
              label="Filter CVEs" 
              onClick={handleClick}
              variant="tertiary"
              icon="filter_list"
            />
          </div>
        </div>

        <div className="bg-[#06122d] p-6 rounded-xl">
          <h3 className="text-sm font-medium text-[#91aaeb] mb-4">Backup Manager</h3>
          <div className="flex gap-3">
            <ActionButton 
              label="Create Backup" 
              onClick={handleClick}
              variant="primary"
              icon="backup"
            />
            <ActionButton 
              label="Restore" 
              onClick={handleClick}
              variant="secondary"
              icon="restart_alt"
            />
            <ActionButton 
              label="Delete Backup" 
              onClick={handleClick}
              variant="danger"
              icon="delete"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ActionButtonExamples;
