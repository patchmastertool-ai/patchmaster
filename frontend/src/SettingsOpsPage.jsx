import React, { useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CH } from './CH.jsx';
import { Copy, CheckCircle, Server, Terminal, Layers, Shield, RefreshCw } from 'lucide-react';

export default function SettingsOpsPage({ health, hosts = [], jobs = [], API, apiFetch }) {
  const [changePw, setChangePw] = useState({ current: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [copied, setCopied]     = useState('');

  const masterIp      = typeof window !== 'undefined' ? window.location.hostname : '<master-ip>';
  const frontendUrl   = typeof window !== 'undefined' ? window.location.origin : `http://${masterIp}`;
  const controllerUrl = (API || `http://${masterIp}:8000`).replace(/\/$/, '');
  const backendOnline = Boolean(health);
  const version       = health?.version || '2.x';

  const copyText = async (key, val) => {
    try { await navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(''), 1800); }
    catch { setCopied(''); }
  };

  const changePassword = async () => {
    if (changePw.new_password !== changePw.confirm_password) return setPwMsg('Passwords do not match.');
    if (changePw.new_password.length < 8) return setPwMsg('Minimum 8 characters required.');
    setSaving(true); setPwMsg('');
    try {
      const r = await apiFetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ old_password: changePw.current, new_password: changePw.new_password }),
      });
      if (r.ok) { setPwMsg('✓ Password changed successfully.'); setChangePw({ current: '', new_password: '', confirm_password: '' }); }
      else { const d = await r.json().catch(() => ({})); setPwMsg(d.detail || 'Password update failed.'); }
    } catch (e) { setPwMsg(`Error: ${e.message}`); }
    setSaving(false);
  };

  const commandDeck = useMemo(() => ([
    {
      key: 'linux', title: 'Linux Quick Install', icon: <Terminal size={18} />,
      description: 'Bootstrap any Linux host directly from the control plane download endpoint.',
      command: `curl -sS ${frontendUrl}/download/install-agent.sh | sudo MASTER_URL=${controllerUrl} bash`,
    },
    {
      key: 'windows', title: 'Windows Quick Install', icon: <Shield size={18} />,
      description: 'Run as Administrator. Package in your endpoint management tooling.',
      command: `cd $env:TEMP\nRemove-Item .\\PatchMaster-Agent-Installer.exe -Force -ErrorAction SilentlyContinue\ncurl.exe -L -o PatchMaster-Agent-Installer.exe "${frontendUrl}/download/patchmaster-agent-installer.exe"\n.\\PatchMaster-Agent-Installer.exe --master-url "${controllerUrl}" --agent-port 18080`,
    },
    {
      key: 'docker', title: 'Docker Lifecycle', icon: <Layers size={18} />,
      description: 'Common lifecycle commands for containerized PatchMaster deployments.',
      command: `docker compose build --no-cache\ndocker compose up -d\ndocker compose logs -f backend\ndocker compose down`,
    },
  ]), [controllerUrl, frontendUrl]);

  const endpoints = [
    { label: 'Frontend',    value: frontendUrl },
    { label: 'API Base',    value: API },
    { label: 'Metrics',     value: `${API.replace(/\/$/, '')}/metrics` },
    { label: 'Master Host', value: masterIp },
  ];

  return (
    <CHPage>
      <CHHeader
        kicker="Platform Settings"
        title="Settings & Environment"
        subtitle={`Control plane ${backendOnline ? 'online' : 'offline'} · v${version} · ${masterIp}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Backend"       value={backendOnline ? 'Online' : 'Offline'}  accent={backendOnline ? CH.green : CH.red} />
        <CHStat label="Version"       value={version}                               accent={CH.accent} />
        <CHStat label="Managed Hosts" value={hosts.length}        sub="registered"  accent={CH.accent} />
        <CHStat label="Job Records"   value={jobs.length}         sub="tracked"     accent="#a78bfa" />
      </div>

      {/* Two-column: Password + Endpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Password Change */}
        <CHCard className="flex flex-col gap-5">
          <div>
            <CHLabel>Account Security</CHLabel>
            <h3 className="text-lg font-bold mt-1" style={{ color: CH.text }}>Change Password</h3>
            <p className="text-sm" style={{ color: CH.textSub }}>Rotate credentials without leaving the admin workspace.</p>
          </div>
          <div className="space-y-3">
            {[
              { ph: 'Current password',       key: 'current',          type: 'password' },
              { ph: 'New password (min 8)',    key: 'new_password',     type: 'password' },
              { ph: 'Confirm new password',   key: 'confirm_password', type: 'password' },
            ].map(f => (
              <input key={f.key} type={f.type} placeholder={f.ph} value={changePw[f.key]}
                onChange={e => setChangePw(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            ))}
          </div>
          <CHBtn variant="primary" onClick={changePassword} disabled={saving}>
            {saving ? 'Updating…' : 'Change Password'}
          </CHBtn>
          {pwMsg && (
            <div className="rounded-xl px-4 py-3 text-sm font-bold"
              style={{ background: pwMsg.startsWith('✓') ? `${CH.green}12` : `${CH.red}12`, color: pwMsg.startsWith('✓') ? CH.green : CH.red }}>
              {pwMsg}
            </div>
          )}
        </CHCard>

        {/* Endpoints */}
        <CHCard>
          <CHLabel>Environment Endpoints</CHLabel>
          <div className="mt-4 space-y-2">
            {endpoints.map(ep => (
              <div key={ep.label} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CH.textSub }}>{ep.label}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: CH.text }}>{ep.value}</p>
                </div>
                <button onClick={() => copyText(ep.label, ep.value)}
                  className="p-2 rounded-lg transition-all"
                  style={{ color: copied === ep.label ? CH.green : CH.textSub, background: 'rgba(3,29,75,0.3)' }}>
                  {copied === ep.label ? <CheckCircle size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ))}
          </div>
        </CHCard>
      </div>

      {/* Command Deck */}
      <CHCard>
        <CHLabel>Operations Command Deck</CHLabel>
        <p className="text-sm mt-1 mb-5" style={{ color: CH.textSub }}>
          Keep the most-used platform commands close for onboarding and recovery.
        </p>
        <div className="space-y-4">
          {commandDeck.map(block => (
            <div key={block.key} className="rounded-xl p-5"
              style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span style={{ color: CH.accent }}>{block.icon}</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{block.title}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{block.description}</p>
                  </div>
                </div>
                <button onClick={() => copyText(block.key, block.command)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: copied === block.key ? `${CH.green}20` : `${CH.accent}15`,
                    color: copied === block.key ? CH.green : CH.accent,
                    border: `1px solid ${copied === block.key ? CH.green + '40' : CH.accent + '40'}`,
                  }}>
                  {copied === block.key ? <CheckCircle size={12} /> : <Copy size={12} />}
                  {copied === block.key ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs font-mono p-4 rounded-xl overflow-x-auto"
                style={{ background: 'rgba(0,0,0,0.4)', color: CH.textSub, lineHeight: 1.6 }}>
                {block.command}
              </pre>
            </div>
          ))}
        </div>
      </CHCard>
    </CHPage>
  );
}
