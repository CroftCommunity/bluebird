import { describe, it, expect } from 'vitest';
import { fetchGarden } from '../../src/garden.js';
import { AuthorFeedClient } from '../../src/atproto/client.js';
import { DEV_INCLUSION } from '../../src/feed/inclusion.js';
import { FIXTURE_FEEDS } from '../fixtures/authorFeed.js';

// A hermetic AuthorFeedClient backed by the shared fixtures — one repost of an
// outside author (safety.bsky.app -> stranger.example) lives in the fixtures.
function fixtureClient(): AuthorFeedClient {
  const fetchImpl: typeof fetch = (input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const actor = url.searchParams.get('actor') ?? '';
    const body = FIXTURE_FEEDS[actor] ?? { feed: [] };
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));
  };
  return new AuthorFeedClient({ fetchImpl });
}

const REPOST_URI = 'at://did:plc:strangerexample/app.bsky.feed.post/x1';

describe('fetchGarden showReposts wiring', () => {
  it('excludes reposts when includeReposts is false (tight ceiling)', async () => {
    const { posts } = await fetchGarden(DEV_INCLUSION, { client: fixtureClient(), includeReposts: false });
    expect(posts.some((p) => p.uri === REPOST_URI)).toBe(false);
  });

  it('injects reposts (still label-floored) when includeReposts is true', async () => {
    const { posts } = await fetchGarden(DEV_INCLUSION, { client: fixtureClient(), includeReposts: true });
    expect(posts.some((p) => p.uri === REPOST_URI)).toBe(true);
    // The label floor still holds — the hidden fixture post never survives.
    expect(posts.some((p) => p.record.text.includes('MUST BE HIDDEN'))).toBe(false);
  });

  it('defaults to the tight ceiling when includeReposts is omitted', async () => {
    const { posts } = await fetchGarden(DEV_INCLUSION, { client: fixtureClient() });
    expect(posts.some((p) => p.uri === REPOST_URI)).toBe(false);
  });
});
