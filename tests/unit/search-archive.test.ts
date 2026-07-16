import { describe, it, expect } from 'vitest';
import { pruneHistory, type SearchEntry } from '../../src/search/history.js';
import { buildSealedSearchRecord, SEARCH_NSID } from '../../src/search/archive.js';
import { createVault, unlockVault } from '../../src/crypto/vault.js';
import { open } from '../../src/crypto/sealedbox.js';

const NOW = 1_000_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('history retention (30 days / 500)', () => {
  it('drops entries older than 30 days', () => {
    const entries: SearchEntry[] = [
      { q: 'fresh', at: NOW - 1 * DAY, blocked: false },
      { q: 'old', at: NOW - 31 * DAY, blocked: false },
    ];
    const kept = pruneHistory(entries, NOW);
    expect(kept.map((e) => e.q)).toEqual(['fresh']);
  });

  it('keeps at most 500 newest', () => {
    const entries: SearchEntry[] = Array.from({ length: 600 }, (_, i) => ({ q: `q${i}`, at: NOW - i, blocked: false }));
    expect(pruneHistory(entries, NOW)).toHaveLength(500);
  });
});

describe('sealed search record', () => {
  it('seals the whole payload; only the sponsor vault can read it', async () => {
    const vault = await createVault({ method: 'passphrase', passphrase: 'pw' });
    const payload = { q: 'volcanoes', blocked: false, tier: 'open', at: 1_752_570_000_000 };
    const record = await buildSealedSearchRecord(payload, vault.publicKeyJwk, '2026-07-15T00:00:00.000Z');

    expect(record.$type).toBe(SEARCH_NSID);
    // The query text never appears in the record.
    expect(JSON.stringify(record)).not.toContain('volcanoes');

    // The sponsor unlocks the vault and opens the sealed payload.
    const priv = await unlockVault(vault, { passphrase: 'pw' });
    expect(JSON.parse(await open(record.enc, priv))).toEqual(payload);
  });

  it('Phase 1: the record createdAt is rounded to the UTC DAY; the precise time rides INSIDE the sealed payload', async () => {
    const vault = await createVault({ method: 'passphrase', passphrase: 'pw' });
    const preciseMs = Date.parse('2026-07-15T13:45:30.000Z');
    const record = await buildSealedSearchRecord(
      { q: 'volcanoes', blocked: false, tier: 'open', at: preciseMs },
      vault.publicKeyJwk,
      '2026-07-15T13:45:30.000Z',
    );

    // The cleartext createdAt exposes only the day — never the precise time.
    expect(record.createdAt).toBe('2026-07-15T00:00:00.000Z');

    // The precise instant is sealed, readable only with the private key.
    const priv = await unlockVault(vault, { passphrase: 'pw' });
    const opened = JSON.parse(await open(record.enc, priv)) as { at: number };
    expect(opened.at).toBe(preciseMs);
  });
});
