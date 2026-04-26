import React, { useEffect, useMemo, useState } from 'react';
import './OpsPages.css';
import { API } from './appRuntime';

export default function OnboardingOpsPage({ AppIcon }) {
  const [masterIp, setMasterIp] = useState('');
  const [osTab, setOsTab] = useState('linux');
  const [siteName, setSiteName] = useState('');
  const [copiedTarget, setCopiedTarget] = useState('');

  useEffect(() => {
    setMasterIp(window.location.hostname || '');
  }, []);

  const frontendOrigin = useMemo(() => {
    if (typeof window === 'undefined') return 'http://<master-ip>';
    return window.location.origin || 'http://<master-ip>';
  }, []);

  const masterUrl = useMemo(() => {
    if (API) return API.replace(/\/$/, '');
    if (masterIp) return `http://${masterIp}:8000`;
    return 'http://<master-ip>';
  }, [masterIp]);

  const downloadBase = masterIp ? frontendOrigin : 'http://<master-ip>';

  const linuxPrefix = siteName ? `PATCHMASTER_SITE="${siteName}" ` : '';
  const windowsSiteArg = siteName ? ` --site "${siteName}"` : '';
  const linuxCmd = `curl -sS ${downloadBase}/download/install-agent.sh | sudo ${linuxPrefix}MASTER_URL=${masterUrl} bash`;
  const windowsCmd = `cd $env:TEMP\nRemove-Item .\\PatchMaster-Agent-Installer.exe -Force -ErrorAction SilentlyContinue\ncurl.exe -L -o PatchMaster-Agent-Installer.exe "${downloadBase}/download/patchmaster-agent-installer.exe"\n.\\PatchMaster-Agent-Installer.exe --master-url "${masterUrl}" --agent-port 18080${windowsSiteArg}`;

  const manualTracks = [
    {
      title: 'Debian and Ubuntu',
      icon: 'package',
      commands: `curl -fsSL -o agent-latest.deb ${downloadBase}/download/agent-latest.deb\nsudo dpkg -i agent-latest.deb || sudo apt-get install -f -y\n${siteName ? `echo 'PATCHMASTER_SITE=${siteName}' | sudo tee -a /etc/patch-agent/env\n` : ''}sudo systemctl enable --now patch-agent patch-agent-heartbeat`,
    },
    {
      title: 'RHEL family',
      icon: 'archive',
      commands: `curl -fsSL -o agent-latest.rpm ${downloadBase}/download/agent-latest.rpm\nsudo rpm -Uvh agent-latest.rpm || sudo dnf localinstall -y agent-latest.rpm\n${siteName ? `echo 'PATCHMASTER_SITE=${siteName}' | sudo tee -a /etc/patch-agent/env\n` : ''}sudo systemctl enable --now patch-agent patch-agent-heartbeat`,
    },
    {
      title: 'Windows',
      icon: 'window',
      commands: `cd %TEMP%\ncurl.exe -L -o PatchMaster-Agent-Installer.exe "${downloadBase}/download/patchmaster-agent-installer.exe"\nPatchMaster-Agent-Installer.exe --master-url "${masterUrl}" --agent-port 18080${windowsSiteArg}`,
    },
  ];

  const rolloutChecklist = [
    'Confirm the master address resolves from the target subnet.',
    'Allow outbound HTTPS or HTTP to the PatchMaster download endpoint.',
    'Verify the host appears in Hosts within 60 seconds of install.',
    'Use the Linux and Windows snippets below for first-run validation.',
    'For Windows, use dedicated agent API port 18080 to avoid 8080 conflicts.',
  ];

  const verifySnippets = [
    {
      title: 'Linux validation',
      icon: 'shield',
      commands: 'sudo systemctl status patch-agent patch-agent-heartbeat\nsudo journalctl -u patch-agent-heartbeat -f',
    },
    {
      title: 'Windows validation',
      icon: 'terminal',
      commands: 'Get-Service PatchMaster-Agent,PatchMaster-Agent-Heartbeat\ncurl.exe -sS http://127.0.0.1:18080/health\nGet-Content "$env:ProgramData\\PatchMaster-Agent\\logs\\PatchMaster-Agent-Heartbeat.out.log" -Tail 80',
    },
  ];

  const copyText = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(label);
      window.setTimeout(() => setCopiedTarget(''), 1800);
    } catch {
      setCopiedTarget('');
    }
  };

  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: '#93c5fd', background: 'linear-gradient(145deg, #eff6ff, #f8fbff)' }}>
          <div className="ops-kicker">Onboarding operations</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Install target</span>
              <span className="ops-emphasis-value" style={{ color: '#1d4ed8', fontSize: 26 }}>{masterIp || '<master-ip>'}</span>
              <span className="ops-emphasis-meta">Use the same address your agents can reach from production networks.</span>
            </div>
            <div className="ops-hero-copy">
              <h3>Bring new hosts online with a clean, repeatable runbook.</h3>
              <p>
                This onboarding workspace gives operators a single place to copy install commands, validate connectivity, and hand off platform-ready instructions to Linux and Windows teams without guesswork.
              </p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">Linux bootstrap</span>
            <span className="ops-chip">Windows installer</span>
            <span className="ops-chip">Manual package path</span>
            <span className="ops-chip">Verification checklist</span>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Deployment profile</span>
          <div className="ops-side-metric">Ready</div>
          <p className="ops-side-note">
            Set the master address once, then copy the exact command needed for each platform. This page is designed for help desk handoff, server ops rollout, and first-host validation.
          </p>
          <div className="ops-inline-list">
            <div className="ops-inline-card">
              <strong>2</strong>
              <span>primary install paths</span>
            </div>
            <div className="ops-inline-card">
              <strong>3</strong>
              <span>manual package tracks</span>
            </div>
            <div className="ops-inline-card">
              <strong>60s</strong>
              <span>expected first check-in</span>
            </div>
            <div className="ops-inline-card">
              <strong>1</strong>
              <span>shared runbook</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ops-summary-grid">
        {[
          { label: 'Master address', value: masterIp || '<master-ip>', sub: 'used in every install command', icon: 'server', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
          { label: 'Linux rollout', value: 'Shell install', sub: 'curl bootstrap and package fallback', icon: 'terminal', color: '#0f766e', bg: 'rgba(16,185,129,0.12)' },
          { label: 'Windows rollout', value: 'EXE + CMD', sub: 'operator-friendly package flow', icon: 'window', color: '#7c3aed', bg: 'rgba(139,92,246,0.12)' },
          { label: 'Validation', value: 'Built in', sub: 'service and log checks included', icon: 'shield', color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
        ].map(card => (
          <div key={card.label} className="ops-summary-card">
            <div className="ops-summary-head">
              <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>
                <AppIcon name={card.icon} size={18} />
              </span>
              <span className="ops-summary-label">{card.label}</span>
            </div>
            <div className="ops-summary-value" style={{ fontSize: card.label === 'Master address' ? 22 : 28 }}>{card.value}</div>
            <div className="ops-summary-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Quick install</div>
            <p className="ops-subtle">Copy a ready-to-run command for the target platform. Update the master address if your agents should use a different reachable hostname or VIP, and optionally stamp a site/location for distributed environments.</p>
          </div>
        </div>
        <div className="ops-form-grid">
          <div>
            <label className="ops-side-label">Master IP or hostname</label>
            <input className="input" value={masterIp} onChange={(e) => setMasterIp(e.target.value)} placeholder="e.g. 10.20.30.40" />
          </div>
          <div>
            <label className="ops-side-label">Site or location</label>
            <input className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Singapore-DC / Mumbai-HQ / London-Branch" />
          </div>
        </div>
        <div className="ops-pills" style={{ marginTop: 16 }}>
          <button className={`ops-pill ${osTab === 'linux' ? 'active' : ''}`} onClick={() => setOsTab('linux')}>Linux</button>
          <button className={`ops-pill ${osTab === 'windows' ? 'active' : ''}`} onClick={() => setOsTab('windows')}>Windows</button>
        </div>
        <div className="ops-command-card" style={{ marginTop: 16 }}>
          <div className="ops-table-toolbar" style={{ marginBottom: 12 }}>
            <div>
              <div className="ops-panel-title" style={{ fontSize: 16 }}>{osTab === 'linux' ? 'Linux bootstrap command' : 'Windows installer command'}</div>
              <p className="ops-subtle" style={{ marginTop: 6 }}>
                Installers are served from <code>{downloadBase}/download/</code>.
              </p>
            </div>
            <button className={`btn btn-sm ${copiedTarget === osTab ? 'btn-success' : 'btn-primary'}`} onClick={() => copyText(osTab, osTab === 'linux' ? linuxCmd : windowsCmd)}>
              {copiedTarget === osTab ? 'Copied' : 'Copy command'}
            </button>
          </div>
          <pre className="code-block">{osTab === 'linux' ? linuxCmd : windowsCmd}</pre>
        </div>
      </div>

      <div className="grid-2">
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Manual package paths</div>
              <p className="ops-subtle">Use these when your operators need explicit package installation steps rather than the quick bootstrap path.</p>
            </div>
          </div>
          <div className="ops-list">
            {manualTracks.map(track => (
              <div key={track.title} className="ops-command-card">
                <div className="ops-table-toolbar" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="ops-summary-icon" style={{ color: '#1d4ed8', background: 'rgba(59,130,246,0.12)' }}>
                      <AppIcon name={track.icon} size={17} />
                    </span>
                    <div className="ops-panel-title" style={{ fontSize: 16 }}>{track.title}</div>
                  </div>
                  <button className={`btn btn-sm ${copiedTarget === track.title ? 'btn-success' : ''}`} onClick={() => copyText(track.title, track.commands)}>
                    {copiedTarget === track.title ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="code-block">{track.commands}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Deployment readiness</div>
              <p className="ops-subtle">Use this as the handoff checklist before you ask platform teams to roll out agents at scale.</p>
            </div>
          </div>
          <div className="ops-list">
            {rolloutChecklist.map(item => (
              <div key={item} className="ops-list-item">
                <div className="ops-list-copy">
                  <strong>{item}</strong>
                  <span>Recommended for all new environments and phased rollouts.</span>
                </div>
                <div className="ops-list-metrics">
                  <span className="badge badge-info">Ready check</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ops-table-toolbar" style={{ marginTop: 24 }}>
            <div>
              <div className="ops-panel-title">Verify first check-in</div>
              <p className="ops-subtle">Once the installer finishes, confirm the service is running and the host reports back to PatchMaster.</p>
            </div>
          </div>
          <div className="ops-list">
            {verifySnippets.map(block => (
              <div key={block.title} className="ops-command-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className="ops-summary-icon" style={{ color: '#0f766e', background: 'rgba(16,185,129,0.12)' }}>
                    <AppIcon name={block.icon} size={17} />
                  </span>
                  <div className="ops-panel-title" style={{ fontSize: 16 }}>{block.title}</div>
                </div>
                <pre className="code-block">{block.commands}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
