import React, { useEffect, useState } from 'react';
import {
  StitchPageHeader,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchButton,
  StitchBadge,
  StitchTable,
} from './components/StitchComponents';

const ROLES = ['admin', 'operator', 'viewer'];

export default function UsersOpsPage({ API, apiFetch }) {
  const [users, setUsers]             = useState([]);
  const [tab, setTab]                 = useState('users');
  const [showCreate, setShowCreate]   = useState(false);
  const [newUser, setNewUser]         = useState({ username: '', email: '', password: '', full_name: '', role: 'viewer' });
  const [createMsg, setCreateMsg]     = useState('');
  const [resetPw, setResetPw]         = useState({ userId: null, password: '' });
  const [resetMsg, setResetMsg]       = useState('');
  const [editUser, setEditUser]       = useState(null);
  const [editUserMsg, setEditUserMsg] = useState('');
  const [editPermsUser, setPermsUser] = useState(null);
  const [editPerms, setEditPerms]     = useState({});
  const [permsMsg, setPermsMsg]       = useState('');
  const [roleDefaults, setRoleDefs]   = useState(null);
  const [allFeatures, setFeatures]    = useState([]);
  const [ldapStatus, setLdapStatus]   = useState(null);
  const [ldapConfig, setLdapConfig]   = useState({
    server: '', base_dn: '', bind_dn: '', bind_password: '',
    user_search_filter: '(sAMAccountName={username})',
    admin_group_dn: '', operator_group_dn: '',
    use_ssl: false, verify_ssl: true, timeout: 10,
  });
  const [ldapMsg, setLdapMsg]         = useState('');
  const [ldapSyncing, setLdapSyncing] = useState(false);

  const refresh = () => { apiFetch(`${API}/api/auth/users`).then(r => r.json()).then(setUsers).catch(() => {}); };

  useEffect(() => {
    refresh();
    apiFetch(`${API}/api/auth/role-defaults`).then(r => r.json()).then(d => { setRoleDefs(d.role_defaults); setFeatures(d.features); }).catch(() => {});
    apiFetch(`${API}/api/auth/ldap/status`).then(r => r.json()).then(setLdapStatus).catch(() => {});
  }, []);

  const changeRole   = async (id, role) => { await apiFetch(`${API}/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) }); refresh(); };
  const toggleActive = async (id, is_active) => { await apiFetch(`${API}/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: !is_active }) }); refresh(); };
  const del          = id => { if (!window.confirm('Delete this user? This cannot be undone.')) return; apiFetch(`${API}/api/auth/users/${id}`, { method: 'DELETE' }).then(refresh); };

  const openEditUser = u => { setEditUser({ id: u.id, username: u.username, email: u.email || '', full_name: u.full_name || '' }); setEditUserMsg(''); };
  const saveEditUser = async () => {
    if (!editUser) return; setEditUserMsg('');
    const r = await apiFetch(`${API}/api/auth/users/${editUser.id}`, { method: 'PUT', body: JSON.stringify({ email: editUser.email, full_name: editUser.full_name }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setEditUser(null); refresh(); } else setEditUserMsg(d.detail || 'Failed to update');
  };

  const createUser = async () => {
    setCreateMsg('');
    if (!newUser.username || !newUser.email || !newUser.password) { setCreateMsg('All fields are required'); return; }
    const r = await apiFetch(`${API}/api/auth/users`, { method: 'POST', body: JSON.stringify(newUser) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setCreateMsg('User created!'); setNewUser({ username: '', email: '', password: '', full_name: '', role: 'viewer' }); setShowCreate(false); refresh(); }
    else setCreateMsg(d.detail || 'Failed to create user');
  };

  const adminResetPw = async () => {
    setResetMsg('');
    if (!resetPw.password) { setResetMsg('Enter a new password'); return; }
    const r = await apiFetch(`${API}/api/auth/users/${resetPw.userId}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: resetPw.password }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setResetMsg('Reset!'); setResetPw({ userId: null, password: '' }); } else setResetMsg(d.detail || 'Failed');
  };

  const openPermsEditor = u => { setPermsUser(u); setEditPerms(u.effective_permissions || {}); setPermsMsg(''); };
  const togglePerm      = feat => setEditPerms(p => ({ ...p, [feat]: !p[feat] }));
  const savePerms       = async () => {
    if (!editPermsUser) return; setPermsMsg('');
    const permsToSave = {};
    for (const f of allFeatures) permsToSave[f] = !!editPerms[f];
    const r = await apiFetch(`${API}/api/auth/users/${editPermsUser.id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: permsToSave }) });
    if (r.ok) { setPermsMsg('Saved!'); refresh(); } else { const d = await r.json().catch(() => ({})); setPermsMsg(d.detail || 'Failed'); }
  };
  const resetPermsToRole = () => {
    if (editPermsUser && roleDefaults) setEditPerms({ ...roleDefaults[editPermsUser.role] });
  };

  const saveLdap = async () => {
    setLdapMsg('');
    const r = await apiFetch(`${API}/api/auth/ldap/config`, { method: 'POST', body: JSON.stringify(ldapConfig) });
    const d = await r.json().catch(() => ({}));
    setLdapMsg(r.ok ? 'LDAP config saved' : d.detail || 'Failed');
  };
  const testLdap = async () => {
    setLdapMsg('');
    const r = await apiFetch(`${API}/api/auth/ldap/test`, { method: 'POST', body: JSON.stringify(ldapConfig) });
    const d = await r.json().catch(() => ({}));
    setLdapMsg(r.ok ? `LDAP test passed: ${d.message || 'Connected'}` : `${d.detail || 'Test failed'}`);
  };
  const syncLdap = async () => {
    setLdapSyncing(true); setLdapMsg('');
    const r = await apiFetch(`${API}/api/auth/ldap/sync`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setLdapMsg(r.ok ? `Synced: ${d.synced_users ?? (d.message || 'done')}` : (d.detail || 'Sync failed'));
    setLdapSyncing(false);
  };

  const adminCount    = users.filter(u => u.role === 'admin').length;
  const operatorCount = users.filter(u => u.role === 'operator').length;
  const ldapUsers     = users.filter(u => u.is_ldap).length;

  const getRoleVariant = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'operator': return 'warning';
      case 'viewer': return 'success';
      default: return 'info';
    }
  };

  return (
    <div className="space-y-8">
      {/* Workspace Distinction Indicator */}
      <div className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30 bg-[#91aaeb]" />
      
      <StitchPageHeader
        kicker="Identity Management"
        title="Users & Access"
        description={`${users.length} accounts · ${adminCount} admin · LDAP ${ldapStatus?.enabled ? 'connected' : 'disabled'}`}
        workspace="governance"
      />

      {/* KPI Cards */}
      <StitchMetricGrid cols={4}>
        <StitchSummaryCard
          label="Total Users"
          value={users.length}
          icon="group"
          color="#7bd0ff"
        />
        <StitchSummaryCard
          label="Admins"
          value={adminCount}
          icon="shield"
          color="#ee7d77"
        />
        <StitchSummaryCard
          label="Operators"
          value={operatorCount}
          icon="build"
          color="#ffd16f"
        />
        <StitchSummaryCard
          label="LDAP Users"
          value={ldapUsers}
          icon="cloud"
          color="#10b981"
        />
      </StitchMetricGrid>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'users',   l: `Users (${users.length})` },
          { k: 'create',  l: 'Create User' },
          { k: 'perms',   l: 'Permissions' },
          { k: 'ldap',    l: 'LDAP / SSO' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              tab === t.k
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* User Table */}
      {tab === 'users' && (
        <div className="bg-surface-container-low p-6 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-on-surface">User Accounts</h2>
            <StitchButton variant="primary" size="sm" onClick={() => setShowCreate(true)} icon="add">Add User</StitchButton>
          </div>
          <StitchTable
            columns={[
              {
                key: 'username',
                header: 'Username',
                render: (val, row) => (
                  <div>
                    <p className="text-sm font-bold text-on-surface">{val}</p>
                    <p className="text-xs text-on-surface-variant">
                      {row.email || '-'} {row.full_name ? `| ${row.full_name}` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (val, row) => (
                  <select
                    value={val}
                    onChange={(e) => changeRole(row.id, e.target.value)}
                    className="px-2 py-1 rounded text-xs font-bold bg-surface-container border border-outline-variant/20 text-on-surface"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ),
              },
              {
                key: 'is_active',
                header: 'Status',
                render: (val) => <StitchBadge variant={val !== false ? 'success' : 'info'} size="sm">{val !== false ? 'Active' : 'Inactive'}</StitchBadge>,
              },
              {
                key: 'is_ldap',
                header: 'Source',
                render: (val) => <StitchBadge variant={val ? 'info' : 'warning'} size="sm">{val ? 'LDAP' : 'Local'}</StitchBadge>,
              },
              {
                key: 'last_login',
                header: 'Last Login',
                render: (val) => val ? new Date(val).toLocaleString() : '-',
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (val, row) => (
                  <div className="flex gap-2">
                    <StitchButton variant="secondary" size="sm" onClick={() => openEditUser(row)} icon="edit">Edit</StitchButton>
                    <StitchButton variant="secondary" size="sm" onClick={() => { setResetPw({ userId: row.id, password: '' }); setTab('create'); }} icon="key">Reset PW</StitchButton>
                    <StitchButton variant="secondary" size="sm" onClick={() => toggleActive(row.id, row.is_active !== false)} icon="power_settings_new">Toggle</StitchButton>
                    <StitchButton variant="secondary" size="sm" onClick={() => openPermsEditor(row)} icon="shield">Perms</StitchButton>
                    {!row.is_ldap && <StitchButton variant="secondary" size="sm" onClick={() => del(row.id)} icon="delete">Delete</StitchButton>}
                  </div>
                ),
              }
            ]}
            data={users}
          />
        </div>
      )}

      {/* Create / Reset / Edit */}
      {tab === 'create' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {showCreate && (
            <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-bold text-on-surface">Create New User</h2>
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                value={newUser.username}
                onChange={(e) => setNewUser(u => ({ ...u, username: e.target.value }))}
                placeholder="Username"
              />
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(u => ({ ...u, email: e.target.value }))}
                placeholder="Email"
              />
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                value={newUser.full_name}
                onChange={(e) => setNewUser(u => ({ ...u, full_name: e.target.value }))}
                placeholder="Full Name"
              />
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(u => ({ ...u, password: e.target.value }))}
                placeholder="Password"
              />
              <select
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                value={newUser.role}
                onChange={(e) => setNewUser(u => ({ ...u, role: e.target.value }))}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {createMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm font-bold ${
                  createMsg.includes('created') ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error'
                }`}>
                  {createMsg}
                </div>
              )}
              <div className="flex gap-3">
                <StitchButton variant="primary" onClick={createUser} icon="add">Create User</StitchButton>
                <StitchButton variant="secondary" onClick={() => setShowCreate(false)} icon="close">Cancel</StitchButton>
              </div>
            </div>
          )}

          {resetPw.userId && (
            <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-bold text-on-surface">Admin Reset Password</h2>
              <p className="text-xs text-on-surface-variant">User: {users.find(u => u.id === resetPw.userId)?.username}</p>
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                type="password"
                value={resetPw.password}
                onChange={(e) => setResetPw(p => ({ ...p, password: e.target.value }))}
                placeholder="New password"
              />
              {resetMsg && <div className={`text-sm font-bold ${resetMsg.includes('Reset') ? 'text-primary' : 'text-error'}`}>{resetMsg}</div>}
              <div className="flex gap-3">
                <StitchButton variant="primary" onClick={adminResetPw} icon="key">Reset Password</StitchButton>
                <StitchButton variant="secondary" onClick={() => { setResetPw({ userId: null, password: '' }); setResetMsg(''); }} icon="close">Cancel</StitchButton>
              </div>
            </div>
          )}

          {editUser && (
            <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-bold text-on-surface">Edit Profile - {editUser.username}</h2>
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                type="email"
                value={editUser.email}
                onChange={(e) => setEditUser(u => ({ ...u, email: e.target.value }))}
              />
              <input
                className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm"
                value={editUser.full_name}
                onChange={(e) => setEditUser(u => ({ ...u, full_name: e.target.value }))}
              />
              {editUserMsg && <div className="text-sm font-bold text-error">{editUserMsg}</div>}
              <div className="flex gap-3">
                <StitchButton variant="primary" onClick={saveEditUser} icon="save">Save</StitchButton>
                <StitchButton variant="secondary" onClick={() => setEditUser(null)} icon="close">Cancel</StitchButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permissions */}
      {tab === 'perms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-container-low p-6 rounded-xl">
            <h2 className="text-lg font-bold text-on-surface mb-4">Select User</h2>
            <div className="space-y-2">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => openPermsEditor(u)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    editPermsUser?.id === u.id
                      ? 'bg-primary/20 border border-primary/30'
                      : 'bg-surface-container border border-outline-variant/20 hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{u.username}</p>
                      <p className="text-xs text-on-surface-variant">{u.email || '-'}</p>
                    </div>
                    <StitchBadge variant={getRoleVariant(u.role)} size="sm">{u.role}</StitchBadge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-xl">
            {editPermsUser ? (
              <>
                <h2 className="text-lg font-bold text-on-surface mb-4">Permissions - {editPermsUser.username}</h2>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto mb-4">
                  {allFeatures.map(feat => (
                    <label key={feat} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer bg-surface-container hover:bg-surface-container-high">
                      <input
                        type="checkbox"
                        checked={!!editPerms[feat]}
                        onChange={() => togglePerm(feat)}
                        className="rounded border-outline-variant/20 text-primary focus:ring-primary"
                      />
                      <span className="text-xs text-on-surface-variant">{feat.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
                {permsMsg && <div className={`mb-4 text-sm font-bold ${permsMsg.includes('Saved') ? 'text-primary' : 'text-error'}`}>{permsMsg}</div>}
                <div className="flex gap-3">
                  <StitchButton variant="primary" onClick={savePerms} icon="save">Save Permissions</StitchButton>
                  <StitchButton variant="secondary" onClick={resetPermsToRole} icon="refresh">Reset to Role</StitchButton>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-symbols-outlined text-on-surface-variant opacity-30 mb-4" style={{ fontSize: 48 }}>shield</span>
                <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Select a user to manage permissions</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LDAP */}
      {tab === 'ldap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">LDAP / Active Directory</h2>
              <StitchBadge variant={ldapStatus?.enabled ? 'success' : 'info'} size="sm">{ldapStatus?.enabled ? 'Connected' : 'Disabled'}</StitchBadge>
            </div>
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" value={ldapConfig.server} onChange={(e) => setLdapConfig(c => ({ ...c, server: e.target.value }))} placeholder="LDAP Server (ldap://...)" />
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" value={ldapConfig.base_dn} onChange={(e) => setLdapConfig(c => ({ ...c, base_dn: e.target.value }))} placeholder="Base DN" />
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" value={ldapConfig.bind_dn} onChange={(e) => setLdapConfig(c => ({ ...c, bind_dn: e.target.value }))} placeholder="Bind DN" />
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" type="password" value={ldapConfig.bind_password} onChange={(e) => setLdapConfig(c => ({ ...c, bind_password: e.target.value }))} placeholder="Bind Password" />
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" value={ldapConfig.user_search_filter} onChange={(e) => setLdapConfig(c => ({ ...c, user_search_filter: e.target.value }))} placeholder="User Search Filter" />
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" value={ldapConfig.admin_group_dn} onChange={(e) => setLdapConfig(c => ({ ...c, admin_group_dn: e.target.value }))} placeholder="Admin Group DN" />
            <input className="w-full bg-surface-container border border-outline-variant/20 text-on-surface px-4 py-2 rounded-lg text-sm" value={ldapConfig.operator_group_dn} onChange={(e) => setLdapConfig(c => ({ ...c, operator_group_dn: e.target.value }))} placeholder="Operator Group DN" />
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!ldapConfig.use_ssl} onChange={(e) => setLdapConfig(c => ({ ...c, use_ssl: e.target.checked }))} className="rounded border-outline-variant/20 text-primary" />
                <span className="text-xs text-on-surface-variant">Use SSL</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!ldapConfig.verify_ssl} onChange={(e) => setLdapConfig(c => ({ ...c, verify_ssl: e.target.checked }))} className="rounded border-outline-variant/20 text-primary" />
                <span className="text-xs text-on-surface-variant">Verify SSL</span>
              </label>
            </div>
            {ldapMsg && <div className={`rounded-xl px-4 py-3 text-sm font-bold ${ldapMsg.includes('passed') || ldapMsg.includes('saved') ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error'}`}>{ldapMsg}</div>}
            <div className="flex gap-3 flex-wrap">
              <StitchButton variant="primary" onClick={saveLdap} icon="save">Save Config</StitchButton>
              <StitchButton variant="secondary" onClick={testLdap} icon="sensors">Test Connection</StitchButton>
              <StitchButton variant="secondary" onClick={syncLdap} disabled={ldapSyncing} icon="refresh">{ldapSyncing ? 'Syncing...' : 'Sync Now'}</StitchButton>
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-xl">
            <h2 className="text-lg font-bold text-on-surface mb-4">LDAP Status</h2>
            {ldapStatus && (
              <div className="space-y-3">
                {Object.entries(ldapStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-3 rounded-lg bg-surface-container border border-outline-variant/20">
                    <span className="text-xs text-on-surface-variant">{k.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-bold font-mono text-on-surface">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
