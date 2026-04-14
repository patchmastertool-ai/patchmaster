import React, { useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CH } from './CH.jsx';
import { Copy, Check, Terminal, Monitor } from 'lucide-react';
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

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };
  const codeStyle  = { background: 'rgba(0,0,0,0.5)', color: '#e2e8f0', border: `1px solid ${CH.border}` };

  return (
    <CHPage>
      <CHHeader
        kicker="Onboarding Operations"
        title="Agent Onboarding"
        subtitle={`Master: ${masterIp || '<master-ip>'} · Linux, Windows, and manual package paths`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Master Address" value={masterIp || '—'}  sub="install target"       accent={CH.accent} />
        <CHStat label="Install Paths"  value={2}                sub="quick-start"          accent={CH.green} />
        <CHStat label="Manual Tracks"  value={3}                sub="deb / rpm / exe"      accent="#a78bfa" />
        <CHStat label="First Check-in" value="60s"              sub="expected wait"        accent={CH.yellow} />
      </div>

      {/* Config panel */}
      <CHCard className="space-y-4">
        <CHLabel>Deployment Configuration</CHLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <CHLabel>Master IP or Hostname</CHLabel>
            <input value={masterIp} onChange={e => setMasterIp(e.target.value)} placeholder="e.g. 10.20.30.40"
              className="rounded-lg px-3 py-2.5 text-sm font-mono" style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <CHLabel>Site / Location Tag (optional)</CHLabel>
            <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="e.g. Singapore-DC · Mumbai-HQ"
              className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
          </div>
        </div>
      </CHCard>

      {/* Quick install */}
      <CHCard className="space-y-4">
        <CHLabel>Quick Install Command</CHLabel>
        <div className="flex gap-2">
          {[{ k: 'linux', l: 'Linux' }, { k: 'windows', l: 'Windows' }].map(t => (
            <button key={t.k} onClick={() => setOsTab(t.k)}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              style={{ background: osTab === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', color: osTab === t.k ? CH.accent : CH.textSub, border: `1px solid ${osTab === t.k ? CH.accent + '40' : CH.border}` }}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CH.border}` }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(3,29,75,0.6)' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: CH.textSub }}>
              {osTab === 'linux' ? 'Linux bootstrap command' : 'Windows installer command'}
            </span>
            <CHBtn variant="ghost" onClick={() => copyText(osTab, osTab === 'linux' ? linuxCmd : windowsCmd)}>
              {copiedTarget === osTab ? <Check size={12} color={CH.green} /> : <Copy size={12} />}
              {copiedTarget === osTab ? 'Copied!' : 'Copy'}
            </CHBtn>
          </div>
          <pre className="px-5 py-4 text-xs font-mono overflow-x-auto"
            style={{ ...codeStyle, background: 'rgba(0,0,0,0.6)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {osTab === 'linux' ? linuxCmd : windowsCmd}
          </pre>
        </div>
        <p className="text-xs" style={{ color: CH.textSub }}>
          Installers served from <span className="font-mono">{downloadBase}/download/</span>
        </p>
      </CHCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual tracks */}
        <CHCard className="space-y-4">
          <CHLabel>Manual Package Paths</CHLabel>
          {manualTracks.map(track => (
            <div key={track.title} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CH.border}` }}>
              <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(3,29,75,0.5)' }}>
                <span className="text-xs font-bold" style={{ color: CH.text }}>{track.title}</span>
                <CHBtn variant="ghost" onClick={() => copyText(track.title, track.commands)}>
                  {copiedTarget === track.title ? <Check size={12} color={CH.green} /> : <Copy size={12} />}
                  {copiedTarget === track.title ? 'Copied' : 'Copy'}
                </CHBtn>
              </div>
              <pre className="px-4 py-3 text-xs font-mono overflow-x-auto"
                style={{ ...codeStyle, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {track.commands}
              </pre>
            </div>
          ))}
        </CHCard>

        {/* Checklist + verify */}
        <div className="space-y-6">
          <CHCard>
            <CHLabel>Deployment Readiness Checklist</CHLabel>
            <div className="mt-4 space-y-2">
              {rolloutChecklist.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                  <span className="w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5"
                    style={{ background: `${CH.green}15`, color: CH.green }}>{i + 1}</span>
                  <p className="text-xs" style={{ color: CH.textSub }}>{item}</p>
                </div>
              ))}
            </div>
          </CHCard>

          <CHCard className="space-y-4">
            <CHLabel>Verify First Check-in</CHLabel>
            {verifySnippets.map(block => (
              <div key={block.title}>
                <p className="text-xs font-bold mb-2" style={{ color: CH.textSub }}>{block.title}</p>
                <pre className="rounded-xl px-4 py-3 text-xs font-mono overflow-x-auto"
                  style={{ ...codeStyle, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {block.commands}
                </pre>
              </div>
            ))}
          </CHCard>
        </div>
      </div>
    </CHPage>
  );
}
