import { describe, it, expect } from 'vitest';
import { createVault, unlockVault, PBKDF2_ITERATIONS } from '../../src/crypto/vault.js';
import { seal, open } from '../../src/crypto/sealedbox.js';

// The passphrase path is fully deterministic and hermetic. The WebAuthn-PRF path
// needs a real/virtual authenticator (verify-in-run), so it isn't exercised here.

describe('passphrase vault', () => {
  it('wraps and recovers the private key with the right passphrase', async () => {
    const vault = await createVault({ method: 'passphrase', passphrase: 'correct horse battery staple' });
    expect(vault.method).toBe('passphrase');
    expect(vault.iterations).toBe(PBKDF2_ITERATIONS);
    // The private key never appears in the stored vault, only the wrapped blob.
    expect(JSON.stringify(vault)).not.toContain('"d"'); // no EC private scalar in clear
    const priv = await unlockVault(vault, { passphrase: 'correct horse battery staple' });
    expect(priv.kty).toBe('EC');
  });

  it('rejects the wrong passphrase (GCM auth fails)', async () => {
    const vault = await createVault({ method: 'passphrase', passphrase: 'right' });
    await expect(unlockVault(vault, { passphrase: 'wrong' })).rejects.toThrow();
  });

  it('closes the loop: seal to the vault public key, unlock, and open', async () => {
    const vault = await createVault({ method: 'passphrase', passphrase: 'pw' });
    const box = await seal(JSON.stringify({ q: 'volcanoes', blocked: false, tier: 'open' }), vault.publicKeyJwk);
    const priv = await unlockVault(vault, { passphrase: 'pw' });
    expect(JSON.parse(await open(box, priv))).toEqual({ q: 'volcanoes', blocked: false, tier: 'open' });
  });

  it('requires a passphrase to create or unlock a passphrase vault', async () => {
    await expect(createVault({ method: 'passphrase' })).rejects.toThrow(/passphrase/i);
    const vault = await createVault({ method: 'passphrase', passphrase: 'x' });
    await expect(unlockVault(vault, {})).rejects.toThrow(/passphrase/i);
  });
});
