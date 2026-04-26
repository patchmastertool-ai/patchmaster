import React from 'react';
import { AppIcon } from '../AppIcons';

/**
 * Stitch Replica Component System
 * 
 * Shared primitives matching the Stitch design language:
 * - Summary cards
 * - Data tables
 * - Status badges
 * - Page headers
 * - Action bars
 * - Empty states
 * - Drawers
 * - Forms
 * 
 * Workspace Distinction Strategy:
 * - Infrastructure pages: Technical/operational feel with darker tones, technical icons
 * - Governance pages: Administrative/formal feel with structured layouts, audit-focused
 * - Fleet operations: Real-time/tactical feel with live metrics, action-oriented
 */

/* ===== WORKSPACE THEMES ===== */

/**
 * Workspace theme configurations for visual distinction
 */
export const WORKSPACE_THEMES = {
  infrastructure: {
    accent: '#5b74b1',
    accentBright: '#7b8fc4',
    bg: '#05183c',
    bgDark: '#031d4b',
    kicker: 'Infrastructure Operations',
    iconStyle: 'technical'
  },
  governance: {
    accent: '#91aaeb',
    accentBright: '#a8bef5',
    bg: '#06122d',
    bgDark: '#05183c',
    kicker: 'Governance & Compliance',
    iconStyle: 'formal'
  },
  fleet: {
    accent: '#7bd0ff',
    accentBright: '#97d8ff',
    bg: '#05183c',
    bgDark: '#031d4b',
    kicker: 'Fleet Operations',
    iconStyle: 'tactical'
  },
  vendor: {
    accent: '#ffd16f',
    accentBright: '#ffe89d',
    bg: '#1a1410',
    bgDark: '#0f0a08',
    kicker: 'Vendor Operations',
    iconStyle: 'business'
  }
};

/**
 * StitchWorkspaceContainer - Workspace-aware page container
 * Provides consistent workspace distinction through subtle visual cues
 */
export function StitchWorkspaceContainer({ 
  children, 
  workspace = 'fleet',
  className = '' 
}) {
  const theme = WORKSPACE_THEMES[workspace] || WORKSPACE_THEMES.fleet;
  
  return (
    <div className={`relative ${className}`}>
      {/* Subtle workspace accent indicator */}
      <div 
        className="absolute top-0 left-0 w-1 h-32 rounded-r opacity-30"
        style={{ backgroundColor: theme.accent }}
      />
      {children}
    </div>
  );
}

/* ===== SUMMARY CARDS ===== */

/**
 * StitchSummaryCard - Bento-style metric card
 * Matches: stitch/patchmaster_dashboard/code.html summary stats
 */
export function StitchSummaryCard({ 
  label, 
  value, 
  subtitle, 
  icon, 
  color = '#7bd0ff',
  trend,
  onClick,
  workspace = 'fleet' // 'infrastructure', 'governance', 'fleet', 'vendor'
}) {
  const theme = WORKSPACE_THEMES[workspace] || WORKSPACE_THEMES.fleet;
  const cardColor = color || theme.accent;
  
  return (
    <div 
      className={`group relative overflow-hidden bg-[#06122d] p-4 sm:p-6 rounded-xl transition-all duration-300 hover:bg-[#05183c] border-t-2 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ borderTopColor: cardColor }}
      onClick={onClick}
    >
      <div className="absolute inset-0 opacity-50" style={{
        background: `linear-gradient(135deg, ${cardColor}1a 0%, transparent 40%)`
      }}></div>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <span className="text-[#91aaeb] uppercase tracking-widest text-[9px] sm:text-[10px] font-bold">
            {label}
          </span>
          {icon && (
            <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ color: cardColor }}>
              {icon}
            </span>
          )}
        </div>
        <div className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-[#dee5ff]">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="mt-2 text-xs text-[#91aaeb]/80 flex items-center gap-1">
            {trend && (
              <span className="font-bold" style={{ color: cardColor }}>
                {trend}
              </span>
            )}
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StitchMetricGrid - Grid container for summary cards
 */
export function StitchMetricGrid({ children, cols = 4 }) {
  const colClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    6: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
  }[cols] || 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 ${colClass} gap-4 sm:gap-6`}>
      {children}
    </div>
  );
}

/* ===== STATUS BADGES ===== */

/**
 * StitchBadge - Status badge component
 * Matches: Stitch badge patterns across all pages
 */
