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

/** Reflect the active theme onto any [data-theme-toggle] controls on the page. */
function updateToggles(): void {
  const t = activeTheme();
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((btn) => {
    const icon = btn.querySelector<HTMLElement>('[data-theme-icon]') ?? btn;
    icon.textContent = t === 'dark' ? '☾' : '☀';
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  });
}

function wireToggles(): void {
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((btn) => {
    if (btn.dataset.themeWired) return;
    btn.dataset.themeWired = '1';
    btn.addEventListener('click', () => {
      toggleTheme();
      updateToggles();
    });
  });
  updateToggles();
}

let installed = false;

/** Apply on load, wire theme toggles, and follow live system changes (no override). */
export function installTheme(): void {
  applyTheme();
  wireToggles();
  if (installed) return;
  installed = true;
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!storedOverride()) {
        applyTheme();
        updateToggles();
      }
    });
  } catch {
    /* no matchMedia — leave the applied default */
  }
}
