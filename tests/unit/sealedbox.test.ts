import { describe, it, expect } from 'vitest';
import { generateAuditKeypair, seal, open, type SealedBox } from '../../src/crypto/sealedbox.js';

// The sealed box is the heart of the encrypted search-history archive: the
// explorer's device can seal to the sponsor's public key but never open; only
// the sponsor's private key reads it. These run on WebCrypto in the node env.

describe('sealed box (ECDH P-256 → HKDF → AES-256-GCM)', () => {
  it('round-trips a payload with the matching keypair', async () => {
    const { publicKeyJwk, privateKeyJwk } = await generateAuditKeypair();
    const payload = JSON.stringify({ q: 'dinosaurs', blocked: false, tier: 'open' });
    const box = await seal(payload, publicKeyJwk);
    expect(await open(box, privateKeyJwk)).toBe(payload);
  });

  it('is opaque to any other private key (privacy in public)', async () => {
    const sponsor = await generateAuditKeypair();
    const attacker = await generateAuditKeypair();
    const box = await seal('my kid searched this', sponsor.publicKeyJwk);
    await expect(open(box, attacker.privateKeyJwk)).rejects.toThrow();
  });

  it('fails the auth tag when the ciphertext is tampered', async () => {
    const { publicKeyJwk, privateKeyJwk } = await generateAuditKeypair();
    const box = await seal('sensitive', publicKeyJwk);
    // Flip one decoded ciphertext byte, deterministically → GCM auth must fail.
    const bytes = Uint8Array.from(atob(box.ct), (c) => c.charCodeAt(0));
    bytes[0] = ((bytes[0] ?? 0) ^ 0xff) & 0xff;
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const bad: SealedBox = { ...box, ct: btoa(bin) };
    await expect(open(bad, privateKeyJwk)).rejects.toThrow();
  });

  it('produces distinct ciphertext each time (ephemeral key + IV)', async () => {
    const { publicKeyJwk, privateKeyJwk } = await generateAuditKeypair();
    const a = await seal('same text', publicKeyJwk);
    const b = await seal('same text', publicKeyJwk);
    expect(a.ct).not.toBe(b.ct);
    expect(a.epk.x).not.toBe(b.epk.x); // fresh ephemeral key per message
    // ...yet both open to the same plaintext.
    expect(await open(a, privateKeyJwk)).toBe('same text');
    expect(await open(b, privateKeyJwk)).toBe('same text');
  });
});
