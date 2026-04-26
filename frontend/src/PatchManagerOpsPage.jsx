import React, { useState, useMemo } from 'react';
import './OpsPages.css';
import { sanitizeDisplayText } from './appRuntime';

/**
 * Parse a download/install progress percentage from apt/dnf/yum log output.
 * Returns a number 0-100, or null if no progress line is found.
 *
 * Patterns handled:
 *   apt:  "Get:3 http://... [1,234 kB]"  + "Fetched X kB in Ys"
 *         "Progress: [ 42%]"
 *         "Unpacking ... (42%)"
 *   dnf:  "(42/100): package-name"
 *         "[ 42%] ..."
 *   generic: any "42%" token on a line
 */
function parseProgress(output) {
  if (!output) return null;
  const lines = output.split('\n');
  let best = null;

  // Walk lines in reverse so we pick up the most recent progress signal
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    // "Progress: [ 42%]" or "[ 42%]"
    const bracketMatch = line.match(/\[\s*(\d{1,3})%\s*\]/);
    if (bracketMatch) {
      const v = parseInt(bracketMatch[1], 10);
      if (v >= 0 && v <= 100) { best = v; break; }
    }

    // dnf "(42/100): ..."
    const dnfMatch = line.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
    if (dnfMatch) {
      const done = parseInt(dnfMatch[1], 10);
      const total = parseInt(dnfMatch[2], 10);
      if (total > 0) { best = Math.min(100, Math.round((done / total) * 100)); break; }
    }

    // generic "42%" anywhere on the line
    const genericMatch = line.match(/\b(\d{1,3})%/);
    if (genericMatch) {
      const v = parseInt(genericMatch[1], 10);
      if (v >= 0 && v <= 100) { best = v; break; }
    }
  }

  return best;
}

function PatchProgressBar({ output, status }) {
  const pct = useMemo(() => parseProgress(output), [output]);

  // If job is done, force 100 on success or keep last parsed value on failure
  const displayPct = status === 'success' ? 100 : (pct ?? (status === 'running' ? null : null));
  if (displayPct === null && status !== 'running') return null;

  const isRunning = status === 'running' || status === 'pending';
  const isFailed  = status === 'failed';
  const barColor  = isFailed ? '#ef4444' : status === 'success' ? '#22c55e' : '#3b82f6';
  const bgColor   = isFailed ? '#fee2e2' : status === 'success' ? '#dcfce7' : '#dbeafe';
  const label     = displayPct !== null ? `${displayPct}%` : '…';
  const width     = displayPct !== null ? `${displayPct}%` : '0%';

  return (
    <div style={{ margin: '10px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        <span>{isRunning ? 'In progress' : isFailed ? 'Failed' : 'Complete'}</span>
        <span style={{ fontWeight: 600, color: barColor }}>{label}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: bgColor, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            height: '100%',
            width,
            background: barColor,
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }}
        />
        {/* indeterminate shimmer when running but no % parsed yet */}
        {isRunning && displayPct === null && (
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
            background: `linear-gradient(90deg, transparent, ${barColor}88, transparent)`,
            animation: 'pm-shimmer 1.4s infinite',
          }} />
        )}
      </div>
    </div>
  );
}

