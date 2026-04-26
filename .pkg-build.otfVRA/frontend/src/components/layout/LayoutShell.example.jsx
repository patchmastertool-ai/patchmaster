import React, { useState } from 'react';
import SideNavBar from './SideNavBar';
import TopNavBar from './TopNavBar';
import MainContent from './MainContent';

/**
 * Complete Layout Shell Integration Example
 * 
 * This example demonstrates how SideNavBar (task 2.1), TopNavBar (task 2.3),
 * and MainContent (task 2.5) work together to create the complete layout shell
 * for PatchMaster pages.
 */

export const CompleteLayoutShellExample = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock user data
  const user = {
    username: 'admin',
    role: 'Administrator',
    avatar: null
  };

  // Mock license info
  const licenseInfo = {
    tier: 'Enterprise',
    status: 'active'
  };

  // Mock license status
  const licenseStatus = {
    active: true,
    label: 'Active'
  };

  // Page configuration
  const pageConfig = {
    dashboard: { title: 'Dashboard', icon: 'dashboard' },
    hosts: { title: 'Host Management', icon: 'dns' },
    patching: { title: 'Patch Manager', icon: 'system_update' },
    cicd: { title: 'CI/CD Pipelines', icon: 'terminal' },
    cves: { title: 'CVE Tracker', icon: 'security' },
    backups: { title: 'Backup & DR Manager', icon: 'backup' },
    policies: { title: 'Policy Manager', icon: 'policy' },
    monitoring: { title: 'Monitoring Operations', icon: 'monitoring' },
    reports: { title: 'Reports & Analytics', icon: 'analytics' },
    settings: { title: 'Settings', icon: 'settings' }
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    console.log('Navigate to:', page);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    console.log('Search:', query);
  };

  const currentPageConfig = pageConfig[currentPage] || pageConfig.dashboard;

  return (
    <div className="relative">
      {/* Fixed Sidebar - Task 2.1 */}
      <SideNavBar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={user}
        licenseInfo={licenseInfo}
      />

      {/* Fixed Header - Task 2.3 */}
      <TopNavBar
        pageTitle={currentPageConfig.title}
        pageIcon={currentPageConfig.icon}
        onSearch={handleSearch}
        notificationCount={5}
        licenseStatus={licenseStatus}
      />

      {/* Main Content Area - Task 2.5 */}
      <MainContent>
        <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">
          {currentPageConfig.title}
        </h1>
        
        {/* Sample Dashboard Content */}
        {currentPage === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Stat Cards */}
              <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#7bd0ff] hover:bg-[#031d4b] transition-all duration-300">
                <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Total Hosts</p>
                <p className="text-[#dee5ff] text-4xl font-bold mt-2">1,234</p>
                <p className="text-[#7bd0ff] text-xs mt-2">↑ 12% from last month</p>
              </div>
              
              <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#7bd0ff] hover:bg-[#031d4b] transition-all duration-300">
                <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Patches Available</p>
                <p className="text-[#dee5ff] text-4xl font-bold mt-2">567</p>
                <p className="text-[#7bd0ff] text-xs mt-2">↑ 8% from last week</p>
              </div>
              
              <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#ffd16f] hover:bg-[#031d4b] transition-all duration-300">
                <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Pending Updates</p>
                <p className="text-[#dee5ff] text-4xl font-bold mt-2">89</p>
                <p className="text-[#ffd16f] text-xs mt-2">Requires attention</p>
              </div>
              
              <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#ee7d77] hover:bg-[#031d4b] transition-all duration-300">
                <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Critical CVEs</p>
                <p className="text-[#dee5ff] text-4xl font-bold mt-2">12</p>
                <p className="text-[#ee7d77] text-xs mt-2">↑ 3 new this week</p>
              </div>
            </div>

            {/* Sample Chart Card */}
            <div className="bg-[#05183c] p-8 rounded-xl mb-8">
              <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Patch Deployment Trends</h2>
              <div className="h-64 flex items-center justify-center text-[#91aaeb]">
                [Chart visualization would go here]
              </div>
            </div>

            {/* Sample Table */}
            <div className="bg-[#05183c] p-6 rounded-xl">
              <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Recent Activity</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-[#2b4680]">
                    <tr>
                      <th className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3">Host</th>
                      <th className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3">Action</th>
                      <th className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3">Status</th>
                      <th className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#2b4680]/30 hover:bg-[#031d4b] transition-colors">
                      <td className="px-4 py-3 text-[#dee5ff]">web-server-01</td>
                      <td className="px-4 py-3 text-[#dee5ff]">Patch Deployment</td>
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter bg-[#7bd0ff]/20 text-[#7bd0ff]">
                          Success
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#91aaeb]">2 minutes ago</td>
                    </tr>
                    <tr className="border-b border-[#2b4680]/30 hover:bg-[#031d4b] transition-colors">
                      <td className="px-4 py-3 text-[#dee5ff]">db-server-03</td>
                      <td className="px-4 py-3 text-[#dee5ff]">Security Scan</td>
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter bg-[#ffd16f]/20 text-[#ffd16f]">
                          Pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#91aaeb]">5 minutes ago</td>
                    </tr>
                    <tr className="border-b border-[#2b4680]/30 hover:bg-[#031d4b] transition-colors">
                      <td className="px-4 py-3 text-[#dee5ff]">app-server-02</td>
                      <td className="px-4 py-3 text-[#dee5ff]">Backup</td>
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter bg-[#7bd0ff]/20 text-[#7bd0ff]">
                          Success
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#91aaeb]">15 minutes ago</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Generic page content for other pages */}
        {currentPage !== 'dashboard' && (
          <div className="bg-[#05183c] p-8 rounded-xl">
            <p className="text-[#91aaeb] mb-4">
              This is the {currentPageConfig.title} page content area.
            </p>
            <p className="text-[#91aaeb]">
              The layout shell (sidebar, header, and content wrapper) remains consistent
              across all pages while the content changes based on the current page.
            </p>
          </div>
        )}
      </MainContent>
    </div>
  );
};

/**
 * Layout Shell with Max-Width Content
 */
export const CenteredContentExample = () => {
  const user = {
    username: 'admin',
    role: 'Administrator'
  };

  const licenseInfo = {
    tier: 'Professional',
    status: 'active'
  };

  return (
    <div className="relative">
      <SideNavBar
        currentPage="settings"
        onNavigate={(page) => console.log(page)}
        user={user}
        licenseInfo={licenseInfo}
      />

      <TopNavBar
        pageTitle="Settings"
        pageIcon="settings"
        onSearch={(query) => console.log(query)}
        notificationCount={0}
        licenseStatus={{ active: true, label: 'Active' }}
      />

      <MainContent maxWidth="max-w-5xl">
        <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Settings</h1>
        <div className="bg-[#05183c] p-8 rounded-xl">
          <p className="text-[#91aaeb]">
            This content is centered with a max-width of 1024px (max-w-5xl).
            This is useful for forms and settings pages where you don't want
            content to stretch too wide on large screens.
          </p>
        </div>
      </MainContent>
    </div>
  );
};

/**
 * Layout Shell with Scrollable Content
 */
export const ScrollableContentExample = () => {
  const user = {
    username: 'admin',
    role: 'Administrator'
  };

  const licenseInfo = {
    tier: 'Enterprise',
    status: 'active'
  };

  return (
    <div className="relative">
      <SideNavBar
        currentPage="reports"
        onNavigate={(page) => console.log(page)}
        user={user}
        licenseInfo={licenseInfo}
      />

      <TopNavBar
        pageTitle="Reports"
        pageIcon="analytics"
        onSearch={(query) => console.log(query)}
        notificationCount={2}
        licenseStatus={{ active: true, label: 'Active' }}
      />

      <MainContent>
        <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Reports</h1>
        <p className="text-[#91aaeb] mb-6">
          This example demonstrates scrollable content. The sidebar and header
          remain fixed while the content area scrolls.
        </p>
        
        {/* Generate many content blocks to demonstrate scrolling */}
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="bg-[#05183c] p-6 rounded-xl mb-4">
            <h3 className="text-xl font-bold text-[#dee5ff] mb-2">
              Report {i + 1}
            </h3>
            <p className="text-[#91aaeb]">
              This is a sample report card. Scroll down to see more reports
              while the sidebar and header remain fixed in position.
            </p>
          </div>
        ))}
      </MainContent>
    </div>
  );
};

export default {
  CompleteLayoutShellExample,
  CenteredContentExample,
  ScrollableContentExample
};
