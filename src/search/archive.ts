import { seal } from '../crypto/sealedbox.js';
import { createRecord, ensureFresh, type OAuthSession } from '../atproto/oauth/client.js';

/**
 * §Telescope encrypted search-history archive (phase 2). When the sponsor turned
 * the archive on (config.search.auditPubKeyJwk present) and the explorer has an
 * account, each search attempt is sealed to the sponsor's audit PUBLIC key and
 * written to the explorer's OWN repo (ing.croft.skylite.search). The device can
 * seal but never open; only the sponsor's private key reads it (docs/
 * telescope-search.md). Best-effort — a failed write never affects the search;
 * the on-device log is always the source of truth.
 */

export const SEARCH_NSID = 'ing.croft.skylite.search';

/** The payload sealed inside each record — "encrypt everything". */
export interface SearchPayload {
  q: string;
  blocked: boolean;
  tier: string;
}

export interface SealedSearchRecord {
  $type?: typeof SEARCH_NSID;
  enc: { epk: JsonWebKey; iv: string; ct: string };
  createdAt: string;
}

/** Build a sealed search record: the whole payload encrypted to the sponsor key. */
export async function buildSealedSearchRecord(
  payload: SearchPayload,
  auditPubKeyJwk: JsonWebKey,
  createdAtIso: string,
): Promise<SealedSearchRecord> {
  const enc = await seal(JSON.stringify(payload), auditPubKeyJwk);
  return { $type: SEARCH_NSID, enc, createdAt: createdAtIso };
}

/**
 * Seal + persist one search attempt to the explorer's repo. Returns the refreshed
 * session, or the same value when there's nothing to do (no session or no audit
 * key). Never throws — a failure is swallowed so the search is never affected.
 */
export async function archiveSearch(
  payload: SearchPayload,
  deps: { session: OAuthSession | null; auditPubKeyJwk?: JsonWebKey; nowIso: string; fetchImpl?: typeof fetch },
): Promise<OAuthSession | null> {
  const { session, auditPubKeyJwk, nowIso, fetchImpl } = deps;
  if (!session || !auditPubKeyJwk) return session;
  try {
    const record = await buildSealedSearchRecord(payload, auditPubKeyJwk, nowIso);
    const fresh = await ensureFresh(session, fetchImpl);
    const { session: next } = await createRecord(fresh, { collection: SEARCH_NSID, record }, fetchImpl);
    return next;
  } catch {
    return session; // best-effort: the on-device log already holds this attempt
  }
}
