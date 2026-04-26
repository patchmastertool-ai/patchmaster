import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from './AppIcons';
import {
  StitchWorkspaceContainer,
  StitchPageHeader,
  StitchSummaryCard,
  StitchButton,
  StitchAlert,
  StitchBadge,
  StitchTable,
  StitchEmptyState
} from './components/StitchComponents';

export default function NetworkBootPageStitch({ hosts, API, apiFetch, useInterval }) {
  const [networks, setNetworks]             = useState([]);
  const [profiles, setProfiles]             = useState([]);
  const [assignments, setAssignments]       = useState([]);
  const [templates, setTemplates]           = useState([]);
  const [mirrorRepos, setMirrorRepos]       = useState([]);
  const [relays, setRelays]                 = useState([]);
  const [bootSessions, setBootSessions]     = useState([]);
  const [selectedProfileId, setSelProfile]  = useState('');
  const [notice, setNotice]                 = useState({ msg: '', ok: true });
  const [busy, setBusy]                     = useState(false);

  const selectedProfile  = useMemo(() => profiles.find(p => String(p.id) === String(selectedProfileId)), [profiles, selectedProfileId]);

  const refreshNetworks    = async () => { try { const r = await apiFetch(`${API}/api/network-boot/networks`); const d = await r.json(); setNetworks(d.items || []); } catch { setNetworks([]); } };
  const refreshProfiles    = async () => { try { const r = await apiFetch(`${API}/api/network-boot/profiles`); const d = await r.json(); const items = d.items || []; setProfiles(items); setSelProfile(c => c && items.some(i => String(i.id) === c) ? c : String(items[0]?.id || '')); } catch { setProfiles([]); } };
  const refreshCatalog     = async () => { try { const r = await apiFetch(`${API}/api/network-boot/catalog`); const d = await r.json(); setTemplates(d.provisioning_templates || []); setMirrorRepos(d.mirror_repositories || []); } catch { setTemplates([]); setMirrorRepos([]); } };
  const refreshAssignments = async () => { try { const r = await apiFetch(`${API}/api/network-boot/assignments`); const d = await r.json(); setAssignments(d.items || []); } catch { setAssignments([]); } };
  const refreshRelays      = async () => { try { const r = await apiFetch(`${API}/api/network-boot/relays`); const d = await r.json(); setRelays(d.items || []); } catch { setRelays([]); } };
  const refreshBootSessions = async () => { try { const r = await apiFetch(`${API}/api/network-boot/boot-sessions?limit=25`); const d = await r.json(); setBootSessions(d.items || []); } catch { setBootSessions([]); } };

  const refreshAll = async () => { await Promise.all([refreshNetworks(), refreshProfiles(), refreshCatalog(), refreshAssignments(), refreshRelays(), refreshBootSessions()]); };

  useEffect(() => { refreshAll(); }, []);
  if (useInterval) useInterval(() => { refreshProfiles(); refreshAssignments(); refreshBootSessions(); }, 15000);

  const profileColumns = [
    {
      header: 'Profile Name',
      render: (profile) => (
        <div>
          <div className="text-sm font-bold text-[#dee5ff]">{profile.name}</div>
          <div className="text-xs text-[#91aaeb]">{profile.os_family || 'linux'} • {profile.architecture || 'x86_64'}</div>
        </div>
      )
    },
    {
      header: 'Firmware',
      render: (profile) => <StitchBadge variant="info">{profile.firmware_mode || 'uefi'}</StitchBadge>
    },
    {
      header: 'Install Mode',
      render: (profile) => <span className="text-xs text-[#91aaeb]">{profile.install_mode || '—'}</span>
    },
    {
      header: 'Actions',
      align: 'right',
      render: (profile) => (
        <StitchButton variant="secondary" size="sm" onClick={() => setSelProfile(String(profile.id))}>
          View
        </StitchButton>
      )
    }
  ];

  const assignmentColumns = [
    {
      header: 'Host',
      render: (assign) => (
        <div>
          <div className="text-sm font-bold text-[#dee5ff]">{assign.hostname || `Host ${assign.host_id}`}</div>
          <div className="text-xs font-mono text-[#91aaeb]">{assign.mac_address || '—'}</div>
        </div>
      )
    },
    {
      header: 'Profile',
      render: (assign) => {
        const profile = profiles.find(p => p.id === assign.profile_id);
        return <span className="text-xs text-[#91aaeb]">{profile?.name || `Profile ${assign.profile_id}`}</span>;
      }
    },
    {
      header: 'Reserved IP',
      render: (assign) => <span className="text-xs font-mono text-[#91aaeb]">{assign.reserved_ip || '—'}</span>
    },
    {
      header: 'Boot Once',
      render: (assign) => <StitchBadge variant={assign.boot_once ? 'warning' : 'info'}>{assign.boot_once ? 'YES' : 'NO'}</StitchBadge>
    }
  ];

  const sessionColumns = [
    {
      header: 'MAC Address',
      render: (session) => <span className="text-xs font-mono text-[#dee5ff]">{session.mac_address || '—'}</span>
    },
    {
      header: 'IP Address',
      render: (session) => <span className="text-xs font-mono text-[#91aaeb]">{session.ip_address || '—'}</span>
    },
    {
      header: 'Status',
      render: (session) => {
        const variant = session.status === 'success' ? 'success' : session.status === 'failed' ? 'error' : 'info';
        return <StitchBadge variant={variant}>{session.status || 'pending'}</StitchBadge>;
      }
    },
    {
      header: 'Timestamp',
      render: (session) => (
        <span className="text-xs text-[#91aaeb]">
          {session.timestamp ? new Date(session.timestamp).toLocaleString() : '—'}
        </span>
      )
    }
  ];

  return (
    <StitchWorkspaceContainer workspace="infrastructure" className="min-h-screen p-12">
      <StitchPageHeader
        workspace="infrastructure"
        title="Network Boot Manager (PXE/iPXE)"
        description="Infrastructure provisioning and network boot operations"
        actions={
          <StitchButton variant="primary" icon="sync" onClick={refreshAll}>
            Refresh All
          </StitchButton>
        }
      />

      {notice.msg && (
        <StitchAlert
          variant={notice.ok ? 'success' : 'error'}
          message={notice.msg}
          onDismiss={() => setNotice({ msg: '', ok: true })}
        />
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StitchSummaryCard
          workspace="infrastructure"
          label="Boot Profiles"
          value={profiles.length}
          icon="terminal"
          subtitle="configured"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Assignments"
          value={assignments.length}
          icon="link"
          subtitle="host mappings"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Networks"
          value={networks.length}
          icon="hub"
          subtitle="configured"
        />
        <StitchSummaryCard
          workspace="infrastructure"
          label="Boot Sessions"
          value={bootSessions.length}
          icon="history"
          subtitle="recent"
        />
      </div>

      {/* Boot Profiles */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Boot Profiles</h3>
        <StitchTable
          columns={profileColumns}
          data={profiles}
          emptyState={
            <StitchEmptyState
              icon="terminal"
              title="No Boot Profiles"
              description="Create boot profiles to define network boot configurations."
            />
          }
        />
      </div>

      {/* Host Assignments */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Host Assignments</h3>
        <StitchTable
          columns={assignmentColumns}
          data={assignments}
          emptyState={
            <StitchEmptyState
              icon="link"
              title="No Host Assignments"
              description="Assign boot profiles to hosts to enable network boot."
            />
          }
        />
      </div>

      {/* Recent Boot Sessions */}
      <div>
        <h3 className="text-lg font-bold text-[#dee5ff] mb-4">Recent Boot Sessions</h3>
        <StitchTable
          columns={sessionColumns}
          data={bootSessions}
          emptyState={
            <div className="text-center py-8 text-[#91aaeb]">
              No boot sessions recorded yet
            </div>
          }
        />
      </div>
    </StitchWorkspaceContainer>
  );
}
