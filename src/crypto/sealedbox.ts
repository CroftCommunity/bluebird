// Sealed box — "privacy in public" for the search-history archive
// (docs/trail-map-search.md). Anyone with the sponsor's PUBLIC key can seal a
// message; only the holder of the matching PRIVATE key can open it. The
// explorer's device seals each search payload to the sponsor's public key and
// writes the ciphertext to her public repo; on the public AppView it is inert.
//
// Scheme (all WebCrypto, no dependencies — same P-256 primitive as OAuth):
//   ephemeral ECDH(P-256) → HKDF-SHA256 → AES-256-GCM.
// A fresh ephemeral keypair per message means two seals of the same text differ,
// and that a leaked ephemeral key exposes ONLY its own message — never the rest of
// the archive. The real key is the sponsor's PRIVATE key: compromise it and the
// ENTIRE archive decrypts. That is exactly what the vault (WebAuthn PRF /
// passphrase wrap, src/crypto/vault.ts) protects. A wrong private key or any
// tampering fails the GCM auth tag (open() throws).

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('WebCrypto is unavailable');
  return c.subtle;
}

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const HKDF_INFO = new TextEncoder().encode('bluebird-search-archive-v1');

export interface SealedBox {
  /** Ephemeral public key (JWK) for this message's ECDH. */
  epk: JsonWebKey;
  /** AES-GCM IV, base64. */
  iv: string;
  /** Ciphertext (incl. GCM tag), base64. */
  ct: string;
}

export interface AuditKeypair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

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

/** Generate the sponsor's audit keypair (extractable, so it can be wrapped + published). */
export async function generateAuditKeypair(): Promise<AuditKeypair> {
  const pair = await subtle().generateKey(ECDH, true, ['deriveBits']);
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    subtle().exportKey('jwk', pair.publicKey),
    subtle().exportKey('jwk', pair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

/** Derive the shared AES-GCM key from an ECDH private key + peer public key. */
async function sharedAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdf = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: HKDF_INFO },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seal a plaintext to the sponsor's public key. Only the private key can open it. */
export async function seal(plaintext: string, publicKeyJwk: JsonWebKey): Promise<SealedBox> {
  const recipient = await subtle().importKey('jwk', publicKeyJwk, ECDH, false, []);
  const ephemeral = await subtle().generateKey(ECDH, true, ['deriveBits']);
  const key = await sharedAesKey(ephemeral.privateKey, recipient);

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const epk = await subtle().exportKey('jwk', ephemeral.publicKey);
  return { epk, iv: b64(iv), ct: b64(ct) };
}

/** Open a sealed box with the sponsor's private key. Throws on the wrong key or tampering. */
export async function open(box: SealedBox, privateKeyJwk: JsonWebKey): Promise<string> {
  const priv = await subtle().importKey('jwk', privateKeyJwk, ECDH, false, ['deriveBits']);
  const epk = await subtle().importKey('jwk', box.epk, ECDH, false, []);
  const key = await sharedAesKey(priv, epk);
  const pt = await subtle().decrypt(
    { name: 'AES-GCM', iv: unb64(box.iv) as BufferSource },
    key,
    unb64(box.ct) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}
