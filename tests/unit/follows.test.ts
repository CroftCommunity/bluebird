import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildFollowRecord,
  FOLLOW_NSID,
  isFollowedLocally,
  addLocalFollow,
  removeLocalFollow,
} from '../../src/social/follows.js';

// A minimal in-memory localStorage so the device-local follow set (which the
// garden/My Sky read in every mode) can be exercised in the node unit env.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
});

describe('buildFollowRecord', () => {
  it('mirrors app.bsky.graph.follow: subject DID + createdAt', () => {
    const rec = buildFollowRecord('did:plc:pat', '2026-07-15T12:00:00.000Z');
    expect(rec.$type).toBe(FOLLOW_NSID);
    expect(rec.subject).toBe('did:plc:pat');
    expect(rec.createdAt).toBe('2026-07-15T12:00:00.000Z');
  });
});

describe('device-local follow set (My Sky source, every mode)', () => {
  it('adds, dedupes, reports, and removes follows', () => {
    expect(isFollowedLocally('did:plc:pat')).toBe(false);
    addLocalFollow('did:plc:pat');
    addLocalFollow('did:plc:pat'); // dedup
    addLocalFollow('did:plc:sam');
    expect(isFollowedLocally('did:plc:pat')).toBe(true);
    expect(isFollowedLocally('did:plc:sam')).toBe(true);

    removeLocalFollow('did:plc:pat');
    expect(isFollowedLocally('did:plc:pat')).toBe(false);
    expect(isFollowedLocally('did:plc:sam')).toBe(true);
  });
});
