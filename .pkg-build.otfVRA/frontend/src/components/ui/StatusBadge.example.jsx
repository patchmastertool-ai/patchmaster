import React from 'react';
import { StatusBadge } from './StatusBadge';

/**
 * StatusBadge Component Examples
 * 
 * This file demonstrates various usage patterns for the StatusBadge component.
 */

export function StatusBadgeExamples() {
  return (
    <div className="p-8 bg-background min-h-screen">
      <h1 className="text-2xl font-bold text-on-surface mb-8">StatusBadge Component Examples</h1>

      {/* Status Variants */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-on-surface mb-4">Status Variants</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <StatusBadge status="success" label="Active" />
          <StatusBadge status="warning" label="Warning" />
          <StatusBadge status="error" label="Failed" />
          <StatusBadge status="info" label="Info" />
          <StatusBadge status="pending" label="Pending" />
        </div>
      </section>

      {/* Size Variants */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-on-surface mb-4">Size Variants</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <StatusBadge status="success" label="Small" size="sm" />
          <StatusBadge status="success" label="Medium" size="md" />
          <StatusBadge status="success" label="Large" size="lg" />
        </div>
      </section>

      {/* Real-World Examples */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-on-surface mb-4">Real-World Examples</h2>
        
        {/* Host Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-on-surface-variant mb-2">Host Status</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="success" label="Online" />
            <StatusBadge status="error" label="Offline" />
            <StatusBadge status="warning" label="Degraded" />
            <StatusBadge status="pending" label="Rebooting" />
          </div>
        </div>

        {/* Patch Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-on-surface-variant mb-2">Patch Status</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="success" label="Patched" />
            <StatusBadge status="warning" label="Outdated" />
            <StatusBadge status="error" label="Vulnerable" />
            <StatusBadge status="info" label="Up to Date" />
          </div>
        </div>

        {/* Job Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-on-surface-variant mb-2">Job Status</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="success" label="Completed" />
            <StatusBadge status="pending" label="Running" />
            <StatusBadge status="error" label="Failed" />
            <StatusBadge status="info" label="Queued" />
          </div>
        </div>

        {/* CVE Severity */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-on-surface-variant mb-2">CVE Severity</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="error" label="Critical" size="lg" />
            <StatusBadge status="error" label="High" />
            <StatusBadge status="warning" label="Medium" />
            <StatusBadge status="info" label="Low" />
          </div>
        </div>

        {/* License Status */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-on-surface-variant mb-2">License Status</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="success" label="Enterprise" />
            <StatusBadge status="info" label="Professional" />
            <StatusBadge status="warning" label="Trial" />
            <StatusBadge status="error" label="Expired" />
          </div>
        </div>
      </section>

      {/* In Context Examples */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-on-surface mb-4">In Context Examples</h2>
        
        {/* Table Row Example */}
        <div className="bg-surface-container-low rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-on-surface">web-server-01</div>
              <div className="text-xs text-on-surface-variant">192.168.1.100</div>
            </div>
            <StatusBadge status="success" label="Online" />
          </div>
        </div>

        {/* Card Header Example */}
        <div className="bg-surface-container-low rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-on-surface">Patch Job #1234</h3>
            <StatusBadge status="pending" label="In Progress" />
          </div>
          <p className="text-sm text-on-surface-variant">
            Applying security updates to 24 hosts...
          </p>
        </div>
      </section>

      {/* Custom Styling */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-on-surface mb-4">Custom Styling</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <StatusBadge status="success" label="Custom" className="ml-4" />
          <StatusBadge status="error" label="Margin" className="mr-4" />
          <StatusBadge status="info" label="Aligned" className="self-start" />
        </div>
      </section>
    </div>
  );
}

export default StatusBadgeExamples;
