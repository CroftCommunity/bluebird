import { describe, it, expect } from 'vitest';
import { AuthorFeedClient, AuthorFeedError } from '../../src/atproto/client.js';
import type { AuthorFeedResponse, PostView } from '../../src/atproto/types.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const noSleep = (): Promise<void> => Promise.resolve();

describe('AuthorFeedClient.getAuthorFeed', () => {
  it('builds the getAuthorFeed URL with actor, limit, and filter', async () => {
    let seen: URL | undefined;
    const client = new AuthorFeedClient({
      fetchImpl: (input) => {
        seen = input as URL;
        return Promise.resolve(jsonResponse({ feed: [] } satisfies AuthorFeedResponse));
      },
    });
    await client.getAuthorFeed({ actor: 'bsky.app', limit: 10 });
    expect(seen?.pathname).toBe('/xrpc/app.bsky.feed.getAuthorFeed');
    expect(seen?.searchParams.get('actor')).toBe('bsky.app');
    expect(seen?.searchParams.get('limit')).toBe('10');
    expect(seen?.searchParams.get('filter')).toBe('posts_no_replies');
    expect(seen?.origin).toBe('https://public.api.bsky.app');
  });

  it('retries on 429 honoring Retry-After, then succeeds', async () => {
    const waits: number[] = [];
    let calls = 0;
    const client = new AuthorFeedClient({
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
      fetchImpl: () => {
        calls++;
        if (calls === 1) {
          return Promise.resolve(
            new Response('rate limited', { status: 429, headers: { 'retry-after': '2' } }),
          );
        }
        return Promise.resolve(jsonResponse({ feed: [] }));
      },
    });
    const res = await client.getAuthorFeed({ actor: 'x' });
    expect(res.feed).toEqual([]);
    expect(calls).toBe(2);
    expect(waits).toEqual([2000]); // honored Retry-After seconds
  });

  it('throws AuthorFeedError on a non-retryable status', async () => {
    const client = new AuthorFeedClient({
      sleep: noSleep,
      fetchImpl: () => Promise.resolve(new Response('nope', { status: 400, statusText: 'Bad Request' })),
    });
    await expect(client.getAuthorFeed({ actor: 'x' })).rejects.toBeInstanceOf(AuthorFeedError);
  });

  it('gives up after maxRetries on persistent 5xx', async () => {
    let calls = 0;
    const client = new AuthorFeedClient({
      sleep: noSleep,
      maxRetries: 2,
      fetchImpl: () => {
        calls++;
        return Promise.resolve(new Response('boom', { status: 503 }));
      },
    });
    await expect(client.getAuthorFeed({ actor: 'x' })).rejects.toBeInstanceOf(AuthorFeedError);
    expect(calls).toBe(3); // initial + 2 retries
  });
});

describe('AuthorFeedClient.collectAuthorFeed', () => {
  it('follows the cursor and stops at maxPosts', async () => {
    const pages: AuthorFeedResponse[] = [
      { cursor: 'p2', feed: [{ post: fakePost('1') }, { post: fakePost('2') }] },
      { cursor: 'p3', feed: [{ post: fakePost('3') }, { post: fakePost('4') }] },
      { feed: [{ post: fakePost('5') }] },
    ];
    let idx = 0;
    const client = new AuthorFeedClient({
      sleep: noSleep,
      fetchImpl: () => Promise.resolve(jsonResponse(pages[idx++])),
    });
    const out = await client.collectAuthorFeed('x', { maxPosts: 3, pageSize: 2 });
    expect(out).toHaveLength(3);
    expect(out.map((f) => f.post.uri)).toEqual(['1', '2', '3']);
  });

  it('stops when the cursor runs out before maxPosts', async () => {
    const client = new AuthorFeedClient({
      sleep: noSleep,
      fetchImpl: () => Promise.resolve(jsonResponse({ feed: [{ post: fakePost('only') }] })),
    });
    const out = await client.collectAuthorFeed('x', { maxPosts: 50 });
    expect(out).toHaveLength(1);
  });
});

function fakePost(id: string): PostView {
  return {
    uri: id,
    cid: id,
    author: { did: 'did:plc:x', handle: 'x.test' },
    record: { text: id, createdAt: '2026-01-01T00:00:00Z' },
    indexedAt: '2026-01-01T00:00:00Z',
  };
}
