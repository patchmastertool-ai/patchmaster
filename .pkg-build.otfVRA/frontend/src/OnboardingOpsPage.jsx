import React, { useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
} from './components/StitchComponents';
import { API } from './appRuntime';

export default function OnboardingOpsPage() {
  const [masterIp, setMasterIp]           = useState('');
  const [osTab, setOsTab]                 = useState('linux');
  const [siteName, setSiteName]           = useState('');
  const [copiedTarget, setCopiedTarget]   = useState('');

  useEffect(() => { setMasterIp(window.location.hostname || ''); }, []);

  const frontendOrigin = typeof window !== 'undefined' ? (window.location.origin || 'http://<master-ip>') : 'http://<master-ip>';
  const masterUrl = API ? API.replace(/\/$/, '') : masterIp ? `http://${masterIp}:8000` : 'http://<master-ip>';
  const downloadBase = masterIp ? frontendOrigin : 'http://<master-ip>';
  const linuxPrefix  = siteName ? `PATCHMASTER_SITE="${siteName}" ` : '';
  const windowsSiteArg = siteName ? ` --site "${siteName}"` : '';

  const linuxCmd   = `curl -sS ${downloadBase}/download/install-agent.sh | sudo ${linuxPrefix}MASTER_URL=${masterUrl} bash`;
  const windowsCmd = `cd $env:TEMP\nRemove-Item .\\PatchMaster-Agent-Installer.exe -Force -ErrorAction SilentlyContinue\ncurl.exe -L -o PatchMaster-Agent-Installer.exe "${downloadBase}/download/patchmaster-agent-installer.exe"\n.\\PatchMaster-Agent-Installer.exe --master-url "${masterUrl}" --agent-port 18080${windowsSiteArg}`;

  const manualTracks = [
    { title: 'Debian / Ubuntu',  commands: `curl -fsSL -o agent-latest.deb ${downloadBase}/download/agent-latest.deb\nsudo dpkg -i agent-latest.deb || sudo apt-get install -f -y\n${siteName ? `echo 'PATCHMASTER_SITE=${siteName}' | sudo tee -a /etc/patch-agent/env\n` : ''}sudo systemctl enable --now patch-agent patch-agent-heartbeat` },
    { title: 'RHEL / CentOS',   commands: `curl -fsSL -o agent-latest.rpm ${downloadBase}/download/agent-latest.rpm\nsudo rpm -Uvh agent-latest.rpm || sudo dnf localinstall -y agent-latest.rpm\n${siteName ? `echo 'PATCHMASTER_SITE=${siteName}' | sudo tee -a /etc/patch-agent/env\n` : ''}sudo systemctl enable --now patch-agent patch-agent-heartbeat` },
    { title: 'Windows (CMD)',    commands: `cd %TEMP%\ncurl.exe -L -o PatchMaster-Agent-Installer.exe "${downloadBase}/download/patchmaster-agent-installer.exe"\nPatchMaster-Agent-Installer.exe --master-url "${masterUrl}" --agent-port 18080${windowsSiteArg}` },
  ];

  const verifySnippets = [
    { title: 'Linux validation',   commands: 'sudo systemctl status patch-agent patch-agent-heartbeat\nsudo journalctl -u patch-agent-heartbeat -f' },
    { title: 'Windows validation', commands: 'Get-Service PatchMaster-Agent,PatchMaster-Agent-Heartbeat\ncurl.exe -sS http://127.0.0.1:18080/health\nGet-Content "$env:ProgramData\\PatchMaster-Agent\\logs\\PatchMaster-Agent-Heartbeat.out.log" -Tail 80' },
  ];

  const rolloutChecklist = [
    'Confirm the master address resolves from the target subnet.',
    'Allow outbound HTTPS/HTTP to the PatchMaster download endpoint.',
    'Verify the host appears in Hosts within 60 seconds of install.',
    'Use the Linux and Windows snippets below for first-run validation.',
    'For Windows, use dedicated agent API port 18080 to avoid conflicts.',
  ];

  const copyText = async (label, value) => {
    try { await navigator.clipboard.writeText(value); setCopiedTarget(label); setTimeout(() => setCopiedTarget(''), 1800); } catch {}
  };

  return (
    <div className="space-y-8">
      <StitchPageHeader
        kicker="Onboarding Operations"
        title="Agent Onboarding"
        description={`Master: ${masterIp || '<master-ip>'} | Linux, Windows, and manual package paths`}
      />

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard 
          label="Master Address" 
          value={masterIp || '-'} 
          subtitle="install target"
          icon="dns"
          color="#7bd0ff"
        />
        <StitchSummaryCard 
          label="Install Paths" 
          value={2} 
          subtitle="quick-start"
          icon="rocket_launch"
          color="#10b981"
        />
        <StitchSummaryCard 
          label="Manual Tracks" 
          value={3} 
          subtitle="deb / rpm / exe"
          icon="package_2"
          color="#7bd0ff"
        />
        <StitchSummaryCard 
          label="First Check-in" 
          value="60s" 
          subtitle="expected wait"
          icon="schedule"
          color="#ffd16f"
        />
      </StitchMetricGrid>

      {/* Config panel */}
      <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Deployment Configuration</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#91aaeb] mb-2">Master IP or Hostname</label>
            <input
              className="input w-full bg-[#031d4b] border border-[#2b4680] text-[#dee5ff] px-4 py-2 rounded-lg"
              value={masterIp}
              onChange={(e) => setMasterIp(e.target.value)}
              placeholder="e.g. 10.20.30.40"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#91aaeb] mb-2">Site / Location Tag (optional)</label>
            <input
              className="input w-full bg-[#031d4b] border border-[#2b4680] text-[#dee5ff] px-4 py-2 rounded-lg"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g. Singapore-DC | Mumbai-HQ"
            />
          </div>
        </div>
      </div>

      {/* Quick install */}
      <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Quick Install Command</p>
        <div className="flex gap-2">
          {[{ k: 'linux', l: 'Linux' }, { k: 'windows', l: 'Windows' }].map(t => (
            <button 
              key={t.k} 
              onClick={() => setOsTab(t.k)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                osTab === t.k 
                  ? 'bg-[#7bd0ff]/20 text-[#7bd0ff] border border-[#7bd0ff]/40' 
                  : 'bg-[#031d4b] text-[#91aaeb] border border-[#2b4680]'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
        <div className="rounded-xl overflow-hidden border border-[#2b4680]">
          <div className="flex items-center justify-between px-4 py-2 bg-[#031d4b]">
            <span className="text-xs font-bold uppercase tracking-widest text-[#91aaeb]">
              {osTab === 'linux' ? 'Linux bootstrap command' : 'Windows installer command'}
            </span>
            <StitchButton
              variant="ghost"
              size="sm"
              icon={copiedTarget === osTab ? 'check' : 'content_copy'}
              onClick={() => copyText(osTab, osTab === 'linux' ? linuxCmd : windowsCmd)}
            >
              {copiedTarget === osTab ? 'Copied!' : 'Copy'}
            </StitchButton>
          </div>
          <pre className="px-5 py-4 text-xs font-mono overflow-x-auto bg-black/60 text-[#e2e8f0] whitespace-pre-wrap" style={{ lineHeight: 1.7 }}>
            {osTab === 'linux' ? linuxCmd : windowsCmd}
          </pre>
        </div>
        <p className="text-xs text-[#91aaeb]">
          Installers served from <span className="font-mono">{downloadBase}/download/</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual tracks */}
        <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Manual Package Paths</p>
          {manualTracks.map(track => (
            <div key={track.title} className="rounded-xl overflow-hidden border border-[#2b4680]">
              <div className="flex items-center justify-between px-4 py-2 bg-[#031d4b]">
                <span className="text-xs font-bold text-[#dee5ff]">{track.title}</span>
                <StitchButton
                  variant="ghost"
                  size="sm"
                  icon={copiedTarget === track.title ? 'check' : 'content_copy'}
                  onClick={() => copyText(track.title, track.commands)}
                >
                  {copiedTarget === track.title ? 'Copied' : 'Copy'}
                </StitchButton>
              </div>
              <pre className="px-4 py-3 text-xs font-mono overflow-x-auto bg-black/50 text-[#e2e8f0] border-t border-[#2b4680] whitespace-pre-wrap" style={{ lineHeight: 1.7 }}>
                {track.commands}
              </pre>
            </div>
          ))}
        </div>

        {/* Checklist + verify */}
        <div className="space-y-6">
          <div className="bg-[#05183c] p-6 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">Deployment Readiness Checklist</p>
            <div className="space-y-2">
              {rolloutChecklist.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#031d4b] border border-[#2b4680]">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5 bg-[#4ade80]/15 text-[#4ade80]">
                    {i + 1}
                  </span>
                  <p className="text-xs text-[#91aaeb]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#05183c] p-6 rounded-xl space-y-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Verify First Check-in</p>
            {verifySnippets.map(block => (
              <div key={block.title}>
                <p className="text-xs font-bold mb-2 text-[#91aaeb]">{block.title}</p>
                <pre className="rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto bg-black/50 text-[#e2e8f0] border border-[#2b4680] whitespace-pre-wrap" style={{ lineHeight: 1.7 }}>
                  {block.commands}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
