import React, { useEffect, useMemo, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, Download, Wifi, Server, Zap } from 'lucide-react';

const statusColor = s => ({ implemented: CH.green, planned: CH.accent, idle: CH.textSub, active: CH.green, error: CH.red }[String(s).toLowerCase()] || CH.textSub);

const BLANK_NETWORK = { name: '', interface_name: '', vlan_id: '', cidr: '', gateway: '', dns_servers: '', dhcp_range_start: '', dhcp_range_end: '', next_server: '', controller_url: '', relay_id: '', boot_file_bios: 'undionly.kpxe', boot_file_uefi: 'ipxe.efi' };
const BLANK_RELAY   = { name: '', host_id: '', site_scope: '', install_root: '/var/lib/patchmaster/network-boot', public_base_url: '', notes: '' };
const BLANK_PROFILE = { name: '', network_id: '', provisioning_template_id: '', mirror_repo_id: '', os_family: 'linux', os_version: '', architecture: 'x86_64', firmware_mode: 'uefi', install_mode: 'ubuntu_autoinstall', kernel_url: '', initrd_url: '', rootfs_url: '', answer_template: '', post_install_script: '', release_label: 'stable' };
const BLANK_ASSIGN  = { network_id: '', profile_id: '', host_id: '', hostname: '', mac_address: '', reserved_ip: '', firmware_mode: 'uefi', site_scope: '', boot_once: true };

