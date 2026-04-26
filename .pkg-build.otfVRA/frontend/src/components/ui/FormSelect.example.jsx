import React from 'react';
import { FormSelect } from './FormSelect';

/**
 * FormSelect Component Examples
 * 
 * This file demonstrates various usage patterns for the FormSelect component.
 */

export function FormSelectExamples() {
  const [os, setOs] = React.useState('');
  const [packageManager, setPackageManager] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [region, setRegion] = React.useState('');
  const [patchPolicy, setPatchPolicy] = React.useState('');
  const [backupFrequency, setBackupFrequency] = React.useState('');
  const [maintenanceWindow, setMaintenanceWindow] = React.useState('');

  // Basic options
  const osOptions = [
    { value: 'ubuntu', label: 'Ubuntu' },
    { value: 'debian', label: 'Debian' },
    { value: 'centos', label: 'CentOS' },
    { value: 'rhel', label: 'Red Hat Enterprise Linux' },
    { value: 'fedora', label: 'Fedora' },
    { value: 'arch', label: 'Arch Linux' },
  ];

  // Grouped options
  const packageManagerOptions = [
    { value: 'apt', label: 'APT (Advanced Package Tool)', group: 'Debian-based' },
    { value: 'dpkg', label: 'DPKG (Debian Package)', group: 'Debian-based' },
    { value: 'yum', label: 'YUM (Yellowdog Updater Modified)', group: 'RedHat-based' },
    { value: 'dnf', label: 'DNF (Dandified YUM)', group: 'RedHat-based' },
    { value: 'rpm', label: 'RPM (Red Hat Package Manager)', group: 'RedHat-based' },
    { value: 'pacman', label: 'Pacman', group: 'Arch-based' },
    { value: 'zypper', label: 'Zypper', group: 'SUSE-based' },
  ];

  const priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const regionOptions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)', group: 'Americas' },
    { value: 'us-west-2', label: 'US West (Oregon)', group: 'Americas' },
    { value: 'ca-central-1', label: 'Canada (Central)', group: 'Americas' },
    { value: 'eu-west-1', label: 'Europe (Ireland)', group: 'Europe' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)', group: 'Europe' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)', group: 'Asia Pacific' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)', group: 'Asia Pacific' },
  ];

  const patchPolicyOptions = [
    { value: 'auto', label: 'Automatic (Apply all patches immediately)' },
    { value: 'scheduled', label: 'Scheduled (Apply during maintenance window)' },
    { value: 'manual', label: 'Manual (Require approval before patching)' },
    { value: 'security-only', label: 'Security Only (Auto-apply security patches)' },
  ];

  const backupFrequencyOptions = [
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const maintenanceWindowOptions = [
    { value: 'weekday-night', label: 'Weekday Nights (Mon-Fri 2:00-4:00 AM)', group: 'Weekday' },
    { value: 'weekday-early', label: 'Weekday Early Morning (Mon-Fri 5:00-7:00 AM)', group: 'Weekday' },
    { value: 'saturday-night', label: 'Saturday Night (Sat 2:00-6:00 AM)', group: 'Weekend' },
    { value: 'sunday-night', label: 'Sunday Night (Sun 2:00-6:00 AM)', group: 'Weekend' },
    { value: 'custom', label: 'Custom Schedule', group: 'Custom' },
  ];

  // Validation
  const validateRequired = (value) => {
    return value ? '' : 'This field is required';
  };

  return (
    <div className="p-8 bg-[#060e20] min-h-screen">
      <h1 className="text-2xl font-bold text-[#dee5ff] mb-8">FormSelect Component Examples</h1>

      {/* Basic Select */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Basic Select</h2>
        
        <div className="space-y-4">
          <FormSelect 
            label="Operating System" 
            value={os} 
            onChange={setOs}
            options={osOptions}
          />

          <FormSelect 
            label="Priority Level" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
          />
        </div>
      </section>

      {/* Grouped Options */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Grouped Options (optgroup)</h2>
        
        <div className="space-y-4">
          <FormSelect 
            label="Package Manager" 
            value={packageManager} 
            onChange={setPackageManager}
            options={packageManagerOptions}
          />

          <FormSelect 
            label="Deployment Region" 
            value={region} 
            onChange={setRegion}
            options={regionOptions}
          />
        </div>
      </section>

      {/* Required Fields */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Required Fields</h2>
        
        <div className="space-y-4">
          <FormSelect 
            label="Operating System" 
            value={os} 
            onChange={setOs}
            options={osOptions}
            required
          />

          <FormSelect 
            label="Priority Level" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
            required
          />
        </div>
      </section>

      {/* Error States */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Error States</h2>
        
        <div className="space-y-4">
          <FormSelect 
            label="Operating System" 
            value="" 
            onChange={() => {}}
            options={osOptions}
            error="Please select an operating system"
            required
          />

          <FormSelect 
            label="Package Manager" 
            value="" 
            onChange={() => {}}
            options={packageManagerOptions}
            error="This field is required"
            required
          />
        </div>
      </section>

      {/* Host Configuration Form */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Host Configuration Form</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormSelect 
            label="Operating System" 
            value={os} 
            onChange={setOs}
            options={osOptions}
            required
          />
          
          <FormSelect 
            label="Package Manager" 
            value={packageManager} 
            onChange={setPackageManager}
            options={packageManagerOptions}
            required
          />
          
          <FormSelect 
            label="Priority Level" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
            required
          />

          <button className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            Save Configuration
          </button>
        </div>
      </section>

      {/* Patch Policy Form */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Patch Policy Configuration</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormSelect 
            label="Patch Policy" 
            value={patchPolicy} 
            onChange={setPatchPolicy}
            options={patchPolicyOptions}
            required
          />
          
          <FormSelect 
            label="Maintenance Window" 
            value={maintenanceWindow} 
            onChange={setMaintenanceWindow}
            options={maintenanceWindowOptions}
            required
          />
          
          <FormSelect 
            label="Priority Level" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
          />

          <button className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            Apply Policy
          </button>
        </div>
      </section>

      {/* Backup Configuration */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Backup Configuration</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormSelect 
            label="Backup Frequency" 
            value={backupFrequency} 
            onChange={setBackupFrequency}
            options={backupFrequencyOptions}
            required
          />
          
          <FormSelect 
            label="Backup Region" 
            value={region} 
            onChange={setRegion}
            options={regionOptions}
            required
          />

          <button className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            Configure Backup
          </button>
        </div>
      </section>

      {/* Live Validation */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Live Validation</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormSelect 
            label="Operating System" 
            value={os} 
            onChange={setOs}
            options={osOptions}
            error={validateRequired(os)}
            required
          />
          
          <FormSelect 
            label="Priority Level" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
            error={validateRequired(priority)}
            required
          />

          <button 
            className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!os || !priority}
          >
            Submit
          </button>
        </div>
      </section>

      {/* Multi-Select Form Example */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Complete Configuration Form</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <div className="text-sm text-[#91aaeb] mb-4">
            Configure your host settings
          </div>

          <FormSelect 
            label="Operating System" 
            value={os} 
            onChange={setOs}
            options={osOptions}
            required
          />
          
          <FormSelect 
            label="Package Manager" 
            value={packageManager} 
            onChange={setPackageManager}
            options={packageManagerOptions}
            required
          />
          
          <FormSelect 
            label="Patch Policy" 
            value={patchPolicy} 
            onChange={setPatchPolicy}
            options={patchPolicyOptions}
            required
          />
          
          <FormSelect 
            label="Maintenance Window" 
            value={maintenanceWindow} 
            onChange={setMaintenanceWindow}
            options={maintenanceWindowOptions}
            required
          />
          
          <FormSelect 
            label="Priority Level" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
          />
          
          <FormSelect 
            label="Backup Frequency" 
            value={backupFrequency} 
            onChange={setBackupFrequency}
            options={backupFrequencyOptions}
          />

          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-4 py-2 bg-[#2b4680]/20 text-[#dee5ff] text-xs font-bold rounded-lg border border-[#2b4680]/20 hover:bg-[#2b4680]/30 transition-all">
              Cancel
            </button>
            <button className="flex-1 px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
              Save Configuration
            </button>
          </div>
        </div>
      </section>

      {/* Custom Styling */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Custom Styling</h2>
        
        <div className="space-y-4">
          <FormSelect 
            label="With Custom Margin" 
            value={os} 
            onChange={setOs}
            options={osOptions}
            className="mb-8"
          />

          <FormSelect 
            label="With Custom Padding" 
            value={priority} 
            onChange={setPriority}
            options={priorityOptions}
            className="p-4 bg-[#05183c] rounded-lg"
          />
        </div>
      </section>

      {/* Empty State */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Empty Options</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormSelect 
            label="No Options Available" 
            value="" 
            onChange={() => {}}
            options={[]}
          />
          
          <p className="text-xs text-[#91aaeb]">
            This demonstrates a select with no options (edge case)
          </p>
        </div>
      </section>
    </div>
  );
}

export default FormSelectExamples;
