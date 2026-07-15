import { createRecord, deleteRecord, ensureFresh, type OAuthSession } from '../atproto/oauth/client.js';
import { getLocalFollows, setLocalFollows } from '../config/binding.js';
import { rkeyFromUri } from './likes.js';

/**
 * §D1 follows (My Sky). A follow is the explorer's own pick of an actor to see
 * in My Sky — distinct from the sponsor's garden. Device-local follows exist in
 * EVERY mode (capabilities.canFollowLocally is always true): the DID list on the
 * device is what My Sky reads. When the explorer has an account
 * (canPersistFollows), following ALSO writes an `ing.croft.skylite.follow`
 * record into her OWN repo (mirrors app.bsky.graph.follow: subject DID +
 * createdAt), and unfollowing deletes it. The sponsor never touches these.
 */

export const FOLLOW_NSID = 'ing.croft.skylite.follow';

export interface FollowRecord {
  $type?: typeof FOLLOW_NSID;
  subject: string; // the followed actor's DID
  createdAt: string;
}

/** Pure: the follow record body for an actor DID. */
export function buildFollowRecord(did: string, createdAtIso: string): FollowRecord {
  return { $type: FOLLOW_NSID, subject: did, createdAt: createdAtIso };
}

// --- device-local follow set (the My Sky source, every mode) ------------------

export function isFollowedLocally(did: string): boolean {
  return getLocalFollows().includes(did);
}

export function addLocalFollow(did: string): void {
  const follows = getLocalFollows();
  if (!follows.includes(did)) setLocalFollows([...follows, did]);
}

export function removeLocalFollow(did: string): void {
  setLocalFollows(getLocalFollows().filter((d) => d !== did));
}

// --- index of the explorer's own follow records: did -> record uri ------------
// So a one-tap unfollow knows which record to delete without a round-trip.

const KEY_FOLLOW_RECORDS = 'skylite.follow.records';

function readIndex(): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY_FOLLOW_RECORDS);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, string>): void {
  try {
    globalThis.localStorage?.setItem(KEY_FOLLOW_RECORDS, JSON.stringify(index));
  } catch {
    /* storage disabled — non-fatal */
  }
}

export function followRecordUriFor(did: string): string | undefined {
  return readIndex()[did];
}

function rememberFollowRecord(did: string, uri: string): void {
  writeIndex({ ...readIndex(), [did]: uri });
}

function forgetFollowRecord(did: string): void {
  const index = readIndex();
  delete index[did];
  writeIndex(index);
}

// --- follow / unfollow --------------------------------------------------------

/**
 * Follow an actor. Always records the device-local follow (My Sky works with no
 * account). When a session is present, also persists the follow record. Returns
 * the (possibly refreshed) session, or the same value when local-only.
 */
export async function followActor(
  did: string,
  session: OAuthSession | null,
  nowIso: string,
  fetchImpl?: typeof fetch,
): Promise<OAuthSession | null> {
  addLocalFollow(did);
  if (!session) return session;
  const fresh = await ensureFresh(session, fetchImpl);
  const { session: next, uri } = await createRecord(
    fresh,
    { collection: FOLLOW_NSID, record: buildFollowRecord(did, nowIso) },
    fetchImpl,
  );
  rememberFollowRecord(did, uri);
  return next;
}

/**
 * Unfollow an actor. Always removes the device-local follow. When a session is
 * present and a record is known, also deletes the persisted follow record.
 */
export async function unfollowActor(
  did: string,
  session: OAuthSession | null,
  fetchImpl?: typeof fetch,
): Promise<OAuthSession | null> {
  removeLocalFollow(did);
  const recordUri = followRecordUriFor(did);
  if (!session || !recordUri) return session;
  const fresh = await ensureFresh(session, fetchImpl);
  const next = await deleteRecord(fresh, { collection: FOLLOW_NSID, rkey: rkeyFromUri(recordUri) }, fetchImpl);
  forgetFollowRecord(did);
  return next;
}
