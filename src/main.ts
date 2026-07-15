import { skyliteVersion } from './version.js';
import { mountGarden } from './garden.js';
import { renderPausedLock, renderStaleLock } from './render/locks.js';
import { ingestProvisioningFromLocation, getCachedConfig, getLocalConfig } from './config/binding.js';
import { resolveGarden } from './config/provider.js';
import { registerServiceWorker } from './pwa/register.js';
import { installBackgroundLock } from './lock/backgroundLock.js';
import { showHelpHandoff, type HelpContact } from './care/handoff.js';

/** The trusted-adult contact from whatever config we last knew (any gate state). */
function helpContact(): HelpContact {
  return (getCachedConfig()?.config ?? getLocalConfig())?.help ?? {};
}

/**
 * Phase 2 entry point. Ingests any provisioning link, resolves which config
 * governs this device (sponsor PDS → local → dev fixture) and its D5 gate, then
 * renders the garden, the pause lock, or the staleness lock accordingly. The
 * inclusion list now comes from the sponsor's enabled channels — the Phase-1
 * dev fixture is only the unprovisioned fallback.
 */
async function start(): Promise<void> {
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();

  registerServiceWorker();
  installBackgroundLock();

  // "Something's wrong" handoff — reachable from the topbar in every state.
  const helpBtn = document.querySelector<HTMLElement>('[data-help-btn]');
  if (helpBtn) helpBtn.addEventListener('click', () => showHelpHandoff(helpContact()));

  const container = document.querySelector<HTMLElement>('[data-garden]');
  if (!container) return;

  // A fresh provisioning link binds this device, then is cleared from the URL.
  ingestProvisioningFromLocation(window.location, window.history);

  const { gate, inclusion } = await resolveGarden();
  switch (gate.kind) {
    case 'paused':
      renderPausedLock(container);
      return;
    case 'stale-locked':
      renderStaleLock(container);
      return;
    default: {
      // Show the "saved posts, offline" banner either when serving a cached
      // config (D5) or when the device itself is offline.
      const offline = gate.offline || !navigator.onLine;
      // §3: reposts inject whole outside posts — honor the sponsor's showReposts
      // switch (default true), still under the label floor.
      await mountGarden(
        container,
        { version: 1, entries: inclusion },
        { offline, includeReposts: gate.config.showReposts },
      );
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start(), { once: true });
} else {
  void start();
}
