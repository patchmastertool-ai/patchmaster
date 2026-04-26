import React from 'react';
import { StatCard } from './StatCard';

/**
 * StatCard Component Examples
 * 
 * This file demonstrates various usage patterns for the StatCard component
 * based on the Stitch dashboard design reference.
 */

export function StatCardExamples() {
  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">
            StatCard Component Examples
          </h1>
          <p className="text-on-surface-variant">
            Bento Grid metric cards from the Stitch design system
          </p>
        </div>

        {/* Basic Grid - Dashboard Stats */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Dashboard Overview Grid
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              label="Total Hosts"
              value="1,248"
              icon="dns"
              trend={{ value: "+12", label: "since yesterday" }}
              variant="primary"
            />
            
            <StatCard
              label="Online"
              value="1,242"
              icon="sensors"
              trend={{ value: "99.5%", label: "availability" }}
              variant="primary"
            />
            
            <StatCard
              label="Failed Jobs"
              value="3"
              icon="warning"
              trend={{ value: "Critical", label: "response required" }}
              variant="error"
            />
            
            <StatCard
              label="Pending Updates"
              value="156"
              icon="system_update_alt"
              trend={{ value: "24", label: "security patches" }}
              variant="warning"
            />
          </div>
        </section>

        {/* Clickable Cards */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Interactive Cards (with onClick)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Active CVEs"
              value="47"
              icon="security"
              trend={{ value: "12", label: "high severity" }}
              variant="error"
              onClick={() => alert('Navigate to CVE Tracker')}
            />
            
            <StatCard
              label="Backup Jobs"
              value="156"
              icon="backup"
              trend={{ value: "100%", label: "success rate" }}
              variant="success"
              onClick={() => alert('Navigate to Backup Manager')}
            />
            
            <StatCard
              label="CI/CD Pipelines"
              value="23"
              icon="terminal"
              trend={{ value: "5", label: "running now" }}
              variant="primary"
              onClick={() => alert('Navigate to CI/CD')}
            />
          </div>
        </section>

        {/* Cards Without Trends */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Simple Cards (no trend)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              label="Total Users"
              value="42"
              icon="group"
              variant="primary"
            />
            
            <StatCard
              label="Active Policies"
              value="18"
              icon="policy"
              variant="primary"
            />
            
            <StatCard
              label="Monitoring Alerts"
              value="7"
              icon="monitoring"
              variant="warning"
            />
            
            <StatCard
              label="Reports Generated"
              value="234"
              icon="analytics"
              variant="success"
            />
          </div>
        </section>

        {/* All Variants */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            All Variants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              label="Primary Variant"
              value="100"
              icon="dashboard"
              trend={{ value: "+10", label: "increase" }}
              variant="primary"
            />
            
            <StatCard
              label="Success Variant"
              value="99"
              icon="check_circle"
              trend={{ value: "100%", label: "completion" }}
              variant="success"
            />
            
            <StatCard
              label="Error Variant"
              value="5"
              icon="error"
              trend={{ value: "Critical", label: "attention needed" }}
              variant="error"
            />
            
            <StatCard
              label="Warning Variant"
              value="20"
              icon="warning"
              trend={{ value: "5", label: "new today" }}
              variant="warning"
            />
          </div>
        </section>

        {/* Large Numbers */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Large Numbers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Total Patches"
              value="12,456"
              icon="system_update"
              trend={{ value: "+1,234", label: "this month" }}
              variant="primary"
            />
            
            <StatCard
              label="Storage Used"
              value="2.4 TB"
              icon="storage"
              trend={{ value: "78%", label: "capacity" }}
              variant="warning"
            />
            
            <StatCard
              label="API Requests"
              value="1.2M"
              icon="cloud"
              trend={{ value: "+15%", label: "vs last week" }}
              variant="success"
            />
          </div>
        </section>

        {/* Percentage Values */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Percentage Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              label="System Uptime"
              value="99.9%"
              icon="monitoring"
              trend={{ value: "30 days", label: "streak" }}
              variant="success"
            />
            
            <StatCard
              label="Patch Success"
              value="97.5%"
              icon="check_circle"
              trend={{ value: "+2.5%", label: "improvement" }}
              variant="primary"
            />
            
            <StatCard
              label="Disk Usage"
              value="82%"
              icon="storage"
              trend={{ value: "High", label: "cleanup needed" }}
              variant="warning"
            />
            
            <StatCard
              label="Failed Backups"
              value="2.1%"
              icon="backup"
              trend={{ value: "3", label: "hosts affected" }}
              variant="error"
            />
          </div>
        </section>

        {/* Custom Styling */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Custom Styling
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              label="Custom Class"
              value="42"
              icon="star"
              trend={{ value: "Special", label: "metric" }}
              variant="primary"
              className="shadow-lg shadow-primary/20"
            />
            
            <StatCard
              label="Another Custom"
              value="99"
              icon="favorite"
              trend={{ value: "Highlighted", label: "card" }}
              variant="error"
              className="ring-2 ring-error/30"
            />
          </div>
        </section>

        {/* Responsive Grid Examples */}
        <section>
          <h2 className="text-2xl font-bold text-on-surface mb-4">
            Responsive Layouts
          </h2>
          
          {/* 2-column on mobile, 4-column on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Metric 1" value="10" icon="dashboard" variant="primary" />
            <StatCard label="Metric 2" value="20" icon="dns" variant="success" />
            <StatCard label="Metric 3" value="30" icon="security" variant="warning" />
            <StatCard label="Metric 4" value="40" icon="backup" variant="error" />
          </div>

          {/* 1-column on mobile, 3-column on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatCard
              label="Large Card 1"
              value="100"
              icon="monitoring"
              trend={{ value: "+10", label: "growth" }}
              variant="primary"
            />
            <StatCard
              label="Large Card 2"
              value="200"
              icon="analytics"
              trend={{ value: "+20", label: "increase" }}
              variant="success"
            />
            <StatCard
              label="Large Card 3"
              value="300"
              icon="settings"
              trend={{ value: "+30", label: "more" }}
              variant="warning"
            />
          </div>
        </section>

      </div>
    </div>
  );
}

export default StatCardExamples;
