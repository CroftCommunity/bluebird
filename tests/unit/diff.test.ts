import { describe, it, expect } from 'vitest';
import { diffInclusion, changeSentence, hasChanges } from '../../src/config/diff.js';
import type { InclusionEntry } from '../../src/feed/inclusion.js';

const e = (actor: string, displayName = actor): InclusionEntry => ({ actor, displayName });

describe('diffInclusion (§3 garden-change transparency)', () => {
  it('detects added accounts', () => {
    const d = diffInclusion([e('a.test')], [e('a.test'), e('b.test', 'Bee'), e('c.test', 'Cee')]);
    expect(d.added.sort()).toEqual(['Bee', 'Cee']);
    expect(d.removed).toEqual([]);
  });

  it('detects removed accounts', () => {
    const d = diffInclusion([e('a.test', 'Ada'), e('b.test')], [e('a.test', 'Ada')]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual(['b.test']);
  });

  it('is case-insensitive on the actor', () => {
    const d = diffInclusion([e('Dup.test')], [e('dup.test')]);
    expect(hasChanges(d)).toBe(false);
  });

  it('summarizes changes in plain words', () => {
    expect(changeSentence(diffInclusion([e('a')], [e('a'), e('b'), e('c'), e('d')]))).toBe(
      '3 accounts were added to your garden.',
    );
    expect(changeSentence(diffInclusion([e('a'), e('b')], [e('a')]))).toBe('1 account was removed.');
    expect(changeSentence(diffInclusion([e('a'), e('b')], [e('a'), e('c')]))).toBe(
      '1 account was added to your garden and 1 was removed.',
    );
  });

  it('returns null when nothing changed', () => {
    expect(changeSentence(diffInclusion([e('a')], [e('a')]))).toBeNull();
    expect(changeSentence(undefined)).toBeNull();
  });
});
