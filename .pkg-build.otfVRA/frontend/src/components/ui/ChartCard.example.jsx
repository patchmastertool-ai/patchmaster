import React from 'react';
import { ChartCard } from './ChartCard';

/**
 * ChartCard Component Examples
 * 
 * This file demonstrates various usage patterns for the ChartCard component.
 */

export function ChartCardExamples() {
  return (
    <div className="p-8 space-y-8 bg-[#060e20] min-h-screen">
      <h1 className="text-3xl font-bold text-[#dee5ff] mb-8">ChartCard Examples</h1>

      {/* Example 1: Basic chart card with title only */}
      <div>
        <h2 className="text-xl text-[#dee5ff] mb-4">Basic Chart Card</h2>
        <ChartCard title="System Performance">
          <div className="h-64 flex items-center justify-center text-[#91aaeb]">
            Chart visualization goes here
          </div>
        </ChartCard>
      </div>

      {/* Example 2: Chart card with subtitle */}
      <div>
        <h2 className="text-xl text-[#dee5ff] mb-4">With Subtitle</h2>
        <ChartCard 
          title="Network Traffic" 
          subtitle="Last 24 Hours"
        >
          <div className="h-64 flex items-center justify-center text-[#91aaeb]">
            Network chart visualization
          </div>
        </ChartCard>
      </div>

      {/* Example 3: Chart card with legend */}
      <div>
        <h2 className="text-xl text-[#dee5ff] mb-4">With Legend</h2>
        <ChartCard
          title="CPU & Memory Usage"
          legend={[
            { label: 'CPU Usage', color: '#7bd0ff' },
            { label: 'Memory Usage', color: '#a2dcff' },
          ]}
        >
          <div className="h-64 flex items-center justify-center text-[#91aaeb]">
            Multi-series chart visualization
          </div>
        </ChartCard>
      </div>

      {/* Example 4: Chart card with actions */}
      <div>
        <h2 className="text-xl text-[#dee5ff] mb-4">With Actions</h2>
        <ChartCard
          title="Storage Capacity"
          actions={
            <>
              <button className="px-3 py-1.5 text-xs text-[#7bd0ff] hover:text-[#dee5ff] transition-colors">
                Filter
              </button>
              <button className="px-3 py-1.5 text-xs text-[#7bd0ff] hover:text-[#dee5ff] transition-colors">
                Export
              </button>
            </>
          }
        >
          <div className="h-64 flex items-center justify-center text-[#91aaeb]">
            Storage chart visualization
          </div>
        </ChartCard>
      </div>

      {/* Example 5: Complete chart card with all features */}
      <div>
        <h2 className="text-xl text-[#dee5ff] mb-4">Complete Example</h2>
        <ChartCard
          title="Infrastructure Metrics"
          subtitle="Real-time Monitoring"
          legend={[
            { label: 'Inbound Traffic', color: '#7bd0ff' },
            { label: 'Outbound Traffic', color: '#ffd16f' },
            { label: 'Error Rate', color: '#ee7d77' },
          ]}
          actions={
            <>
              <button className="px-3 py-1.5 text-xs bg-[#05183c] text-[#7bd0ff] rounded hover:bg-[#031d4b] transition-colors">
                Last 24h
              </button>
              <button className="px-3 py-1.5 text-xs text-[#7bd0ff] hover:text-[#dee5ff] transition-colors">
                Export CSV
              </button>
            </>
          }
        >
          <div className="h-80 flex items-center justify-center text-[#91aaeb]">
            Complex multi-metric chart visualization
          </div>
        </ChartCard>
      </div>

      {/* Example 6: Chart card with SVG content */}
      <div>
        <h2 className="text-xl text-[#dee5ff] mb-4">With SVG Chart</h2>
        <ChartCard
          title="Response Time Distribution"
          subtitle="Last Hour"
          legend={[
            { label: 'P50', color: '#7bd0ff' },
            { label: 'P95', color: '#ffd16f' },
            { label: 'P99', color: '#ee7d77' },
          ]}
        >
          <div className="h-64 relative">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              {/* Simple bar chart example */}
              <rect x="20" y="100" width="40" height="100" fill="#7bd0ff" opacity="0.6" />
              <rect x="80" y="80" width="40" height="120" fill="#7bd0ff" opacity="0.6" />
              <rect x="140" y="60" width="40" height="140" fill="#7bd0ff" opacity="0.6" />
              <rect x="200" y="90" width="40" height="110" fill="#7bd0ff" opacity="0.6" />
              <rect x="260" y="120" width="40" height="80" fill="#7bd0ff" opacity="0.6" />
              <rect x="320" y="140" width="40" height="60" fill="#7bd0ff" opacity="0.6" />
            </svg>
          </div>
        </ChartCard>
      </div>

      {/* Example 7: Narrow chart card */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl text-[#dee5ff] mb-4">Compact Layout</h2>
          <ChartCard
            title="Active Hosts"
            legend={[
              { label: 'Online', color: '#7bd0ff' },
              { label: 'Offline', color: '#ee7d77' },
            ]}
          >
            <div className="h-48 flex items-center justify-center text-[#91aaeb]">
              Compact chart
            </div>
          </ChartCard>
        </div>
        <div>
          <h2 className="text-xl text-[#dee5ff] mb-4">Compact Layout</h2>
          <ChartCard
            title="Patch Status"
            legend={[
              { label: 'Patched', color: '#7bd0ff' },
              { label: 'Pending', color: '#ffd16f' },
            ]}
          >
            <div className="h-48 flex items-center justify-center text-[#91aaeb]">
              Compact chart
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

export default ChartCardExamples;
