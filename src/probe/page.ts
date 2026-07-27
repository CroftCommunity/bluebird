// THROWAWAY device probe harness (Phase 0-prep A2). Lives on the probe branch
// only; NEVER merges. Its job is to answer the Phase 0 device gates on a real
// installed iOS PWA:
//   · D1 — does sessionStorage wipe (and localStorage survive) a cold launch?
//   · D5 — does WebAuthn PRF yield a real, stable secret in standalone display
//          mode, and does an AES-GCM wrap round-trip across a cold launch?
// It is built on the SAME crypto core the real feature uses (Phase 1a), so the
// fixture it emits is a valid Phase 1a regression fixture, not a discard.
//
// Strict CSP (script-src 'self') means no inline JS — every button is wired here.
// Every WebAuthn call sits behind a tap (transient activation, required on iOS).

import { skyliteVersion } from '../version.js';
import {
  prfEnroll,
  prfGet,
  wrapJson,
  unwrapJson,
  webauthnAvailable,
} from '../crypto/vault.js';
import { log } from '../log.js';

// --- constants ---------------------------------------------------------------

const SESSION_INFO = 'skylite-explorer-session-v1';
const STAMP_KEY = 'skylite.probe';
const CRED_KEY = 'skylite.probe.cred';
const WRAPPED_KEY = 'skylite.probe.wrapped';

// A fixed 32-byte PRF eval salt — the same salt must be used at enroll and every
// get() for the derived secret to match.
const SALT = new Uint8Array(32);
for (let i = 0; i < SALT.length; i++) SALT[i] = (i * 7 + 3) & 0xff;

// --- small helpers -----------------------------------------------------------

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function b64(bytes: Uint8Array): string {
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s);
}
function $(sel: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(sel);
}
function set(sel: string, text: string): void {
  const el = $(sel);
  if (el) el.textContent = text;
}
function line(msg: string): void {
  log.info('[probe]', msg); // also surfaces in the console under ?debug=1
  const pane = $('[data-log]');
  if (pane) pane.textContent = `${msg}\n${pane.textContent ?? ''}`.slice(0, 4000);
}
function onClick(sel: string, fn: () => void | Promise<void>): void {
  const el = $(sel);
  if (!el) return;
  el.addEventListener('click', () => {
    void (async () => {
      try {
        await fn();
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        line(`ERROR: ${m}`);
      }
    })();
  });
}

// In-memory derived key material. Lost on cold launch — which is the point: after
// a relaunch the "unlock" button must RE-derive it from the stored passkey.
let material: Uint8Array | null = null;

// Minimal read of the PRF extension output (not in the default lib.dom types).
interface PrfExt {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
}

// --- D1: storage stamps ------------------------------------------------------

function renderStamps(): void {
  set('[data-d1-session]', sessionStorage.getItem(STAMP_KEY) ?? '(empty)');
  set('[data-d1-local]', localStorage.getItem(STAMP_KEY) ?? '(empty)');
}

function stampBoth(): void {
  const prev = Number((JSON.parse(localStorage.getItem(STAMP_KEY) ?? '{}') as { n?: number }).n ?? 0);
  const value = JSON.stringify({ n: prev + 1, t: new Date().toISOString() });
  sessionStorage.setItem(STAMP_KEY, value);
  localStorage.setItem(STAMP_KEY, value);
  renderStamps();
  line(`D1: stamped both stores → ${value}`);
}

// --- D5: crypto round-trip ---------------------------------------------------

function simulateMaterial(): void {
  material = globalThis.crypto.getRandomValues(new Uint8Array(32));
  set('[data-material]', `simulated (no WebAuthn): ${hex(material)}`);
  line('D5: simulated 32-byte material (skips WebAuthn — for the crypto-wiring check)');
}

async function enroll(): Promise<void> {
  if (!webauthnAvailable()) throw new Error('WebAuthn is unavailable on this browser');
  const { credentialId, material: m } = await prfEnroll({
    salt: SALT,
    label: 'skylite-explorer-session',
    displayName: 'Skylite session (probe)',
  });
  material = m;
  localStorage.setItem(CRED_KEY, credentialId);
  set('[data-material]', `PRF secret: ${hex(m)}`);
  line(`D5: enrolled passkey, credentialId=${credentialId.slice(0, 16)}… secret=${m.length} bytes`);
}

