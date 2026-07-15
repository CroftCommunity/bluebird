import type { AuthorFeedResponse, FeedViewPost, PostView } from './types.js';

/**
 * Read-only client for `app.bsky.feed.getAuthorFeed`. Unauthenticated by design
 * — the lexicon states "Does not require auth", and unauthenticated app.bsky.*
 * reads are served by the public AppView (build plan §1). No token, no account.
 */

export const PUBLIC_APPVIEW = 'https://public.api.bsky.app';

/** `filter` values the getAuthorFeed lexicon accepts. */
export type AuthorFeedFilter =
  | 'posts_with_replies'
  | 'posts_no_replies'
  | 'posts_with_media'
  | 'posts_and_author_threads';

export interface ClientOptions {
  /** AppView origin. Defaults to the public AppView. */
  baseUrl?: string;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable sleep (ms) for tests. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Max retries on 429 / 5xx before giving up. Default 3. */
  maxRetries?: number;
  /** Base backoff in ms (doubled per attempt). Default 500. */
  backoffBaseMs?: number;
  /** Cap on any single backoff wait. Default 15_000. */
  backoffCapMs?: number;
}

export interface GetAuthorFeedParams {
  /** DID or handle of the author. */
  actor: string;
  /** Page size (AppView max is 100). Default 30. */
  limit?: number;
  cursor?: string;
  filter?: AuthorFeedFilter;
  signal?: AbortSignal;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class AuthorFeedError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthorFeedError';
    this.status = status;
  }
}

export class AuthorFeedClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly backoffCapMs: number;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? PUBLIC_APPVIEW;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.sleep = opts.sleep ?? defaultSleep;
    this.maxRetries = opts.maxRetries ?? 3;
    this.backoffBaseMs = opts.backoffBaseMs ?? 500;
    this.backoffCapMs = opts.backoffCapMs ?? 15_000;
  }

  /** Fetch a single page of an author's feed. */
  async getAuthorFeed(params: GetAuthorFeedParams): Promise<AuthorFeedResponse> {
    const url = new URL('/xrpc/app.bsky.feed.getAuthorFeed', this.baseUrl);
    url.searchParams.set('actor', params.actor);
    url.searchParams.set('limit', String(params.limit ?? 30));
    url.searchParams.set('filter', params.filter ?? 'posts_no_replies');
    if (params.cursor) url.searchParams.set('cursor', params.cursor);

    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        ...(params.signal ? { signal: params.signal } : {}),
      });

      if (res.ok) {
        return (await res.json()) as AuthorFeedResponse;
      }

      // Polite backoff: retry only rate-limit / transient server errors.
      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!retryable || attempt >= this.maxRetries) {
        throw new AuthorFeedError(
          `getAuthorFeed(${params.actor}) failed: ${res.status} ${res.statusText}`,
          res.status,
        );
      }
      await this.sleep(this.backoffDelay(attempt, res.headers.get('retry-after')));
    }
  }

  /**
   * Fetch up to `maxPosts` of an author's feed, following the cursor. Stops when
   * the cursor runs out or the target is reached. Repost/pin entries are kept as
   * returned; de-duplication and merge happen in feed/merge.
   */
  async collectAuthorFeed(
    actor: string,
    opts: { maxPosts?: number; pageSize?: number; filter?: AuthorFeedFilter; signal?: AbortSignal } = {},
  ): Promise<FeedViewPost[]> {
    const maxPosts = opts.maxPosts ?? 30;
    const pageSize = Math.min(opts.pageSize ?? 30, 100);
    const out: FeedViewPost[] = [];
    let cursor: string | undefined;

    while (out.length < maxPosts) {
      const page = await this.getAuthorFeed({
        actor,
        limit: Math.min(pageSize, maxPosts - out.length),
        ...(cursor ? { cursor } : {}),
        ...(opts.filter ? { filter: opts.filter } : {}),
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      out.push(...page.feed);
      if (!page.cursor || page.feed.length === 0) break;
      cursor = page.cursor;
    }
    return out.slice(0, maxPosts);
  }

  /**
   * Fetch hydrated post views by at:// URI (`app.bsky.feed.getPosts`, public,
   * unauthenticated). Used by the post-view page (§B3) to render a single shared
   * post in full. Same polite backoff as getAuthorFeed.
   */
  async getPosts(uris: string[], signal?: AbortSignal): Promise<{ posts: PostView[] }> {
    const url = new URL('/xrpc/app.bsky.feed.getPosts', this.baseUrl);
    for (const uri of uris) url.searchParams.append('uris', uri);

    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        ...(signal ? { signal } : {}),
      });
      if (res.ok) {
        const data = (await res.json()) as { posts?: PostView[] };
        return { posts: data.posts ?? [] };
      }
      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (!retryable || attempt >= this.maxRetries) {
        throw new AuthorFeedError(`getPosts failed: ${res.status} ${res.statusText}`, res.status);
      }
      await this.sleep(this.backoffDelay(attempt, res.headers.get('retry-after')));
    }
  }

  private backoffDelay(attempt: number, retryAfter: string | null): number {
    // Honor an explicit Retry-After (seconds) when the server sends one.
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, this.backoffCapMs);
    }
    return Math.min(this.backoffBaseMs * 2 ** attempt, this.backoffCapMs);
  }
}
