import type { PostView } from './atproto/types.js';
import { AuthorFeedClient } from './atproto/client.js';
import type { InclusionList } from './feed/inclusion.js';
import { mergeFeeds } from './feed/merge.js';
import { filterByLabels } from './feed/labels.js';
import { renderPost, markSavedPosts } from './render/post.js';
import { el, clear } from './render/dom.js';
import { offlineBanner } from './render/locks.js';
import { savedUris } from './saves/store.js';

/**
 * Orchestrates the read path: pull each included author's feed, merge them
 * newest-first, apply the label backstop (D3), and render. One author failing
 * must not blank the whole garden — the ceiling is the union of who resolves.
 */

export interface GardenOptions {
  client?: AuthorFeedClient;
  perAuthor?: number;
  limit?: number;
  /**
   * Whether reposts (whole outside posts, injected by a garden author's act) are
   * shown. Mirrors config.showReposts (default true). Reposts are label-floored
   * identically to any other post — the label floor is the only safety layer for
   * outside authors (§3). Defaults to false at this layer so a caller that omits
   * it gets the tight inclusion ceiling.
   */
  includeReposts?: boolean;
}

export interface GardenResult {
  posts: PostView[];
  failedActors: string[];
}

export async function fetchGarden(
  inclusion: InclusionList,
  opts: GardenOptions = {},
): Promise<GardenResult> {
  const client = opts.client ?? new AuthorFeedClient();
  const perAuthor = opts.perAuthor ?? 20;

  const settled = await Promise.allSettled(
    inclusion.entries.map((e) => client.collectAuthorFeed(e.actor, { maxPosts: perAuthor })),
  );

  const feeds = [];
  const failedActors: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const entry = inclusion.entries[i];
    if (r && r.status === 'fulfilled') feeds.push(r.value);
    else if (entry) failedActors.push(entry.actor);
  }

  const merged = mergeFeeds(feeds, {
    includeReposts: opts.includeReposts ?? false,
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
  });
  const posts = filterByLabels(merged);
  return { posts, failedActors };
}

type Status = 'loading' | 'ready' | 'empty' | 'error';

function statusMessage(status: Status): string {
  switch (status) {
    case 'loading':
      return 'Opening the window…';
    case 'empty':
      return 'Nothing new in the garden right now.';
    case 'error':
      return "Couldn't reach the sky. Try again in a little while.";
    default:
      return '';
  }
}

export function renderGardenInto(
  container: HTMLElement,
  result: GardenResult,
  status: Status,
  opts: { offline?: boolean } = {},
): void {
  clear(container);
  if (opts.offline) container.append(offlineBanner());
  if (status !== 'ready') {
    container.append(el('p', { class: 'garden__status', 'data-garden-status': status }, [statusMessage(status)]));
    return;
  }
  const list = el('div', { class: 'garden__list', 'data-garden-list': 'true' });
  for (const post of result.posts) list.append(renderPost(post));
  container.append(list);
}

/** Mount the garden into a container, showing loading → ready/empty/error. */
export async function mountGarden(
  container: HTMLElement,
  inclusion: InclusionList,
  opts: GardenOptions & { offline?: boolean } = {},
): Promise<void> {
  renderGardenInto(container, { posts: [], failedActors: [] }, 'loading');
  try {
    const result = await fetchGarden(inclusion, opts);
    const status: Status =
      result.posts.length > 0 ? 'ready' : result.failedActors.length > 0 ? 'error' : 'empty';
    renderGardenInto(container, result, status, { offline: opts.offline ?? false });
    if (status === 'ready') void savedUris().then((set) => markSavedPosts(container, set));
  } catch {
    renderGardenInto(container, { posts: [], failedActors: [] }, 'error');
  }
}