export function StitchBadge({ 
  children, 
  variant = 'default',
  size = 'md'
}) {
  const variants = {
    success: 'bg-[#004c69]/20 text-[#7bd0ff]',
    warning: 'bg-[#fcc025]/20 text-[#ffd16f]',
    error: 'bg-[#7f2927]/20 text-[#ff9993]',
    info: 'bg-[#00668b]/20 text-[#a2dcff]',
    default: 'bg-[#00225a]/40 text-[#b4c0d7]',
    primary: 'bg-[#004c69]/20 text-[#7bd0ff]',
    critical: 'bg-[#7f2927]/20 text-[#ff9993]',
    security: 'bg-[#7f2927]/20 text-[#ff9993]',
    moderate: 'bg-[#00225a]/40 text-[#b4c0d7]',
    standard: 'bg-[#004c69]/20 text-[#7bd0ff]',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2 py-0.5 text-[10px]',
    lg: 'px-3 py-1 text-[11px]'
  };

  return (
    <span className={`inline-flex items-center rounded font-bold uppercase tracking-wider ${variants[variant] || variants.default} ${sizes[size]}`}>
      {children}
    </span>
  );
}

/**
 * StitchStatusDot - Animated status indicator
 */
export function StitchStatusDot({ status = 'online', label, size = 'md' }) {
  const colors = {
    online: { bg: '#22c55e', shadow: 'rgba(34,197,94,0.4)' },
    offline: { bg: '#ef4444', shadow: 'rgba(239,68,68,0.4)' },
    warning: { bg: '#fcc025', shadow: 'rgba(252,192,37,0.4)' },
    healthy: { bg: '#7bd0ff', shadow: 'rgba(123,208,255,0.4)' },
    critical: { bg: '#ee7d77', shadow: 'rgba(238,125,119,0.4)' },
  };

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  const color = colors[status] || colors.offline;

  return (
    <div className="flex items-center gap-2">
      <span 
        className={`${sizes[size]} rounded-full flex-shrink-0`}
        style={{ 
          background: color.bg, 
          boxShadow: `0 0 8px ${color.shadow}` 
        }}
      />
      {label && (
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: color.bg }}>
          {label}
        </span>
      )}
    </div>
  );
}

/* ===== PAGE HEADERS ===== */

/**
 * StitchPageHeader - Standard page header
 * Matches: Stitch page header pattern
 */