export default function PatchManagerOpsPage({ hosts, API, apiFetch, AppIcon, useInterval }) {
  // Defensive check: ensure hosts is always an array
  const safeHosts = Array.isArray(hosts) ? hosts : [];
  
  const [selectedHost, setSelectedHost] = useState('');
  const [upgradable, setUpgradable] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [instPage, setInstPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [selectedPkgs, setSelectedPkgs] = useState([]);
  const [holdPkgs, setHoldPkgs] = useState('');
  const [autoSnapshot, setAutoSnapshot] = useState(true);
  const [autoRollback, setAutoRollback] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [downloadOnly, setDownloadOnly] = useState(false);
  const [saveToRepo, setSaveToRepo] = useState(true);
  const [updatePolicy, setUpdatePolicy] = useState('latest');
  // Technical options
  const [securityOnly, setSecurityOnly] = useState(false);
  const [excludeKernel, setExcludeKernel] = useState(false);
  const [autoReboot, setAutoReboot] = useState(false);
  const [prePatchScript, setPrePatchScript] = useState('');
  const [postPatchScript, setPostPatchScript] = useState('');
  const [extraFlags, setExtraFlags] = useState('');
  const [masterRepoPkgs, setMasterRepoPkgs] = useState([]);
  const [archivedRepoPkgs, setArchivedRepoPkgs] = useState([]);
  const [repoStats, setRepoStats] = useState(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoSelected, setRepoSelected] = useState('');
  const [info, setInfo] = useState('');
  const [sizeEstimate, setSizeEstimate] = useState({ loading: false, totalBytes: 0, knownCount: 0, unknownCount: 0, packageCount: 0 });

  useInterval(() => {
    if (jobId && (!jobStatus || (jobStatus.status !== 'success' && jobStatus.status !== 'failed'))) {
      apiFetch(`${API}/api/jobs/status/${jobId}`).then(r => r.json()).then(setJobStatus).catch(() => {});
    }
  }, jobId ? 2000 : null);

  const fetchUpgradable = async () => {
    if (!selectedHost) return alert('Select a host first');
    setLoading(true);
    setUpgradable([]);
    setInstalled([]);
    setSelectedPkgs([]);
    setJobId(null);
    setJobStatus(null);
    setInfo('');
    setSizeEstimate({ loading: false, totalBytes: 0, knownCount: 0, unknownCount: 0, packageCount: 0 });
    try {
      // Refresh package cache first so upgradable list is current
      await apiFetch(`${API}/api/agent/${selectedHost}/packages/refresh`, { method: 'POST' }).catch(() => {});
      const [rUpg, rInst] = await Promise.all([
        apiFetch(`${API}/api/agent/${selectedHost}/packages/upgradable`),
        apiFetch(`${API}/api/agent/${selectedHost}/packages/installed`)
      ]);
      const d = await rUpg.json().catch(() => ({ packages: [] }));
      const dInst = await rInst.json().catch(() => ({ packages: [] }));
      const packages = Array.isArray(d.packages) ? d.packages : [];
      const installedPkgs = Array.isArray(dInst.packages) ? dInst.packages : [];
      setUpgradable(packages);
      setInstalled(installedPkgs);
      setInstPage(0);
      const hostLabel = safeHosts.find(h => h.ip === selectedHost)?.hostname || selectedHost;
      setInfo(packages.length ? `Found ${packages.length} upgradable packages on ${hostLabel}.` : 'No updates available on this host.');
    } catch (e) {
      setInfo('Could not reach agent: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePkg = (name) => {
    setSelectedPkgs(prev => prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]);
  };
  const holdList = holdPkgs.split(',').map(item => item.trim()).filter(Boolean);
  const holdSet = new Set(holdList);
  const toggleHoldPkg = (name) => {
    const next = holdSet.has(name) ? holdList.filter(x => x !== name) : [...holdList, name];
    setHoldPkgs(next.join(','));
    if (!holdSet.has(name)) {
      setSelectedPkgs(prev => prev.filter(x => x !== name));
    }
  };

  const selectAll = () => setSelectedPkgs(upgradable.map(pkg => pkg.name).filter(name => !holdSet.has(name)));
  const selectNone = () => setSelectedPkgs([]);

  const policyAnalyzedPackages = React.useMemo(() => {
    const versionNumbers = (v) => {
      if (typeof v !== 'string') return [];
      const cleaned = v.split(':').pop() || '';
      const parts = cleaned.match(/\d+/g);
      return Array.isArray(parts) ? parts.map(x => Number(x)) : [];
    };
    return upgradable.map(pkg => {
      if (updatePolicy !== 'n_minus_1') {
        return { ...pkg, policyIncluded: true, policyReason: 'Included by Latest policy' };
      }
      const cur = versionNumbers(pkg.current_version || '');
      const next = versionNumbers(pkg.available_version || '');
      if (!cur.length || !next.length) {
        return { ...pkg, policyIncluded: true, policyReason: 'Included by N-1: version parsing unavailable' };
      }
      const curMajor = cur[0];
      const nextMajor = next[0];
      if (nextMajor !== curMajor) {
        return { ...pkg, policyIncluded: false, policyReason: `Excluded by N-1: major jump ${curMajor} -> ${nextMajor}` };
      }
      const curMinor = cur.length > 1 ? cur[1] : 0;
      const nextMinor = next.length > 1 ? next[1] : 0;
      if ((nextMinor - curMinor) > 1) {
        return { ...pkg, policyIncluded: false, policyReason: `Excluded by N-1: minor jump ${curMinor} -> ${nextMinor}` };
      }
      return { ...pkg, policyIncluded: true, policyReason: 'Included by N-1 stable window' };
    });
  }, [upgradable, updatePolicy]);
  const policyExcludedPackages = policyAnalyzedPackages.filter(pkg => !pkg.policyIncluded);
  const policyIncludedPackages = policyAnalyzedPackages.filter(pkg => pkg.policyIncluded).map(pkg => pkg.name);
  const scopePackagesRaw = selectedPkgs.length ? selectedPkgs : (updatePolicy === 'n_minus_1' ? policyIncludedPackages : upgradable.map(pkg => pkg.name));
  const effectiveScopePackages = scopePackagesRaw.filter(name => !holdSet.has(name));

  const estimateScopeImpact = async () => {
    if (!selectedHost) return;
    setSizeEstimate((prev) => ({ ...prev, loading: true }));
    try {
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/packages/uris`, {
        method: 'POST',
        body: JSON.stringify({ packages: effectiveScopePackages }),
      });
      const d = await r.json().catch(() => ({}));
      const uris = Array.isArray(d.uris) ? d.uris : [];
      let totalBytes = 0;
      let knownCount = 0;
      let unknownCount = 0;
      uris.forEach((u) => {
        const n = Number(u?.size);
        if (Number.isFinite(n) && n > 0) {
          totalBytes += n;
          knownCount += 1;
        } else {
          unknownCount += 1;
        }
      });
      setSizeEstimate({
        loading: false,
        totalBytes,
        knownCount,
        unknownCount,
        packageCount: effectiveScopePackages.length,
      });
    } catch {
      setSizeEstimate({ loading: false, totalBytes: 0, knownCount: 0, unknownCount: 0, packageCount: effectiveScopePackages.length });
    }
  };

  const executePatch = async (forceDownloadOnly = null) => {
    if (!selectedHost) return alert('Select a host');
    const scopePackages = effectiveScopePackages;
    const isDownloadOnly = forceDownloadOnly !== null ? forceDownloadOnly : downloadOnly;
    const mode = dryRun ? 'DRY RUN' : isDownloadOnly ? 'DOWNLOAD ONLY' : 'DOWNLOAD + INSTALL';
    const hostLabel = safeHosts.find(h => h.ip === selectedHost)?.hostname || selectedHost;
    if (!window.confirm(`${mode} on ${hostLabel}?\n\nPolicy: ${updatePolicy}\nAuto-Snapshot: ${autoSnapshot}\nAuto-Rollback: ${autoRollback}\nSecurity-only: ${securityOnly}\nExclude kernel: ${excludeKernel}\nAuto-reboot: ${autoReboot}\nPackages: ${scopePackages.length || 'NONE after hold list'}\nHold: ${holdList.length}`)) return;
    setJobId(null);
    setJobStatus(null);
    try {
      const parsedFlags = extraFlags.split(/[\s,]+/).filter(f => f.startsWith('-'));
      const body = {
        packages: scopePackages,
        hold: holdPkgs.split(',').map(item => item.trim()).filter(Boolean),
        dry_run: dryRun,
        auto_snapshot: autoSnapshot,
        auto_rollback: autoRollback,
        download_only: isDownloadOnly,
        save_to_repo: saveToRepo,
        update_policy: updatePolicy,
        security_only: securityOnly,
        exclude_kernel: excludeKernel,
        auto_reboot: autoReboot,
        pre_patch_script: prePatchScript.trim() || null,
        post_patch_script: postPatchScript.trim() || null,
        extra_flags: parsedFlags,
      };
      const r = await apiFetch(`${API}/api/agent/${selectedHost}/patch/server-patch`, { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (d.status === 'started') {
        setJobId(d.job_id);
      } else {
        alert('Failed to start job: ' + JSON.stringify(d));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const fetchMasterRepoPkgs = async () => {
    setRepoLoading(true);
    try {
      const [rActive, rArchive, rStats] = await Promise.all([
        apiFetch(`${API}/api/packages/local/`),
        apiFetch(`${API}/api/packages/local/archive`),
        apiFetch(`${API}/api/packages/local/stats`)
      ]);
      const d = await rActive.json();
      const a = await rArchive.json().catch(() => ({ packages: [] }));
      const s = await rStats.json().catch(() => null);
      const activePkgs = Array.isArray(d.packages) ? d.packages : [];
      setMasterRepoPkgs(activePkgs);
      setArchivedRepoPkgs(Array.isArray(a.packages) ? a.packages : []);
      setRepoStats(s);
      if (!repoSelected && activePkgs.length) {
        setRepoSelected(activePkgs[0].name);
      }
    } catch (e) {
      setInfo(`Failed to load master repository: ${e.message}`);
    }
    setRepoLoading(false);
  };

  const archiveRepoPackage = async (filename) => {
    try {
      const r = await apiFetch(`${API}/api/packages/local/archive/${encodeURIComponent(filename)}`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.message || 'Archive failed');
      setInfo(`Archived ${filename}`);
      fetchMasterRepoPkgs();
    } catch (e) {
      setInfo(`Archive failed: ${e.message}`);
    }
  };

  const restoreRepoPackage = async (filename) => {
    try {
      const r = await apiFetch(`${API}/api/packages/local/restore/${encodeURIComponent(filename)}`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.message || 'Restore failed');
      setInfo(`Restored ${filename}`);
      fetchMasterRepoPkgs();
    } catch (e) {
      setInfo(`Restore failed: ${e.message}`);
    }
  };

  const deleteRepoPackage = async (filename, archived = false) => {
    if (!window.confirm(`Delete ${filename} from ${archived ? 'archive' : 'active repo'}?`)) return;
    try {
      const r = await apiFetch(`${API}/api/packages/local/${encodeURIComponent(filename)}?archived=${archived ? 'true' : 'false'}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.message || 'Delete failed');
      setInfo(`Deleted ${filename}`);
      fetchMasterRepoPkgs();
    } catch (e) {
      setInfo(`Delete failed: ${e.message}`);
    }
  };

  const cleanupRepo = async (mode) => {
    if (!window.confirm(`Cleanup ${mode} repository packages?`)) return;
    try {
      const r = await apiFetch(`${API}/api/packages/local/cleanup`, { method: 'POST', body: JSON.stringify({ mode }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.message || 'Cleanup failed');
      setInfo(`Cleanup done. Deleted ${d.deleted_count || 0} package(s).`);
      fetchMasterRepoPkgs();
    } catch (e) {
      setInfo(`Cleanup failed: ${e.message}`);
    }
  };

  const pushRepoPackageToHost = async () => {
    if (!selectedHost) return alert('Select host first');
    if (!repoSelected) return alert('Select a package from master repository');
    const hostObj = safeHosts.find(h => h.ip === selectedHost);
    if (!hostObj) return alert('Host not found');
    try {
      const r = await apiFetch(`${API}/api/packages/local/push/${hostObj.id}?filename=${encodeURIComponent(repoSelected)}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || 'Push failed');
      setInfo(`Pushed ${repoSelected} to ${selectedHost} agent local storage.`);
    } catch (e) {
      setInfo(`Push failed: ${e.message}`);
    }
  };

  const currentHost = safeHosts.find(host => host.ip === selectedHost) || null;
  const patchScopeCount = effectiveScopePackages.length;
  const safeguardCount = [autoSnapshot, autoRollback, dryRun].filter(Boolean).length;
  const jobState = jobStatus?.status || (jobId ? 'running' : 'idle');

  const posture = !selectedHost
    ? {
        title: 'Choose a target host',
        description: 'Select a managed host to inspect pending package updates and prepare a controlled rollout.',
        tone: '#1d4ed8',
        bg: 'linear-gradient(145deg, #eff6ff, #f8fbff)',
        border: '#93c5fd',
      }
    : upgradable.length > 0
      ? {
          title: 'Patch window ready',
          description: 'Updates have been discovered. Validate safeguards, hold list, and package scope before execution.',
          tone: dryRun ? '#b45309' : '#166534',
          bg: dryRun ? 'linear-gradient(145deg, #fffbeb, #fffdf5)' : 'linear-gradient(145deg, #ecfdf3, #f8fffb)',
          border: dryRun ? '#fcd34d' : '#86efac',
        }
      : {
          title: 'Discovery pending',
          description: 'Run an update check to inventory the packages that are ready to download and install offline.',
          tone: '#7c3aed',
          bg: 'linear-gradient(145deg, #f5f3ff, #fbf8ff)',
          border: '#c4b5fd',
        };

  const summaryCards = [
    { label: 'Target Host', value: currentHost ? (currentHost.hostname || currentHost.name) : 'None', sub: currentHost ? currentHost.ip : 'Select a host to begin', icon: 'server', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Updates Found', value: upgradable.length, sub: info || 'No discovery has run yet', icon: 'package', color: '#7c3aed', bg: 'rgba(139,92,246,0.12)' },
    { label: 'Installed', value: installed.length, sub: 'Live package inventory on target host', icon: 'search', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Patch Scope', value: patchScopeCount, sub: upgradable.length ? (selectedPkgs.length ? 'Explicit package selection' : 'All discovered packages') : 'No package scope yet', icon: 'layers', color: '#0f766e', bg: 'rgba(20,184,166,0.12)' },
    { label: 'Safeguards', value: safeguardCount, sub: `${holdList.length} packages on hold`, icon: 'shield', color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
    { label: 'Job State', value: jobState.toUpperCase(), sub: jobId ? `Job #${jobId}` : 'No active job', icon: 'timeline', color: jobState === 'success' ? '#0f766e' : jobState === 'failed' ? '#dc2626' : '#1d4ed8', bg: jobState === 'success' ? 'rgba(16,185,129,0.12)' : jobState === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)' },
  ];

  return (
    <div className="ops-shell">
      <div className="ops-hero">
        <div className="ops-hero-main" style={{ borderColor: posture.border, background: posture.bg }}>
          <div className="ops-kicker">Controlled patch execution</div>
          <div className="ops-hero-row">
            <div className="ops-hero-emphasis">
              <span className="ops-emphasis-label">Patch scope</span>
              <span className="ops-emphasis-value" style={{ color: posture.tone }}>{patchScopeCount}</span>
              <span className="ops-emphasis-meta">{selectedPkgs.length ? 'selected packages' : upgradable.length ? 'packages ready to install' : 'packages pending discovery'}</span>
            </div>
            <div className="ops-hero-copy">
              <h3>{posture.title}</h3>
              <p>{posture.description}</p>
            </div>
          </div>
          <div className="ops-chip-row">
            <span className="ops-chip">{downloadOnly ? 'Download-only to Master repository' : 'Server downloads updates and pushes them to the agent'}</span>
            <span className="ops-chip">{autoSnapshot ? 'Snapshot enabled' : 'Snapshot disabled'}</span>
            <span className="ops-chip">{autoRollback ? 'Rollback enabled' : 'Rollback disabled'}</span>
            <span className="ops-chip">{dryRun ? 'Dry run mode' : 'Execution mode'}</span>
            <span className="ops-chip">Policy: {updatePolicy === 'n_minus_1' ? 'N-1 Stable' : 'Latest'}</span>
            {securityOnly && <span className="ops-chip">Security-only</span>}
            {excludeKernel && <span className="ops-chip">Kernel excluded</span>}
            {autoReboot && <span className="ops-chip">Auto-reboot</span>}
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-side-label">Current target</span>
          <div className="ops-side-metric">{currentHost ? (currentHost.hostname || currentHost.name) : '--'}</div>
          <p className="ops-side-note">{currentHost ? `${currentHost.ip} - ${currentHost.os || 'platform unavailable'}` : 'Select a host to populate patchable package data.'}</p>
          <div className="ops-inline-list">
            {[
              { label: 'Queued packages', value: patchScopeCount },
              { label: 'Hold list', value: holdList.length },
              { label: 'Job state', value: jobState.toUpperCase() },
              { label: 'Dry run', value: dryRun ? 'On' : 'Off' },
            ].map(item => (
              <div key={item.label} className="ops-inline-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ops-summary-grid">
        {summaryCards.map(card => (
          <div key={card.label} className="ops-summary-card">
            <div className="ops-summary-head">
              <span className="ops-summary-icon" style={{ color: card.color, background: card.bg }}>
                <AppIcon name={card.icon} size={18} />
              </span>
              <span className="ops-summary-label">{card.label}</span>
            </div>
            <div className="ops-summary-value">{card.value}</div>
            <div className="ops-summary-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Target host and discovery</div>
            <p className="ops-subtle">Pick a host, query available package updates, and review the queue before a rollout.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-primary" onClick={fetchUpgradable} disabled={loading || !selectedHost}>{loading ? 'Checking...' : 'Check Updates'}</button>
          </div>
        </div>
        <div className="form-row">
          <select className="input" value={selectedHost} onChange={e => { setSelectedHost(e.target.value); setUpgradable([]); setInstalled([]); setInstPage(0); setSelectedPkgs([]); setJobId(null); setJobStatus(null); setInfo(''); setSizeEstimate({ loading: false, totalBytes: 0, knownCount: 0, unknownCount: 0, packageCount: 0 }); }} style={{ minWidth: 280, flex: '1 1 320px' }}>
            <option value="">Select host</option>
            {safeHosts.map(host => <option key={host.id} value={host.ip}>{host.hostname || host.name} ({host.ip})</option>)}
          </select>
        </div>
        {info && <p className="ops-subtle" style={{ marginTop: 12 }}>{info}</p>}
      </div>

      {selectedHost && upgradable.length === 0 && !loading && !info && (
        <div className="ops-empty">Run an update check to inventory pending packages for {safeHosts.find(h => h.ip === selectedHost)?.hostname || selectedHost}.</div>
      )}

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Master Repository + Offline Push</div>
            <p className="ops-subtle">Use one workflow: download approved updates to master repo, then push any package to target agent local storage.</p>
          </div>
          <div className="ops-actions">
            <button className="btn btn-sm btn-primary" onClick={fetchMasterRepoPkgs} disabled={repoLoading}>{repoLoading ? 'Loading...' : 'Load Master Repo'}</button>
            <button className="btn btn-sm btn-warning" onClick={() => cleanupRepo('active')} disabled={repoLoading || !masterRepoPkgs.length}>Cleanup Active</button>
            <button className="btn btn-sm btn-danger" onClick={() => cleanupRepo('archive')} disabled={repoLoading || !archivedRepoPkgs.length}>Cleanup Archive</button>
          </div>
        </div>
        {repoStats && (
          <div className="ops-chip-row" style={{ marginBottom: 10 }}>
            <span className="ops-chip">Active: {repoStats.active?.count || 0} files / {repoStats.active?.size_mb || 0} MB</span>
            <span className="ops-chip">Archived: {repoStats.archived?.count || 0} files / {repoStats.archived?.size_mb || 0} MB</span>
            <span className="ops-chip">Total: {repoStats.total_mb || 0} MB</span>
          </div>
        )}
        <div className="form-row">
          <select className="input" value={repoSelected} onChange={e => setRepoSelected(e.target.value)} style={{ minWidth: 320, flex: '1 1 360px' }}>
            <option value="">Select package from master repository</option>
            {masterRepoPkgs.map(pkg => <option key={pkg.name} value={pkg.name}>{pkg.name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={pushRepoPackageToHost} disabled={!selectedHost || !repoSelected}>Push to Selected Host</button>
        </div>
        {masterRepoPkgs.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table ops-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Size (MB)</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterRepoPkgs.slice(0, 80).map((pkg, idx) => (
                  <tr key={`master-repo-pkg-${pkg.name}-${idx}`}>
                    <td>{pkg.name}</td>
                    <td>{pkg.size_mb ?? (pkg.size ? (Number(pkg.size)/(1024*1024)).toFixed(2) : '—')}</td>
                    <td>{pkg.created ? new Date(Number(pkg.created) * 1000).toLocaleString() : '—'}</td>
                    <td style={{display:'flex', gap:6}}>
                      <button className="btn btn-sm btn-secondary" onClick={() => archiveRepoPackage(pkg.name)}>Archive</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteRepoPackage(pkg.name, false)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {archivedRepoPkgs.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table ops-table">
              <thead>
                <tr>
                  <th>Archived package</th>
                  <th>Size (MB)</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedRepoPkgs.slice(0, 80).map((pkg, idx) => (
                  <tr key={`archive-repo-pkg-${pkg.name}-${idx}`}>
                    <td>{pkg.name}</td>
                    <td>{pkg.size_mb ?? (pkg.size ? (Number(pkg.size)/(1024*1024)).toFixed(2) : '—')}</td>
                    <td>{pkg.created ? new Date(Number(pkg.created) * 1000).toLocaleString() : '—'}</td>
                    <td style={{display:'flex', gap:6}}>
                      <button className="btn btn-sm btn-primary" onClick={() => restoreRepoPackage(pkg.name)}>Restore</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteRepoPackage(pkg.name, true)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {upgradable.length > 0 && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Available package updates</div>
              <p className="ops-subtle">Review package versions and tune the exact scope for this patch window.</p>
            </div>
            <div className="ops-actions">
              <button className="btn btn-sm btn-primary" onClick={selectAll}>Select All</button>
              <button className="btn btn-sm" onClick={selectNone}>Clear Selection</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Sel</th>
                  <th style={{ width: 60 }}>Hold</th>
                  <th>Package</th>
                  <th>Current Version</th>
                  <th>Available Version</th>
                </tr>
              </thead>
              <tbody>
                {upgradable.map((pkg, index) => (
                  <tr key={`${pkg.name}-${index}`} className={selectedPkgs.includes(pkg.name) ? 'row-selected' : ''}>
                    <td><input type="checkbox" checked={selectedPkgs.includes(pkg.name)} onChange={() => togglePkg(pkg.name)} disabled={holdSet.has(pkg.name)} /></td>
                    <td><input type="checkbox" checked={holdSet.has(pkg.name)} onChange={() => toggleHoldPkg(pkg.name)} /></td>
                    <td>
                      <strong>{pkg.name}</strong>
                      <span className="ops-table-meta">{holdSet.has(pkg.name) ? 'On hold: skipped from update/upgrade execution.' : 'Will be included when patch scope is executed.'}</span>
                    </td>
                    <td><code>{sanitizeDisplayText(pkg.current_version, 'Unknown')}</code></td>
                    <td><code className="text-success-inline">{sanitizeDisplayText(pkg.available_version, '-')}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {updatePolicy === 'n_minus_1' && (
            <p className="ops-subtle" style={{marginTop:10}}>Excluded by N-1 policy: {policyExcludedPackages.length}. These will be skipped during server-side patch execution.</p>
          )}
        </div>
      )}

      {upgradable.length > 0 && updatePolicy === 'n_minus_1' && policyExcludedPackages.length > 0 && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">N-1 Policy Exclusions</div>
              <p className="ops-subtle">Exact package-level exclusion reasons for this host.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table ops-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Current Version</th>
                  <th>Available Version</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {policyExcludedPackages.map((pkg, index) => (
                  <tr key={`policy-excluded-${pkg.name}-${index}`}>
                    <td><strong>{pkg.name}</strong></td>
                    <td><code>{sanitizeDisplayText(pkg.current_version, 'Unknown')}</code></td>
                    <td><code>{sanitizeDisplayText(pkg.available_version, 'Unknown')}</code></td>
                    <td>{pkg.policyReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ops-panel">
        <div className="ops-table-toolbar">
          <div>
            <div className="ops-panel-title">Execution policy</div>
            <p className="ops-subtle">Protect the patch run with snapshots, rollback, dry run validation, and hold-list exclusions.</p>
          </div>
        </div>
        <div className="ops-toggle-grid">
          <label className="ops-toggle-option">
            <input type="checkbox" checked={autoSnapshot} onChange={e => setAutoSnapshot(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Pre-patch snapshot</strong>
              <span>Create a host snapshot before installation starts.</span>
            </div>
          </label>
          <label className="ops-toggle-option">
            <input type="checkbox" checked={autoRollback} onChange={e => setAutoRollback(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Automatic rollback</strong>
              <span>Revert automatically when the patch job reports a failure.</span>
            </div>
          </label>
          <label className="ops-toggle-option">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Dry run mode</strong>
              <span>Validate package scope and execution flow without performing the install.</span>
            </div>
          </label>
          <label className="ops-toggle-option">
            <input type="checkbox" checked={securityOnly} onChange={e => setSecurityOnly(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Security patches only</strong>
              <span>Limit to security advisories (apt: security sources only, dnf: --security).</span>
            </div>
          </label>
          <label className="ops-toggle-option">
            <input type="checkbox" checked={excludeKernel} onChange={e => setExcludeKernel(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Exclude kernel packages</strong>
              <span>Skip linux-image, linux-headers, linux-modules updates.</span>
            </div>
          </label>
          <label className="ops-toggle-option">
            <input type="checkbox" checked={autoReboot} onChange={e => setAutoReboot(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Auto reboot if required</strong>
              <span>Schedule a reboot 60 seconds after patching if the agent reports reboot-required.</span>
            </div>
          </label>
          <label className="ops-toggle-option" style={{ display: 'none' }}>
            <input type="checkbox" checked={saveToRepo} onChange={e => setSaveToRepo(e.target.checked)} />
            <div className="ops-toggle-copy">
              <strong>Save in Master Repo</strong>
              <span>Store downloaded packages in Local Repository for later push.</span>
            </div>
          </label>
        </div>
        <div className="form-row" style={{ marginTop: 14 }}>
          <select className="input" value={updatePolicy} onChange={e => setUpdatePolicy(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="latest">Policy: Latest updates</option>
            <option value="n_minus_1">Policy: N-1 stable rollout</option>
          </select>
          <input className="input" placeholder="Extra apt/dnf flags (e.g. --allow-downgrades)" value={extraFlags} onChange={e => setExtraFlags(e.target.value)} style={{ flex: '1 1 260px' }} />
        </div>
        <div className="form-row" style={{ marginTop: 10 }}>
          <input className="input" placeholder="Pre-patch shell script (runs on server before patching)" value={prePatchScript} onChange={e => setPrePatchScript(e.target.value)} style={{ flex: '1 1 320px' }} />
          <input className="input" placeholder="Post-patch shell script (runs on server after patching)" value={postPatchScript} onChange={e => setPostPatchScript(e.target.value)} style={{ flex: '1 1 320px' }} />
        </div>
        <div className="form-row" style={{ marginTop: 14 }}>
          <input className="input" placeholder="Hold packages (comma-separated)" value={holdPkgs} onChange={e => setHoldPkgs(e.target.value)} style={{ flex: '1 1 320px' }} />
          <button className="btn btn-secondary" onClick={estimateScopeImpact} disabled={!selectedHost || sizeEstimate.loading}>
            {sizeEstimate.loading ? 'Estimating...' : 'Estimate Size Impact'}
          </button>
          <button className="btn btn-lg btn-secondary" onClick={() => executePatch(true)} disabled={!selectedHost || (!!jobId && jobStatus?.status === 'running') || dryRun}>
            {jobId && jobStatus?.status === 'running' ? 'Job Running...' : `Download Only (${patchScopeCount})`}
          </button>
          <button className="btn btn-lg btn-success" onClick={() => executePatch(false)} disabled={!selectedHost || (!!jobId && jobStatus?.status === 'running')}>
            {jobId && jobStatus?.status === 'running' ? 'Job Running...' : dryRun ? 'Run Simulation' : `Download + Install (${patchScopeCount})`}
          </button>
        </div>
        <div className="ops-chip-row" style={{ marginTop: 10 }}>
          <span className="ops-chip">Scope packages: {sizeEstimate.packageCount || patchScopeCount}</span>
          <span className="ops-chip">Estimated download: {(Number(sizeEstimate.totalBytes || 0) / (1024 * 1024)).toFixed(2)} MB</span>
          <span className="ops-chip">Known sizes: {sizeEstimate.knownCount}</span>
          <span className="ops-chip">Unknown sizes: {sizeEstimate.unknownCount}</span>
          <span className="ops-chip">Projected repo growth: {(Number(sizeEstimate.totalBytes || 0) / (1024 * 1024)).toFixed(2)} MB</span>
        </div>
      </div>

      {(jobStatus || jobId) && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Patch job output</div>
              <p className="ops-subtle">Follow the server-side workflow from download through offline installation on the target agent.</p>
            </div>
            <div className="ops-actions">
              <span className={`badge badge-${jobState === 'success' ? 'success' : jobState === 'failed' ? 'danger' : 'warning'}`}>{jobState.toUpperCase()}</span>
              {jobStatus?.updated_at && <span className="ops-subtle">Last update: {new Date(jobStatus.updated_at).toLocaleTimeString()}</span>}
            </div>
          </div>
          <PatchProgressBar output={jobStatus?.output} status={jobState} />
          <div className="ops-console">{jobStatus?.output || 'Initializing...'}</div>
          {jobStatus?.result && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Final Result (JSON)</summary>
              <pre className="code-block" style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word', 
                overflowWrap: 'break-word',
                maxWidth: '100%',
                overflowX: 'auto',
                fontSize: 12,
                lineHeight: 1.6
              }}>{JSON.stringify(jobStatus.result, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {installed.length > 0 && (
        <div className="ops-panel">
          <div className="ops-table-toolbar">
            <div>
              <div className="ops-panel-title">Installed packages on selected server (live)</div>
              <p className="ops-subtle">Current package inventory from the selected host. Showing {instPage * 10 + 1}–{Math.min((instPage + 1) * 10, installed.length)} of {installed.length}</p>
            </div>
            <div className="ops-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => setInstPage(p => Math.max(0, p - 1))} disabled={instPage === 0}>‹ Prev</button>
              <span className="ops-subtle" style={{ minWidth: 60, textAlign: 'center' }}>Page {instPage + 1} / {Math.ceil(installed.length / 10)}</span>
              <button className="btn btn-sm" onClick={() => setInstPage(p => p + 1)} disabled={(instPage + 1) * 10 >= installed.length}>Next ›</button>
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="table ops-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Installed Version</th>
                </tr>
              </thead>
              <tbody>
                {installed.slice(instPage * 10, instPage * 10 + 10).map((pkg, index) => (
                  <tr key={`installed-${pkg.name}-${index}`}>
                    <td>{pkg.name}</td>
                    <td><code>{sanitizeDisplayText(pkg.version || pkg.installed_version, 'Unknown')}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
