import { bluebirdVersion } from './version.js';
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
import { capabilities } from './config/capabilities.js';
import type { LikeUi } from './render/post.js';
import type { OAuthSession } from './atproto/oauth/client.js';
import {
  finishExplorerSignInFromUrl,
  refreshExplorerSessionOnOpen,
  startExplorerSignIn,
  persistExplorerSession,
} from './social/explorer-auth.js';
import { makeLikeUi, explorerSignInBanner } from './social/like-ui.js';
import { makeFollowUi } from './social/follow-ui.js';
import { fetchFriendHearts } from './social/friends-hearts.js';
import { installTheme } from './brand/theme.js';

/** The explorer's scoped OAuth session (B1), or null in localOnly / lapsed states. */
let explorerSession: OAuthSession | null = null;

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

      // B1/B2 likes — only when the explorer has an account (localOnly off).
      // capabilities() keys on localOnly, never skin.
      const caps = capabilities(gate.config);
      const like: LikeUi | undefined = caps.canPersistLikes
        ? makeLikeUi({
            getSession: () => explorerSession,
            setSession: (s) => {
              explorerSession = s;
              persistExplorerSession(s);
            },
            requestSignIn: () => document.querySelector<HTMLElement>('[data-explorer-signin]')?.click(),
          })
        : undefined;

      // D1 follow — add an author to My Sky. Available in every mode (device-local
      // always; persisted when the explorer has an account). Never gates on skin.
      const follow = makeFollowUi({
        getSession: () => explorerSession,
        setSession: (s) => {
          explorerSession = s;
          persistExplorerSession(s);
        },
      });

      // B2 friends' hearts — the see-but-not-be-seen lurk read. When the sponsor
      // enabled it (or the explorer has an account), read friends' PUBLIC likes
      // anonymously — NO session, NO credential — and annotate the garden by
      // name. A localOnly explorer can lurk with no repo of her own.
      const friendHearts =
        caps.canSeeFriendsHearts && gate.config.friends.length > 0
          ? fetchFriendHearts(gate.config.friends).catch(() => new Map<string, string[]>())
          : undefined;

      await mountGarden(
        container,
        { version: 1, entries: inclusion },
        {
          offline,
          includeReposts: gate.config.showReposts,
          ...(notice ? { changeNotice: notice } : {}),
          ...(like ? { like } : {}),
          follow,
          ...(friendHearts ? { friendHearts } : {}),
        },
      );

      // Gentle degrade: sharing is on but there's no valid session — offer
      // sign-in without ever gating the garden (which just rendered above).
      if (caps.canPersistLikes && !explorerSession) {
        container.prepend(explorerSignInBanner((target, options) => void startExplorerSignIn(target, options ?? {})));
      }
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
  installTheme(); // device-local theme (P2) — before anything paints branded chrome

  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = bluebirdVersion();

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

  // B1 explorer identity: finish an OAuth callback if this is one, otherwise
  // refresh-on-open (keeps sponsor-assisted re-auth rare, docs/custody.md). A
  // broken refresh chain clears the session and degrades gently.
  try {
    explorerSession = await finishExplorerSignInFromUrl();
  } catch {
    explorerSession = null;
  }
  if (!explorerSession) explorerSession = await refreshExplorerSessionOnOpen();

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
