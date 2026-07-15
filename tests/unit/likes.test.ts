import { describe, it, expect } from 'vitest';
import { buildLikeRecord, rkeyFromUri, LIKE_NSID } from '../../src/social/likes.js';
import type { PostView } from '../../src/atproto/types.js';

const post: PostView = {
  uri: 'at://did:plc:author/app.bsky.feed.post/abc',
  cid: 'bafycid',
  author: { did: 'did:plc:author', handle: 'a.test' },
  record: { text: 'hi', createdAt: '2026-07-15T00:00:00Z' },
  indexedAt: '2026-07-15T00:00:00Z',
};

describe('buildLikeRecord', () => {
  it('mirrors app.bsky.feed.like: subject strongRef + createdAt', () => {
    const rec = buildLikeRecord(post, '2026-07-15T12:00:00.000Z');
    expect(rec.$type).toBe(LIKE_NSID);
    expect(rec.subject).toEqual({ uri: post.uri, cid: post.cid });
    expect(rec.createdAt).toBe('2026-07-15T12:00:00.000Z');
  });
});

describe('rkeyFromUri', () => {
  it('takes the last path segment', () => {
    expect(rkeyFromUri('at://did:plc:me/ing.croft.skylite.like/3krk')).toBe('3krk');
    expect(rkeyFromUri('')).toBe('');
  });
});
