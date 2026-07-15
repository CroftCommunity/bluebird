import { describe, it, expect, beforeEach } from 'vitest';
import { ensureAuditVault, auditPublicKey, unlockAuditKey } from '../../src/sponsor/audit-key.js';
import { seal, open } from '../../src/crypto/sealedbox.js';

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

describe('sponsor audit-key lifecycle', () => {
  it('creates one keypair and reuses it across explorers', async () => {
    const a = await ensureAuditVault({ method: 'passphrase', passphrase: 'pw' });
    const b = await ensureAuditVault({ method: 'passphrase', passphrase: 'ignored-second-time' });
    expect(a).toEqual(b); // same published public key, not a new keypair
    expect(auditPublicKey()).toEqual(a);
    expect(a.kty).toBe('EC');
  });

  it('publishes only the public key; the private key stays wrapped and unlockable', async () => {
    const pub = await ensureAuditVault({ method: 'passphrase', passphrase: 'pw' });
    // A search sealed by an explorer to the published key...
    const box = await seal(JSON.stringify({ q: 'comets', blocked: false, tier: 'open' }), pub);
    // ...is readable only after the sponsor unlocks the private key.
    const priv = await unlockAuditKey({ passphrase: 'pw' });
    expect(JSON.parse(await open(box, priv))).toEqual({ q: 'comets', blocked: false, tier: 'open' });
    await expect(unlockAuditKey({ passphrase: 'wrong' })).rejects.toThrow();
  });
});
