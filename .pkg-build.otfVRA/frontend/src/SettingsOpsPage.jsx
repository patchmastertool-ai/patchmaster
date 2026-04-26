import React, { useMemo, useState } from 'react';
import { 
  StitchPageHeader,
  StitchMetricGrid,
  StitchSummaryCard,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchAlert
} from './components/StitchComponents';
import { AppIcon } from './AppIcons';

export default function SettingsOpsPage({ health, hosts = [], jobs = [], API, apiFetch }) {
  const [changePw, setChangePw] = useState({ current: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwMsgType, setPwMsgType] = useState(''); // 'success' or 'error'
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  const masterIp = typeof window !== 'undefined' ? window.location.hostname : '<master-ip>';
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : `http://${masterIp}`;
  const controllerUrl = (API || `http://${masterIp}:8000`).replace(/\/$/, '');
  const backendOnline = Boolean(health);
  const version = health?.version || '2.x';

  const copyText = async (key, val) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  };

  const changePassword = async () => {
    if (changePw.new_password !== changePw.confirm_password) {
      setPwMsg('Passwords do not match.');
      setPwMsgType('error');
      return;
    }
    if (changePw.new_password.length < 8) {
      setPwMsg('Minimum 8 characters required.');
      setPwMsgType('error');
      return;
    }
    setSaving(true);
    setPwMsg('');
    try {
      const r = await apiFetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ old_password: changePw.current, new_password: changePw.new_password }),
      });
      if (r.ok) {
        setPwMsg('Password changed successfully.');
        setPwMsgType('success');
        setChangePw({ current: '', new_password: '', confirm_password: '' });
      } else {
        const d = await r.json().catch(() => ({}));
        setPwMsg(d.detail || 'Password update failed.');
        setPwMsgType('error');
      }
    } catch (e) {
      setPwMsg(`Error: ${e.message}`);
      setPwMsgType('error');
    }
    setSaving(false);
  };

  const commandDeck = useMemo(
    () => [
      {
        key: 'linux',
        title: 'Linux Quick Install',
        icon: 'terminal',
        description: 'Bootstrap any Linux host directly from the control plane download endpoint.',
        command: `curl -sS ${frontendUrl}/download/install-agent.sh | sudo MASTER_URL=${controllerUrl} bash`,
      },
      {
        key: 'windows',
        title: 'Windows Quick Install',
        icon: 'security',
        description: 'Run as Administrator. Package in your endpoint management tooling.',
        command: `cd $env:TEMP\nRemove-Item .\\PatchMaster-Agent-Installer.exe -Force -ErrorAction SilentlyContinue\ncurl.exe -L -o PatchMaster-Agent-Installer.exe "${frontendUrl}/download/patchmaster-agent-installer.exe"\n.\\PatchMaster-Agent-Installer.exe --master-url "${controllerUrl}" --agent-port 18080`,
      },
      {
        key: 'docker',
        title: 'Docker Lifecycle',
        icon: 'layers',
        description: 'Common lifecycle commands for containerized PatchMaster deployments.',
        command: `docker compose build --no-cache\ndocker compose up -d\ndocker compose logs -f backend\ndocker compose down`,
      },
    ],
    [controllerUrl, frontendUrl]
  );

  const endpoints = [
    { label: 'Frontend', value: frontendUrl },
    { label: 'API Base', value: API },
    { label: 'Metrics', value: `${API.replace(/\/$/, '')}/metrics` },
    { label: 'Master Host', value: masterIp },
  ];

  return (
    <div className="flex h-full bg-[#060e20] text-[#dee5ff] overflow-hidden">
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 sm:px-12 py-6 sm:py-8">
        {/* Page Header */}
        <StitchPageHeader
          kicker="Platform Settings"
          title="Settings & Environment"
          description={`Control plane ${backendOnline ? 'online' : 'offline'} · v${version} · ${masterIp}`}
          workspace="governance"
        />

        {/* KPIs */}
        <StitchMetricGrid cols={4}>
          <StitchSummaryCard
            label="Backend"
            value={backendOnline ? 'Online' : 'Offline'}
            icon="cloud"
            color="#7bd0ff"
            workspace="governance"
          />
          <StitchSummaryCard
            label="Version"
            value={version}
            icon="info"
            color="#7bd0ff"
            workspace="governance"
          />
          <StitchSummaryCard
            label="Managed Hosts"
            value={hosts.length}
            subtitle="registered"
            icon="dns"
            color="#7bd0ff"
            workspace="governance"
          />
          <StitchSummaryCard
            label="Job Records"
            value={jobs.length}
            subtitle="tracked"
            icon="history"
            color="#ffd16f"
            workspace="governance"
          />
        </StitchMetricGrid>

        {/* Two-column: Password + Endpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-8">
          {/* Password Change */}
          <div className="bg-[#05183c] p-6 rounded-xl">
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">Account Security</p>
              <h3 className="text-lg font-bold text-[#dee5ff]">Change Password</h3>
              <p className="text-sm text-[#91aaeb] mt-1">
                Rotate credentials without leaving the admin workspace.
              </p>
            </div>
            <div className="space-y-4 mb-6">
              <StitchFormField label="Current Password">
                <StitchInput
                  type="password"
                  value={changePw.current}
                  onChange={(e) => setChangePw((p) => ({ ...p, current: e.target.value }))}
                  placeholder="Enter current password"
                />
              </StitchFormField>
              <StitchFormField label="New Password">
                <StitchInput
                  type="password"
                  value={changePw.new_password}
                  onChange={(e) => setChangePw((p) => ({ ...p, new_password: e.target.value }))}
                  placeholder="Enter new password (min 8 characters)"
                />
              </StitchFormField>
              <StitchFormField label="Confirm New Password">
                <StitchInput
                  type="password"
                  value={changePw.confirm_password}
                  onChange={(e) => setChangePw((p) => ({ ...p, confirm_password: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </StitchFormField>
            </div>
            <StitchButton
              variant="primary"
              onClick={changePassword}
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Updating…' : 'Change Password'}
            </StitchButton>
            {pwMsg && (
              <StitchAlert
                variant={pwMsgType === 'success' ? 'success' : 'error'}
                icon={pwMsgType === 'success' ? 'check_circle' : 'error'}
                message={pwMsg}
              />
            )}
          </div>

          {/* Endpoints */}
          <div className="bg-[#05183c] p-6 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-4">
              Environment Endpoints
            </p>
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div
                  key={ep.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#031d4b] border border-[#2b4680]/30"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#91aaeb]">
                      {ep.label}
                    </p>
                    <p className="text-xs font-mono mt-1 text-[#dee5ff]">{ep.value}</p>
                  </div>
                  <button
                    onClick={() => copyText(ep.label, ep.value)}
                    className="p-2 rounded-lg transition-all hover:bg-[#05183c]"
                    aria-label={`Copy ${ep.label}`}
                  >
                    <AppIcon
                      name={copied === ep.label ? 'check_circle' : 'content_copy'}
                      size={16}
                      className={copied === ep.label ? 'text-[#7bd0ff]' : 'text-[#91aaeb]'}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Command Deck */}
        <div className="bg-[#05183c] p-6 rounded-xl">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
            Operations Command Deck
          </p>
          <p className="text-sm text-[#91aaeb] mb-6">
            Keep the most-used platform commands close for onboarding and recovery.
          </p>
          <div className="space-y-4">
            {commandDeck.map((block) => (
              <div key={block.key} className="rounded-lg p-5 bg-[#031d4b] border border-[#2b4680]/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <AppIcon name={block.icon} size={20} className="text-[#7bd0ff] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-[#dee5ff]">{block.title}</p>
                      <p className="text-xs text-[#91aaeb] mt-1">{block.description}</p>
                    </div>
                  </div>
                  <StitchButton
                    variant={copied === block.key ? 'secondary' : 'ghost'}
                    icon={copied === block.key ? 'check_circle' : 'content_copy'}
                    onClick={() => copyText(block.key, block.command)}
                    size="sm"
                  >
                    {copied === block.key ? 'Copied' : 'Copy'}
                  </StitchButton>
                </div>
                <pre className="text-xs font-mono p-4 rounded-lg overflow-x-auto bg-[#000000]/40 text-[#91aaeb] border border-[#2b4680]/20">
                  {block.command}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
