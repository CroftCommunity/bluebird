import { describe, it, expect } from 'vitest';
import { mergeFeeds, postTimestamp } from '../../src/feed/merge.js';
import type { FeedViewPost, PostView } from '../../src/atproto/types.js';
import { FIXTURE_FEEDS, FIXTURE_POSTS, EXPECTED_VISIBLE_ORDER } from '../fixtures/authorFeed.js';

const feeds = (): FeedViewPost[][] => Object.values(FIXTURE_FEEDS).map((r) => r.feed);

function mkPost(uri: string, createdAt: string, indexedAt = createdAt): PostView {
  return {
    uri,
    cid: 'c',
    author: { did: 'did:plc:x', handle: 'x.test' },
    record: { text: 't', createdAt },
    indexedAt,
  };
}

describe('mergeFeeds', () => {
  it('merges N feeds newest-first', () => {
    const merged = mergeFeeds(feeds());
    // B2 (hidden) is still present here — labels are applied downstream — but the
    // repost is dropped, so the newest visible is A1 not the repost.
    expect(merged[0]?.uri).toBe(FIXTURE_POSTS.B2_HIDDEN.uri); // 13:00 is newest overall
    expect(merged.map((p) => p.uri)).not.toContain(
      'at://did:plc:strangerexample/app.bsky.feed.post/x1',
    );
  });

  it('drops reposts by default and keeps them when asked', () => {
    const withReposts = mergeFeeds(feeds(), { includeReposts: true });
    expect(withReposts.some((p) => p.uri.includes('/x1'))).toBe(true);
    const without = mergeFeeds(feeds());
    expect(without.some((p) => p.uri.includes('/x1'))).toBe(false);
  });

  it('de-duplicates by post uri across feeds', () => {
    const p = mkPost('at://did/app.bsky.feed.post/dup', '2026-01-01T00:00:00Z');
    const merged = mergeFeeds([[{ post: p }], [{ post: p }]]);
    expect(merged).toHaveLength(1);
  });

  it('respects the limit', () => {
    expect(mergeFeeds(feeds(), { limit: 2 })).toHaveLength(2);
  });

  it('produces the expected visible order once reposts are dropped and B2 excluded', () => {
    // Simulate the label filter by removing the hidden post, then check order.
    const merged = mergeFeeds(feeds()).filter((p) => p.uri !== FIXTURE_POSTS.B2_HIDDEN.uri);
    expect(merged.map((p) => p.uri)).toEqual(EXPECTED_VISIBLE_ORDER);
  });
});

describe('postTimestamp', () => {
  it('prefers record.createdAt', () => {
    const p = mkPost('at://a', '2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z');
    expect(postTimestamp(p)).toBe(Date.parse('2026-05-01T00:00:00Z'));
  });

  it('falls back to indexedAt when createdAt is unparseable', () => {
    const p = mkPost('at://a', 'not-a-date', '2026-05-02T00:00:00Z');
    expect(postTimestamp(p)).toBe(Date.parse('2026-05-02T00:00:00Z'));
  });

  it('guards against a spoofed far-future createdAt', () => {
    // createdAt is a year ahead of indexedAt → trust indexedAt.
    const p = mkPost('at://a', '2030-01-01T00:00:00Z', '2026-05-02T00:00:00Z');
    expect(postTimestamp(p)).toBe(Date.parse('2026-05-02T00:00:00Z'));
  });
});
