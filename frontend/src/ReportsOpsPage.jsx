import React, { useState } from 'react';
import { CHPage, CHHeader, CHCard, CHLabel, CHBadge, CHBtn, CH } from './CH.jsx';
import { Download, FileText, BarChart2, Shield, Database, Code, RefreshCw } from 'lucide-react';

const REPORT_CARDS = [
  {
    type: 'hardening', title: 'System Hardening', format: 'PDF',
    desc: 'Policy compliance, OS versions, and hardening scores across the fleet.',
    audience: 'Security & Platform Teams',
    icon: Shield, color: CH.accent,
  },
  {
    type: 'compliance', title: 'Compliance Summary', format: 'PDF',
    desc: 'High-level patching status, SLA adherence, and executive risk summary.',
    audience: 'Leadership & Audit',
    icon: BarChart2, color: CH.green,
  },
  {
    type: 'full_system', title: 'Full System Audit', format: 'PDF',
    desc: 'Complete raw export of hosts, packages, CVEs, and user activity logs.',
    audience: 'Audit, GRC & Operations',
    icon: Database, color: '#a78bfa',
  },
  {
    type: 'devops', title: 'DevOps Delivery', format: 'PDF',
    desc: 'Pipelines, builds, deployments, artifacts, and standalone readiness.',
    audience: 'DevOps & Release Managers',
    icon: Code, color: '#60a5fa',
  },
  {
    type: '__csv__', title: 'Patch Summary', format: 'CSV',
    desc: 'Hostname, IP, OS, compliance, reboot flag, last patch time, and groups.',
    audience: 'Operations & BI Pipelines',
    icon: FileText, color: CH.yellow,
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
    <CHPage>
      <CHHeader
        kicker="Governance Reporting"
        title="Reports & Exports"
        subtitle="5 professional report formats for audit, leadership, and operations workflows"
      />

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORT_CARDS.map(card => {
          const Icon = card.icon;
          const isLoading = downloading === card.type;
          const isBlocked = !!downloading && !isLoading;

          return (
            <div key={card.type}
              className="rounded-2xl p-6 flex flex-col gap-4 transition-all"
              style={{
                background: 'rgba(6,18,45,0.7)',
                border: `1px solid ${CH.border}`,
                borderTop: `2px solid ${card.color}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${card.color}18`, color: card.color }}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: CH.text }}>{card.title}</p>
                  <CHBadge color={card.format === 'PDF' ? CH.accent : CH.green}>{card.format}</CHBadge>
                </div>
              </div>
              <p className="text-xs leading-relaxed flex-1" style={{ color: CH.textSub }}>{card.desc}</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: CH.textSub }}>
                  Audience: {card.audience}
                </p>
                <CHBtn
                  variant="primary"
                  disabled={isBlocked || isLoading}
                  onClick={() => card.type === '__csv__' ? downloadCsv() : downloadPdf(card.type)}
                  className="w-full justify-center py-3"
                  style={{ borderTop: `2px solid transparent` }}
                >
                  <Download size={14} className={isLoading ? 'animate-bounce' : ''} />
                  {isLoading ? 'Preparing…' : `Download ${card.format}`}
                </CHBtn>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Guide */}
      <CHCard>
        <CHLabel>How Teams Use These Reports</CHLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {[
            { title: 'Hardening Report',      tag: 'Technical deep-dive',   desc: 'Platform standards, policy compliance, and remediation planning.' },
            { title: 'Executive Summary',     tag: 'Leadership-ready',       desc: 'Quarterly risk reviews and compliance steering meetings.' },
            { title: 'Full Audit Export',     tag: 'Evidence-grade',         desc: 'Incident support, historical records, and audit evidence trails.' },
            { title: 'CSV Patch Summary',     tag: 'Ops workflow',           desc: 'Spreadsheets, BI tools, and team-level action tracking.' },
            { title: 'DevOps Delivery',       tag: 'DevOps baseline',        desc: 'Release governance, CI/CD health, and deployment throughput.' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: CH.text }}>{item.title}</p>
                <p className="text-xs mt-1" style={{ color: CH.textSub }}>{item.desc}</p>
              </div>
              <CHBadge color={CH.accent}>{item.tag}</CHBadge>
            </div>
          ))}
        </div>
      </CHCard>
    </CHPage>
  );
}
