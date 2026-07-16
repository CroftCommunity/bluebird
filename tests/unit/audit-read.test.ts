import { describe, it, expect } from 'vitest';
import { decryptHistory } from '../../src/search/audit-read.js';
import { buildSealedSearchRecord, type SealedSearchRecord } from '../../src/search/archive.js';
import { generateAuditKeypair, seal } from '../../src/crypto/sealedbox.js';

describe('decryptHistory', () => {
  it('decrypts, orders newest-first, and skips records it cannot open', async () => {
    const sponsor = await generateAuditKeypair();
    const other = await generateAuditKeypair();

    const older = await buildSealedSearchRecord({ q: 'older', blocked: false, tier: 'open', at: Date.parse('2026-07-14T00:00:00Z') }, sponsor.publicKeyJwk, '2026-07-14T00:00:00Z');
    const newer = await buildSealedSearchRecord({ q: 'newer', blocked: true, tier: 'discovery', at: Date.parse('2026-07-15T00:00:00Z') }, sponsor.publicKeyJwk, '2026-07-15T00:00:00Z');
    // Sealed to a DIFFERENT key → undecryptable with the sponsor's key, must be skipped.
    const foreign = await buildSealedSearchRecord({ q: 'secret', blocked: false, tier: 'open', at: Date.parse('2026-07-16T00:00:00Z') }, other.publicKeyJwk, '2026-07-16T00:00:00Z');

    const out = await decryptHistory([older, newer, foreign], sponsor.privateKeyJwk);
    expect(out.map((e) => e.q)).toEqual(['newer', 'older']); // newest first, foreign skipped
    expect(out[0]).toMatchObject({ q: 'newer', blocked: true, tier: 'discovery' });
  });

  it('Phase 1 tolerant read: uses the inner precise `at` for new records, falls back to record createdAt for old ones', async () => {
    const sponsor = await generateAuditKeypair();

    // NEW shape: precise `at` sealed inside; the record createdAt is day-granular.
    const preciseMs = Date.parse('2026-07-12T09:30:00.000Z');
    const newer = await buildSealedSearchRecord(
      { q: 'new', blocked: false, tier: 'open', at: preciseMs },
      sponsor.publicKeyJwk,
      '2026-07-12T00:00:00.000Z',
    );

    // OLD shape: no inner `at` at all (a record written before Phase 1).
    const oldBox = await seal(JSON.stringify({ q: 'old', blocked: false, tier: 'open' }), sponsor.publicKeyJwk);
    const older: SealedSearchRecord = { enc: oldBox, createdAt: '2026-07-10T00:00:00.000Z' };

    const out = await decryptHistory([newer, older], sponsor.privateKeyJwk);
    const byQ = Object.fromEntries(out.map((e) => [e.q, e.at]));
    expect(byQ['new']).toBe('2026-07-12T09:30:00.000Z'); // inner precise time, not the day
    expect(byQ['old']).toBe('2026-07-10T00:00:00.000Z'); // fallback to record createdAt
  });
});
