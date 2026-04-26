import React, { useState } from 'react';
import {
  StitchPageHeader,
  StitchButton,
  StitchBadge,
} from './components/StitchComponents';

const REPORT_CARDS = [
  {
    type: 'hardening', title: 'System Hardening', format: 'PDF',
    desc: 'Policy compliance, OS versions, and hardening scores across the fleet.',
    audience: 'Security & Platform Teams',
    icon: 'security',
  },
  {
    type: 'compliance', title: 'Compliance Summary', format: 'PDF',
    desc: 'High-level patching status, SLA adherence, and executive risk summary.',
    audience: 'Leadership & Audit',
    icon: 'analytics',
  },
  {
    type: 'full_system', title: 'Full System Audit', format: 'PDF',
    desc: 'Complete raw export of hosts, packages, CVEs, and user activity logs.',
    audience: 'Audit, GRC & Operations',
    icon: 'database',
  },
  {
    type: 'devops', title: 'DevOps Delivery', format: 'PDF',
    desc: 'Pipelines, builds, deployments, artifacts, and standalone readiness.',
    audience: 'DevOps & Release Managers',
    icon: 'terminal',
  },
  {
    type: '__csv__', title: 'Patch Summary', format: 'CSV',
    desc: 'Hostname, IP, OS, compliance, reboot flag, last patch time, and groups.',
    audience: 'Operations & BI Pipelines',
    icon: 'description',
  },
];

export default function ReportsOpsPage({ API, apiFetch, toast }) {
  const [downloading, setDownloading] = useState('');

  const downloadPdf = async type => {
    setDownloading(type);
    try {
      const r = await apiFetch(`${API}/api/reports/download/${type}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.detail || `Download failed (${r.status})`);
      }
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disp = r.headers.get('content-disposition') || '';
      const parsed = disp.includes('filename=')
        ? disp.split('filename=')[1].replace(/"/g, '').trim()
        : `PatchMaster_${type}_Report.pdf`;
      a.href = url; a.download = parsed; a.click();
      window.URL.revokeObjectURL(url);
      if (toast) toast(`${type.replace('_', ' ')} report downloaded`, 'success');
    } catch (e) {
      if (toast) toast(`Report failed: ${e.message}`, 'danger');
    }
    setDownloading('');
  };

  const downloadCsv = async () => {
    setDownloading('__csv__');
    try {
      const r = await apiFetch(`${API}/api/reports/patch-summary.csv`);
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'patch_summary.csv'; a.click();
      window.URL.revokeObjectURL(url);
      if (toast) toast('CSV downloaded', 'success');
    } catch (e) {
      if (toast) toast(`Export failed: ${e.message}`, 'danger');
    }
    setDownloading('');
  };

  return (
    <div className="space-y-8">
      {/* Workspace Distinction Indicator */}
      <div className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30 bg-[#91aaeb]" />
      
      <StitchPageHeader
        kicker="Governance Reporting"
        title="Reports & Exports"
        description="5 professional report formats for audit, leadership, and operations workflows"
        workspace="governance"
      />

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORT_CARDS.map(card => {
          const isLoading = downloading === card.type;
          const isBlocked = !!downloading && !isLoading;

          return (
            <div key={card.type}
              className="bg-[#05183c] p-6 rounded-xl flex flex-col gap-4 transition-all border-t-2 border-[#91aaeb] hover:bg-[#031d4b]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#91aaeb]/10">
                  <span className="material-symbols-outlined text-[#91aaeb]" style={{ fontSize: 20 }}>{card.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#dee5ff]">{card.title}</p>
                  <StitchBadge 
                    variant={card.format === 'PDF' ? 'info' : 'success'} 
                    size="sm"
                  >
                    {card.format}
                  </StitchBadge>
                </div>
              </div>
              <p className="text-xs leading-relaxed flex-1 text-[#91aaeb]">{card.desc}</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3 text-[#91aaeb]">
                  Audience: {card.audience}
                </p>
                <StitchButton
                  variant="primary"
                  size="md"
                  icon={isLoading ? undefined : 'download'}
                  onClick={() => card.type === '__csv__' ? downloadCsv() : downloadPdf(card.type)}
                  disabled={isBlocked}
                  className="w-full justify-center"
                >
                  {isLoading ? 'Preparing...' : `Download ${card.format}`}
                </StitchButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Guide */}
      <div className="bg-[#05183c] p-8 rounded-xl">
        <h2 className="text-2xl font-bold text-[#dee5ff] mb-6">How Teams Use These Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: 'Hardening Report',      tag: 'Technical deep-dive',   desc: 'Platform standards, policy compliance, and remediation planning.' },
            { title: 'Executive Summary',     tag: 'Leadership-ready',       desc: 'Quarterly risk reviews and compliance steering meetings.' },
            { title: 'Full Audit Export',     tag: 'Evidence-grade',         desc: 'Incident support, historical records, and audit evidence trails.' },
            { title: 'CSV Patch Summary',     tag: 'Ops workflow',           desc: 'Spreadsheets, BI tools, and team-level action tracking.' },
            { title: 'DevOps Delivery',       tag: 'DevOps baseline',        desc: 'Release governance, CI/CD health, and deployment throughput.' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-4 p-4 rounded-lg bg-[#031d4b] border border-[#2b4680]/30 hover:border-[#2b4680] transition-colors">
              <div className="flex-1">
                <p className="text-sm font-bold text-[#dee5ff]">{item.title}</p>
                <p className="text-xs mt-1 text-[#91aaeb]">{item.desc}</p>
              </div>
              <StitchBadge variant="info" size="sm">{item.tag}</StitchBadge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
