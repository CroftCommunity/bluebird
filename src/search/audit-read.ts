import { RepoClient } from '../atproto/repo.js';
import { open } from '../crypto/sealedbox.js';
import { SEARCH_NSID, type SealedSearchRecord } from './archive.js';

/**
 * §Phase 3B — the sponsor reads an explorer's encrypted search history. Pure
 * PUBLIC reads (resolve the handle, resolve the PDS, listRecords) — the audit
 * view "touches nothing on the explorer's device", same posture as the label
 * audit. The ciphertext is opened locally with the sponsor's unlocked private
 * key; a record that won't decrypt (wrong key / corrupt) is skipped, not fatal.
 */

const APPVIEW = 'https://public.api.bsky.app';

/** Resolve a handle to a DID via the public AppView. A DID passes through. */
export async function resolveHandleToDid(
  handle: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<string> {
  if (handle.startsWith('did:')) return handle;
  const url = new URL('/xrpc/com.atproto.identity.resolveHandle', APPVIEW);
  url.searchParams.set('handle', handle.replace(/^@/, ''));
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`resolveHandle failed: ${res.status}`);
  const data = (await res.json()) as { did?: string };
  if (typeof data.did !== 'string') throw new Error('handle did not resolve to a DID');
  return data.did;
}

/** Read the explorer's sealed search-history records (public, unauthenticated). */
export async function fetchSealedHistory(did: string, deps: { repo?: RepoClient } = {}): Promise<SealedSearchRecord[]> {
  const repo = deps.repo ?? new RepoClient();
  const pds = await repo.resolvePds(did);
  const { records } = await repo.listRecords<SealedSearchRecord>(pds, {
    repo: did,
    collection: SEARCH_NSID,
    limit: 100,
  });
  return records.map((r) => r.value);
}

export interface DecryptedSearch {
  q: string;
  blocked: boolean;
  tier: string;
  at: string;
}

interface SealedPayload {
  q?: unknown;
  blocked?: unknown;
  tier?: unknown;
  at?: unknown;
}

/** Open each sealed record with the sponsor's private key; newest first. */
export async function decryptHistory(
  records: SealedSearchRecord[],
  privateKeyJwk: JsonWebKey,
): Promise<DecryptedSearch[]> {
  const out: DecryptedSearch[] = [];
  for (const rec of records) {
    try {
      const payload = JSON.parse(await open(rec.enc, privateKeyJwk)) as SealedPayload;
      // Tolerant read: new records carry the precise time sealed as `at` (epoch
      // ms); older records predate Phase 1 and only have the record `createdAt`.
      const at = typeof payload.at === 'number' ? new Date(payload.at).toISOString() : rec.createdAt;
      out.push({
        q: typeof payload.q === 'string' ? payload.q : '',
        blocked: payload.blocked === true,
        tier: typeof payload.tier === 'string' ? payload.tier : '',
        at,
      });
    } catch {
      /* undecryptable (wrong key / corrupt) — skip, don't fail the whole read */
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
