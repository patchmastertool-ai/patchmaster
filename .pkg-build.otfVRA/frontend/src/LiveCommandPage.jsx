import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  StitchPageHeader,
  StitchButton,
  StitchFormField,
  StitchInput,
  StitchSelect,
  StitchBadge,
  StitchSummaryCard,
  StitchMetricGrid,
  StitchAlert
} from './components/StitchComponents';

const HISTORY_KEY = 'pm_live_command_history';
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveHistory(items) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch {} }

export default function LiveCommandPage({ hosts, API, apiFetch }) {
  const hostList = Array.isArray(hosts) ? hosts : [];
  const [mode, setMode]               = useState('single');
  const [selectedHostId, setSelHost]  = useState('');
  const [command, setCommand]         = useState('');
  const [timeoutSec, setTimeoutSec]   = useState(30);
  const [running, setRunning]         = useState(false);
  const [result, setResult]           = useState(null);
  const [workingDir, setWorkingDir]   = useState('');
  const [hostCwds, setHostCwds]       = useState({});
  const [multiResults, setMulti]      = useState([]);
  const [history, setHistory]         = useState(loadHistory);
  const textareaRef                   = useRef(null);

  useEffect(() => { if (!selectedHostId && hostList.length) setSelHost(String(hostList[0].id || '')); }, [hostList, selectedHostId]);
  useEffect(() => { setWorkingDir(hostCwds[selectedHostId] || ''); }, [selectedHostId, hostCwds]);

  const persistHistory = useCallback(items => { setHistory(items); saveHistory(items); }, []);

  const runOnHost = useCallback(async (hostId, cmd, cwd, tout) => {
    const host = hostList.find(h => String(h.id) === String(hostId));
    const startedAt = new Date().toISOString();
    try {
      const res = await apiFetch(`${API}/api/agent/by-host/${hostId}/run`, {
        method: 'POST',
        body: JSON.stringify({ command: cmd.trim(), timeout: Number(tout) || 30, working_dir: cwd || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Command failed');
      return { ok: true, host_id: hostId, host_ip: host?.ip || '', hostname: host?.hostname || host?.name || host?.ip || '', command: data.command || cmd.trim(), output: data.output || '', rc: data.rc ?? 0, working_dir: data.working_dir || cwd || '', started_at: startedAt };
    } catch (err) {
      return { ok: false, host_id: hostId, host_ip: host?.ip || '', hostname: host?.hostname || host?.name || host?.ip || '', command: cmd.trim(), output: String(err.message || err), rc: 'ERR', working_dir: cwd || '', started_at: startedAt };
    }
  }, [hostList, API, apiFetch]);

  const runSingle = async () => {
    if (!selectedHostId || !command.trim() || running) return;
    setRunning(true);
    const r = await runOnHost(selectedHostId, command.trim(), workingDir, timeoutSec);
    setResult(r);
    if (r.working_dir !== undefined) {
      setWorkingDir(r.working_dir);
      setHostCwds(prev => ({ ...prev, [selectedHostId]: r.working_dir }));
    }
    persistHistory([r, ...history].slice(0, 20));
    setRunning(false);
  };

  const runAll = async () => {
    if (!command.trim() || running) return;
    setRunning(true);
    const online = hostList.filter(h => h.is_online !== false);
    setMulti(online.map(h => ({ host_id: h.id, host_ip: h.ip, hostname: h.hostname || h.name || h.ip, status: 'running', rc: null, output: '', working_dir: hostCwds[String(h.id)] || '' })));
    const results = await Promise.all(online.map(h => runOnHost(String(h.id), command.trim(), hostCwds[String(h.id)] || '', timeoutSec)));
    const newCwds = { ...hostCwds };
    results.forEach(r => { if (r.working_dir !== undefined) newCwds[String(r.host_id)] = r.working_dir; });
    setHostCwds(newCwds);
    setMulti(results.map(r => ({ ...r, status: r.ok ? 'done' : 'error' })));
    persistHistory([...results, ...history].slice(0, 20));
    setRunning(false);
  };

  const handleRun = () => mode === 'all' ? runAll() : runSingle();
  const selectedHost = hostList.find(h => String(h.id) === String(selectedHostId));
  const onlineCount = hostList.filter(h => h.is_online !== false).length;

  return (
    <div className="min-h-screen bg-[#060e20] p-0">
      <div className="px-10 pt-10 pb-6 space-y-8">
        {/* Page Header */}
        <div>
          <nav className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.15em] text-[#91aaeb] font-medium">
            <span>Operations</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-[#7bd0ff]">Command Terminal</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-[#dee5ff]">LIVE COMMAND TERMINAL</h2>
              <p className="text-sm text-[#939eb5] mt-2">
                {onlineCount} hosts online · {mode === 'all' ? 'Broadcast mode' : 'Single host mode'}
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#06122d] p-6 rounded-xl border-t-2 border-[#7bd0ff] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#7bd0ff]/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[#91aaeb] uppercase tracking-widest text-[10px] font-bold">Total Hosts</span>
                <span className="material-symbols-outlined text-[#7bd0ff]">dns</span>
              </div>
              <div className="text-4xl font-black tracking-tighter text-[#dee5ff]">{hostList.length}</div>
              <div className="mt-2 text-xs text-[#91aaeb]/80">registered</div>
            </div>
          </div>
          <div className="bg-[#06122d] p-6 rounded-xl border-t-2 border-[#10b981] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#10b981]/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[#91aaeb] uppercase tracking-widest text-[10px] font-bold">Online</span>
                <span className="material-symbols-outlined text-[#10b981]">sensors</span>
              </div>
              <div className="text-4xl font-black tracking-tighter text-[#dee5ff]">{onlineCount}</div>
              <div className="mt-2 text-xs text-[#91aaeb]/80">ready for commands</div>
            </div>
          </div>
          <div className="bg-[#06122d] p-6 rounded-xl border-t-2 border-[#ffd16f] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#ffd16f]/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[#91aaeb] uppercase tracking-widest text-[10px] font-bold">Mode</span>
                <span className="material-symbols-outlined text-[#ffd16f]">system_update</span>
              </div>
              <div className="text-4xl font-black tracking-tighter text-[#dee5ff]">{mode === 'all' ? 'Broadcast' : 'Single'}</div>
            </div>
          </div>
          <div className="bg-[#06122d] p-6 rounded-xl border-t-2 border-[#7bd0ff] relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#7bd0ff]/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[#91aaeb] uppercase tracking-widest text-[10px] font-bold">History</span>
                <span className="material-symbols-outlined text-[#7bd0ff]">schedule</span>
              </div>
              <div className="text-4xl font-black tracking-tighter text-[#dee5ff]">{history.length}</div>
              <div className="mt-2 text-xs text-[#91aaeb]/80">recent commands</div>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-[#fcc025]/10 border border-[#fcc025]/30 rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#ffd16f] text-lg">info</span>
          <div className="flex-1 text-xs text-[#dee5ff]">
            <strong className="font-bold text-[#ffd16f]">Allowlist-based execution:</strong> Only pre-approved read-only commands are permitted. Admin/operator role required. Timeout bounded 1-300s.
          </div>
        </div>

        {/* Command Composer */}
        <div className="bg-[#05183c] rounded-xl p-6 space-y-4 border border-[#2b4680]/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              {[
                { k: 'single', l: 'Single Host' },
                { k: 'all',    l: `Broadcast (${onlineCount} online)` },
              ].map(m => (
                <button
                  key={m.k}
                  onClick={() => setMode(m.k)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === m.k
                      ? 'bg-[#7bd0ff] text-[#004560]'
                      : 'bg-[#00225a] text-[#dee5ff] hover:bg-[#031d4b] border border-[#2b4680]/30'
                  }`}
                >
                  {m.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[#91aaeb] text-[11px] font-bold uppercase tracking-widest mb-1">Timeout (s)</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(e.target.value)}
                  className="w-20 text-center bg-[#00225a] border-none rounded-lg text-sm text-[#dee5ff] py-2 px-3 focus:ring-1 focus:ring-[#7bd0ff] outline-none"
                />
              </div>
              {mode === 'single' && (
                <div className="min-w-[200px]">
                  <label className="block text-[#91aaeb] text-[11px] font-bold uppercase tracking-widest mb-1">Target Host</label>
                  <select
                    value={selectedHostId}
                    onChange={(e) => setSelHost(e.target.value)}
                    className="w-full bg-[#00225a] border-none rounded-lg text-sm text-[#dee5ff] py-2 pl-3 pr-8 focus:ring-1 focus:ring-[#7bd0ff] outline-none"
                  >
                    <option value="">-- Select --</option>
                    {hostList.map(h => (
                      <option key={h.id} value={String(h.id)}>
                        {h.hostname || h.name} ({h.ip})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {mode === 'single' && selectedHost && (
            <div className="flex gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                selectedHost.is_online ? 'bg-[#004c69]/20 text-[#7bd0ff]' : 'bg-[#7f2927]/20 text-[#ff9993]'
              }`}>
                {selectedHost.is_online ? 'Online' : 'Offline'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#00668b]/20 text-[#a2dcff]">
                {selectedHost.os || 'Unknown OS'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#00668b]/20 text-[#a2dcff]">
                {selectedHost.ip}
              </span>
              {workingDir && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#00225a]/40 text-[#b4c0d7]">
                  cwd: {workingDir}
                </span>
              )}
            </div>
          )}

          <div>
            <label className="block text-[#91aaeb] text-[11px] font-bold uppercase tracking-widest mb-2">Command</label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                rows={3}
                placeholder="Enter command… (Ctrl+Enter to run)"
                onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRun(); } }}
                className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-y focus:outline-none bg-[#060e20] border border-[#2b4680] text-[#dee5ff] focus:ring-1 focus:ring-[#7bd0ff] placeholder:text-[#91aaeb]/50"
                style={{ lineHeight: 1.6 }}
              />
              <div className="absolute right-3 bottom-3 text-[10px] font-bold text-[#91aaeb]/50 tracking-tighter">
                ↵ CTRL+ENTER
              </div>
            </div>
          </div>
          <button
            disabled={running || !command.trim() || (mode === 'single' && !selectedHostId)}
            onClick={handleRun}
            className="bg-[#7bd0ff] text-[#004560] px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            {running ? 'Running...' : 'Execute Command'}
          </button>
        </div>

        {/* Single host output + history */}
        {mode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#05183c] rounded-xl p-6 flex flex-col gap-3 border border-[#2b4680]/20">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Terminal Output</label>
                {result && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    result.ok ? 'bg-[#004c69]/20 text-[#7bd0ff]' : 'bg-[#7f2927]/20 text-[#ff9993]'
                  }`}>
                    {result.ok ? `EXIT ${result.rc}` : 'FAILED'}
                  </span>
                )}
              </div>
              {!result ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-[#91aaeb] opacity-30">terminal</span>
                  <p className="text-xs uppercase tracking-widest font-bold mt-3 text-[#91aaeb]">Run a command to see output</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 text-xs font-mono text-[#91aaeb]">
                    {result.host_ip} · {new Date(result.started_at).toLocaleString()}
                  </div>
                  <div className="px-3 py-2 rounded-lg font-mono text-xs bg-[#7bd0ff]/10 text-[#7bd0ff] border border-[#7bd0ff]/25">
                    $ {result.command}
                  </div>
                  <pre className="rounded-xl p-4 text-xs font-mono min-h-40 max-h-80 overflow-y-auto bg-[#060e20] text-[#e2e8f0] whitespace-pre-wrap border border-[#2b4680]/30">
                    {result.output || '(no output)'}
                  </pre>
                  {result.working_dir && (
                    <p className="text-[10px] font-mono text-[#91aaeb]">cwd after: {result.working_dir}</p>
                  )}
                </>
              )}
            </div>

            <div className="bg-[#05183c] rounded-xl p-6 flex flex-col gap-3 border border-[#2b4680]/20">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">Command History</label>
                {history.length > 0 && (
                  <button
                    onClick={() => persistHistory([])}
                    className="text-[10px] font-bold uppercase tracking-widest text-[#ff9993] hover:text-[#ee7d77] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-[#91aaeb] opacity-30">schedule</span>
                  <p className="text-xs uppercase tracking-widest font-bold mt-3 text-[#91aaeb]">No history yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {history.map((item, idx) => (
                    <button
                      key={`${item.started_at}-${idx}`}
                      onClick={() => {
                        const found = hostList.find(h => h.ip === item.host_ip || String(h.id) === String(item.host_id));
                        if (found) setSelHost(String(found.id));
                        setCommand(item.command || '');
                        setResult(item);
                      }}
                      className="w-full text-left p-3 rounded-lg transition-all hover:bg-[#00225a]/50 bg-[#06122d] border border-[#2b4680]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-[#91aaeb]">
                              {new Date(item.started_at).toLocaleTimeString()}
                            </span>
                            <span className="material-symbols-outlined text-[14px] text-[#91aaeb] opacity-0 group-hover:opacity-100 transition-opacity">content_copy</span>
                          </div>
                          <p className="text-xs font-bold truncate text-[#dee5ff]">{item.hostname || item.host_ip}</p>
                          <p className="text-[10px] font-mono truncate mt-0.5 text-[#91aaeb]">$ {item.command}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.ok ? 'bg-[#004c69]/20 text-[#7bd0ff]' : 'bg-[#7f2927]/20 text-[#ff9993]'
                        }`}>
                          {item.ok ? `EXIT ${item.rc}` : 'ERR'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Broadcast results */}
        {mode === 'all' && multiResults.length > 0 && (
          <div className="bg-[#05183c] rounded-xl p-6 border border-[#2b4680]/20">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#91aaeb]">
                Broadcast Results — {multiResults.length} hosts
              </label>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#004c69]/20 text-[#7bd0ff]">
                  {multiResults.filter(r => r.ok).length} ok
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#7f2927]/20 text-[#ff9993]">
                  {multiResults.filter(r => !r.ok).length} failed
                </span>
                {running && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#00225a]/40 text-[#b4c0d7]">
                    running...
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {multiResults.map((r, idx) => (
                <div
                  key={`${r.host_ip}-${idx}`}
                  className="rounded-xl p-4 space-y-3 bg-[#06122d] border border-[#2b4680]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-sm text-[#91aaeb]">terminal</span>
                      <span className="font-bold text-sm text-[#dee5ff]">{r.hostname || r.host_ip}</span>
                      <span className="text-xs font-mono text-[#91aaeb]">{r.host_ip}</span>
                      {r.working_dir && (
                        <span className="text-xs font-mono text-[#91aaeb]">cwd: {r.working_dir}</span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'running' ? 'bg-[#00225a]/40 text-[#b4c0d7]' :
                      r.ok ? 'bg-[#004c69]/20 text-[#7bd0ff]' : 'bg-[#7f2927]/20 text-[#ff9993]'
                    }`}>
                      {r.status === 'running' ? 'running...' : r.ok ? `EXIT ${r.rc}` : 'FAILED'}
                    </span>
                  </div>
                  <pre className="text-xs font-mono p-3 rounded-lg max-h-48 overflow-y-auto bg-[#060e20] text-[#e2e8f0] whitespace-pre-wrap border border-[#2b4680]/30">
                    {r.status === 'running' ? 'Waiting for response…' : (r.output || '(no output)')}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
