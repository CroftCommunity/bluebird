/**
 * P2 theme mechanics. Theme (light/dark) is a device-local, explorer-owned
 * setting — a third axis, independent of any capability or the cosmetic skin
 * switch, and it never syncs anywhere. Default follows `prefers-color-scheme`;
 * a manual override persists in localStorage and wins over the media query.
 * The `theme-color` meta is kept in sync with the active theme's background.
 */

export type Theme = 'light' | 'dark';

const KEY = 'skylite.theme';

function storage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** The explorer's explicit choice, or null to follow the system. */
export function storedOverride(): Theme | null {
  const v = storage()?.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function activeTheme(): Theme {
  return storedOverride() ?? systemTheme();
}

/** Keep the browser-UI theme-color meta matching the active background token. */
function syncThemeColor(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (!bg) return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', bg);
}

/** Reflect the current override (or its absence) onto the document + meta. */
export function applyTheme(): void {
  const override = storedOverride();
  const root = document.documentElement;
  if (override) root.setAttribute('data-theme', override);
  else root.removeAttribute('data-theme');
  syncThemeColor();
}

/** Set an explicit theme, or pass null to go back to following the system. */
export function setTheme(theme: Theme | null): void {
  const s = storage();
  if (theme) s?.setItem(KEY, theme);
  else s?.removeItem(KEY);
  applyTheme();
}

/** Flip to the opposite of what's currently showing (and persist it). */
export function toggleTheme(): Theme {
  const next: Theme = activeTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

let installed = false;

/** Apply on load and, with no override, follow live system-theme changes. */
export function installTheme(): void {
  applyTheme();
  if (installed) return;
  installed = true;
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!storedOverride()) applyTheme();
    });
  } catch {
    /* no matchMedia — leave the applied default */
  }
}
