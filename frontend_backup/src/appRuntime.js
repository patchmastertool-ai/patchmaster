import React from 'react';

// Resolve API base for all environments (docker, bare-metal, proxy):
// 1) VITE_API_URL if set.
// 2) If running on port 3000, swap to 8000 on the same host.
// 3) Otherwise use same origin.
const ENV_API = import.meta?.env?.VITE_API_URL;

export const API = (() => {
  if (ENV_API) return ENV_API.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    const { origin } = window.location;
    return origin.replace(/:(3000)$/, ':8000');
  }
  return '';
})();

export function useInterval(callback, delay) {
  const savedCallback = React.useRef();

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }

    return undefined;
  }, [delay]);
}

export function getToken() {
  return localStorage.getItem('pm_token');
}

export function websocketUrl(path, token = getToken()) {
  const base = (() => {
    if (API) return new URL(API, window.location.origin);
    return new URL(window.location.origin);
  })();
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = path.startsWith('/') ? path : `/${path}`;
  base.search = token ? `token=${encodeURIComponent(token)}` : '';
  return base.toString();
}

export function setToken(token) {
  localStorage.setItem('pm_token', token);
  try {
    document.cookie = `pm_token=${token}; path=/; SameSite=Lax`;
  } catch {}
}

export function clearToken() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_user');
  try {
    document.cookie = 'pm_token=; Max-Age=0; path=/; SameSite=Lax';
  } catch {}
}

export function getLicenseCache() {
  try {
    return JSON.parse(localStorage.getItem('pm_license'));
  } catch {
    return null;
  }
}

export function setLicenseCache(licenseInfo) {
  try {
    localStorage.setItem('pm_license', JSON.stringify(licenseInfo));
  } catch {}
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('pm_user'));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem('pm_user', JSON.stringify(user));
}

export function authHeaders() {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function apiFetch(url, opts = {}) {
  const headers = { ...authHeaders(), ...opts.headers };
  if (opts.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(url, { ...opts, headers });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Session expired');
  }
  return response;
}

export function hasRole(...roles) {
  const user = getUser();
  return user && roles.includes(user.role);
}

export function hasPerm(feature) {
  const user = getUser();
  if (!user) return false;
  if (user.role === 'admin') return true;

  const permissions = user.permissions || user.effective_permissions;
  if (permissions && typeof permissions === 'object') {
    if (Object.prototype.hasOwnProperty.call(permissions, feature)) {
      return !!permissions[feature];
    }
    return false;
  }

  const basicFeatures = ['dashboard', 'compliance', 'hosts', 'groups', 'compare', 'cve', 'jobs', 'onboarding', 'settings'];
  return basicFeatures.includes(feature);
}

export function hasFeature(feature, licenseInfo) {
  if (hasPerm(feature)) return true;
  if (!licenseInfo) {
    return ['dashboard', 'hosts', 'groups', 'patches', 'jobs', 'onboarding', 'settings', 'license'].includes(feature);
  }
  return !!(Array.isArray(licenseInfo.features) && licenseInfo.features.includes(feature));
}

const MOJIBAKE_REPLACEMENTS = [
  ['â€”', '-'],
  ['â€“', '-'],
  ['â€¦', '...'],
  ['â€¢', '*'],
  ['â†’', '->'],
  ['â†—', '->'],
  ['â€¹', '<'],
  ['â€º', '>'],
  ['Ã—', 'x'],
  ['Â·', '·'],
  ['Â', ''],
];

export function sanitizeDisplayText(value, fallback = '-') {
  if (value === null || value === undefined) return fallback;
  let text = String(value).replace(/\u00a0/g, ' ').trim();
  if (!text) return fallback;

  for (const [bad, good] of MOJIBAKE_REPLACEMENTS) {
    text = text.split(bad).join(good);
  }

  text = text.trim();
  if (!text) return fallback;

  if (/^(?:-+|—+|–+|â€”|â€“|ó€”|�+)$/.test(text)) return fallback;
  if (!/[0-9A-Za-z]/.test(text) && /^[^0-9A-Za-z]+$/.test(text)) return fallback;
  return text;
}

export function formatDetailsText(details) {
  if (details === null || details === undefined || details === '') return '';
  if (typeof details === 'string') return sanitizeDisplayText(details, '');
  try {
    return sanitizeDisplayText(JSON.stringify(details, null, 2), '');
  } catch {
    return sanitizeDisplayText(String(details), '');
  }
}
