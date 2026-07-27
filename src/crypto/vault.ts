// The sponsor's audit key vault. Generates the ECDH keypair (via sealedbox),
// PUBLISHES the public key (phase 2 writes it into the config), and protects the
// PRIVATE key at rest so a stolen sponsor device/localStorage can't read a
// child's search archive.
//
// Two protection methods (docs/telescope-search.md):
//   · webauthn-prf — the platform authenticator (passkey / PIN / biometric)
//     derives a stable secret via the WebAuthn PRF extension; that secret wraps
//     the private key. Nothing brute-forceable is stored. [live path: verify-in-run]
//   · passphrase   — PBKDF2-SHA256 at a high iteration count derives the wrapping
//     key from a sponsor passphrase. The fallback where PRF is unavailable.
// The private key JWK is AES-256-GCM wrapped either way; wrong secret → GCM auth
// fails and unlock throws.
//
// Phase 1a note: the wrap/unwrap + key-material primitives are a GENERIC core
// (`wrapJson`/`unwrapJson`/`passphraseMaterial`/`prfEnroll`/`prfGet`) so a second
// consumer (the explorer session, `src/social`) can reuse the exact PRF + AES-GCM
// code. Domain separation is by the HKDF `info` label (`skylite-audit-vault-v1`
// for this audit vault, a distinct label per other consumer) — distinct labels
// derive distinct AES keys from the same raw material.

import { generateAuditKeypair } from './sealedbox.js';
import { log } from '../log.js';

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('WebCrypto is unavailable');
  return c.subtle;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
/** HKDF `info` for THIS audit vault. Must stay byte-for-byte so a live sponsor's
 * already-stored vault still unlocks after the refactor. */
const AUDIT_VAULT_INFO = 'skylite-audit-vault-v1';
export const PBKDF2_ITERATIONS = 600_000;

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type VaultMethod = 'webauthn-prf' | 'passphrase';

export interface Vault {
  method: VaultMethod;
  /** The sponsor's audit PUBLIC key — safe to publish (phase 2 puts it in config). */
  publicKeyJwk: JsonWebKey;
  /** AES-GCM-wrapped private key JWK. */
  wrapped: { iv: string; ct: string };
  /** b64 salt: the PRF eval salt, or the PBKDF2 salt. */
  salt: string;
  /** webauthn-prf only: the credential to unlock with. */
  credentialId?: string;
  /** passphrase only. */
  iterations?: number;
}

// --- generic crypto core: wrap/unwrap arbitrary JSON with raw key material ----

/** Context for a wrap/unwrap. `info` is the domain-separation label fed to HKDF —
 * distinct labels derive distinct AES keys from the same raw material. */
export interface WrapContext {
  /** Raw key material: a PRF secret or PBKDF2 output. */
  material: Uint8Array;
  /** Domain-separation label (e.g. `skylite-audit-vault-v1`). */
  info: string;
}

async function aesFromMaterial(material: Uint8Array, info: string): Promise<CryptoKey> {
  const hkdf = await subtle().importKey('raw', material as BufferSource, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** AES-256-GCM-wrap any JSON-serializable value. Fresh random 12-byte IV per call. */
export async function wrapJson(value: unknown, ctx: WrapContext): Promise<{ iv: string; ct: string }> {
  const key = await aesFromMaterial(ctx.material, ctx.info);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: b64(iv), ct: b64(ct) };
}

/** Recover a value wrapped by {@link wrapJson}. Wrong material/info → GCM auth fails → throws. */
export async function unwrapJson<T>(wrapped: { iv: string; ct: string }, ctx: WrapContext): Promise<T> {
  const key = await aesFromMaterial(ctx.material, ctx.info);
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(wrapped.iv) as BufferSource },
    key,
    unb64(wrapped.ct) as BufferSource,
  );
  return JSON.parse(dec.decode(pt)) as T;
}

// --- passphrase material (PBKDF2) --------------------------------------------

