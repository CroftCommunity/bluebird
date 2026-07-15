import { describe, it, expect } from 'vitest';
import { encodeTid, genTid, isTid } from '../../src/atproto/tid.js';

describe('TID rkeys', () => {
  it('encodes a 13-char base32-sortable string', () => {
    const t = genTid(Date.parse('2026-07-15T00:00:00Z'), 42);
    expect(t).toHaveLength(13);
    expect(isTid(t)).toBe(true);
  });

  it('is monotonic with time (sorts oldest→newest)', () => {
    const a = genTid(1_000_000, 0);
    const b = genTid(2_000_000, 0);
    expect(a < b).toBe(true);
  });

  it('rejects malformed TIDs', () => {
    expect(isTid('too-short')).toBe(false);
    expect(isTid('0000000000000')).toBe(false); // 0 and 1 are not in the alphabet
    expect(isTid('2345672345672')).toBe(true);
  });

  it('encodeTid is stable for a known value', () => {
    expect(encodeTid(0n)).toBe('2222222222222');
  });
});
