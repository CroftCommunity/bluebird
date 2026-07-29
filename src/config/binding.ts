import type { CachedConfig } from './state.js';
import type { BluebirdConfig } from './types.js';
import { parseConfig } from './parse.js';

/**
 * Device provisioning + local persistence. A explorer's device is bound once to a
 * sponsor's config record (via a provisioning link carrying the sponsor DID +
 * rkey), then remembers it. Also holds the last-good config cache (D5) and the
 * local-only config (D2 fallback for sponsors without a Bluesky account).
 *
 * All storage access is defensive — private-mode / disabled storage must degrade
 * to "unprovisioned", never throw.
 */

export interface Binding {
  sponsorDid: string;
  rkey: string;
  pdsHost?: string;
}

const KEY_BINDING = 'bluebird.binding';
const KEY_CACHE = 'bluebird.config.cache';
const KEY_LOCAL = 'bluebird.config.local';
const KEY_FOLLOWS = 'bluebird.follows';

/**
 * Parse provisioning params (?s=<sponsorDid>&r=<rkey>&pds=<host>) into a Binding.
 * `g` is accepted as a legacy alias for `s` (links issued before the rename).
 */
export function parseProvisioning(params: URLSearchParams): Binding | null {
  const did = (params.get('s') ?? params.get('g'))?.trim();
  if (!did || !did.startsWith('did:')) return null;
  const rkey = params.get('r')?.trim() || 'self';
  const pds = params.get('pds')?.trim();
  return { sponsorDid: did, rkey, ...(pds ? { pdsHost: pds } : {}) };
}

/** Build a provisioning URL a sponsor can send to the explorer's device. */
export function provisioningUrl(origin: string, binding: Binding): string {
  const url = new URL(origin);
  url.searchParams.set('s', binding.sponsorDid);
  if (binding.rkey && binding.rkey !== 'self') url.searchParams.set('r', binding.rkey);
  if (binding.pdsHost) url.searchParams.set('pds', binding.pdsHost);
  return url.toString();
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function getBinding(): Binding | null {
  return readJson<Binding>(KEY_BINDING);
}
export function setBinding(b: Binding): void {
  writeJson(KEY_BINDING, b);
}
export function getCachedConfig(): CachedConfig | null {
  const raw = readJson<{ config?: unknown; fetchedAt?: unknown }>(KEY_CACHE);
  if (!raw) return null;
  // Normalize the stored config the same way a fresh PDS poll does (parseConfig):
  // a legacy/partial cache becomes the canonical two-switch shape, so gating and
  // capabilities() never see a half-populated config (e.g. an absent `friends`).
  const config = parseConfig(raw.config);
  if (!config || typeof raw.fetchedAt !== 'number') return null;
  return { config, fetchedAt: raw.fetchedAt };
}
export function setCachedConfig(c: CachedConfig): void {
  writeJson(KEY_CACHE, c);
}
export function getLocalConfig(): BluebirdConfig | null {
  // Migrate on read: a device-local v1 record parses into the canonical shape.
  return parseConfig(readJson<unknown>(KEY_LOCAL));
}
export function setLocalConfig(c: BluebirdConfig): void {
  writeJson(KEY_LOCAL, c);
}
/**
 * The explorer's device-local follows (My Sky, RUN-DISCOVER D1) — DIDs. The slot
 * exists now so S5 backup/restore round-trips it; D1 fills it in.
 */
export function getLocalFollows(): string[] {
  const list = readJson<unknown>(KEY_FOLLOWS);
  return Array.isArray(list) ? list.filter((d): d is string => typeof d === 'string') : [];
}
export function setLocalFollows(dids: string[]): void {
  writeJson(KEY_FOLLOWS, dids);
}

/**
 * If the current URL carries provisioning params, persist the binding and return
 * it (also clearing the params from the address bar so a shared link doesn't
 * linger). Returns the newly-stored binding, or null if none present.
 */
export function ingestProvisioningFromLocation(loc: Location, history: History): Binding | null {
  const url = new URL(loc.href);
  const binding = parseProvisioning(url.searchParams);
  if (!binding) return null;
  setBinding(binding);
  url.searchParams.delete('s');
  url.searchParams.delete('g');
  url.searchParams.delete('r');
  url.searchParams.delete('pds');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return binding;
}
