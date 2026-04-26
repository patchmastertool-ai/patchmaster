import os
import sys

FRONTEND = r'c:\Users\test\Desktop\pat-1\frontend\src'

def splice(filename, keep_lines, new_return_content):
    """Keep first keep_lines lines, then append the new return block."""
    path = os.path.join(FRONTEND, filename)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    top = ''.join(lines[:keep_lines])
    with open(path, 'w', encoding='utf-8') as f:
        f.write(top)
        f.write(new_return_content)
    print(f"OK: {filename}")

# ────────────────────────────────────────────────────────────────
# Phase 3 pages
# ────────────────────────────────────────────────────────────────

SOFTWARE_RETURN = """
  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <section className="mb-0 p-8 rounded-2xl bg-surface-container-low border border-outline-variant/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#a855f7]" />
        <div className="absolute top-[-20%] right-[-5%] w-[40%] h-[150%] blur-3xl pointer-events-none bg-gradient-to-l from-[#a855f7]/10 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-on-surface-variant flex items-center">
              <span className="material-symbols-outlined text-[12px] mr-1">inventory_2</span>
              Software Distribution
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-[#a855f7]">apps</span>
            Software Kiosk &amp; Push
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm">
            Push packages across your fleet instantly, maintain an approved self-service catalog, and queue installs for controlled shutdown cycles. A unified software distribution platform for enterprise operators.
          </p>
        </div>
      </section>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map(s => (
          <div key={s.label} className="bg-surface-container p-6 rounded-2xl border border-outline-variant/5 shadow-lg flex flex-col justify-between group hover:border-outline-variant/20 transition-colors">
            <div className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant mb-4">{s.label}</div>
            <strong className="text-3xl font-black text-on-surface block">{s.value}</strong>
            <p className="text-[10px] text-on-surface-variant mt-1 opacity-75">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab Strip */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-surface-container-high border border-outline-variant/10 shadow-inner w-full">
        {[['push', 'Operator Push'], ['kiosk', 'Approved Catalog']].map(([k, l]) => (
          <button key={k} className={`flex-1 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === k ? 'bg-[#a855f7] text-white shadow-md' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-highest'}`} onClick={() => setView(k)}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Operator Push View ── */}
      {view === 'push' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Host selection */}
            <div className="lg:col-span-5 bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#a855f7]">dns</span>
                  Select Target Hosts ({selectedHosts.length})
                </h3>
                <div className="flex gap-2">
                  <button className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline" onClick={selectAll}>All</button>
                  <span className="text-outline-variant">|</span>
                  <button className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface" onClick={selectNone}>None</button>
                </div>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {hosts.map(host => (
                  <label key={host.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedHosts.includes(host.ip) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface-container-high border border-transparent'}`}>
                    <input type="checkbox" checked={selectedHosts.includes(host.ip)} onChange={() => toggleHost(host.ip)} className="rounded text-primary focus:ring-primary h-4 w-4" />
                    <div>
                      <span className="text-sm font-bold text-on-surface block">{host.hostname || host.name}</span>
                      <span className="text-[9px] text-on-surface-variant font-mono">{host.ip} · {host.os || 'Unknown OS'}{host.site ? ` · ${host.site}` : ''}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Configuration */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-[16px] text-[#a855f7]">settings</span>
                  Configure Action
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Operation</label>
                    <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={action} onChange={e => setAction(e.target.value)}>
                      <option value="install">Install Package</option>
                      <option value="remove">Remove Package</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Execution Mode</label>
                    <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={executionMode} onChange={e => setExecutionMode(e.target.value)}>
                      <option value="immediate">Immediate Execution</option>
                      <option value="shutdown">Queue for Controlled Shutdown</option>
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Package Names (comma-separated)</label>
                  <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner font-mono" placeholder="nginx, curl, vim" value={packages} onChange={e => setPackages(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Change Ticket / Reason</label>
                  <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="CHG-12345 (optional)" value={operatorNote} onChange={e => setOperatorNote(e.target.value)} />
                </div>
                <div className="flex justify-end pt-4 border-t border-outline-variant/10">
                  <button className="bg-[#a855f7] hover:brightness-110 text-white px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 flex items-center gap-2" onClick={executeOperatorAction} disabled={loading || !selectedHosts.length || !packages.trim()}>
                    <span className="material-symbols-outlined text-[16px]">{loading ? 'sync' : executionMode === 'shutdown' ? 'schedule' : 'bolt'}</span>
                    {loading ? 'Processing...' : executionMode === 'shutdown' ? 'Queue Action' : 'Execute Now'}
                  </button>
                </div>
              </div>

              {results.length > 0 && (
                <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">Execution Results</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {results.map((r, idx) => (
                      <div key={`${r.ip}-${idx}`} className={`flex items-center justify-between p-3 rounded-xl border ${r.status === 'success' ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'}`}>
                        <span className="text-xs font-mono font-bold text-on-surface">{r.ip}</span>
                        <span className="text-xs text-on-surface-variant max-w-xs truncate">{r.message}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${r.status === 'success' ? 'text-success bg-success/10' : 'text-error bg-error/10'}`}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shutdown Queue */}
          {selectedSingleHost && (
            <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-warning">schedule</span>
                    Controlled Shutdown Queue — <span className="font-mono">{selectedSingleHost}</span>
                  </h3>
                </div>
                <div className="flex gap-3">
                  <button className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline" onClick={() => fetchQueue(selectedSingleHost)}>{queueState.loading ? 'Refreshing...' : 'Refresh'}</button>
                  <button className="bg-warning/20 text-warning hover:bg-warning hover:text-[#422100] border border-warning/30 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-colors" onClick={() => runPowerAction('reboot')}>Reboot + Run Queue</button>
                  <button className="bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-colors" onClick={() => runPowerAction('shutdown')}>Shutdown + Run Queue</button>
                </div>
              </div>
              <div className="p-6">
                {queueState.items.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-8 opacity-50">No shutdown-queued installs for this host.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead className="border-b border-outline-variant/20">
                      <tr>
                        <th className="py-2 px-4 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Queued At</th>
                        <th className="py-2 px-4 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Action</th>
                        <th className="py-2 px-4 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Packages</th>
                        <th className="py-2 px-4 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Requested By</th>
                        <th className="py-2 px-4 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {queueState.items.map(item => (
                        <tr key={item.id} className="hover:bg-surface-container-high transition-colors">
                          <td className="py-3 px-4 text-[10px] font-mono text-secondary-dim">{item.queued_at ? new Date(item.queued_at).toLocaleString() : '—'}</td>
                          <td className="py-3 px-4 text-xs font-bold text-on-surface">{item.action}</td>
                          <td className="py-3 px-4 text-xs font-mono text-primary">{Array.isArray(item.packages) ? item.packages.join(', ') : ''}</td>
                          <td className="py-3 px-4 text-xs text-on-surface-variant">{item.requested_by || '—'}</td>
                          <td className="py-3 px-4 text-xs text-on-surface-variant">{item.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Kiosk / Catalog View ── */}
      {view === 'kiosk' && (
        <>
          {/* Target Host + Execution Override */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Target Host</label>
                <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={kioskHostId} onChange={e => setKioskHostId(e.target.value)}>
                  <option value="">Choose target host...</option>
                  {kioskHosts.map(host => <option key={host.id} value={host.id}>{host.hostname || host.name} ({host.ip})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Execution Override</label>
                <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={kioskExecutionOverride} onChange={e => setKioskExecutionOverride(e.target.value)}>
                  <option value="default">Use catalog default</option>
                  <option value="immediate">Force immediate</option>
                  <option value="shutdown">Force controlled shutdown</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Request Note</label>
              <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="Reason for this request..." value={kioskNote} onChange={e => setKioskNote(e.target.value)} />
            </div>
            {kioskMessage && <p className="mt-4 text-sm font-mono text-primary">{kioskMessage}</p>}
          </div>

          {/* Catalog Grid */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">Approved Software Catalog</h3>
            </div>
            {catalogLoading ? (
              <div className="p-12 text-center text-on-surface-variant opacity-50 text-xs uppercase tracking-widest font-bold">Loading catalog...</div>
            ) : catalog.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant opacity-50 text-xs uppercase tracking-widest font-bold">No catalog items configured</div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b border-outline-variant/20 bg-surface-container-high/50">
                  <tr>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Software Title</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Package ID</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Platforms</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Mode</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {catalog.map(item => (
                    <tr key={item.id} className={`group transition-colors hover:bg-surface-container-high ${!item.is_enabled ? 'opacity-50 grayscale' : ''}`}>
                      <td className="py-4 px-6">
                        <span className="text-sm font-bold text-on-surface block">{item.name}</span>
                        <span className="text-[9px] text-on-surface-variant">{item.description || 'No description'}</span>
                      </td>
                      <td className="py-4 px-6 text-xs font-mono text-primary">{item.package_name}</td>
                      <td className="py-4 px-6 text-xs text-on-surface-variant">{(item.supported_platforms || []).join(', ') || 'Any'}</td>
                      <td className="py-4 px-6 text-xs text-secondary-dim">{item.default_execution_mode}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.is_enabled && (item.allowed_actions || []).includes('install') && (
                            <button className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-[#001d36] px-3 py-1 rounded text-[9px] font-black uppercase transition-colors" onClick={() => submitKioskRequest(item, 'install')}>Request Install</button>
                          )}
                          {item.is_enabled && (item.allowed_actions || []).includes('remove') && (
                            <button className="bg-error/10 text-error border border-error/20 hover:bg-error hover:text-white px-3 py-1 rounded text-[9px] font-black uppercase transition-colors" onClick={() => submitKioskRequest(item, 'remove')}>Request Remove</button>
                          )}
                          {!item.is_enabled && <span className="text-[9px] uppercase font-bold text-on-surface-variant opacity-50">Disabled</span>}
                          {isPrivileged && (
                            <button className="bg-surface-highest border border-outline-variant/20 hover:bg-surface-bright text-on-surface-variant px-3 py-1 rounded text-[9px] font-bold uppercase transition-colors" onClick={() => toggleCatalogItem(item)}>
                              {item.is_enabled ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Catalog Management (Admin only) */}
          {isPrivileged && (
            <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[16px] text-[#a855f7]">library_add</span>
                Add Catalog Item
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input className="bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="Display name" value={catalogForm.name} onChange={e => setCatalogForm(p => ({...p, name: e.target.value}))} />
                <input className="bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner font-mono" placeholder="Package / apt / winget ID" value={catalogForm.package_name} onChange={e => setCatalogForm(p => ({...p, package_name: e.target.value}))} />
                <input className="bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner col-span-2" placeholder="Description" value={catalogForm.description} onChange={e => setCatalogForm(p => ({...p, description: e.target.value}))} />
                <input className="bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="Platforms (comma separated)" value={catalogForm.supported_platforms} onChange={e => setCatalogForm(p => ({...p, supported_platforms: e.target.value}))} />
                <input className="bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="Allowed actions (install,remove)" value={catalogForm.allowed_actions} onChange={e => setCatalogForm(p => ({...p, allowed_actions: e.target.value}))} />
                <select className="bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={catalogForm.default_execution_mode} onChange={e => setCatalogForm(p => ({...p, default_execution_mode: e.target.value}))}>
                  <option value="immediate">Immediate by default</option>
                  <option value="shutdown">Controlled shutdown by default</option>
                </select>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={catalogForm.is_enabled} onChange={e => setCatalogForm(p => ({...p, is_enabled: e.target.checked}))} className="rounded" />
                  <span className="text-sm text-on-surface font-bold">Enable item</span>
                </label>
              </div>
              {catalogMessage && <p className="text-sm font-mono text-primary mb-3">{catalogMessage}</p>}
              <button className="bg-[#a855f7] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all" onClick={createCatalogItem}>Add Item</button>
            </div>
          )}

          {/* Request Queue */}
          <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface">Request Queue</h3>
              <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline" onClick={fetchRequests}>Refresh</button>
            </div>
            {requestsLoading ? (
              <div className="p-12 text-center text-on-surface-variant opacity-50 text-xs uppercase tracking-widest font-bold">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant opacity-50 text-xs uppercase tracking-widest font-bold">No kiosk requests yet</div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b border-outline-variant/20 bg-surface-container-high/50">
                  <tr>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">#</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Request</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Target</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Status</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Requester</th>
                    <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant text-right">Decisions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {requests.map(item => (
                    <tr key={item.id} className="hover:bg-surface-container-high transition-colors">
                      <td className="py-3 px-6 text-xs font-mono text-on-surface-variant">#{item.id}</td>
                      <td className="py-3 px-6">
                        <span className="text-xs font-bold text-on-surface block">{item.catalog_item?.name}</span>
                        <span className="text-[9px] text-on-surface-variant">{item.requested_action} · {item.note || 'No note'}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-xs text-on-surface block">{item.host?.hostname || 'Unknown'}</span>
                        <span className="text-[9px] font-mono text-on-surface-variant">{item.host?.ip || ''}</span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] uppercase font-black ${item.status === 'submitted' ? 'bg-warning/10 text-warning border border-warning/20' : item.status === 'rejected' || item.status === 'failed' ? 'bg-error/10 text-error border border-error/20' : 'bg-success/10 text-success border border-success/20'}`}>{item.status}</span>
                      </td>
                      <td className="py-3 px-6 text-xs text-on-surface-variant">{item.requested_by?.username || '—'}</td>
                      <td className="py-3 px-6 text-right">
                        {isPrivileged && item.status === 'submitted' && (
                          <div className="flex gap-2 justify-end">
                            <button className="bg-success/10 text-success hover:bg-success hover:text-[#052e16] border border-success/20 px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors" onClick={() => decideRequest(item.id, 'approve')}>Approve</button>
                            <button className="bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors" onClick={() => decideRequest(item.id, 'reject')}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
"""

