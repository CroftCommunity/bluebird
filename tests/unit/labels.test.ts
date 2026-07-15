import { describe, it, expect } from 'vitest';
import {
  postLabelAction,
  filterByLabels,
  effectiveLabels,
  recordEmbedHidden,
} from '../../src/feed/labels.js';
import type { PostView, RecordEmbedView } from '../../src/atproto/types.js';
import { FIXTURE_POSTS } from '../fixtures/authorFeed.js';

function mk(labels?: PostView['labels'], authorLabels?: PostView['labels']): PostView {
  return {
    uri: 'at://x',
    cid: 'c',
    author: { did: 'did:plc:x', handle: 'x.test', ...(authorLabels ? { labels: authorLabels } : {}) },
    record: { text: 't', createdAt: '2026-01-01T00:00:00Z' },
    indexedAt: '2026-01-01T00:00:00Z',
    ...(labels ? { labels } : {}),
  };
}

describe('postLabelAction', () => {
  it('shows an unlabeled post', () => {
    expect(postLabelAction(mk())).toBe('show');
  });

  it('hides adult / graphic labels', () => {
    for (const val of ['porn', 'sexual', 'nudity', 'graphic-media', 'gore', '!hide', '!takedown']) {
      expect(postLabelAction(mk([{ val }]))).toBe('hide');
    }
  });

  it('ignores a negated label', () => {
    expect(postLabelAction(mk([{ val: 'porn', neg: true }]))).toBe('show');
  });

  it('hides when the author itself is labeled', () => {
    expect(postLabelAction(mk(undefined, [{ val: 'porn' }]))).toBe('hide');
  });

  it('collects effective labels from post and author', () => {
    const p = mk([{ val: 'a' }, { val: 'b', neg: true }], [{ val: 'c' }]);
    expect(effectiveLabels(p).sort()).toEqual(['a', 'c']);
  });
});

// Named invariant: label-floor-excludes (§0/§3). Label-bearing posts are
// EXCLUDED (not blurred), and there is no reveal.
describe('label-floor-excludes', () => {
  it('drops the hidden fixture post and keeps the rest', () => {
    const kept = filterByLabels([FIXTURE_POSTS.A1, FIXTURE_POSTS.B2_HIDDEN, FIXTURE_POSTS.B1]);
    expect(kept).toContain(FIXTURE_POSTS.A1);
    expect(kept).toContain(FIXTURE_POSTS.B1);
    expect(kept).not.toContain(FIXTURE_POSTS.B2_HIDDEN);
  });

  it('excludes rather than annotates — the result set simply omits labeled posts', () => {
    const kept = filterByLabels([FIXTURE_POSTS.B2_HIDDEN]);
    expect(kept).toHaveLength(0);
  });
});

// Named invariant (logic half): labeled-embed-never-renders (§3). The label
// floor applies to quoted/embedded records via their own or their author's
// labels. The DOM half is asserted in tests/e2e/embeds.spec.ts.
describe('labeled-embed-never-renders', () => {
  const quote = (labels?: RecordEmbedView['labels'], authorLabels?: PostView['labels']): RecordEmbedView => ({
    $type: 'app.bsky.embed.record#viewRecord',
    uri: 'at://did:plc:outsider/app.bsky.feed.post/q',
    author: { did: 'did:plc:outsider', handle: 'outsider.test', ...(authorLabels ? { labels: authorLabels } : {}) },
    value: { $type: 'app.bsky.feed.post', text: 'quoted text', createdAt: '2026-01-01T00:00:00Z' },
    ...(labels ? { labels } : {}),
  });

  it('hides an embed whose record carries a floor label', () => {
    expect(recordEmbedHidden(quote([{ val: 'porn' }]))).toBe(true);
  });

  it('hides an embed whose author carries a floor label', () => {
    expect(recordEmbedHidden(quote(undefined, [{ val: '!takedown' }]))).toBe(true);
  });

  it('shows a clean embed', () => {
    expect(recordEmbedHidden(quote())).toBe(false);
  });

  it('ignores a negated embed label', () => {
    expect(recordEmbedHidden(quote([{ val: 'porn', neg: true }]))).toBe(false);
  });

  it('treats a missing embed as not hidden', () => {
    expect(recordEmbedHidden(undefined)).toBe(false);
  });
});
