import { describe, it, expect } from 'vitest';
import { queryAllowed } from '../../src/search/policy.js';
import { SEARCH_DEFAULTS, type SkyliteSearch } from '../../src/config/types.js';

const S = (over: Partial<SkyliteSearch> = {}): SkyliteSearch => ({ ...SEARCH_DEFAULTS, ...over });

describe('queryAllowed — blocklist (negative gate)', () => {
  it('refuses a query containing a seeded blocked term (substring, protective)', () => {
    expect(queryAllowed('sexy pictures', S()).ok).toBe(false);
    expect(queryAllowed('how to draw a dog', S())).toEqual({ ok: true });
  });

  it('honors sponsor-added blocked words (custom category)', () => {
    const s = S({ blocklistExtra: ['fortnite'] });
    expect(queryAllowed('fortnite skins', s)).toEqual({ ok: false, reason: 'blocked', category: 'custom' });
  });

  it('Phase 2: a blocked query carries the category of the term it hit', () => {
    // self-harm gets its own programmatic group — the care-aware refusal keys on it.
    expect(queryAllowed('how to commit suicide', S())).toEqual({ ok: false, reason: 'blocked', category: 'self-harm' });
    expect(queryAllowed('thoughts of self harm', S())).toEqual({ ok: false, reason: 'blocked', category: 'self-harm' });
    // other categories are labelled but keep the generic refusal.
    expect(queryAllowed('nsfw', S())).toEqual({ ok: false, reason: 'blocked', category: 'adult' });
    expect(queryAllowed('gore', S())).toEqual({ ok: false, reason: 'blocked', category: 'violence' });
  });

  it('can be turned off (open except allowlist)', () => {
    expect(queryAllowed('gore', S({ useBlocklist: false }))).toEqual({ ok: true });
  });

  it('empty queries are rejected', () => {
    expect(queryAllowed('   ', S())).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('queryAllowed — allowlist (positive gate)', () => {
  it('when on, only queries matching an allowed topic run', () => {
    const s = S({ useAllowlist: true });
    expect(queryAllowed('dinosaurs', s)).toEqual({ ok: true });
    expect(queryAllowed('celebrity gossip', s)).toEqual({ ok: false, reason: 'not-allowlisted' });
  });

  it('honors sponsor-added allowed topics', () => {
    const s = S({ useAllowlist: true, allowlistExtra: ['chess'] });
    expect(queryAllowed('chess openings', s)).toEqual({ ok: true });
  });

  it('is off by default (any non-blocked query runs)', () => {
    expect(queryAllowed('celebrity gossip', S())).toEqual({ ok: true });
  });
});

describe('queryAllowed — both gates active', () => {
  it('permits iff matches allowlist AND not blocked', () => {
    const s = S({ useAllowlist: true, useBlocklist: true, allowlistExtra: ['bodies'] });
    // matches allowlist but hits the blocklist substring ("sex" in "bodies"? no) —
    // use an explicit blocked term to prove precedence:
    expect(queryAllowed('space nsfw', s)).toEqual({ ok: false, reason: 'blocked', category: 'adult' }); // blocked wins
    expect(queryAllowed('space rockets', s)).toEqual({ ok: true }); // allowed + clean
    expect(queryAllowed('random topic', s)).toEqual({ ok: false, reason: 'not-allowlisted' });
  });
});
