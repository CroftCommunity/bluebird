import { describe, it, expect } from 'vitest';
import { AuthorFeedClient } from '../../src/atproto/client.js';

// §D Telescope transport: app.bsky.feed.getFeed, public + unauthenticated.
function clientReturning(handler: (url: URL) => Response): AuthorFeedClient {
  const fetchImpl: typeof fetch = (input) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(handler(new URL(href)));
  };
  return new AuthorFeedClient({ fetchImpl });
}

describe('AuthorFeedClient.getFeed', () => {
  it('requests the feed generator by at:// uri and returns its posts', async () => {
    let seenFeed = '';
    const client = clientReturning((url) => {
      seenFeed = url.searchParams.get('feed') ?? '';
      return new Response(JSON.stringify({ feed: [{ post: { uri: 'at://x/app.bsky.feed.post/1' } }] }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    const res = await client.getFeed('at://did:plc:gen/app.bsky.feed.generator/cool', { limit: 10 });
    expect(seenFeed).toBe('at://did:plc:gen/app.bsky.feed.generator/cool');
    expect(res.feed).toHaveLength(1);
  });

  it('throws on a non-retryable error', async () => {
    const client = clientReturning(() => new Response('nope', { status: 400 }));
    await expect(client.getFeed('at://did:plc:gen/app.bsky.feed.generator/x')).rejects.toThrow(/getFeed failed: 400/);
  });
});
