import React, { useState } from 'react';
import SideNavBar from './SideNavBar';

/**
 * Example usage of the SideNavBar component
 * 
 * This demonstrates how to integrate the SideNavBar into your application
 * with proper state management and navigation handling.
 */
export function SideNavBarExample() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Example user data
  const user = {
    username: 'Admin User',
    role: 'System Operator',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuNV9XaVZRMa8X7Cwz79bwugrr_4C-FZ_Q46HERytyx-F8vQqMN2rq4mT0dYYivI16y0M0IWlxtCUUwX1ThVi0wT2J1Qzk8IeNByPjqYOgXKdTmAGqo2d813r9jdhEnSZ6mMix7lO5w676BZU6Q6SDfmo0EXroTQVDZtBnX3D9c426DnfWH6aZOxzg5MZUJmfGiKOtIHhzqsvtZHXaWPW9KIlcjx0NrCKVuye1vB3Vde1k0VzEDls_wShP_sQq92SVVJHu0bP-PyE',
  };

  // Example license info
  const licenseInfo = {
    tier: 'Enterprise Tier',
    status: 'active',
  };

  // Navigation handler
  const handleNavigate = (page) => {
    console.log(`Navigating to: ${page}`);
    setCurrentPage(page);
    // In a real app, you would use React Router or similar:
    // navigate(`/${page}`);
  };

  return (
    <div className="min-h-screen bg-[#060e20]">
      <SideNavBar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={user}
        licenseInfo={licenseInfo}
      />
      
      {/* Main content area (offset by sidebar width) */}
      <main className="ml-64 p-8">
        <h1 className="text-2xl font-bold text-[#dee5ff]">
          Current Page: {currentPage}
        </h1>
        <p className="text-[#91aaeb] mt-4">
          Click on the sidebar navigation items to see the active state change.
        </p>
      </main>
    </div>
  );
}

/**
 * Example with minimal props (using defaults)
 */
export function SideNavBarMinimalExample() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <div className="min-h-screen bg-[#060e20]">
      <SideNavBar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={{
          username: 'Guest User',
          role: 'Viewer',
        }}
        licenseInfo={{
          tier: 'Community Edition',
          status: 'active',
        }}
      />
      
      <main className="ml-64 p-8">
        <h1 className="text-2xl font-bold text-[#dee5ff]">
          Minimal Example
        </h1>
      </main>
    </div>
  );
}

export default SideNavBarExample;
