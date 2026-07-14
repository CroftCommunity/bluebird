import { describe, it, expect } from 'vitest';
import { postLabelAction, filterByLabels, effectiveLabels } from '../../src/feed/labels.js';
import type { PostView } from '../../src/atproto/types.js';
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

describe('filterByLabels', () => {
  it('drops the hidden fixture post and keeps the rest', () => {
    const kept = filterByLabels([FIXTURE_POSTS.A1, FIXTURE_POSTS.B2_HIDDEN, FIXTURE_POSTS.B1]);
    expect(kept).toContain(FIXTURE_POSTS.A1);
    expect(kept).toContain(FIXTURE_POSTS.B1);
    expect(kept).not.toContain(FIXTURE_POSTS.B2_HIDDEN);
  });
});
