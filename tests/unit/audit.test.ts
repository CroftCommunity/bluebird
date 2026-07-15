import { describe, it, expect } from 'vitest';
import { auditGarden } from '../../src/audit/audit.js';
import { FIXTURE_FEEDS } from '../fixtures/authorFeed.js';
import { EMBED_FIXTURE_FEEDS } from '../fixtures/embeds.js';
import type { FeedViewPost } from '../../src/atproto/types.js';

const feedOf = (feeds: Record<string, { feed: FeedViewPost[] }>, actor: string): FeedViewPost[] =>
  feeds[actor]?.feed ?? [];

describe('auditGarden (S7 effectiveness)', () => {
  it('counts posts hidden per label per account', () => {
    const result = auditGarden([
      { entry: { actor: 'atproto.com', displayName: 'AT Protocol' }, feed: feedOf(FIXTURE_FEEDS, 'atproto.com') },
      { entry: { actor: 'bsky.app', displayName: 'Bluesky' }, feed: feedOf(FIXTURE_FEEDS, 'bsky.app') },
    ]);

    expect(result.totalHidden).toBe(1);
    expect(result.byLabel).toEqual({ porn: 1 });

    const atproto = result.perAccount.find((a) => a.actor === 'atproto.com');
    expect(atproto?.hidden).toBe(1);
    expect(atproto?.byLabel).toEqual({ porn: 1 });
    expect(atproto?.examples[0]?.labels).toContain('porn');

    const bsky = result.perAccount.find((a) => a.actor === 'bsky.app');
    expect(bsky?.hidden).toBe(0);
  });

  it('counts label-excluded embeds as their own category', () => {
    const result = auditGarden([
      { entry: { actor: 'bsky.app', displayName: 'Bluesky' }, feed: feedOf(EMBED_FIXTURE_FEEDS, 'bsky.app') },
    ]);
    // Three host posts (all clean); two quote a labeled record/author.
    expect(result.totalHidden).toBe(0);
    expect(result.embedExclusions.count).toBe(2);
    expect(result.embedExclusions.examples.length).toBeGreaterThan(0);
  });

  it('reports fetched totals for the window', () => {
    const result = auditGarden([
      { entry: { actor: 'bsky.app', displayName: 'Bluesky' }, feed: feedOf(FIXTURE_FEEDS, 'bsky.app') },
    ]);
    expect(result.totalFetched).toBe(feedOf(FIXTURE_FEEDS, 'bsky.app').length);
  });
});
