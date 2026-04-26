import React from 'react';
import MainContent from './MainContent';
import SideNavBar from './SideNavBar';
import TopNavBar from './TopNavBar';

/**
 * MainContent Component Examples
 * 
 * This file demonstrates various usage patterns for the MainContent component.
 */

// Example 1: Basic Usage
export const BasicExample = () => {
  return (
    <MainContent>
      <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Dashboard</h1>
      <p className="text-[#91aaeb]">
        This is the basic usage of MainContent with simple content.
      </p>
    </MainContent>
  );
};

// Example 2: With Max-Width Container
export const MaxWidthExample = () => {
  return (
    <MainContent maxWidth="max-w-7xl">
      <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Centered Content</h1>
      <p className="text-[#91aaeb]">
        This content is centered with a max-width of 1280px (max-w-7xl).
      </p>
    </MainContent>
  );
};

// Example 3: With Additional Classes
export const AdditionalClassesExample = () => {
  return (
    <MainContent className="pb-16">
      <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Extra Padding</h1>
      <p className="text-[#91aaeb]">
        This example adds extra bottom padding using the className prop.
      </p>
    </MainContent>
  );
};

// Example 4: Complete Layout Shell
export const CompleteLayoutExample = () => {
  const mockUser = {
    username: 'admin',
    role: 'Administrator',
    avatar: null
  };

  const mockLicenseInfo = {
    tier: 'Enterprise',
    status: 'active'
  };

  const handleNavigate = (page) => {
    console.log('Navigate to:', page);
  };

  const handleSearch = (query) => {
    console.log('Search:', query);
  };

  return (
    <>
      <SideNavBar
        currentPage="dashboard"
        onNavigate={handleNavigate}
        user={mockUser}
        licenseInfo={mockLicenseInfo}
      />
      <TopNavBar
        pageTitle="Dashboard"
        pageIcon="dashboard"
        onSearch={handleSearch}
        notificationCount={5}
        licenseStatus={{ active: true, label: 'Active' }}
      />
      <MainContent>
        <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stat cards would go here */}
          <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#7bd0ff]">
            <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Total Hosts</p>
            <p className="text-[#dee5ff] text-4xl font-bold mt-2">1,234</p>
          </div>
          <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#7bd0ff]">
            <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Patches Available</p>
            <p className="text-[#dee5ff] text-4xl font-bold mt-2">567</p>
          </div>
          <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#ffd16f]">
            <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Pending Updates</p>
            <p className="text-[#dee5ff] text-4xl font-bold mt-2">89</p>
          </div>
          <div className="bg-[#05183c] p-6 rounded-xl border-t-2 border-[#ee7d77]">
            <p className="text-[#91aaeb] text-xs uppercase tracking-wider font-bold">Critical CVEs</p>
            <p className="text-[#dee5ff] text-4xl font-bold mt-2">12</p>
          </div>
        </div>
      </MainContent>
    </>
  );
};

// Example 5: Long Scrollable Content
export const ScrollableContentExample = () => {
  return (
    <MainContent>
      <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Scrollable Content</h1>
      <p className="text-[#91aaeb] mb-4">
        This example demonstrates the scrollable behavior when content exceeds viewport height.
      </p>
      {Array.from({ length: 50 }, (_, i) => (
        <div key={i} className="bg-[#05183c] p-4 rounded-lg mb-4">
          <p className="text-[#dee5ff]">Content Block {i + 1}</p>
          <p className="text-[#91aaeb] text-sm">
            This is a sample content block to demonstrate scrolling behavior.
          </p>
        </div>
      ))}
    </MainContent>
  );
};

// Example 6: Responsive Max-Width
export const ResponsiveMaxWidthExample = () => {
  return (
    <MainContent maxWidth="max-w-full md:max-w-5xl lg:max-w-7xl">
      <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Responsive Width</h1>
      <p className="text-[#91aaeb]">
        This content uses responsive max-width classes:
        - Full width on mobile
        - max-w-5xl on tablet (md)
        - max-w-7xl on desktop (lg)
      </p>
    </MainContent>
  );
};

// Example 7: Grid Layout
export const GridLayoutExample = () => {
  return (
    <MainContent maxWidth="max-w-7xl">
      <h1 className="text-4xl font-bold text-[#dee5ff] mb-6">Grid Layout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-[#05183c] p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Main Content</h2>
            <p className="text-[#91aaeb]">
              This is the main content area taking up 2/3 of the width on large screens.
            </p>
          </div>
        </div>
        <div>
          <div className="bg-[#05183c] p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-[#dee5ff] mb-4">Sidebar</h2>
            <p className="text-[#91aaeb]">
              This is a sidebar taking up 1/3 of the width on large screens.
            </p>
          </div>
        </div>
      </div>
    </MainContent>
  );
};

// Default export for Storybook or demo pages
export default {
  BasicExample,
  MaxWidthExample,
  AdditionalClassesExample,
  CompleteLayoutExample,
  ScrollableContentExample,
  ResponsiveMaxWidthExample,
  GridLayoutExample
};
