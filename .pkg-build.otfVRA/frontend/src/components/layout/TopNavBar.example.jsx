import React, { useState } from 'react';
import { TopNavBar } from './TopNavBar';

/**
 * TopNavBar Component Examples
 * 
 * This file demonstrates various usage scenarios for the TopNavBar component.
 */

export function TopNavBarExamples() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query) => {
    console.log('Search query:', query);
    setSearchQuery(query);
  };

  return (
    <div className="space-y-8 p-8 bg-[#060e20] min-h-screen">
      <h1 className="text-2xl font-bold text-[#dee5ff]">TopNavBar Component Examples</h1>

      {/* Example 1: Active License with Notifications */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#7bd0ff]">Example 1: Active License with Notifications</h2>
        <p className="text-sm text-[#91aaeb]">Standard header with active license and 3 unread notifications</p>
        <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
          <TopNavBar
            pageTitle="Dashboard"
            pageIcon="dashboard"
            onSearch={handleSearch}
            notificationCount={3}
            licenseStatus={{
              active: true,
              label: 'License Active',
            }}
          />
        </div>
      </div>

      {/* Example 2: Expired License */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#7bd0ff]">Example 2: Expired License</h2>
        <p className="text-sm text-[#91aaeb]">Header showing expired license status with error styling</p>
        <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
          <TopNavBar
            pageTitle="Dashboard"
            pageIcon="dashboard"
            onSearch={handleSearch}
            notificationCount={0}
            licenseStatus={{
              active: false,
              label: 'License Expired',
            }}
          />
        </div>
      </div>

      {/* Example 3: No Notifications */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#7bd0ff]">Example 3: No Notifications</h2>
        <p className="text-sm text-[#91aaeb]">Header without notification badge (count = 0)</p>
        <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
          <TopNavBar
            pageTitle="Hosts"
            pageIcon="dns"
            onSearch={handleSearch}
            notificationCount={0}
            licenseStatus={{
              active: true,
              label: 'License Active',
            }}
          />
        </div>
      </div>

      {/* Example 4: Many Notifications */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#7bd0ff]">Example 4: Many Notifications</h2>
        <p className="text-sm text-[#91aaeb]">Header with high notification count</p>
        <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
          <TopNavBar
            pageTitle="CVE Tracker"
            pageIcon="security"
            onSearch={handleSearch}
            notificationCount={15}
            licenseStatus={{
              active: true,
              label: 'License Active',
            }}
          />
        </div>
      </div>

      {/* Example 5: No License Status */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#7bd0ff]">Example 5: No License Status</h2>
        <p className="text-sm text-[#91aaeb]">Header without license status information (shows default)</p>
        <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
          <TopNavBar
            pageTitle="Settings"
            pageIcon="settings"
            onSearch={handleSearch}
            notificationCount={1}
            licenseStatus={undefined}
          />
        </div>
      </div>

      {/* Example 6: Different Page Contexts */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#7bd0ff]">Example 6: Different Page Contexts</h2>
        <p className="text-sm text-[#91aaeb]">Headers for various pages in the application</p>
        
        <div className="space-y-4">
          <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
            <TopNavBar
              pageTitle="Patch Manager"
              pageIcon="system_update"
              onSearch={handleSearch}
              notificationCount={2}
              licenseStatus={{ active: true, label: 'License Active' }}
            />
          </div>
          
          <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
            <TopNavBar
              pageTitle="CI/CD Pipelines"
              pageIcon="terminal"
              onSearch={handleSearch}
              notificationCount={0}
              licenseStatus={{ active: true, label: 'License Active' }}
            />
          </div>
          
          <div className="relative h-20 bg-[#06122d] rounded-lg overflow-hidden">
            <TopNavBar
              pageTitle="Backup & DR"
              pageIcon="backup"
              onSearch={handleSearch}
              notificationCount={5}
              licenseStatus={{ active: true, label: 'License Active' }}
            />
          </div>
        </div>
      </div>

      {/* Search Query Display */}
      {searchQuery && (
        <div className="p-4 bg-[#05183c] rounded-lg border border-[#2b4680]">
          <p className="text-sm text-[#dee5ff]">
            Current search query: <span className="font-bold text-[#7bd0ff]">{searchQuery}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default TopNavBarExamples;
