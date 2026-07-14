import type { FeedViewPost, PostView } from '../atproto/types.js';

/**
 * Merge N author feeds into one newest-first garden — the "made thing, not an
 * algorithm" of IDEAS.md §2. Pure and deterministic (no wall clock), so it is
 * heavily unit-tested against fixtures.
 *
 * Two things this does that matter for safety, not just ordering:
 *  - **Reposts are dropped by default.** An included author reposting an
 *    *excluded* author would smuggle that author's post past the inclusion
 *    ceiling ("she only ever sees who you've included"). Dropping reposts keeps
 *    the ceiling tight. Set `includeReposts` to override.
 *  - **De-duplication by post URI**, so the same post surfaced from two feeds
 *    appears once.
 */

export interface MergeOptions {
  includeReposts?: boolean;
  limit?: number;
}

const REPOST = 'app.bsky.feed.defs#reasonRepost';

/** Milliseconds since epoch, or null if unparseable. */
function toMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * The sort key for a post. Prefer the authored time (`record.createdAt`), but
 * guard against a spoofed far-future `createdAt`: a post cannot truly be indexed
 * before it was created, so if `createdAt` runs more than a day past `indexedAt`
 * we trust `indexedAt` instead. Keeps junk from pinning itself to the top.
 */
export function postTimestamp(post: PostView): number {
  const created = toMs(post.record.createdAt);
  const indexed = toMs(post.indexedAt);
  if (created === null) return indexed ?? 0;
  if (indexed !== null && created - indexed > 24 * 60 * 60 * 1000) return indexed;
  return created;
}

export function mergeFeeds(feeds: FeedViewPost[][], opts: MergeOptions = {}): PostView[] {
  const includeReposts = opts.includeReposts ?? false;
  const seen = new Set<string>();
  const posts: PostView[] = [];

  for (const feed of feeds) {
    for (const item of feed) {
      const isRepost = item.reason?.$type === REPOST;
      if (isRepost && !includeReposts) continue;
      const uri = item.post?.uri;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      posts.push(item.post);
    }
  }

  posts.sort((a, b) => {
    const d = postTimestamp(b) - postTimestamp(a);
    // Stable, deterministic tie-break so equal timestamps never reorder run-to-run.
    return d !== 0 ? d : (a.uri < b.uri ? 1 : a.uri > b.uri ? -1 : 0);
  });

  return typeof opts.limit === 'number' ? posts.slice(0, opts.limit) : posts;
}
