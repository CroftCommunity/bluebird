import { describe, it, expect } from 'vitest';
import { decryptHistory } from '../../src/search/audit-read.js';
import { buildSealedSearchRecord } from '../../src/search/archive.js';
import { generateAuditKeypair } from '../../src/crypto/sealedbox.js';

describe('decryptHistory', () => {
  it('decrypts, orders newest-first, and skips records it cannot open', async () => {
    const sponsor = await generateAuditKeypair();
    const other = await generateAuditKeypair();

    const older = await buildSealedSearchRecord({ q: 'older', blocked: false, tier: 'open' }, sponsor.publicKeyJwk, '2026-07-14T00:00:00Z');
    const newer = await buildSealedSearchRecord({ q: 'newer', blocked: true, tier: 'discovery' }, sponsor.publicKeyJwk, '2026-07-15T00:00:00Z');
    // Sealed to a DIFFERENT key → undecryptable with the sponsor's key, must be skipped.
    const foreign = await buildSealedSearchRecord({ q: 'secret', blocked: false, tier: 'open' }, other.publicKeyJwk, '2026-07-16T00:00:00Z');

    const out = await decryptHistory([older, newer, foreign], sponsor.privateKeyJwk);
    expect(out.map((e) => e.q)).toEqual(['newer', 'older']); // newest first, foreign skipped
    expect(out[0]).toMatchObject({ q: 'newer', blocked: true, tier: 'discovery' });
  });
});
