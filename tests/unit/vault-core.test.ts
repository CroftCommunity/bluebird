import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { wrapJson, unwrapJson, passphraseMaterial } from '../../src/crypto/vault.js';

// The generic crypto core extracted in Phase 1a. Exercised hermetically with
// injected raw key material (no WebAuthn). The PRF paths (prfEnroll/prfGet) still
// need a real authenticator, so they stay guarded by the audit e2e specs.

const AUDIT_INFO = 'skylite-audit-vault-v1';
const SESSION_INFO = 'skylite-explorer-session-v1';

function randomMaterial(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}
function b64ToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

describe('generic crypto core', () => {
  it('wrapJson/unwrapJson round-trips arbitrary JSON with injected raw material', async () => {
    const material = randomMaterial();
    const value = { a: 1, b: ['two', 3], nested: { ok: true } };
    const wrapped = await wrapJson(value, { material, info: SESSION_INFO });
    const back = await unwrapJson<typeof value>(wrapped, { material, info: SESSION_INFO });
    expect(back).toEqual(value);
  });

  it('two labels derive distinct keys (domain separation)', async () => {
    const material = randomMaterial();
    const wrapped = await wrapJson({ secret: 'session' }, { material, info: SESSION_INFO });
    // Same raw material, different HKDF info → different AES key → GCM auth fails.
    await expect(unwrapJson(wrapped, { material, info: AUDIT_INFO })).rejects.toThrow();
  });

  it('each wrap uses a fresh IV', async () => {
    const material = randomMaterial();
    const value = { same: 'plaintext' };
    const a = await wrapJson(value, { material, info: AUDIT_INFO });
    const b = await wrapJson(value, { material, info: AUDIT_INFO });
    expect(a.iv).not.toBe(b.iv);
  });

  it('a pre-refactor audit blob still unwraps (cross-version regression)', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(
      readFileSync(join(here, '..', 'fixtures', 'audit-vault-pre-refactor.json'), 'utf8'),
    ) as {
      hkdfInfo: string;
      passphrase: string;
      salt: string;
      iterations: number;
      wrapped: { iv: string; ct: string };
      expectedPrivateJwk: JsonWebKey;
    };
    const material = await passphraseMaterial(
      fixture.passphrase,
      b64ToBytes(fixture.salt),
      fixture.iterations,
    );
    const recovered = await unwrapJson<JsonWebKey>(fixture.wrapped, {
      material,
      info: fixture.hkdfInfo,
    });
    expect(recovered).toEqual(fixture.expectedPrivateJwk);
  });
});