export function StitchPageHeader({ 
  kicker = 'Workspace',
  title, 
  description,
  actions,
  children,
  workspace = 'fleet' // 'infrastructure', 'governance', 'fleet', 'vendor'
}) {
  const theme = WORKSPACE_THEMES[workspace] || WORKSPACE_THEMES.fleet;
  const kickerText = kicker === 'Workspace' ? theme.kicker : kicker;
  
  return (
    <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="flex-1">
          <div 
            className="uppercase tracking-[0.2em] text-[10px] font-bold mb-2"
            style={{ color: theme.accentBright }}
          >
            {kickerText}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter text-[#dee5ff] mb-2">
            {title}
          </h2>
          {description && (
            <p className="text-[#939eb5] mt-2 max-w-2xl leading-relaxed text-sm">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ===== DATA TABLES ===== */

/**
 * StitchTable - Enterprise data table
 * Matches: Stitch table patterns from host_management and patch_manager
 */
export function StitchTable({ 
  columns, 
  data, 
  onRowClick,
  emptyState,
  loading 
}) {
  if (loading) {
    return (
      <div className="bg-[#06122d] rounded-2xl p-8 sm:p-12 text-center">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return emptyState || (
      <div className="bg-[#06122d] rounded-2xl p-8 sm:p-12 text-center">
        <div className="text-[#64748b]">No data available</div>
      </div>
    );
  }

  return (
    <div className="bg-[#06122d] rounded-2xl overflow-hidden shadow-2xl">
      {/* Mobile: Horizontal scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-1 px-2 sm:px-4 py-2">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-[#91aaeb]">
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`py-4 sm:py-6 px-3 sm:px-6 whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="space-y-2">
            {data.map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                className={`group hover:bg-[#00225a]/30 transition-all rounded-xl ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col, colIdx) => (
                  <td 
                    key={colIdx}
                    className={`py-3 sm:py-5 px-3 sm:px-6 ${colIdx === 0 ? 'rounded-l-xl' : ''} ${colIdx === columns.length - 1 ? 'rounded-r-xl' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {col.render ? col.render(row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * StitchTablePagination - Table pagination controls
 */
export function StitchTablePagination({ 
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange 
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="p-4 sm:p-6 border-t border-[#2b4680]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="text-xs text-[#91aaeb]">
        Showing <span className="font-bold text-[#dee5ff]">{startItem}-{endItem}</span> of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button 
          className="p-2 rounded-lg hover:bg-[#00225a] text-[#91aaeb] transition-all disabled:opacity-30"
          disabled={currentPage === 1}
          onClick={() => onPageChange?.(currentPage - 1)}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          
          return (
            <button
              key={i}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                pageNum === currentPage 
                  ? 'bg-[#7bd0ff] text-[#004560]' 
                  : 'hover:bg-[#00225a] text-[#dee5ff]'
              }`}
              onClick={() => onPageChange?.(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
        {totalPages > 5 && currentPage < totalPages - 2 && (
          <>
            <span className="text-[#91aaeb] mx-1 hidden sm:inline">...</span>
            <button
              className="w-8 h-8 rounded-lg hover:bg-[#00225a] text-xs font-medium transition-all hidden sm:block"
              onClick={() => onPageChange?.(totalPages)}
            >
              {totalPages}
            </button>
          </>
        )}
        <button 
          className="p-2 rounded-lg hover:bg-[#00225a] text-[#91aaeb] transition-all disabled:opacity-30"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange?.(currentPage + 1)}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

/* ===== ACTION BARS ===== */

/**
 * StitchActionBar - Filter and action toolbar
 * Matches: Stitch filter panels
 */
export function StitchActionBar({ children, className = '' }) {
  return (
    <div className={`bg-[#06122d] rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 relative overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7bd0ff]/40 to-transparent"></div>
      {children}
    </div>
  );
}

/**
 * StitchButton - Primary action button
 */
export function StitchButton({ 
  children, 
  variant = 'primary',
  size = 'md',
  icon,
  onClick,
  disabled,
  className = ''
}) {
  const variants = {
    primary: 'bg-[#7bd0ff] text-[#004560] hover:brightness-110',
    secondary: 'bg-[#00225a] text-[#dee5ff] hover:bg-[#031d4b] border border-[#2b4680]/30',
    tertiary: 'bg-[#fcc025] text-[#614700] hover:brightness-110',
    danger: 'bg-[#ee7d77] text-[#490106] hover:brightness-110',
    ghost: 'bg-transparent text-[#7bd0ff] hover:bg-[#7bd0ff]/10 border border-[#7bd0ff]/30'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 sm:px-6 py-2.5 sm:py-3 text-sm',
    lg: 'px-6 sm:px-8 py-3 sm:py-4 text-base'
  };

  return (
    <button
      className={`rounded-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
      <span className="hidden sm:inline">{children}</span>
      {/* Mobile: show icon only if icon exists, otherwise show text */}
      {icon && <span className="sm:hidden sr-only">{children}</span>}
      {!icon && <span className="sm:hidden">{children}</span>}
    </button>
  );
}

/* ===== EMPTY STATES ===== */

/**
 * StitchEmptyState - Actionable empty state
 * Matches: Stitch empty state patterns
 */
export function StitchEmptyState({ 
  icon = 'inbox',
  title,
  description,
  action,
  actionLabel,
  onAction 
}) {
  return (
    <div className="bg-[#06122d] rounded-2xl p-8 sm:p-16 text-center">
      <div className="max-w-md mx-auto space-y-4 sm:space-y-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-[#00225a]/40 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl sm:text-5xl text-[#91aaeb]">
            {icon}
          </span>
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-[#dee5ff] mb-2">{title}</h3>
          <p className="text-sm text-[#939eb5] leading-relaxed">{description}</p>
        </div>
        {(action || onAction) && (
          <div>
            {action || (
              <StitchButton onClick={onAction} icon="add_circle">
                {actionLabel || 'Get Started'}
              </StitchButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== DRAWERS ===== */

/**
 * StitchDrawer - Right-side detail drawer
 * Matches: Stitch drawer patterns for detail views
 */
export function StitchDrawer({ 
  isOpen, 
  onClose, 
  title, 
  children,
  width = 'lg' 
}) {
  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full ${widths[width]} w-full bg-[#05183c] z-50 shadow-2xl overflow-y-auto transform transition-transform`}>
        {/* Header */}
        <div className="sticky top-0 bg-[#06122d] border-b border-[#2b4680]/20 p-4 sm:p-6 flex items-center justify-between z-10">
          <h3 className="text-lg sm:text-xl font-bold text-[#dee5ff]">{title}</h3>
          <button 
            className="p-2 rounded-lg hover:bg-[#00225a] text-[#91aaeb] transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </>
  );
}

/* ===== FORMS ===== */

/**
 * StitchFormField - Form field wrapper
 */
export function StitchFormField({ 
  label, 
  required, 
  error, 
  hint,
  children 
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-[#91aaeb] text-[11px] font-bold uppercase tracking-widest">
          {label}
          {required && <span className="text-[#ee7d77] ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-[10px] text-[#4d556b]">{hint}</p>
      )}
      {error && (
        <p className="text-[10px] text-[#ff9993] font-semibold">{error}</p>
      )}
    </div>
  );
}

/**
 * StitchInput - Text input field
 */
export function StitchInput({ 
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled,
  className = ''
}) {
  return (
    <input
      type={type}
      className={`w-full bg-[#111827] border border-[#334155] text-[#fff] placeholder-[#91aaeb]/50 px-4 py-3 rounded-lg text-sm focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/**
 * StitchSelect - Select dropdown
 */
export function StitchSelect({ 
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled,
  className = ''
}) {
  return (
    <select
      className={`w-full bg-[#00225a] border-none rounded-lg text-sm text-[#dee5ff] py-3 pl-4 pr-10 focus:ring-1 focus:ring-[#7bd0ff] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt, idx) => (
        <option key={idx} value={opt.value || opt}>
          {opt.label || opt}
        </option>
      ))}
    </select>
  );
}

/**
 * StitchTextarea - Multiline text input
 */
export function StitchTextarea({ 
  placeholder,
  value,
  onChange,
  rows = 4,
  disabled,
  className = ''
}) {
  return (
    <textarea
      className={`w-full bg-[#111827] border border-[#334155] text-[#fff] placeholder-[#91aaeb]/50 px-4 py-3 rounded-lg text-sm focus:ring-1 focus:ring-[#7bd0ff] focus:border-[#7bd0ff] transition-all outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      disabled={disabled}
    />
  );
}

/* ===== ACTIVITY FEED ===== */

/**
 * StitchActivityItem - Activity feed item
 * Matches: Recent Operations pattern from dashboard
 */
export function StitchActivityItem({ 
  icon,
  iconColor = '#7bd0ff',
  iconBg = 'rgba(123,208,255,0.3)',
  title,
  subtitle,
  badge,
  badgeVariant = 'success',
  timestamp,
  onClick 
}) {
  return (
    <div 
      className={`flex gap-4 p-3 rounded-lg hover:bg-[#031d4b] transition-colors group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div 
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <span className="material-symbols-outlined text-xl" style={{ color: iconColor }}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h4 className="text-sm font-semibold truncate text-[#dee5ff]">{title}</h4>
          {timestamp && (
            <span className="text-[10px] font-mono text-[#91aaeb]/60">{timestamp}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {badge && <StitchBadge variant={badgeVariant}>{badge}</StitchBadge>}
          {subtitle && (
            <p className="text-xs text-[#91aaeb] truncate">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== TABS ===== */

/**
 * StitchTabs - Tab navigation
 */
export function StitchTabs({ tabs = [], activeTab, onTabChange }) {
  return (
    <div className="flex gap-4 sm:gap-8 border-b border-[#2b4680]/10 mb-6 sm:mb-8 overflow-x-auto no-scrollbar">
      {tabs.map((tab, idx) => (
        <button
          key={idx}
          className={`pb-3 sm:pb-4 font-semibold text-sm whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? 'text-[#7bd0ff] border-b-2 border-[#7bd0ff]'
              : 'text-[#91aaeb] hover:text-[#dee5ff]'
          }`}
          onClick={() => onTabChange?.(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ===== ALERT BANNERS ===== */

/**
 * StitchAlert - Alert/notification banner
 */
export function StitchAlert({ 
  variant = 'info',
  icon,
  title,
  message,
  onDismiss 
}) {
  const variants = {
    info: { bg: '#004c69', text: '#7bd0ff', border: '#00668b' },
    success: { bg: '#004c69', text: '#7bd0ff', border: '#00668b' },
    warning: { bg: '#fcc025', text: '#614700', border: '#edb210' },
    error: { bg: '#7f2927', text: '#ff9993', border: '#ee7d77' },
  };

  const style = variants[variant] || variants.info;

  return (
    <div 
      className="p-4 sm:p-6 rounded-xl flex items-start gap-3 sm:gap-4"
      style={{ backgroundColor: style.bg, borderLeft: `4px solid ${style.border}` }}
    >
      {icon && (
        <div 
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${style.border}33` }}
        >
          <span className="material-symbols-outlined text-lg sm:text-xl" style={{ color: style.text }}>
            {icon}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-sm font-bold mb-1" style={{ color: style.text }}>
            {title}
          </h4>
        )}
        {message && (
          <p className="text-xs leading-relaxed" style={{ color: style.text, opacity: 0.9 }}>
            {message}
          </p>
        )}
      </div>
      {onDismiss && (
        <button 
          className="p-1 rounded hover:bg-black/20 transition-colors flex-shrink-0"
          onClick={onDismiss}
          style={{ color: style.text }}
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      )}
    </div>
  );
}
