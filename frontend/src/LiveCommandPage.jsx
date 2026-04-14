import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CHPage, CHHeader, CHCard, CHStat, CHLabel, CHBadge, CHBtn, CH } from './CH.jsx';
import { Play, Terminal, History, X, Monitor } from 'lucide-react';

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
    <CHPage>
      <CHHeader
        kicker="Remote Execution Console"
        title="Live Command"
        subtitle={`${onlineCount} hosts online · ${mode === 'all' ? 'Broadcast mode' : 'Single host mode'}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <CHStat label="Total Hosts"  value={hostList.length}  sub="registered"       accent={CH.accent} />
        <CHStat label="Online"       value={onlineCount}      sub="ready for commands" accent={CH.green} />
        <CHStat label="Mode"         value={mode === 'all' ? 'Broadcast' : 'Single'} accent={CH.yellow} />
        <CHStat label="History"      value={history.length}   sub="recent commands"  accent="#a78bfa" />
      </div>

      {/* Control Panel */}
      <CHCard className="space-y-4">
        {/* Mode + Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            {[
              { k: 'single', l: 'Single Host' },
              { k: 'all',    l: `Broadcast (${onlineCount} online)` },
            ].map(m => (
              <button key={m.k} onClick={() => setMode(m.k)}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  background: mode === m.k ? `${CH.accent}20` : 'rgba(3,29,75,0.4)',
                  color: mode === m.k ? CH.accent : CH.textSub,
                  border: `1px solid ${mode === m.k ? CH.accent + '40' : CH.border}`,
                }}>{m.l}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <CHLabel>Timeout (s)</CHLabel>
              <input type="number" min={1} max={300} value={timeoutSec} onChange={e => setTimeoutSec(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm w-20 text-center"
                style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}
              />
            </div>
            {mode === 'single' && (
              <div className="flex flex-col gap-0.5">
                <CHLabel>Target Host</CHLabel>
                <select value={selectedHostId} onChange={e => setSelHost(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(3,29,75,0.5)', border: `1px solid ${CH.border}`, color: CH.text }}>
                  <option value="">-- Select --</option>
                  {hostList.map(h => <option key={h.id} value={String(h.id)}>{h.hostname || h.name} ({h.ip})</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Host Meta */}
        {mode === 'single' && selectedHost && (
          <div className="flex gap-2 flex-wrap">
            <CHBadge color={selectedHost.is_online ? CH.green : CH.red}>{selectedHost.is_online ? 'Online' : 'Offline'}</CHBadge>
            <CHBadge color={CH.textSub}>{selectedHost.os || 'Unknown OS'}</CHBadge>
            <CHBadge color={CH.textSub}>{selectedHost.ip}</CHBadge>
            {workingDir && <CHBadge color={CH.accent}>cwd: {workingDir}</CHBadge>}
          </div>
        )}

        {/* Command input */}
        <div className="flex flex-col gap-1">
          <CHLabel>Command</CHLabel>
          <textarea ref={textareaRef} value={command} onChange={e => setCommand(e.target.value)}
            rows={4} placeholder="Enter command… (Ctrl+Enter to run)"
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRun(); } }}
            className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-y focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${CH.border}`, color: CH.text, lineHeight: 1.6 }}
          />
        </div>
        <CHBtn variant="primary" disabled={running || !command.trim() || (mode === 'single' && !selectedHostId)} onClick={handleRun} className="self-start">
          <Play size={14} /> {running ? 'Running…' : 'Execute Command'}
        </CHBtn>
      </CHCard>

      {/* Single host output + history */}
      {mode === 'single' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CHCard className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CHLabel>Latest Output</CHLabel>
              {result && <CHBadge color={result.ok ? CH.green : CH.red}>{result.ok ? `EXIT ${result.rc}` : 'FAILED'}</CHBadge>}
            </div>
            {!result ? (
              <p className="text-xs py-6 text-center" style={{ color: CH.textSub }}>Run a command to see output.</p>
            ) : (
              <>
                <div className="flex gap-2 text-xs font-mono" style={{ color: CH.textSub }}>
                  {result.host_ip} · {new Date(result.started_at).toLocaleString()}
                </div>
                <div className="px-3 py-2 rounded-lg font-mono text-xs"
                  style={{ background: `${CH.accent}12`, color: CH.accent, border: `1px solid ${CH.accent}25` }}>
                  {result.command}
                </div>
                <pre className="rounded-xl p-4 text-xs font-mono min-h-40 max-h-80 overflow-y-auto"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                  {result.output || '(no output)'}
                </pre>
                {result.working_dir && <p className="text-[10px] font-mono" style={{ color: CH.textSub }}>cwd after: {result.working_dir}</p>}
              </>
            )}
          </CHCard>

          <CHCard className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CHLabel>Command History</CHLabel>
              {history.length > 0 && <CHBtn variant="ghost" onClick={() => persistHistory([])}><X size={12} /> Clear</CHBtn>}
            </div>
            {history.length === 0 ? (
              <p className="text-xs py-6 text-center" style={{ color: CH.textSub }}>No history yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.map((item, idx) => (
                  <button key={`${item.started_at}-${idx}`}
                    onClick={() => {
                      const found = hostList.find(h => h.ip === item.host_ip || String(h.id) === String(item.host_id));
                      if (found) setSelHost(String(found.id));
                      setCommand(item.command || '');
                      setResult(item);
                    }}
                    className="w-full text-left p-3 rounded-lg transition-all hover:bg-white/5"
                    style={{ background: 'rgba(3,29,75,0.3)', border: `1px solid ${CH.border}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: CH.text }}>{item.hostname || item.host_ip}</p>
                        <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: CH.textSub }}>{item.command}</p>
                      </div>
                      <CHBadge color={item.ok ? CH.green : CH.red}>{item.ok ? `EXIT ${item.rc}` : 'ERR'}</CHBadge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CHCard>
        </div>
      )}

      {/* Broadcast results */}
      {mode === 'all' && multiResults.length > 0 && (
        <CHCard>
          <div className="flex items-center justify-between mb-4">
            <CHLabel>Broadcast Results — {multiResults.length} hosts</CHLabel>
            <div className="flex gap-2">
              <CHBadge color={CH.green}>{multiResults.filter(r => r.ok).length} ok</CHBadge>
              <CHBadge color={CH.red}>{multiResults.filter(r => !r.ok).length} failed</CHBadge>
              {running && <CHBadge color={CH.accent}>running…</CHBadge>}
            </div>
          </div>
          <div className="space-y-4">
            {multiResults.map((r, idx) => (
              <div key={`${r.host_ip}-${idx}`} className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(3,29,75,0.4)', border: `1px solid ${CH.border}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Terminal size={14} style={{ color: CH.textSub }} />
                    <span className="font-bold text-sm" style={{ color: CH.text }}>{r.hostname || r.host_ip}</span>
                    <span className="text-xs font-mono" style={{ color: CH.textSub }}>{r.host_ip}</span>
                    {r.working_dir && <span className="text-xs font-mono" style={{ color: CH.textSub }}>cwd: {r.working_dir}</span>}
                  </div>
                  <CHBadge color={r.status === 'running' ? CH.accent : r.ok ? CH.green : CH.red}>
                    {r.status === 'running' ? 'running…' : r.ok ? `EXIT ${r.rc}` : 'FAILED'}
                  </CHBadge>
                </div>
                <pre className="text-xs font-mono p-3 rounded-lg max-h-48 overflow-y-auto"
                  style={{ background: 'rgba(0,0,0,0.5)', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                  {r.status === 'running' ? 'Waiting for response…' : (r.output || '(no output)')}
                </pre>
              </div>
            ))}
          </div>
        </CHCard>
      )}
    </CHPage>
  );
}
