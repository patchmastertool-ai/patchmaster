import React, { useCallback, useEffect, useRef, useState } from 'react';

const HISTORY_KEY = 'pm_live_command_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch {}
}

export default function LiveCommandPage({ hosts, API, apiFetch, CodeIcon }) {
  const hostList = Array.isArray(hosts) ? hosts : [];

  // ── mode: 'single' | 'all' ──
  const [mode, setMode] = useState('single');
  const [selectedHostId, setSelectedHostId] = useState('');
  const [command, setCommand] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [running, setRunning] = useState(false);

  // single-host state
  const [result, setResult] = useState(null);
  const [workingDir, setWorkingDir] = useState('');   // tracks cwd per host
  const [hostCwds, setHostCwds] = useState({});       // { hostId: cwd }

  // multi-host state
  const [multiResults, setMultiResults] = useState([]); // [{host, status, rc, output, working_dir}]

  const [history, setHistory] = useState(loadHistory);

  const textareaRef = useRef(null);

  useEffect(() => {
    if (!selectedHostId && hostList.length) {
      setSelectedHostId(String(hostList[0].id || ''));
    }
  }, [hostList, selectedHostId]);

  // sync working dir when switching hosts
  useEffect(() => {
    setWorkingDir(hostCwds[selectedHostId] || '');
  }, [selectedHostId, hostCwds]);

  const persistHistory = useCallback((items) => {
    setHistory(items);
    saveHistory(items);
  }, []);

  // ── run on a single host, returns result object ──
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
      return {
        ok: true,
        host_id: hostId,
        host_ip: host?.ip || '',
        hostname: host?.hostname || host?.name || host?.ip || '',
        command: data.command || cmd.trim(),
        output: data.output || '',
        rc: data.rc ?? 0,
        working_dir: data.working_dir || cwd || '',
        started_at: startedAt,
      };
    } catch (err) {
      return {
        ok: false,
        host_id: hostId,
        host_ip: host?.ip || '',
        hostname: host?.hostname || host?.name || host?.ip || '',
        command: cmd.trim(),
        output: String(err.message || err),
        rc: 'ERR',
        working_dir: cwd || '',
        started_at: startedAt,
      };
    }
  }, [hostList, API, apiFetch]);

  const runSingle = async () => {
    if (!selectedHostId || !command.trim() || running) return;
    setRunning(true);
    const r = await runOnHost(selectedHostId, command.trim(), workingDir, timeoutSec);
    setResult(r);
    // update cwd if command was cd or response returned new working_dir
    if (r.working_dir !== undefined) {
      const newCwd = r.working_dir;
      setWorkingDir(newCwd);
      setHostCwds(prev => ({ ...prev, [selectedHostId]: newCwd }));
    }
    persistHistory([r, ...history].slice(0, 20));
    setRunning(false);
  };

  const runAll = async () => {
    if (!command.trim() || running) return;
    setRunning(true);
    const onlineHosts = hostList.filter(h => h.is_online !== false);
    // initialise placeholders
    setMultiResults(onlineHosts.map(h => ({
      host_id: h.id, host_ip: h.ip, hostname: h.hostname || h.name || h.ip,
      status: 'running', rc: null, output: '', working_dir: hostCwds[String(h.id)] || '',
    })));

    const results = await Promise.all(
      onlineHosts.map(h => runOnHost(String(h.id), command.trim(), hostCwds[String(h.id)] || '', timeoutSec))
    );

    // update cwds
    const newCwds = { ...hostCwds };
    results.forEach(r => {
      if (r.working_dir !== undefined) newCwds[String(r.host_id)] = r.working_dir;
    });
    setHostCwds(newCwds);
    setMultiResults(results.map(r => ({ ...r, status: r.ok ? 'done' : 'error' })));
    persistHistory([...results, ...history].slice(0, 20));
    setRunning(false);
  };

  const handleRun = () => mode === 'all' ? runAll() : runSingle();

  const selectedHost = hostList.find(h => String(h.id) === String(selectedHostId));

  return (
    <div>
      <div className="card highlight-card">
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <CodeIcon code="RC" size={20} />
          Live Commands
        </h2>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Run diagnostic commands on one host or all online hosts simultaneously. Admin and operator roles only.
        </p>
      </div>

      {/* ── Controls ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('single')}
          >Single Host</button>
          <button
            className={`btn btn-sm ${mode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('all')}
          >All Online Hosts ({hostList.filter(h => h.is_online !== false).length})</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mode === 'single' ? 'minmax(220px,1.2fr) minmax(140px,0.4fr) auto' : '1fr auto', gap: 12, alignItems: 'end' }}>
          {mode === 'single' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Host</label>
              <select className="input" value={selectedHostId} onChange={e => setSelectedHostId(e.target.value)}>
                <option value="">-- Select host --</option>
                {hostList.map(h => (
                  <option key={h.id} value={String(h.id)}>{h.hostname || h.name} ({h.ip})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Timeout (s)</label>
            <input className="input" type="number" min="1" max="300" value={timeoutSec} onChange={e => setTimeoutSec(e.target.value)} style={{ width: 90 }} />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={running || !command.trim() || (mode === 'single' && !selectedHostId)}
            style={{ alignSelf: 'flex-end' }}
          >
            {running ? 'Running…' : 'Run'}
          </button>
        </div>

        {mode === 'single' && selectedHost && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <span className={`badge ${selectedHost.is_online ? 'badge-success' : 'badge-danger'}`}>{selectedHost.is_online ? 'Online' : 'Offline'}</span>
            <span className="badge badge-info">{selectedHost.os || 'Unknown OS'}</span>
            <span className="badge badge-info">{selectedHost.ip}</span>
            {workingDir && <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>cwd: {workingDir}</span>}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Command</label>
          <textarea
            ref={textareaRef}
            className="input"
            style={{ minHeight: 90, resize: 'vertical', fontFamily: 'Consolas, Monaco, monospace' }}
            placeholder="Enter command… (Ctrl+Enter to run)"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleRun(); } }}
          />
        </div>
      </div>

      {/* ── Single host output ── */}
      {mode === 'single' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <h3>Latest Output</h3>
              {result && (
                <span className={`badge ${result.ok ? 'badge-success' : 'badge-danger'}`}>
                  {result.ok ? `EXIT ${result.rc}` : 'FAILED'}
                </span>
              )}
            </div>
            {!result ? (
              <p style={{ color: '#64748b' }}>Run a command to see output here.</p>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                  {result.host_ip} · {new Date(result.started_at).toLocaleString()}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#eff6ff', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                  {result.command}
                </div>
                <pre style={{ margin: 0, background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 14, minHeight: 200, whiteSpace: 'pre-wrap', overflowX: 'auto', fontSize: 13 }}>
                  {result.output || '(no output)'}
                </pre>
                {result.working_dir && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                    cwd after: {result.working_dir}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Recent Runs</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => persistHistory([])} disabled={!history.length}>Clear</button>
            </div>
            {!history.length ? (
              <p style={{ color: '#64748b' }}>No history yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {history.map((item, idx) => (
                  <button
                    key={`${item.started_at}-${idx}`}
                    className="btn btn-sm"
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                    onClick={() => {
                      const found = hostList.find(h => h.ip === item.host_ip || String(h.id) === String(item.host_id));
                      if (found) setSelectedHostId(String(found.id));
                      setCommand(item.command || '');
                      setResult(item);
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <strong style={{ fontSize: 12 }}>{item.hostname || item.host_ip}</strong>
                      <span style={{ fontSize: 11, color: '#64748b', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.command}</span>
                    </span>
                    <span className={`badge ${item.ok ? 'badge-success' : 'badge-danger'}`}>{item.ok ? `EXIT ${item.rc}` : 'ERR'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── All-hosts output grid ── */}
      {mode === 'all' && multiResults.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Results — {multiResults.length} hosts</h3>
            <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
              <span className="badge badge-success">{multiResults.filter(r => r.ok).length} ok</span>
              <span className="badge badge-danger">{multiResults.filter(r => !r.ok).length} failed</span>
              {running && <span className="badge badge-info">running…</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {multiResults.map((r, idx) => (
              <div key={`${r.host_ip}-${idx}`} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontSize: 14 }}>{r.hostname || r.host_ip}</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{r.host_ip}</span>
                    {r.working_dir && (
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>cwd: {r.working_dir}</span>
                    )}
                  </div>
                  <span className={`badge ${r.status === 'running' ? 'badge-info' : r.ok ? 'badge-success' : 'badge-danger'}`}>
                    {r.status === 'running' ? 'running…' : r.ok ? `EXIT ${r.rc}` : `FAILED`}
                  </span>
                </div>
                <pre style={{ margin: 0, background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: '10px 14px', maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {r.status === 'running' ? 'Waiting for response…' : (r.output || '(no output)')}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