BACKUP_RETURN = """
  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <section className="mb-0 p-8 rounded-2xl bg-surface-container-low border border-outline-variant/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#06b6d4]" />
        <div className="absolute top-[-20%] right-[-5%] w-[40%] h-[150%] blur-3xl pointer-events-none bg-gradient-to-l from-[#06b6d4]/10 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-on-surface-variant">Backup &amp; Disaster Recovery</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-[#06b6d4]">cloud_upload</span>
            Backup Manager
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-2xl text-sm">
            Configure and monitor enterprise database, file, and system backups. One-click restore and full job history for compliance auditing.
          </p>
        </div>
      </section>

      {/* Backup Jobs List */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden glass-gradient">
        <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-low flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[#06b6d4] text-sm">backup</span>
            Configured Backup Jobs
          </h3>
          <button className="bg-[#06b6d4] text-[#001d36] px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2" onClick={() => setShowModal(true)}>
            <span className="material-symbols-outlined text-[14px]">add</span>
            New Job
          </button>
        </div>
        <div className="overflow-x-auto min-h-[200px]">
          {configs.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant opacity-50 text-xs uppercase tracking-widest font-bold">No backup jobs configured</div>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-outline-variant/20">
                <tr>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Job Name</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Host</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Type</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Storage</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Schedule</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Retention</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Last Run</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {configs.map(c => {
                  const h = hosts.find(x => x.id === c.host_id);
                  return (
                    <tr key={c.id} className={`group hover:bg-surface-container-high transition-colors cursor-pointer ${selectedConfig === c.id ? 'bg-primary/5' : ''}`}>
                      <td className="py-4 px-6">
                        <span className="text-sm font-bold text-on-surface">{c.name}</span>
                      </td>
                      <td className="py-4 px-6 text-xs text-on-surface-variant">{h ? h.hostname : c.host_id}</td>
                      <td className="py-4 px-6">
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20">{c.backup_type}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[9px] uppercase font-bold text-secondary-dim block">{c.storage_type || 'local'}</span>
                        <span className="text-[9px] font-mono text-outline-variant">{c.storage_path || '—'}</span>
                      </td>
                      <td className="py-4 px-6 text-xs font-mono text-on-surface-variant">{c.schedule || 'Manual'}</td>
                      <td className="py-4 px-6 text-xs text-on-surface">{c.retention_count} copies</td>
                      <td className="py-4 px-6">
                        {c.last_run_status && <span className={`text-[9px] uppercase font-bold block ${c.last_run_status === 'success' ? 'text-success' : c.last_run_status === 'failed' ? 'text-error' : 'text-tertiary'}`}>{c.last_run_status}</span>}
                        <span className="text-[9px] font-mono text-secondary-dim">{c.last_run_at ? new Date(c.last_run_at).toLocaleString() : '—'}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex gap-2 justify-end">
                          <button className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-[#001d36] px-3 py-1 rounded text-[9px] font-black uppercase transition-colors" onClick={() => runBackup(c.id)}>Run Now</button>
                          <button className="bg-surface-highest border border-outline-variant/20 hover:bg-surface-bright text-on-surface px-3 py-1 rounded text-[9px] font-bold uppercase transition-colors" onClick={() => viewLogs(c.id)}>Logs</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Job History Panel */}
      {selectedConfig && (
        <div className="bg-surface-container rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden glass-gradient">
          <div className="px-6 py-5 border-b border-outline-variant/10 bg-surface-container-low flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-secondary">history</span>
              Run History
            </h3>
            <button className="text-[10px] font-bold text-on-surface-variant hover:text-on-surface uppercase tracking-widest" onClick={() => setSelectedConfig(null)}>Close</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-outline-variant/20">
                <tr>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Status</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Started</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Completed</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Size</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Duration</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant">Output</th>
                  <th className="py-3 px-6 text-[9px] uppercase font-bold tracking-widest text-on-surface-variant text-right">Restore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] uppercase font-black ${l.status === 'success' ? 'bg-success/10 text-success border border-success/20' : l.status === 'failed' ? 'bg-error/10 text-error border border-error/20' : l.status === 'running' ? 'bg-tertiary/10 text-tertiary border border-tertiary/20 animate-pulse' : 'bg-surface-highest text-on-surface border border-outline-variant/20'}`}>{l.status}</span>
                    </td>
                    <td className="py-3 px-6 text-[10px] font-mono text-secondary-dim">{new Date(l.started_at).toLocaleString()}</td>
                    <td className="py-3 px-6 text-[10px] font-mono text-secondary-dim">{l.completed_at ? new Date(l.completed_at).toLocaleString() : '—'}</td>
                    <td className="py-3 px-6 text-xs text-on-surface-variant">{l.file_size_bytes ? `${l.file_size_bytes}B` : '—'}</td>
                    <td className="py-3 px-6 text-xs text-on-surface-variant">{l.duration_seconds ? `${Math.round(l.duration_seconds)}s` : '—'}</td>
                    <td className="py-3 px-6">
                      {l.output ? (
                        <details>
                          <summary className="cursor-pointer text-[10px] font-bold text-primary uppercase tracking-widest">View Output</summary>
                          <pre className="text-[10px] font-mono bg-[#050b14] text-tertiary rounded-lg p-3 mt-2 max-h-40 overflow-y-auto">{l.output}</pre>
                        </details>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-6 text-right">
                      {l.status === 'success' && (
                        <button className="bg-surface-highest border border-outline-variant/20 hover:bg-surface-bright text-on-surface px-3 py-1 rounded text-[9px] font-bold uppercase transition-colors" onClick={() => runRestore(l.id)}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-surface-container-low border border-outline-variant/20 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/10 bg-surface-container relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#06b6d4]" />
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-on-surface">Create Backup Job</h3>
                <button onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {msg && <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs font-mono">{msg}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Job Name</label>
                  <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="e.g. Daily DB Backup" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Host</label>
                  <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={formData.host_id} onChange={e => setFormData({...formData, host_id: e.target.value})}>
                    <option value="">Select Host</option>
                    {hosts.map(h => <option key={h.id} value={h.id}>{h.hostname} ({h.ip})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Backup Type</label>
                  <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="file">File / Folder</option>
                    <option value="database">Database Dump</option>
                    <option value="vm">VM Snapshot</option>
                    <option value="live">Live Sync</option>
                    <option value="full_system">Full System Image</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Source Path / Connection String</label>
                  <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner font-mono" placeholder={formData.type === 'database' ? 'postgresql://user:pass@localhost/db' : '/var/www/html'} value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} />
                </div>
                {formData.type === 'database' && (
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Database Type</label>
                    <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={formData.db_type} onChange={e => setFormData({...formData, db_type: e.target.value})}>
                      <option value="">Select Type</option>
                      <option value="postgres">PostgreSQL</option>
                      <option value="mysql">MySQL / MariaDB</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="redis">Redis</option>
                      <option value="sqlite">SQLite</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Schedule (Cron)</label>
                  <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner font-mono" placeholder="0 2 * * *" value={formData.schedule} onChange={e => setFormData({...formData, schedule: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Retention (copies)</label>
                  <input type="number" className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={formData.retention} onChange={e => setFormData({...formData, retention: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Storage Type</label>
                  <select className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" value={formData.storage_type} onChange={e => setFormData({...formData, storage_type: e.target.value})}>
                    <option value="local">Local / Mounted</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Storage Path</label>
                  <input className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner font-mono" placeholder="/mnt/backup" value={formData.storage_path} onChange={e => setFormData({...formData, storage_path: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Compression (0-9)</label>
                  <input type="number" className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" min="0" max="9" value={formData.compression} onChange={e => setFormData({...formData, compression: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5">Encryption Key</label>
                  <input type="password" className="w-full bg-surface-container-high border-none rounded-xl text-sm text-on-surface py-3 px-4 shadow-inner" placeholder="AES-256 Key" value={formData.encryption_key} onChange={e => setFormData({...formData, encryption_key: e.target.value})} />
                </div>
                {testMsg && <div className={`col-span-2 text-xs font-mono font-bold ${testMsg.startsWith('Success:') ? 'text-success' : 'text-error'}`}>{testMsg}</div>}
              </div>
              <div className="pt-4 flex gap-3 justify-end border-t border-outline-variant/10">
                <button className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant border border-outline-variant/20 hover:bg-surface-highest" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="bg-[#06b6d4] text-[#001d36] px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50" onClick={createConfig} disabled={loading}>{loading ? 'Creating...' : 'Create Job'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

splice('SoftwarePage.jsx', 266, SOFTWARE_RETURN)
splice('BackupManagerPage.jsx', 133, BACKUP_RETURN)

print("Phase 3 (SoftwarePage, BackupManagerPage): DONE")
