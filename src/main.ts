import { skyliteVersion } from './version.js';

/**
 * Phase 0 entry point. The garden itself (Phase 1) does not exist yet; all this
 * bundle proves is that the pipeline builds, ships, and renders a build we can
 * point at. It stamps the running version into the page so a browser check —
 * and the e2e gate — can confirm exactly which build is live.
 */
function renderVersionStamp(): void {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) {
    stamp.textContent = skyliteVersion();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderVersionStamp, { once: true });
} else {
  renderVersionStamp();
}
