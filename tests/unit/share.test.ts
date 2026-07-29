import { describe, it, expect } from 'vitest';
import { postPermalink, sharePost } from '../../src/share/share.js';

const URI = 'at://did:plc:abc/app.bsky.feed.post/xyz';
const ORIGIN = 'https://bluebird.example';

describe('postPermalink', () => {
  it('builds a Bluebird post-view URL with the encoded at:// uri', () => {
    expect(postPermalink(URI, ORIGIN)).toBe(
      'https://bluebird.example/post.html?uri=at%3A%2F%2Fdid%3Aplc%3Aabc%2Fapp.bsky.feed.post%2Fxyz',
    );
  });
});

describe('sharePost', () => {
  it('uses the native share sheet with the permalink when available', async () => {
    let shared: unknown;
    const nav = {
      share: (data: ShareData) => {
        shared = data;
        return Promise.resolve();
      },
      clipboard: {} as Clipboard,
    };
    const out = await sharePost(URI, { origin: ORIGIN, nav });
    expect(out).toBe('shared');
    expect(shared).toMatchObject({ url: postPermalink(URI, ORIGIN), title: 'Bluebird' });
  });

  it('treats a user-cancelled sheet (AbortError) as dismissed, not failed', async () => {
    const nav = {
      share: () => Promise.reject(new DOMException('cancel', 'AbortError')),
      clipboard: {} as Clipboard,
    };
    expect(await sharePost(URI, { origin: ORIGIN, nav })).toBe('dismissed');
  });

  it('falls back to copying the link when there is no share API', async () => {
    let copied = '';
    const nav = {
      clipboard: { writeText: (t: string) => ((copied = t), Promise.resolve()) } as unknown as Clipboard,
    };
    const out = await sharePost(URI, { origin: ORIGIN, nav });
    expect(out).toBe('copied');
    expect(copied).toBe(postPermalink(URI, ORIGIN));
  });

  it('falls back to copy when a real share error (not abort) occurs', async () => {
    let copied = '';
    const nav = {
      share: () => Promise.reject(new Error('boom')),
      clipboard: { writeText: (t: string) => ((copied = t), Promise.resolve()) } as unknown as Clipboard,
    };
    expect(await sharePost(URI, { origin: ORIGIN, nav })).toBe('copied');
    expect(copied).toBe(postPermalink(URI, ORIGIN));
  });

  it('reports failure when neither share nor clipboard is available', async () => {
    expect(await sharePost(URI, { origin: ORIGIN, nav: {} })).toBe('failed');
  });
});
