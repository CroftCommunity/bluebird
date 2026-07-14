import { skyliteVersion } from './version.js';
import { mountGarden } from './garden.js';
import { DEV_INCLUSION } from './feed/inclusion.js';

/**
 * Phase 1 entry point. Stamps the running build (kept from Phase 0) and mounts
 * the garden — the merged, newest-first, label-filtered read of the inclusion
 * list. The inclusion list is still the Phase-1 dev fixture; the guardian config
 * (Phase 2) replaces it without touching this wiring.
 */
function start(): void {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();

  const container = document.querySelector<HTMLElement>('[data-garden]');
  if (container) void mountGarden(container, DEV_INCLUSION);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
