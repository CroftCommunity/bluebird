import { installTheme } from '../brand/theme.js';
import { skyliteVersion } from '../version.js';
import { el, clear } from '../render/dom.js';
import { registerServiceWorker } from '../pwa/register.js';
import { mountGarden } from '../garden.js';
import { getLocalFollows } from '../config/binding.js';
import { followNames, followNameFor } from '../social/follows.js';
import { makeFollowUi } from '../social/follow-ui.js';
import { getExplorerSession, persistExplorerSession } from '../social/explorer-auth.js';
import type { OAuthSession } from '../atproto/oauth/client.js';
import type { InclusionList } from '../feed/inclusion.js';

/**
 * §D1 My Sky. The explorer's OWN pick of voices — the people she followed,
 * distinct from the sponsor's garden. Device-local in every mode: the follow
 * DID list on this device is the whole source; when the explorer has an account
 * the follows are also persisted records. Reads reuse the garden path exactly
 * (same inclusion → getAuthorFeed → merge → label floor → renderPost), so My Sky
 * inherits the garden's safety posture: label floor, no counts, gated links.
 */

let explorerSession: OAuthSession | null = null;

function inclusionFromFollows(dids: string[]): InclusionList {
  // A follow is a DID; getAuthorFeed accepts a DID as `actor`. Use the friendly
  // name captured at follow time when we have one; the feed also hydrates the
  // author on each post.
  return {
    version: 1,
    entries: dids.map((did) => ({ actor: did, displayName: followNameFor(did) ?? did })),
  };
}

/** A calm, count-free line naming who's in My Sky ("In your sky: A, B and C"). */
function skyHeader(): HTMLElement {
  const names = followNames().map((f) => f.name);
  let sentence: string;
  if (names.length === 1) sentence = `In your sky: ${names[0]}`;
  else if (names.length === 2) sentence = `In your sky: ${names[0]} and ${names[1]}`;
  else sentence = `In your sky: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return el('p', { class: 'mysky__header', 'data-mysky-header': 'true' }, [sentence]);
}

async function render(root: HTMLElement): Promise<void> {
  // The "In your sky" header is a SIBLING of root (mountGarden clears root), so
  // drop any stale one each render.
  root.parentElement?.querySelector('[data-mysky-header]')?.remove();

  const follows = getLocalFollows();
  if (follows.length === 0) {
    clear(root);
    root.append(
      el('p', { class: 'garden__status', 'data-mysky-empty': 'true' }, [
        'Your Sky is empty. Tap ＋ Follow on someone in the garden to see them here.',
      ]),
    );
    return;
  }

  const follow = makeFollowUi({
    getSession: () => explorerSession,
    setSession: (s) => {
      explorerSession = s;
      persistExplorerSession(s);
    },
    // Unfollowing from My Sky removes the author — re-read so they drop out.
    onChange: () => void render(root),
  });

  root.before(skyHeader());
  await mountGarden(root, inclusionFromFollows(follows), {
    offline: !navigator.onLine,
    follow,
  });
}

function boot(): void {
  installTheme();
  const stamp = document.querySelector<HTMLElement>('[data-version-stamp]');
  if (stamp) stamp.textContent = skyliteVersion();
  registerServiceWorker();
  explorerSession = getExplorerSession();

  const root = document.querySelector<HTMLElement>('[data-mysky]');
  if (root) void render(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