export default function NetworkBootPage({ hosts, API, apiFetch, useInterval }) {
  const [tab, setTab]                       = useState('overview');
  const [workflowCards, setWorkflowCards]   = useState([]);
  const [networks, setNetworks]             = useState([]);
  const [profiles, setProfiles]             = useState([]);
  const [assignments, setAssignments]       = useState([]);
  const [templates, setTemplates]           = useState([]);
  const [mirrorRepos, setMirrorRepos]       = useState([]);
  const [relays, setRelays]                 = useState([]);
  const [bootSessions, setBootSessions]     = useState([]);
  const [selectedProfileId, setSelProfile]  = useState('');
  const [artifactPreview, setArtifactPrev]  = useState(null);
  const [servicePreview, setServicePrev]    = useState(null);
  const [notice, setNotice]                 = useState({ msg: '', ok: true });
  const [busy, setBusy]                     = useState(false);
  const [networkForm, setNetForm]           = useState(BLANK_NETWORK);
  const [relayForm, setRelayForm]           = useState(BLANK_RELAY);
  const [profileForm, setProfileForm]       = useState(BLANK_PROFILE);
  const [assignmentForm, setAssignForm]     = useState(BLANK_ASSIGN);

  const orderedHosts     = useMemo(() => [...hosts].sort((a, b) => String(a.hostname || '').localeCompare(String(b.hostname || ''))), [hosts]);
  const selectedProfile  = useMemo(() => profiles.find(p => String(p.id) === String(selectedProfileId)), [profiles, selectedProfileId]);

  const refreshWorkflows   = async () => { try { const r = await apiFetch(`${API}/api/network-boot/workflows`); const d = await r.json(); setWorkflowCards(d.items || d.workflows || []); } catch { setWorkflowCards([]); } };
  const refreshNetworks    = async () => { try { const r = await apiFetch(`${API}/api/network-boot/networks`); const d = await r.json(); setNetworks(d.items || []); } catch { setNetworks([]); } };
  const refreshProfiles    = async () => { try { const r = await apiFetch(`${API}/api/network-boot/profiles`); const d = await r.json(); const items = d.items || []; setProfiles(items); setSelProfile(c => c && items.some(i => String(i.id) === c) ? c : String(items[0]?.id || '')); } catch { setProfiles([]); } };
  const refreshCatalog     = async () => { try { const r = await apiFetch(`${API}/api/network-boot/catalog`); const d = await r.json(); setTemplates(d.provisioning_templates || []); setMirrorRepos(d.mirror_repositories || []); } catch { setTemplates([]); setMirrorRepos([]); } };
  const refreshAssignments = async () => { try { const r = await apiFetch(`${API}/api/network-boot/assignments`); const d = await r.json(); setAssignments(d.items || []); } catch { setAssignments([]); } };
  const refreshRelays      = async () => { try { const r = await apiFetch(`${API}/api/network-boot/relays`); const d = await r.json(); setRelays(d.items || []); } catch { setRelays([]); } };
  const refreshBootSessions = async () => { try { const r = await apiFetch(`${API}/api/network-boot/boot-sessions?limit=25`); const d = await r.json(); setBootSessions(d.items || []); } catch { setBootSessions([]); } };
  const refreshServicePrev = async () => { try { const r = await apiFetch(`${API}/api/network-boot/service-preview`); const d = await r.json(); setServicePrev(r.ok ? d : null); } catch { setServicePrev(null); } };

  const refreshAll = async () => { await Promise.all([refreshWorkflows(), refreshNetworks(), refreshProfiles(), refreshCatalog(), refreshAssignments(), refreshRelays(), refreshBootSessions(), refreshServicePrev()]); };

  const loadPreview = async (profileId) => {
    if (!profileId) { setArtifactPrev(null); return; }
    try { const r = await apiFetch(`${API}/api/network-boot/profiles/${profileId}/artifact-preview`); const d = await r.json(); if (!r.ok) { setNotice({ msg: d.detail || 'Could not load preview.', ok: false }); return; } setArtifactPrev(d); } catch (e) { setNotice({ msg: e.message, ok: false }); }
  };

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { selectedProfileId ? loadPreview(selectedProfileId) : setArtifactPrev(null); }, [selectedProfileId]);
  if (useInterval) useInterval(() => { refreshProfiles(); refreshAssignments(); refreshRelays(); refreshBootSessions(); }, 15000);

  const createNetwork = async () => {
    if (!networkForm.name.trim()) { setNotice({ msg: 'Boot network name is required.', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/network-boot/networks`, { method: 'POST', body: JSON.stringify({ ...networkForm, name: networkForm.name.trim(), vlan_id: networkForm.vlan_id === '' ? null : Number(networkForm.vlan_id), dns_servers: networkForm.dns_servers.split(',').map(v => v.trim()).filter(Boolean), relay_id: networkForm.relay_id ? Number(networkForm.relay_id) : null, boot_file_bios: networkForm.boot_file_bios || 'undionly.kpxe', boot_file_uefi: networkForm.boot_file_uefi || 'ipxe.efi' }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Could not create network.', ok: false }); return; }
      setNotice({ msg: `Boot network "${d.name}" created.`, ok: true }); setNetForm(BLANK_NETWORK); await refreshNetworks();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const createProfile = async () => {
    if (!profileForm.name.trim()) { setNotice({ msg: 'Profile name is required.', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/network-boot/profiles`, { method: 'POST', body: JSON.stringify({ ...profileForm, name: profileForm.name.trim(), network_id: profileForm.network_id ? Number(profileForm.network_id) : null, provisioning_template_id: profileForm.provisioning_template_id ? Number(profileForm.provisioning_template_id) : null, mirror_repo_id: profileForm.mirror_repo_id ? Number(profileForm.mirror_repo_id) : null }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Could not create profile.', ok: false }); return; }
      setNotice({ msg: `Profile "${d.name}" created.`, ok: true }); setProfileForm(p => ({ ...p, name: '', os_version: '', kernel_url: '', initrd_url: '', rootfs_url: '', answer_template: '', post_install_script: '' })); await refreshProfiles(); setSelProfile(String(d.id));
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const createRelay = async () => {
    if (!relayForm.name.trim() || !relayForm.host_id) { setNotice({ msg: 'Relay name and managed host are required.', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const r = await apiFetch(`${API}/api/network-boot/relays`, { method: 'POST', body: JSON.stringify({ name: relayForm.name.trim(), host_id: Number(relayForm.host_id), site_scope: relayForm.site_scope.trim(), install_root: relayForm.install_root.trim(), public_base_url: relayForm.public_base_url.trim(), notes: relayForm.notes, is_enabled: true }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Could not create relay.', ok: false }); return; }
      setNotice({ msg: `Relay "${d.name}" created.`, ok: true }); setRelayForm(BLANK_RELAY); await refreshRelays();
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const createAssignment = async () => {
    if (!assignmentForm.network_id || !assignmentForm.profile_id || !assignmentForm.mac_address.trim()) { setNotice({ msg: 'Network, profile, and MAC address are required.', ok: false }); return; }
    setBusy(true); setNotice({ msg: '', ok: true });
    try {
      const selHost = orderedHosts.find(h => String(h.id) === String(assignmentForm.host_id || ''));
      const r = await apiFetch(`${API}/api/network-boot/assignments`, { method: 'POST', body: JSON.stringify({ network_id: Number(assignmentForm.network_id), profile_id: Number(assignmentForm.profile_id), host_id: assignmentForm.host_id ? Number(assignmentForm.host_id) : null, hostname: assignmentForm.hostname.trim() || selHost?.hostname || '', mac_address: assignmentForm.mac_address.trim(), reserved_ip: assignmentForm.reserved_ip.trim(), firmware_mode: assignmentForm.firmware_mode, site_scope: assignmentForm.site_scope.trim() || selHost?.site || '', boot_once: Boolean(assignmentForm.boot_once), is_enabled: true }) });
      const d = await r.json();
      if (!r.ok) { setNotice({ msg: d.detail || 'Could not create assignment.', ok: false }); return; }
      setNotice({ msg: `PXE assignment created for ${d.hostname || d.mac_address}.`, ok: true }); setAssignForm(a => ({ ...a, host_id: '', hostname: '', mac_address: '', reserved_ip: '', site_scope: '', boot_once: true })); await Promise.all([refreshAssignments(), refreshServicePrev()]);
    } catch (e) { setNotice({ msg: e.message, ok: false }); }
    setBusy(false);
  };

  const runRelayAction = async (relayId, action) => {
    setNotice({ msg: '', ok: true });
    try { const r = await apiFetch(`${API}/api/network-boot/relays/${relayId}/${action}`, { method: 'POST' }); const d = await r.json(); if (!r.ok) { setNotice({ msg: d.detail || `Could not ${action} relay.`, ok: false }); return; } setNotice({ msg: `Relay action queued: ${action}.`, ok: true }); await Promise.all([refreshRelays(), refreshBootSessions()]); } catch (e) { setNotice({ msg: e.message, ok: false }); }
  };

  const downloadDeploymentBundle = async () => {
    try { const r = await apiFetch(`${API}/api/network-boot/deployment-bundle`); if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Could not download bundle.', ok: false }); return; } const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'patchmaster-network-boot-bundle.tar.gz'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); setNotice({ msg: 'PXE deployment bundle downloaded.', ok: true }); } catch (e) { setNotice({ msg: e.message, ok: false }); }
  };
  const downloadRelayBundle = async relay => {
    try { const r = await apiFetch(`${API}/boot/network-boot/relays/${relay.id}/bundle.tar.gz`); if (!r.ok) { const d = await r.json(); setNotice({ msg: d.detail || 'Could not download relay bundle.', ok: false }); return; } const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `patchmaster-boot-relay-${relay.id}.tar.gz`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); setNotice({ msg: `Relay bundle downloaded for ${relay.name}.`, ok: true }); } catch (e) { setNotice({ msg: e.message, ok: false }); }
  };

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  const TABS = [
    { k: 'overview',     l: `Overview (${workflowCards.length})` },
    { k: 'relays',       l: `Relays (${relays.length})` },
    { k: 'networks',     l: `Networks (${networks.length})` },
    { k: 'profiles',     l: `Profiles (${profiles.length})` },
    { k: 'assignments',  l: `Assignments (${assignments.length})` },
    { k: 'sessions',     l: `Sessions (${bootSessions.length})` },
  ];

  return (
    <CHPage>
      <CHHeader
        kicker="Bare-Metal Deployment Workspace"
        title="Network Boot (PXE)"
        subtitle={`${relays.length} relays · ${profiles.length} profiles · ${assignments.length} PXE assignments · ${bootSessions.length} sessions`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={refreshAll}><RefreshCw size={14} /></CHBtn>
            <CHBtn variant="default" onClick={downloadDeploymentBundle}><Download size={14} /> Deployment Bundle</CHBtn>
          </div>
        }
      />

      {notice.msg && (
        <div className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{ background: notice.ok ? `${CH.green}12` : `${CH.red}12`, color: notice.ok ? CH.green : CH.red }}>
          {notice.msg}
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <CHStat label="Networks"    value={networks.length}     accent={CH.accent} />
        <CHStat label="Profiles"    value={profiles.length}     accent="#a78bfa" />
        <CHStat label="Assignments" value={assignments.length}  accent={CH.yellow} />
        <CHStat label="Relays"      value={relays.length}       accent={CH.green} />
        <CHStat label="Sessions"    value={bootSessions.length} accent="#60a5fa" />
        <CHStat label="Templates"   value={templates.length}    accent={CH.textSub} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: tab === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', color: tab === t.k ? CH.accent : CH.textSub, border: `1px solid ${tab === t.k ? CH.accent + '40' : CH.border}` }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workflowCards.map(wf => (
            <CHCard key={wf.id || wf.label}>
              <div className="flex items-center justify-between mb-3">
                <CHLabel>{wf.label || wf.id}</CHLabel>
                <CHBadge color={statusColor(wf.status)}>{wf.status}</CHBadge>
              </div>
              <p className="text-sm font-bold mb-3" style={{ color: CH.text }}>{wf.title}</p>
              <div className="space-y-1">
                {(wf.capabilities || []).map(cap => (
                  <p key={cap} className="text-xs flex items-center gap-2" style={{ color: CH.textSub }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CH.accent }} />
                    {cap}
                  </p>
                ))}
              </div>
            </CHCard>
          ))}
        </div>
      )}

      {/* ── RELAYS ── */}
      {tab === 'relays' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-4">
            <CHLabel>Register Boot Relay</CHLabel>
            {[
              { k: 'name',           p: 'Relay name',  ph: 'mumbai-hq-relay-01' },
              { k: 'site_scope',     p: 'Site',        ph: 'Mumbai-HQ' },
              { k: 'install_root',   p: 'Install root', ph: '' },
              { k: 'public_base_url', p: 'Public base URL', ph: 'http://10.42.120.20' },
            ].map(f => (
              <div key={f.k} className="flex flex-col gap-1">
                <CHLabel>{f.p}</CHLabel>
                <input value={relayForm[f.k]} onChange={e => setRelayForm(r => ({ ...r, [f.k]: e.target.value }))} placeholder={f.ph} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <CHLabel>Managed Host</CHLabel>
              <select value={relayForm.host_id} onChange={e => setRelayForm(r => ({ ...r, host_id: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                <option value="">Select host</option>
                {orderedHosts.map(h => <option key={h.id} value={h.id}>{h.hostname} ({h.ip}){h.site ? ` — ${h.site}` : ''}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <CHLabel>Notes</CHLabel>
              <textarea value={relayForm.notes} onChange={e => setRelayForm(r => ({ ...r, notes: e.target.value }))} rows={2} placeholder="Optional operator notes" className="w-full rounded-xl px-4 py-3 text-sm resize-y" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}`, color: CH.text }} />
            </div>
            <div className="flex gap-3">
              <CHBtn variant="primary" onClick={createRelay} disabled={busy}>{busy ? 'Saving…' : 'Register Relay'}</CHBtn>
              <CHBtn variant="ghost" onClick={refreshRelays}>Refresh</CHBtn>
            </div>
          </CHCard>

          <CHCard>
            <CHLabel>Managed Relays ({relays.length})</CHLabel>
            <div className="mt-4 space-y-3">
              {relays.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No managed boot relays yet.</p> : null}
              {relays.map(relay => (
                <div key={relay.id} className="p-3 rounded-xl" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{relay.name}</p>
                      <p className="text-xs" style={{ color: CH.textSub }}>{relay.host?.hostname || 'Unbound'} · {relay.host?.ip || '—'}{relay.site_scope ? ` · ${relay.site_scope}` : ''}</p>
                      <p className="text-xs" style={{ color: CH.textSub }}>v{relay.applied_version || 'not applied'} · validate: {relay.last_validation_status || 'not run'}</p>
                    </div>
                    <CHBadge color={statusColor(relay.status || 'idle')}>{relay.status || 'idle'}</CHBadge>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <CHBtn variant="default" onClick={() => runRelayAction(relay.id, 'install')}>Install</CHBtn>
                    <CHBtn variant="default" onClick={() => runRelayAction(relay.id, 'sync')}>Sync</CHBtn>
                    <CHBtn variant="default" onClick={() => runRelayAction(relay.id, 'validate')}>Validate</CHBtn>
                    <CHBtn variant="ghost" onClick={() => downloadRelayBundle(relay)}><Download size={12} /> Bundle</CHBtn>
                  </div>
                </div>
              ))}
            </div>
          </CHCard>
        </div>
      )}

      {/* ── NETWORKS ── */}
      {tab === 'networks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-4">
            <CHLabel>Define Boot Network</CHLabel>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'name',             p: 'Network Name',  ph: 'Branch-London-UEFI' },
                { k: 'interface_name',   p: 'Interface',     ph: 'bond0.120' },
                { k: 'vlan_id',          p: 'VLAN',          ph: '120' },
                { k: 'cidr',             p: 'CIDR',          ph: '10.42.120.0/24' },
                { k: 'gateway',          p: 'Gateway',       ph: '10.42.120.1' },
                { k: 'dns_servers',      p: 'DNS Servers',   ph: '8.8.8.8,8.8.4.4' },
                { k: 'dhcp_range_start', p: 'DHCP Start',   ph: '10.42.120.100' },
                { k: 'dhcp_range_end',   p: 'DHCP End',     ph: '10.42.120.200' },
                { k: 'next_server',      p: 'Next Server',  ph: '10.42.120.20' },
                { k: 'controller_url',   p: 'Controller URL', ph: 'http://pm.local:8000' },
              ].map(f => (
                <div key={f.k} className="flex flex-col gap-1">
                  <CHLabel>{f.p}</CHLabel>
                  <input value={networkForm[f.k]} onChange={e => setNetForm(n => ({ ...n, [f.k]: e.target.value }))} placeholder={f.ph} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                </div>
              ))}
            </div>
            <CHBtn variant="primary" onClick={createNetwork} disabled={busy}>{busy ? 'Saving…' : 'Create Boot Network'}</CHBtn>
          </CHCard>

          <CHCard>
            <CHLabel>Boot Networks ({networks.length})</CHLabel>
            <div className="mt-4 space-y-2">
              {networks.length === 0 ? <p className="text-sm py-4 text-center" style={{ color: CH.textSub }}>No networks yet.</p> : null}
              {networks.map(n => (
                <div key={n.id} className="p-3 rounded-xl" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{n.name}</p>
                      <p className="text-xs font-mono" style={{ color: CH.textSub }}>{n.cidr} · {n.interface_name}{n.vlan_id ? ` · VLAN ${n.vlan_id}` : ''}</p>
                    </div>
                    {n.relay && <CHBadge color={CH.green}>Relay: {n.relay.name}</CHBadge>}
                  </div>
                </div>
              ))}
            </div>
          </CHCard>
        </div>
      )}

      {/* ── PROFILES ── */}
      {tab === 'profiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-4">
            <CHLabel>Create Boot Profile</CHLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1">
                <CHLabel>Profile Name</CHLabel>
                <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} placeholder="Ubuntu-22.04-UEFI" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
              {[
                { k: 'network_id', p: 'Network', type: 'select', options: networks.map(n => ({ k: n.id, l: n.name })) },
                { k: 'os_family', p: 'OS Family', type: 'select', options: [{ k: 'linux', l: 'Linux' }, { k: 'windows', l: 'Windows' }] },
                { k: 'firmware_mode', p: 'Firmware', type: 'select', options: [{ k: 'uefi', l: 'UEFI' }, { k: 'bios', l: 'BIOS' }, { k: 'mixed', l: 'Mixed' }] },
                { k: 'install_mode', p: 'Install Mode', type: 'select', options: [{ k: 'ubuntu_autoinstall', l: 'Ubuntu Autoinstall' }, { k: 'debian_preseed', l: 'Debian Preseed' }, { k: 'windows_unattend', l: 'Windows Unattend' }] },
              ].map(f => (
                <div key={f.k} className="flex flex-col gap-1">
                  <CHLabel>{f.p}</CHLabel>
                  <select value={profileForm[f.k]} onChange={e => setProfileForm(p => ({ ...p, [f.k]: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                    <option value="">—</option>
                    {f.options.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
                  </select>
                </div>
              ))}
              {[
                { k: 'os_version', p: 'OS Version', ph: '22.04' },
                { k: 'kernel_url', p: 'Kernel URL', ph: 'http://…/vmlinuz' },
                { k: 'initrd_url', p: 'initrd URL', ph: 'http://…/initrd' },
                { k: 'release_label', p: 'Release Label', ph: 'stable' },
              ].map(f => (
                <div key={f.k} className="flex flex-col gap-1">
                  <CHLabel>{f.p}</CHLabel>
                  <input value={profileForm[f.k]} onChange={e => setProfileForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                </div>
              ))}
            </div>
            <CHBtn variant="primary" onClick={createProfile} disabled={busy}>{busy ? 'Saving…' : 'Create Profile'}</CHBtn>
          </CHCard>

          <CHCard>
            <CHLabel>Boot Profiles ({profiles.length})</CHLabel>
            <CHTable headers={['Name', 'OS', 'Mode', 'Network']} emptyMessage="No profiles yet." className="mt-4">
              {profiles.map(p => (
                <CHTR key={p.id} style={String(p.id) === selectedProfileId ? { background: `${CH.accent}08` } : {}} onClick={() => setSelProfile(String(p.id))}>
                  <td className="px-4 py-3 text-sm font-bold cursor-pointer" style={{ color: CH.text }}>{p.name}</td>
                  <td className="px-4 py-3"><CHBadge color={CH.accent}>{p.os_family}</CHBadge></td>
                  <td className="px-4 py-3"><CHBadge color={CH.textSub}>{p.firmware_mode}</CHBadge></td>
                  <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{p.network?.name || '—'}</td>
                </CHTR>
              ))}
            </CHTable>
            {artifactPreview && (
              <div className="mt-4 rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${CH.border}` }}>
                <CHLabel>Artifact Preview — {selectedProfile?.name}</CHLabel>
                <pre className="text-xs font-mono max-h-48 overflow-y-auto" style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(artifactPreview, null, 2)}
                </pre>
              </div>
            )}
          </CHCard>
        </div>
      )}

      {/* ── ASSIGNMENTS ── */}
      {tab === 'assignments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-4">
            <CHLabel>Create PXE Assignment</CHLabel>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'network_id', p: 'Boot Network', type: 'select', opts: networks.map(n => ({ k: n.id, l: n.name })) },
                { k: 'profile_id', p: 'Boot Profile', type: 'select', opts: profiles.map(p => ({ k: p.id, l: p.name })) },
                { k: 'host_id',    p: 'Managed Host (optional)', type: 'select', opts: orderedHosts.map(h => ({ k: h.id, l: `${h.hostname} (${h.ip})` })) },
                { k: 'firmware_mode', p: 'Firmware', type: 'select', opts: [{ k: 'uefi', l: 'UEFI' }, { k: 'bios', l: 'BIOS' }, { k: 'mixed', l: 'Mixed' }] },
              ].map(f => (
                <div key={f.k} className="flex flex-col gap-1">
                  <CHLabel>{f.p}</CHLabel>
                  <select value={assignmentForm[f.k]} onChange={e => setAssignForm(a => ({ ...a, [f.k]: e.target.value }))} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                    <option value="">—</option>
                    {f.opts.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
                  </select>
                </div>
              ))}
              {[
                { k: 'hostname',    p: 'Hostname Override',  ph: 'branch-a-lt-01' },
                { k: 'mac_address', p: 'MAC Address',        ph: 'AA-BB-CC-DD-EE-FF' },
                { k: 'reserved_ip', p: 'Reserved IP',        ph: '10.42.120.50' },
                { k: 'site_scope',  p: 'Site',               ph: 'London-Branch-A' },
              ].map(f => (
                <div key={f.k} className="flex flex-col gap-1">
                  <CHLabel>{f.p}</CHLabel>
                  <input value={assignmentForm[f.k]} onChange={e => setAssignForm(a => ({ ...a, [f.k]: e.target.value }))} placeholder={f.ph} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer col-span-2">
                <input type="checkbox" checked={assignmentForm.boot_once} onChange={e => setAssignForm(a => ({ ...a, boot_once: e.target.checked }))} />
                <span className="text-xs" style={{ color: CH.textSub }}>Boot-once (single PXE provision)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <CHBtn variant="primary" onClick={createAssignment} disabled={busy}>{busy ? 'Saving…' : 'Create PXE Assignment'}</CHBtn>
              <CHBtn variant="ghost" onClick={refreshAssignments}>Refresh</CHBtn>
            </div>
          </CHCard>

          <CHCard>
            <CHLabel>Active PXE Assignments ({assignments.length})</CHLabel>
            <CHTable headers={['Hostname', 'MAC', 'Profile', 'Network', 'Status']} emptyMessage="No PXE assignments yet." className="mt-4">
              {assignments.map(a => (
                <CHTR key={a.id}>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color: CH.text }}>{a.hostname || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: CH.textSub }}>{a.mac_address}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{a.profile?.name || '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: CH.textSub }}>{a.network?.name || '—'}</td>
                  <td className="px-4 py-3"><CHBadge color={a.is_enabled ? CH.green : CH.textSub}>{a.is_enabled ? 'Active' : 'Disabled'}</CHBadge></td>
                </CHTR>
              ))}
            </CHTable>
          </CHCard>
        </div>
      )}

      {/* ── SESSIONS ── */}
      {tab === 'sessions' && (
        <CHCard>
          <div className="flex items-center justify-between mb-4">
            <CHLabel>Live Boot Sessions ({bootSessions.length})</CHLabel>
            <CHBtn variant="ghost" onClick={refreshBootSessions}><RefreshCw size={14} /></CHBtn>
          </div>
          <div className="space-y-3">
            {bootSessions.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: CH.textSub }}>No boot sessions yet.</p> : null}
            {bootSessions.map(s => (
              <div key={s.id} className="p-4 rounded-xl" style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{s.hostname || s.assignment?.hostname || s.mac_address}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{s.current_stage} · {s.status} · {s.provisioning_source || 'unknown source'}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{s.relay?.name ? `Relay: ${s.relay.name}` : 'No relay'}{s.controller_url ? ` · ${s.controller_url}` : ''}</p>
                    {s.events?.length > 0 && <p className="text-xs mt-1" style={{ color: CH.textSub }}>Latest event: {s.events[0].event_type} ({s.events[0].source})</p>}
                  </div>
                  <CHBadge color={CH.accent}>{s.event_count || 0} events</CHBadge>
                </div>
              </div>
            ))}
          </div>
        </CHCard>
      )}
    </CHPage>
  );
}
