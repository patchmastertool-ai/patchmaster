import React, { useEffect, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CHTable, CHTR, CH } from './CH.jsx';
import { RefreshCw, Plus, User, Shield, Trash2, Key, Settings } from 'lucide-react';

const ROLES = ['admin', 'operator', 'viewer'];
const roleColor = r => ({ admin: CH.red, operator: CH.yellow, viewer: CH.green }[r] || CH.textSub);

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
    if (r.ok) { setCreateMsg('✓ User created!'); setNewUser({ username: '', email: '', password: '', full_name: '', role: 'viewer' }); setShowCreate(false); refresh(); }
    else setCreateMsg(d.detail || 'Failed to create user');
  };

  const adminResetPw = async () => {
    setResetMsg('');
    if (!resetPw.password) { setResetMsg('Enter a new password'); return; }
    const r = await apiFetch(`${API}/api/auth/users/${resetPw.userId}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: resetPw.password }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setResetMsg('✓ Reset!'); setResetPw({ userId: null, password: '' }); } else setResetMsg(d.detail || 'Failed');
  };

  const openPermsEditor = u => { setPermsUser(u); setEditPerms(u.effective_permissions || {}); setPermsMsg(''); };
  const togglePerm      = feat => setEditPerms(p => ({ ...p, [feat]: !p[feat] }));
  const savePerms       = async () => {
    if (!editPermsUser) return; setPermsMsg('');
    const permsToSave = {};
    for (const f of allFeatures) permsToSave[f] = !!editPerms[f];
    const r = await apiFetch(`${API}/api/auth/users/${editPermsUser.id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: permsToSave }) });
    if (r.ok) { setPermsMsg('✓ Saved!'); refresh(); } else { const d = await r.json().catch(() => ({})); setPermsMsg(d.detail || 'Failed'); }
  };
  const resetPermsToRole = () => {
    if (editPermsUser && roleDefaults) setEditPerms({ ...roleDefaults[editPermsUser.role] });
  };

  const saveLdap = async () => {
    setLdapMsg('');
    const r = await apiFetch(`${API}/api/auth/ldap/config`, { method: 'POST', body: JSON.stringify(ldapConfig) });
    const d = await r.json().catch(() => ({}));
    setLdapMsg(r.ok ? '✓ LDAP config saved' : d.detail || 'Failed');
  };
  const testLdap = async () => {
    setLdapMsg('');
    const r = await apiFetch(`${API}/api/auth/ldap/test`, { method: 'POST', body: JSON.stringify(ldapConfig) });
    const d = await r.json().catch(() => ({}));
    setLdapMsg(r.ok ? `✓ LDAP test passed: ${d.message || 'Connected'}` : `✗ ${d.detail || 'Test failed'}`);
  };
  const syncLdap = async () => {
    setLdapSyncing(true); setLdapMsg('');
    const r = await apiFetch(`${API}/api/auth/ldap/sync`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setLdapMsg(r.ok ? `✓ Synced: ${d.synced_users ?? (d.message || 'done')}` : (d.detail || 'Sync failed'));
    setLdapSyncing(false);
  };

  const inputStyle = { background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text };

  const adminCount    = users.filter(u => u.role === 'admin').length;
  const operatorCount = users.filter(u => u.role === 'operator').length;
  const ldapUsers     = users.filter(u => u.is_ldap).length;

  return (
    <CHPage>
      <CHHeader
        kicker="Identity Management"
        title="Users & Access"
        subtitle={`${users.length} accounts · ${adminCount} admin · LDAP ${ldapStatus?.enabled ? 'connected' : 'disabled'}`}
        actions={
          <div className="flex gap-2">
            <CHBtn variant="ghost" onClick={refresh}><RefreshCw size={14} /></CHBtn>
            <CHBtn variant="primary" onClick={() => setShowCreate(v => !v)}>
              <Plus size={14} /> {showCreate ? 'Cancel' : 'Create User'}
            </CHBtn>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Users" value={users.length}     sub="registered"    accent={CH.accent} />
        <CHStat label="Admins"      value={adminCount}       sub="full access"   accent={CH.red} />
        <CHStat label="Operators"   value={operatorCount}    sub="platform ops"  accent={CH.yellow} />
        <CHStat label="LDAP Users"  value={ldapUsers}        sub="directory sync" accent={CH.green} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'users',   l: `Users (${users.length})` },
          { k: 'create',  l: 'Create User' },
          { k: 'perms',   l: 'Permissions' },
          { k: 'ldap',    l: 'LDAP / SSO' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ background: tab === t.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)', color: tab === t.k ? CH.accent : CH.textSub, border: `1px solid ${tab === t.k ? CH.accent + '40' : CH.border}` }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* User Table */}
      {tab === 'users' && (
        <CHCard>
          <CHLabel>User Accounts</CHLabel>
          <CHTable headers={['User', 'Role', 'Status', 'Source', 'Actions']} emptyMessage="No users found." className="mt-4">
            {users.map(u => (
              <CHTR key={u.id}>
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-bold" style={{ color: CH.text }}>{u.username}</p>
                    <p className="text-xs" style={{ color: CH.textSub }}>{u.email || '—'} {u.full_name ? `· ${u.full_name}` : ''}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs"
                    style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: roleColor(u.role) }}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <CHBadge color={u.is_active !== false ? CH.green : CH.textSub}>{u.is_active !== false ? 'Active' : 'Inactive'}</CHBadge>
                </td>
                <td className="px-6 py-4">
                  <CHBadge color={u.is_ldap ? '#60a5fa' : CH.textSub}>{u.is_ldap ? 'LDAP' : 'Local'}</CHBadge>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-1.5 justify-end flex-wrap">
                    <CHBtn variant="ghost" onClick={() => openEditUser(u)}><Settings size={12} /></CHBtn>
                    <CHBtn variant="ghost" onClick={() => { setResetPw({ userId: u.id, password: '' }); setResetMsg(''); setTab('create'); }}>
                      <Key size={12} />
                    </CHBtn>
                    <CHBtn variant="ghost" onClick={() => toggleActive(u.id, u.is_active !== false)}>
                      {u.is_active !== false ? 'Deactivate' : 'Activate'}
                    </CHBtn>
                    <CHBtn variant="default" onClick={() => openPermsEditor(u)}>Perms</CHBtn>
                    {!u.is_ldap && <CHBtn variant="danger" onClick={() => del(u.id)}><Trash2 size={12} /></CHBtn>}
                  </div>
                </td>
              </CHTR>
            ))}
          </CHTable>
        </CHCard>
      )}

      {/* Create / Reset */}
      {tab === 'create' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-4">
            <CHLabel>Create New User</CHLabel>
            {[
              { k: 'username',  p: 'Username',      t: 'text' },
              { k: 'email',     p: 'Email',          t: 'email' },
              { k: 'full_name', p: 'Full Name',      t: 'text' },
              { k: 'password',  p: 'Password',       t: 'password' },
            ].map(f => (
              <div key={f.k} className="flex flex-col gap-1">
                <CHLabel>{f.p}</CHLabel>
                <input type={f.t} value={newUser[f.k]} onChange={e => setNewUser(u => ({ ...u, [f.k]: e.target.value }))}
                  placeholder={f.p} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <CHLabel>Role</CHLabel>
              <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            {createMsg && (
              <div className="rounded-xl px-4 py-3 text-sm font-bold"
                style={{ background: createMsg.startsWith('✓') ? `${CH.green}12` : `${CH.red}12`, color: createMsg.startsWith('✓') ? CH.green : CH.red }}>
                {createMsg}
              </div>
            )}
            <CHBtn variant="primary" onClick={createUser}>Create User</CHBtn>
          </CHCard>

          {resetPw.userId && (
            <CHCard className="space-y-4">
              <CHLabel>Admin Reset Password</CHLabel>
              <p className="text-xs" style={{ color: CH.textSub }}>User: {users.find(u => u.id === resetPw.userId)?.username}</p>
              <div className="flex flex-col gap-1">
                <CHLabel>New Password</CHLabel>
                <input type="password" value={resetPw.password}
                  onChange={e => setResetPw(p => ({ ...p, password: e.target.value }))}
                  placeholder="New password" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
              {resetMsg && <div className="text-sm font-bold" style={{ color: resetMsg.startsWith('✓') ? CH.green : CH.red }}>{resetMsg}</div>}
              <div className="flex gap-3">
                <CHBtn variant="primary" onClick={adminResetPw}>Reset Password</CHBtn>
                <CHBtn variant="ghost" onClick={() => { setResetPw({ userId: null, password: '' }); setResetMsg(''); }}>Cancel</CHBtn>
              </div>
            </CHCard>
          )}

          {editUser && (
            <CHCard className="space-y-4">
              <CHLabel>Edit Profile — {editUser.username}</CHLabel>
              {[
                { k: 'email',     p: 'Email',     t: 'email' },
                { k: 'full_name', p: 'Full Name', t: 'text'  },
              ].map(f => (
                <div key={f.k} className="flex flex-col gap-1">
                  <CHLabel>{f.p}</CHLabel>
                  <input type={f.t} value={editUser[f.k]} onChange={e => setEditUser(u => ({ ...u, [f.k]: e.target.value }))}
                    className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
                </div>
              ))}
              {editUserMsg && <div className="text-sm font-bold" style={{ color: CH.red }}>{editUserMsg}</div>}
              <div className="flex gap-3">
                <CHBtn variant="primary" onClick={saveEditUser}>Save</CHBtn>
                <CHBtn variant="ghost" onClick={() => setEditUser(null)}>Cancel</CHBtn>
              </div>
            </CHCard>
          )}
        </div>
      )}

      {/* Permissions */}
      {tab === 'perms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard>
            <CHLabel>Select User to Edit Permissions</CHLabel>
            <div className="mt-4 space-y-2">
              {users.map(u => (
                <button key={u.id} onClick={() => openPermsEditor(u)}
                  className="w-full text-left p-3 rounded-lg transition-all"
                  style={{ background: editPermsUser?.id === u.id ? `${CH.accent}12` : 'rgba(3,29,75,0.3)', border: `1px solid ${editPermsUser?.id === u.id ? CH.accent + '30' : CH.border}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: CH.text }}>{u.username}</p>
                      <p className="text-xs" style={{ color: CH.textSub }}>{u.email || '—'}</p>
                    </div>
                    <CHBadge color={roleColor(u.role)}>{u.role}</CHBadge>
                  </div>
                </button>
              ))}
            </div>
          </CHCard>

          <CHCard>
            {editPermsUser ? (
              <>
                <CHLabel>Permissions — {editPermsUser.username}</CHLabel>
                <div className="mt-4 grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {allFeatures.map(feat => (
                    <label key={feat} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                      style={{ background: 'rgba(3,29,75,0.3)' }}>
                      <input type="checkbox" checked={!!editPerms[feat]} onChange={() => togglePerm(feat)} />
                      <span className="text-xs" style={{ color: CH.textSub }}>{feat.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
                {permsMsg && <div className="mt-3 text-sm font-bold" style={{ color: permsMsg.startsWith('✓') ? CH.green : CH.red }}>{permsMsg}</div>}
                <div className="flex gap-3 mt-4">
                  <CHBtn variant="primary" onClick={savePerms}>Save Permissions</CHBtn>
                  <CHBtn variant="ghost" onClick={resetPermsToRole}>Reset to Role Defaults</CHBtn>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield size={48} style={{ color: CH.textSub, opacity: 0.3 }} />
                <p className="text-xs uppercase tracking-widest font-bold mt-4" style={{ color: CH.textSub }}>Select a user to manage permissions</p>
              </div>
            )}
          </CHCard>
        </div>
      )}

      {/* LDAP */}
      {tab === 'ldap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="space-y-4">
            <div className="flex items-center justify-between">
              <CHLabel>LDAP / Active Directory Configuration</CHLabel>
              <CHBadge color={ldapStatus?.enabled ? CH.green : CH.textSub}>{ldapStatus?.enabled ? 'Connected' : 'Disabled'}</CHBadge>
            </div>
            {[
              { k: 'server',        p: 'LDAP Server (ldap://…)' },
              { k: 'base_dn',       p: 'Base DN' },
              { k: 'bind_dn',       p: 'Bind DN' },
              { k: 'bind_password', p: 'Bind Password', t: 'password' },
              { k: 'user_search_filter', p: 'User Search Filter' },
              { k: 'admin_group_dn',    p: 'Admin Group DN' },
              { k: 'operator_group_dn', p: 'Operator Group DN' },
            ].map(f => (
              <div key={f.k} className="flex flex-col gap-1">
                <CHLabel>{f.p}</CHLabel>
                <input type={f.t || 'text'} value={ldapConfig[f.k]}
                  onChange={e => setLdapConfig(c => ({ ...c, [f.k]: e.target.value }))}
                  className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
              </div>
            ))}
            <div className="flex gap-6">
              {[{ k: 'use_ssl', l: 'Use SSL' }, { k: 'verify_ssl', l: 'Verify SSL' }].map(chk => (
                <label key={chk.k} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!ldapConfig[chk.k]} onChange={e => setLdapConfig(c => ({ ...c, [chk.k]: e.target.checked }))} />
                  <span className="text-xs" style={{ color: CH.textSub }}>{chk.l}</span>
                </label>
              ))}
            </div>
            {ldapMsg && (
              <div className="rounded-xl px-4 py-3 text-sm font-bold"
                style={{ background: ldapMsg.startsWith('✓') ? `${CH.green}12` : `${CH.red}12`, color: ldapMsg.startsWith('✓') ? CH.green : CH.red }}>
                {ldapMsg}
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <CHBtn variant="primary" onClick={saveLdap}>Save Config</CHBtn>
              <CHBtn variant="default" onClick={testLdap}>Test Connection</CHBtn>
              <CHBtn variant="ghost" onClick={syncLdap} disabled={ldapSyncing}>{ldapSyncing ? 'Syncing…' : 'Sync Now'}</CHBtn>
            </div>
          </CHCard>

          <CHCard>
            <CHLabel>LDAP Status</CHLabel>
            {ldapStatus && (
              <div className="mt-4 space-y-3">
                {Object.entries(ldapStatus).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                    <span className="text-xs" style={{ color: CH.textSub }}>{k.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-bold font-mono" style={{ color: CH.text }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </CHCard>
        </div>
      )}
    </CHPage>
  );
}
