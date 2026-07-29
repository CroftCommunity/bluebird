import { seal } from '../crypto/sealedbox.js';
import { createRecord, ensureFresh, type OAuthSession } from '../atproto/oauth/client.js';
import type { TrustTier } from '../config/types.js';

/**
 * §Telescope encrypted search-history archive (phase 2). When the sponsor turned
 * the archive on (config.search.auditPubKeyJwk present) and the explorer has an
 * account, each search attempt is sealed to the sponsor's audit PUBLIC key and
 * written to the explorer's OWN repo (ing.croft.bluebird.search). The device can
 * seal but never open; only the sponsor's private key reads it (docs/
 * trail-map-search.md). Best-effort — a failed write never affects the search;
 * the on-device log is always the source of truth.
 */

export const SEARCH_NSID = 'ing.croft.bluebird.search';

/**
 * The payload sealed inside each record — "encrypt everything". The precise
 * attempt time (`at`, epoch ms) lives INSIDE the ciphertext so that existence,
 * count, and the calendar day are all a public reader ever learns; the sponsor's
 * decrypted timeline uses this inner `at` (§RUN-TRUEUP Phase 1).
 */
export interface SearchPayload {
  q: string;
  blocked: boolean;
  tier: string;
  /** Precise attempt time (epoch ms), sealed — never exposed in cleartext. */
  at: number;
}

export interface SealedSearchRecord {
  $type?: typeof SEARCH_NSID;
  enc: { epk: JsonWebKey; iv: string; ct: string };
  createdAt: string;
  /**
   * Trust tier the search ran under (green/blue/black), cleartext by design so
   * Patrol tooling and third-party audits can read the trust context without the
   * sponsor's private key. A trust rating, not a content rating.
   */
  tier: TrustTier;
}

/**
 * Round an ISO instant DOWN to its UTC calendar day (00:00:00.000Z). The
 * record-level `createdAt` is only ever day-granular: it leaks that a search
 * happened on a given day, never the precise time (which rides sealed in `at`).
 */
export function toUtcDay(iso: string): string {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/** Build a sealed search record: the whole payload encrypted to the sponsor key. */
export async function buildSealedSearchRecord(
  payload: SearchPayload,
  auditPubKeyJwk: JsonWebKey,
  createdAtIso: string,
  tier: TrustTier,
): Promise<SealedSearchRecord> {
  const enc = await seal(JSON.stringify(payload), auditPubKeyJwk);
  return { $type: SEARCH_NSID, enc, createdAt: toUtcDay(createdAtIso), tier };
}

/**
 * Seal + persist one search attempt to the explorer's repo. Returns the refreshed
 * session, or the same value when there's nothing to do (no session or no audit
 * key). Never throws — a failure is swallowed so the search is never affected.
 */
export async function archiveSearch(
  payload: SearchPayload,
  deps: {
    session: OAuthSession | null;
    auditPubKeyJwk?: JsonWebKey;
    nowIso: string;
    tier: TrustTier;
    fetchImpl?: typeof fetch;
  },
): Promise<OAuthSession | null> {
  const { session, auditPubKeyJwk, nowIso, tier, fetchImpl } = deps;
  if (!session || !auditPubKeyJwk) return session;
  try {
    const record = await buildSealedSearchRecord(payload, auditPubKeyJwk, nowIso, tier);
    const fresh = await ensureFresh(session, fetchImpl);
    const { session: next } = await createRecord(fresh, { collection: SEARCH_NSID, record }, fetchImpl);
    return next;
  } catch {
    return session; // best-effort: the on-device log already holds this attempt
  }
}
