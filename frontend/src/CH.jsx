/**
 * Command Horizon V2 — Shared UI Primitives
 * All PatchMaster pages import from this file for consistent design tokens.
 */
import React from 'react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
export const CH = {
  bg:        '#060e20',
  surface:   '#06122d',
  surfaceMd: '#05183c',
  surfaceHi: '#00225a',
  border:    'rgba(43,70,128,0.25)',
  accent:    '#7bd0ff',
  text:      '#dee5ff',
  textSub:   '#91aaeb',
  green:     '#10b981',
  red:       '#ef4444',
  yellow:    '#fbbf24',
};

// ─── Page Shell ───────────────────────────────────────────────────────────────
export function CHPage({ children, className = '' }) {
  return (
    <div
      className={`h-full overflow-y-auto ${className}`}
      style={{ background: CH.bg, color: CH.text, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8 pb-16">
        {children}
      </div>
    </div>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────
export function CHHeader({ kicker, title, subtitle, actions }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        {kicker && (
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: CH.accent }}>
            {kicker}
          </p>
        )}
        <h1 className="text-4xl font-black tracking-tight" style={{ color: CH.text }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: CH.textSub }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function CHCard({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ background: 'rgba(6,18,45,0.7)', border: `1px solid ${CH.border}`, ...style }}
    >
      {children}
    </div>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
export function CHLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: CH.textSub }}>
      {children}
    </p>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function CHStat({ label, value, sub, accent = CH.accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-6 text-left transition-all group"
      style={{
        background: 'rgba(6,18,45,0.7)',
        border: `1px solid ${CH.border}`,
        borderTop: `2px solid ${accent}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(5,24,60,0.8)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'rgba(6,18,45,0.7)'; }}
    >
      <CHLabel>{label}</CHLabel>
      <div className="text-4xl font-black tracking-tighter mt-3" style={{ color: CH.text }}>{value}</div>
      {sub && <div className="text-xs mt-2" style={{ color: CH.textSub }}>{sub}</div>}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function CHBadge({ children, color = CH.accent }) {
  return (
    <span
      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {children}
    </span>
  );
}

// ─── Status Dot ───────────────────────────────────────────────────────────────
export function CHDot({ status }) {
  const color = status === 'online' || status === 'ok' || status === 'success' ? CH.green
    : status === 'error' || status === 'failed' || status === 'critical' ? CH.red
    : status === 'warning' ? CH.yellow
    : CH.textSub;
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />;
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function CHBtn({ children, onClick, variant = 'default', disabled = false, className = '' }) {
  const styles = {
    default:  { background: `${CH.accent}18`, color: CH.accent, border: `1px solid ${CH.accent}40` },
    primary:  { background: CH.accent, color: '#06122d', boxShadow: `0 4px 14px ${CH.accent}25` },
    danger:   { background: `${CH.red}18`, color: CH.red, border: `1px solid ${CH.red}40` },
    ghost:    { background: 'rgba(3,29,75,0.4)', color: CH.textSub, border: `1px solid ${CH.border}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={styles[variant] || styles.default}
    >
      {children}
    </button>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function CHTable({ headers, children, emptyMessage = 'No data available.' }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${CH.border}` }}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="text-[10px] font-bold uppercase tracking-widest text-left"
              style={{ background: 'rgba(3,29,75,0.5)', borderBottom: `1px solid ${CH.border}`, color: CH.textSub }}
            >
              {headers.map((h, i) => (
                <th key={i} className={`px-6 py-4 ${h === '#' || h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: 'rgba(6,18,45,0.5)' }}>
            {React.Children.count(children) === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-16 text-center text-sm" style={{ color: CH.textSub }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────
export function CHTR({ children, onClick, selected }) {
  return (
    <tr
      onClick={onClick}
      className="transition-colors"
      style={{
        borderBottom: `1px solid rgba(43,70,128,0.1)`,
        background: selected ? 'rgba(3,29,75,0.5)' : undefined,
        cursor: onClick ? 'pointer' : undefined,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(3,29,75,0.25)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = ''; }}
    >
      {children}
    </tr>
  );
}

// ─── Loading spinner ─────────────────────────────────────────────────────────
export function CHLoading({ message = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center h-48 gap-3" style={{ color: CH.textSub }}>
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${CH.accent} transparent ${CH.accent} ${CH.accent}` }} />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function CHEmpty({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      {icon && <div style={{ color: 'rgba(43,70,128,0.6)' }}>{icon}</div>}
      <p className="text-lg font-bold" style={{ color: CH.text }}>{title}</p>
      {description && <p className="text-sm max-w-md" style={{ color: CH.textSub }}>{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────
export function CHInput({ placeholder, value, onChange, icon, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: CH.textSub }}>
          {icon}
        </div>
      )}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full rounded-lg py-2.5 text-sm focus:outline-none focus:ring-1 ${icon ? 'pl-9 pr-4' : 'px-4'}`}
        style={{
          background: 'rgba(3,29,75,0.5)',
          border: `1px solid rgba(43,70,128,0.35)`,
          color: CH.text,
          '--tw-ring-color': CH.accent,
        }}
      />
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────
export function CHSelect({ value, onChange, children, label }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <CHLabel>{label}</CHLabel>}
      <select
        value={value}
        onChange={onChange}
        className="rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
        style={{
          background: 'rgba(3,29,75,0.5)',
          border: `1px solid rgba(43,70,128,0.35)`,
          color: CH.text,
        }}
      >
        {children}
      </select>
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────
export function CHProgress({ value, max = 100, color = CH.accent }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(43,70,128,0.2)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

// ─── Severity helper ─────────────────────────────────────────────────────────
export function severityColor(sev) {
  const s = (sev || '').toLowerCase();
  if (s === 'critical') return CH.red;
  if (s === 'high')     return CH.yellow;
  if (s === 'medium')   return CH.accent;
  return CH.textSub;
}

export function severityBadge(sev) {
  const color = severityColor(sev);
  return <CHBadge color={color}>{sev || 'info'}</CHBadge>;
}
