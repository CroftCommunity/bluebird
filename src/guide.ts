import { installTheme } from './brand/theme.js';
import { skyliteVersion } from './version.js';
import { registerServiceWorker } from './pwa/register.js';

/** The sponsor guide — static reference copy (setup flow + account security). */
function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
