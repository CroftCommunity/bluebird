import { skyliteVersion } from './version.js';
import { mountGarden } from './garden.js';
import { renderPausedLock, renderStaleLock } from './render/locks.js';
import { ingestProvisioningFromLocation, getBinding, getCachedConfig, getLocalConfig } from './config/binding.js';
import { resolveGarden } from './config/provider.js';
import { registerServiceWorker } from './pwa/register.js';
import { installBackgroundLock } from './lock/backgroundLock.js';
import { showHelpHandoff, type HelpContact } from './care/handoff.js';
import { renderLanding } from './landing.js';
import { installPullToRefresh } from './refresh/pull.js';
import { changeSentence } from './config/diff.js';

/** The trusted-adult contact from whatever config we last knew (any gate state). */
function helpContact(): HelpContact {
  return (getCachedConfig()?.config ?? getLocalConfig())?.help ?? {};
}

/**
 * Re-poll the sponsor config and re-fetch the feeds, then render the resulting
 * gate. This is the single path both the refresh control and the pull gesture
 * (S6) call. Offline it leans on the cached config + SW-cached feeds and shows
 * the offline banner — never a dead spinner.
 */
async function openGarden(container: HTMLElement): Promise<void> {
  const { gate, inclusion, changes } = await resolveGarden();
  switch (gate.kind) {
    case 'paused':
      renderPausedLock(container);
      return;
    case 'stale-locked':
      renderStaleLock(container);
      return;
    default: {
      // Reflect the cosmetic skin switch so it is observable and ready for the
      // full skin (RUN-SOCIAL B4). Only "simple" is styled today; this NEVER
      // gates a capability (capabilities-key-on-localOnly-never-skin).
      document.documentElement.dataset.skin = gate.config.skin;
      // Show the "saved posts, offline" banner either when serving a cached
      // config (D5) or when the device itself is offline.
      const offline = gate.offline || !navigator.onLine;
      // §3: reposts inject whole outside posts — honor the sponsor's showReposts
      // switch (default true), still under the label floor.
      // §3: name what the last config poll changed, always on.
      const notice = changeSentence(changes);
      await mountGarden(
        container,
        { version: 1, entries: inclusion },
        { offline, includeReposts: gate.config.showReposts, ...(notice ? { changeNotice: notice } : {}) },
      );
    }
  }
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

  // S1 role funnel: a device that is not yet set up (no binding, no local
  // config) sees the landing with two doors — never the garden. A provisioning
  // arrival was bound just above, so it skips straight past this.
  const setUp = getBinding() !== null || getLocalConfig() !== null;
  if (!setUp) {
    document.querySelector('.topbar')?.setAttribute('hidden', 'hidden');
    renderLanding(container);
    return;
  }

  // S6 refresh: an always-visible control in the header plus a custom pull
  // gesture on the feed container. Both re-poll config and re-fetch feeds.
  let refreshing = false;
  const refresh = async (): Promise<void> => {
    if (refreshing) return;
    refreshing = true;
    document.querySelector('[data-refresh]')?.classList.add('topbar__refresh--spin');
    try {
      await openGarden(container);
    } finally {
      refreshing = false;
      document.querySelector('[data-refresh]')?.classList.remove('topbar__refresh--spin');
    }
  };
  const refreshBtn = document.querySelector<HTMLElement>('[data-refresh]');
  if (refreshBtn) {
    refreshBtn.hidden = false;
    refreshBtn.addEventListener('click', () => void refresh());
  }
  installPullToRefresh(container, refresh);

  await openGarden(container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start(), { once: true });
} else {
  void start();
}