export async function passphraseMaterial(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

// --- WebAuthn PRF material (verify-in-run) ------------------------------------

// Minimal shape for reading the PRF extension output.
interface PrfResults {
  prf?: { results?: { first?: ArrayBuffer } };
}

/** Best-effort: WebAuthn exists. Actual PRF support is only known after a call. */
export function webauthnAvailable(): boolean {
  return (
    typeof globalThis.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.credentials != null
  );
}

export async function prfGet(credentialId: string, salt: Uint8Array): Promise<Uint8Array> {
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: unb64(credentialId) as BufferSource }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt as BufferSource } } },
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error('WebAuthn unlock was cancelled');
  const first = (assertion.getClientExtensionResults() as PrfResults).prf?.results?.first;
  if (!first) {
    // The hmac-secret trap: `prf.enabled` can be true while `results.first` is
    // absent (spec-conformant per Apple forum 782466). `enabled` is meaningless;
    // the presence of `results.first` is the only trustworthy signal. Log before
    // throwing so the fallback path is diagnosable from the console alone
    // (warn always emits; ?debug=1 would not survive an OAuth redirect).
    log.warn('[vault] PRF returned no hmac-secret (results.first absent) — treating as no-PRF');
    throw new Error('This passkey does not support PRF — use a passphrase instead');
  }
  return new Uint8Array(first);
}

/** WebAuthn credential labelling — distinguishes the audit-key credential from a
 * session credential in the authenticator UI. */
export interface PrfEnrollOptions {
  salt: Uint8Array;
  /** WebAuthn credential `user.name`. */
  label: string;
  /** WebAuthn credential `user.displayName`. */
  displayName: string;
}

export async function prfEnroll(opts: PrfEnrollOptions): Promise<{ credentialId: string; material: Uint8Array }> {
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const userId = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Skylite', id: location.hostname },
      user: { id: userId, name: opts.label, displayName: opts.displayName },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      extensions: { prf: {} },
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('WebAuthn enrollment was cancelled');
  const credentialId = b64(new Uint8Array(cred.rawId));
  // PRF output is reliably available on a subsequent get(), so fetch it there.
  const material = await prfGet(credentialId, opts.salt);
  return { credentialId, material };
}

// --- high-level create / unlock ----------------------------------------------

export async function createVault(opts: { method: VaultMethod; passphrase?: string }): Promise<Vault> {
  const { publicKeyJwk, privateKeyJwk } = await generateAuditKeypair();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  if (opts.method === 'passphrase') {
    if (!opts.passphrase) throw new Error('A passphrase is required');
    const material = await passphraseMaterial(opts.passphrase, salt, PBKDF2_ITERATIONS);
    const wrapped = await wrapJson(privateKeyJwk, { material, info: AUDIT_VAULT_INFO });
    return { method: 'passphrase', publicKeyJwk, wrapped, salt: b64(salt), iterations: PBKDF2_ITERATIONS };
  }

  const { credentialId, material } = await prfEnroll({
    salt,
    label: 'skylite-audit',
    displayName: 'Skylite search-history key',
  });
  const wrapped = await wrapJson(privateKeyJwk, { material, info: AUDIT_VAULT_INFO });
  return { method: 'webauthn-prf', publicKeyJwk, wrapped, salt: b64(salt), credentialId };
}

/** Recover the sponsor's audit private key. Throws on the wrong passphrase / cancelled unlock. */
export async function unlockVault(vault: Vault, opts: { passphrase?: string } = {}): Promise<JsonWebKey> {
  let material: Uint8Array;
  if (vault.method === 'passphrase') {
    if (!opts.passphrase) throw new Error('A passphrase is required');
    material = await passphraseMaterial(opts.passphrase, unb64(vault.salt), vault.iterations ?? PBKDF2_ITERATIONS);
  } else {
    if (!vault.credentialId) throw new Error('This vault has no passkey');
    material = await prfGet(vault.credentialId, unb64(vault.salt));
  }
  return unwrapJson<JsonWebKey>(vault.wrapped, { material, info: AUDIT_VAULT_INFO });
}

// --- device-local storage (sponsor device only) ------------------------------

const KEY = 'skylite.audit.vault';

export function saveVault(vault: Vault): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(vault));
  } catch {
    /* storage disabled — non-fatal */
  }
}

export function loadVault(): Vault | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Vault) : null;
  } catch {
    return null;
  }
}
