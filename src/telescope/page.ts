import { installTheme } from '../brand/theme.js';
import { skyliteVersion } from '../version.js';
import { el, clear } from '../render/dom.js';
import { registerServiceWorker } from '../pwa/register.js';
import { renderPausedLock, renderStaleLock } from '../render/locks.js';
import { resolveGarden } from '../config/provider.js';
import { renderGardenInto, type GardenResult } from '../garden.js';
import { AuthorFeedClient } from '../atproto/client.js';
import { filterByLabels } from '../feed/labels.js';
import { makeFollowUi } from '../social/follow-ui.js';
import { getExplorerSession, persistExplorerSession } from '../social/explorer-auth.js';
import type { OAuthSession } from '../atproto/oauth/client.js';
import type { SkyliteApprovedFeed } from '../config/types.js';

/**
 * §D Telescope — sponsor-curated discovery. Rung 1 (this page): browse the
 * sponsor's APPROVED feed generators. A discovery feed shows outside authors, so
 * the SAME safety layers as the garden apply, unchanged: the label floor
 * (filterByLabels), no counts, gated links, the navigation wall — and the D1
 * follow control, so an explorer can pull a discovered voice into My Sky. The
 * "open search / whole sky" rung (config.telescope) is a HIGHER, riskier rung —
 * staged, not built here.
 */

let explorerSession: OAuthSession | null = null;

function followUi() {
  return makeFollowUi({
    getSession: () => explorerSession,
    setSession: (s) => {
      explorerSession = s;
      persistExplorerSession(s);
    },
    // The follow button updates itself optimistically — no full reload needed.
  });
}

async function loadFeed(list: HTMLElement, feed: SkyliteApprovedFeed): Promise<void> {
  renderGardenInto(list, { posts: [], failedActors: [] }, 'loading');
  try {
    const res = await new AuthorFeedClient().getFeed(feed.uri, { limit: 30 });
    const posts = filterByLabels(res.feed.map((fv) => fv.post));
    const result: GardenResult = { posts, failedActors: [] };
    const status = posts.length > 0 ? 'ready' : 'empty';
    renderGardenInto(list, result, status, { follow: followUi() });
  } catch {
    renderGardenInto(list, { posts: [], failedActors: [feed.uri] }, 'error');
  }
}

function picker(feeds: SkyliteApprovedFeed[], onPick: (f: SkyliteApprovedFeed) => void): HTMLElement {
  const row = el('div', { class: 'telescope__picker', 'data-telescope-picker': 'true' });
  feeds.forEach((feed, i) => {
    const btn = el('button', {
      class: 'telescope__feed',
      type: 'button',
      'data-telescope-feed': feed.uri,
      ...(i === 0 ? { 'aria-current': 'true' } : {}),
    }, [feed.name || feed.uri]);
    btn.addEventListener('click', () => {
      row.querySelectorAll('[aria-current]').forEach((b) => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
      onPick(feed);
    });
    row.append(btn);
  });
  return row;
}

function message(root: HTMLElement, text: string, kind: string): void {
  clear(root);
  root.append(el('p', { class: 'garden__status', 'data-telescope-status': kind }, [text]));
}

async function render(root: HTMLElement): Promise<void> {
  const { gate } = await resolveGarden();
  if (gate.kind === 'paused') return renderPausedLock(root);
  if (gate.kind === 'stale-locked') return renderStaleLock(root);

  const feeds = gate.config.approvedFeeds;
  if (feeds.length === 0) {
    message(
      root,
      'No discovery feeds yet. Someone who looks after you can add trusted feeds to open here.',
      'empty',
    );
    return;
  }

  clear(root);
  const list = el('main', { class: 'garden', 'data-telescope-list': 'true', 'aria-live': 'polite' });
  const firstFeed = feeds[0];
  root.append(
    picker(feeds, (feed) => void loadFeed(list, feed)),
    list,
  );
  if (firstFeed) await loadFeed(list, firstFeed);
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  explorerSession = getExplorerSession();

  const root = document.querySelector<HTMLElement>('[data-telescope]');
  if (root) void render(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
