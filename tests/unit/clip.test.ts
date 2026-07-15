import { describe, it, expect } from 'vitest';
import { clipFromPost } from '../../src/scrapbook/clip.js';
import type { PostView } from '../../src/atproto/types.js';

function post(extra: Partial<PostView> = {}): PostView {
  return {
    uri: 'at://did:plc:a/app.bsky.feed.post/1',
    cid: 'c',
    author: { did: 'did:plc:a', handle: 'a.test', displayName: 'Ada' },
    record: { text: 'hello sky', createdAt: '2026-07-14T00:00:00Z' },
    indexedAt: '2026-07-14T00:00:00Z',
    ...extra,
  };
}

describe('clipFromPost', () => {
  it('extracts author, text, and timestamp', () => {
    const clip = clipFromPost(post(), 'my note', 1000);
    expect(clip).toMatchObject({
      uri: 'at://did:plc:a/app.bsky.feed.post/1',
      authorName: 'Ada',
      handle: 'a.test',
      text: 'hello sky',
      note: 'my note',
      savedAt: 1000,
    });
  });

  it('falls back to @handle when there is no display name', () => {
    const clip = clipFromPost(post({ author: { did: 'did:plc:a', handle: 'a.test' } }), '', 1);
    expect(clip.authorName).toBe('@a.test');
  });

  it('captures the first image thumb when present', () => {
    const clip = clipFromPost(
      post({
        embed: {
          $type: 'app.bsky.embed.images#view',
          images: [{ thumb: 'https://cdn.bsky.app/t.jpg', fullsize: 'f', alt: '' }],
        },
      }),
      '',
      1,
    );
    expect(clip.thumb).toBe('https://cdn.bsky.app/t.jpg');
  });

  it('has no thumb for a text-only post', () => {
    expect(clipFromPost(post(), '', 1).thumb).toBeUndefined();
  });
});
