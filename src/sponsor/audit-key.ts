import { createVault, loadVault, saveVault, unlockVault, type Vault, type VaultMethod } from '../crypto/vault.js';

/**
 * The sponsor's audit keypair lifecycle (phase 3). ONE keypair per sponsor
 * device serves every explorer: the sponsor publishes its PUBLIC key into each
 * explorer's config (search.auditPubKeyJwk) to turn the encrypted archive on, and
 * later unlocks the PRIVATE key (WebAuthn passkey/PIN/biometric or passphrase) to
 * read any explorer's sealed history. The private key never leaves this device;
 * lose it and the archives become unreadable (docs/telescope-search.md).
 */

/** The stored audit vault, if this device has one. */
export function auditVault(): Vault | null {
  return loadVault();
}

/** The public key to publish into a config, or null if no vault exists yet. */
export function auditPublicKey(): JsonWebKey | null {
  return loadVault()?.publicKeyJwk ?? null;
}

/**
 * Ensure this device has an audit vault, creating one if needed, and return its
 * public key. Reuses the existing keypair so every explorer's archive shares one
 * key. `opts` is only consulted when creating.
 */
export async function ensureAuditVault(opts: { method: VaultMethod; passphrase?: string }): Promise<JsonWebKey> {
  const existing = loadVault();
  if (existing) return existing.publicKeyJwk;
  const vault = await createVault(opts);
  saveVault(vault);
  return vault.publicKeyJwk;
}

/** Recover the audit private key to decrypt history. Throws if no vault / wrong secret. */
export async function unlockAuditKey(opts: { passphrase?: string } = {}): Promise<JsonWebKey> {
  const vault = loadVault();
  if (!vault) throw new Error('This device has no audit key');
  return unlockVault(vault, opts);
}