async function getPrfTwice(): Promise<void> {
  const cred = localStorage.getItem(CRED_KEY);
  if (!cred) throw new Error('No enrolled credential — tap Enroll first');
  // Raw get() to inspect the extension results (the enabled-vs-results.first trap).
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: Uint8Array.from(atob(cred), (c) => c.charCodeAt(0)) }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: SALT } } },
    },
  })) as PublicKeyCredential | null;
  const ext = (assertion?.getClientExtensionResults() as PrfExt | undefined)?.prf;
  const first = ext?.results?.first;
  line(`D5 trap check: prf.enabled=${ext?.enabled} results.first ${first ? `present (${first.byteLength}B)` : 'ABSENT'}`);
  // Two library get()s, compare byte-for-byte (intra-session stability).
  const a = await prfGet(cred, SALT);
  const b = await prfGet(cred, SALT);
  const stable = a.length === b.length && a.every((v, i) => v === b[i]);
  material = a;
  set('[data-material]', `PRF secret: ${hex(a)}`);
  set('[data-prf-dump]', `enabled=${ext?.enabled} first=${first ? `${first.byteLength}B` : 'ABSENT'} stable=${stable ? 'YES' : 'NO'}`);
  line(`D5: get() ×2 stable=${stable ? 'YES' : 'NO — UNSTABLE, do not persist'}`);
}

async function wrap(): Promise<void> {
  if (!material) throw new Error('No material — Simulate, Enroll, or Get PRF first');
  const value = { hello: 'world', t: new Date().toISOString() };
  const wrapped = await wrapJson(value, { material, info: SESSION_INFO });
  localStorage.setItem(WRAPPED_KEY, JSON.stringify(wrapped));
  set('[data-wrapped]', JSON.stringify(wrapped));
  line(`D5: wrapped test blob → localStorage['${WRAPPED_KEY}']`);
}

async function unwrapWith(mat: Uint8Array): Promise<void> {
  const raw = localStorage.getItem(WRAPPED_KEY);
  if (!raw) throw new Error('Nothing wrapped yet');
  const wrapped = JSON.parse(raw) as { iv: string; ct: string };
  const value = await unwrapJson<{ hello: string; t: string }>(wrapped, { material: mat, info: SESSION_INFO });
  set('[data-plaintext]', JSON.stringify(value));
  const ok = value?.hello === 'world';
  set('[data-roundtrip]', ok ? 'OK — round-trip recovered plaintext' : 'FAIL');
  line(`D5: unwrap → ${ok ? 'OK' : 'FAIL'} ${JSON.stringify(value)}`);
}

async function unwrapCurrent(): Promise<void> {
  if (!material) throw new Error('No in-memory material — use Simulate/Get PRF, or tap Unlock to re-derive');
  await unwrapWith(material);
}

// The real D5 cross-launch test: after a cold relaunch (in-memory material gone),
// re-derive from the stored passkey and unwrap the stored blob.
async function unlock(): Promise<void> {
  const cred = localStorage.getItem(CRED_KEY);
  if (!cred) throw new Error('No enrolled credential to unlock with');
  material = await prfGet(cred, SALT);
  set('[data-material]', `PRF secret (re-derived): ${hex(material)}`);
  line('D5: re-derived material via PRF after (cold) relaunch');
  await unwrapWith(material);
}

// --- A3: fixture capture -----------------------------------------------------

function copyFixture(): void {
  const raw = localStorage.getItem(WRAPPED_KEY);
  if (!material || !raw) {
    line('Fixture: need material + a wrapped blob first');
    return;
  }
  const fixture = {
    _comment: 'Phase 0-prep D5 probe output — a valid Phase 1a keep-as-fixture.',
    hkdfInfo: SESSION_INFO,
    salt: b64(SALT),
    materialHex: hex(material),
    wrapped: JSON.parse(raw) as unknown,
    expectedPlaintext: { hello: 'world' },
  };
  const json = JSON.stringify(fixture, null, 2);
  set('[data-fixture]', json);
  void navigator.clipboard?.writeText(json).then(
    () => line('Fixture: copied to clipboard'),
    () => line('Fixture: rendered below (clipboard blocked — copy by hand)'),
  );
}

// --- boot --------------------------------------------------------------------

function boot(): void {
  set('[data-version-stamp]', skyliteVersion());
  set('[data-standalone]', matchMedia('(display-mode: standalone)').matches ? 'standalone (installed)' : 'browser tab');
  set('[data-webauthn]', webauthnAvailable() ? 'yes' : 'no');
  renderStamps();
  line(`probe booted — rpId=${location.hostname}`);

  onClick('[data-d1-stamp]', stampBoth);
  onClick('[data-sim]', simulateMaterial);
  onClick('[data-enroll]', enroll);
  onClick('[data-getprf]', getPrfTwice);
  onClick('[data-wrap]', wrap);
  onClick('[data-unwrap-current]', unwrapCurrent);
  onClick('[data-unlock]', unlock);
  onClick('[data-fixture-btn]', copyFixture);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
