import React from 'react';

export function BellIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4a4 4 0 0 0-4 4v2.2c0 .8-.24 1.58-.68 2.25L5.8 14.8A1 1 0 0 0 6.64 16h10.72a1 1 0 0 0 .84-1.2l-1.52-2.35A4.04 4.04 0 0 1 16 10.2V8a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 18a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppIcon({ name, size = 18 }) {
  const common = {
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="4" width="7" height="7" rx="1.6" {...common} />
          <rect x="13.5" y="4" width="7" height="4.5" rx="1.4" {...common} />
          <rect x="13.5" y="11.5" width="7" height="8.5" rx="1.6" {...common} />
          <rect x="3.5" y="13.5" width="7" height="6.5" rx="1.6" {...common} />
        </svg>
      );
    case 'analytics':
    case 'reports':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 19.5h16" {...common} />
          <path d="M7 16.5v-5" {...common} />
          <path d="M12 16.5V9" {...common} />
          <path d="M17 16.5V5.5" {...common} />
        </svg>
      );
    case 'shield':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.5 5.5 6v5.5c0 4.1 2.5 7.8 6.5 9 4-1.2 6.5-4.9 6.5-9V6L12 3.5Z" {...common} />
          <path d="m9.3 12.3 1.8 1.8 3.6-4" {...common} />
        </svg>
      );
    case 'server':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="4.5" width="16" height="6" rx="2" {...common} />
          <rect x="4" y="13.5" width="16" height="6" rx="2" {...common} />
          <path d="M8 8h.01M8 17h.01M12 8h4M12 17h4" {...common} />
        </svg>
      );
    case 'layers':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Z" {...common} />
          <path d="m4 12.5 8 4.5 8-4.5" {...common} />
          <path d="m4 16.5 8 4 8-4" {...common} />
        </svg>
      );
    case 'package':
    case 'box':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" {...common} />
          <path d="m12 12 8-4.5M12 12 4 7.5M12 12v9" {...common} />
        </svg>
      );
    case 'window':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" {...common} />
          <path d="M3.5 8.5h17" {...common} />
          <path d="M7 6.5h.01M10 6.5h.01" {...common} />
        </svg>
      );
    case 'camera':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.5 7.5h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 10v6.5A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5V10a2.5 2.5 0 0 1 2.5-2.5Z" {...common} />
          <circle cx="12" cy="13" r="3.2" {...common} />
        </svg>
      );
    case 'compare':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="6.5" height="14" rx="2" {...common} />
          <rect x="13.5" y="5" width="6.5" height="14" rx="2" {...common} />
          <path d="M10.5 9h3M10.5 15h3" {...common} />
        </svg>
      );
    case 'cloud-off':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 17.5h10a3.5 3.5 0 0 0 .7-6.9A5.5 5.5 0 0 0 7.7 8.3 4 4 0 0 0 7 17.5Z" {...common} />
          <path d="M4.5 5.5 19.5 18.5" {...common} />
        </svg>
      );
    case 'archive':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="16" height="4.5" rx="1.5" {...common} />
          <path d="M5.5 9.5h13v8.5A2 2 0 0 1 16.5 20h-9A2 2 0 0 1 5.5 18V9.5Z" {...common} />
          <path d="M10 13h4M12 13v4" {...common} />
        </svg>
      );
    case 'clock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7.5v5l3 1.8" {...common} />
        </svg>
      );
    case 'bug':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9.5 8.5 8 7M14.5 8.5 16 7M8 12H4.5M19.5 12H16M8.5 16 6 18M15.5 16 18 18" {...common} />
          <path d="M12 7a4 4 0 0 0-4 4v3.5A3.5 3.5 0 0 0 11.5 18h1A3.5 3.5 0 0 0 16 14.5V11a4 4 0 0 0-4-4Z" {...common} />
        </svg>
      );
    case 'timeline':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6v12M12 9v9M18 4v14" {...common} />
          <circle cx="6" cy="6" r="1.5" {...common} />
          <circle cx="12" cy="9" r="1.5" {...common} />
          <circle cx="18" cy="4" r="1.5" {...common} />
        </svg>
      );
    case 'search':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" {...common} />
          <path d="m16 16 4 4" {...common} />
        </svg>
      );
    case 'list':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6h10M9 12h10M9 18h10M5 6h.01M5 12h.01M5 18h.01" {...common} />
        </svg>
      );
    case 'bell':
      return <BellIcon size={size} />;
    case 'users':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" {...common} />
          <path d="M4.5 19a4.5 4.5 0 0 1 9 0M13.5 19a3.5 3.5 0 0 1 7 0" {...common} />
        </svg>
      );
    case 'key':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="8" cy="12" r="3.5" {...common} />
          <path d="M11.5 12H20M17 12v3M14.5 12v2" {...common} />
        </svg>
      );
    case 'pipeline':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="2.2" {...common} />
          <circle cx="18" cy="12" r="2.2" {...common} />
          <circle cx="6" cy="18" r="2.2" {...common} />
          <path d="M8.2 7.3 15.8 10.7M8.2 16.7l7.6-3.4" {...common} />
        </svg>
      );
    case 'database':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <ellipse cx="12" cy="6" rx="6.5" ry="2.5" {...common} />
          <path d="M5.5 6v6c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6M5.5 12v6c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-6" {...common} />
        </svg>
      );
    case 'sliders':
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 6h14M5 12h14M5 18h14M9 6v4M15 12v4M11 18v-4" {...common} />
        </svg>
      );
    case 'monitor':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="16" height="11" rx="2.2" {...common} />
          <path d="M8 20h8M12 16v4M7.5 11.5l2-2 2.2 2.2 4-4" {...common} />
        </svg>
      );
    case 'flask':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 4h4M11 4v4l-4.7 7.6A2.5 2.5 0 0 0 8.4 19h7.2a2.5 2.5 0 0 0 2.1-3.4L13 8V4" {...common} />
          <path d="M9 14h6" {...common} />
        </svg>
      );
    case 'rocket':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4c3 1.2 5.3 3.5 6.5 6.5L14 15l-5-5 3-6Z" {...common} />
          <path d="M9 10 5 14M14 15l-4 4M7 17l-1.5 2.5M17 7l2.5-1.5" {...common} />
        </svg>
      );
    case 'calendar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14" rx="2.4" {...common} />
          <path d="M8 3.5v4M16 3.5v4M4 9.5h16" {...common} />
        </svg>
      );
    case 'wrench':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M14.5 6.5a3.5 3.5 0 0 0-4.4 4.4L4.5 16.5a1.4 1.4 0 1 0 2 2l5.6-5.6a3.5 3.5 0 0 0 4.4-4.4l-2.1 2.1-2.3-2.3 2.4-1.8Z" {...common} />
        </svg>
      );
    case 'terminal':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.2" {...common} />
          <path d="m7 9 3 3-3 3M12.5 15H17" {...common} />
        </svg>
      );
    case 'refresh':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 7v5h-5M4 17v-5h5" {...common} />
          <path d="M6.5 9A7 7 0 0 1 18 7M17.5 15A7 7 0 0 1 6 17" {...common} />
        </svg>
      );
    case 'menu':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" {...common} />
        </svg>
      );
    case 'code':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 8-4 4 4 4M15 8l4 4-4 4M13 6l-2 12" {...common} />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" {...common} />
        </svg>
      );
  }
}

export function CodeIcon({ code, tone = '#1d4ed8', bg = 'rgba(59,130,246,0.12)', size = 18, style = {} }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size + 14,
        height: size + 14,
        padding: '0 8px',
        borderRadius: 999,
        background: bg,
        color: tone,
        border: '1px solid rgba(148, 163, 184, 0.35)',
        fontSize: Math.max(11, Math.round(size * 0.58)),
        fontWeight: 800,
        letterSpacing: '0.06em',
        lineHeight: 1,
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {code}
    </span>
  );
}
