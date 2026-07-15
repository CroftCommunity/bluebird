import { createRecord, deleteRecord, ensureFresh, type OAuthSession } from '../atproto/oauth/client.js';
import type { PostView } from '../atproto/types.js';

/**
 * B2 likes. A like is a record in the EXPLORER's own repo (never the sponsor's),
 * mirroring app.bsky.feed.like: a subject strongRef + createdAt. Likes exist
 * only when the explorer has an account (localOnly off). The explorer can delete
 * her own likes one-tap; the sponsor cannot — her repo is hers.
 */

export const LIKE_NSID = 'ing.croft.skylite.like';

export interface LikeRecord {
  $type?: typeof LIKE_NSID;
  subject: { uri: string; cid: string };
  createdAt: string;
}

/** Pure: the like record body for a post. */
export function buildLikeRecord(post: PostView, createdAtIso: string): LikeRecord {
  return { $type: LIKE_NSID, subject: { uri: post.uri, cid: post.cid }, createdAt: createdAtIso };
}

/** The rkey is the last path segment of an at:// record URI. */
export function rkeyFromUri(uri: string): string {
  return uri.split('/').pop() ?? '';
}

// --- local index of the explorer's own likes: postUri -> like record uri ------
// So a one-tap unlike knows which record to delete without a round-trip.

const KEY_LIKES = 'skylite.likes';

function readIndex(): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY_LIKES);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, string>): void {
  try {
    globalThis.localStorage?.setItem(KEY_LIKES, JSON.stringify(index));
  } catch {
    /* storage disabled — non-fatal */
  }
}

export function likeUriFor(postUri: string): string | undefined {
  return readIndex()[postUri];
}

export function likedPostUris(): Set<string> {
  return new Set(Object.keys(readIndex()));
}

function rememberLike(postUri: string, likeUri: string): void {
  writeIndex({ ...readIndex(), [postUri]: likeUri });
}

function forgetLike(postUri: string): void {
  const index = readIndex();
  delete index[postUri];
  writeIndex(index);
}

// --- like / unlike ------------------------------------------------------------

export async function likePost(
  session: OAuthSession,
  post: PostView,
  nowIso: string,
  fetchImpl?: typeof fetch,
): Promise<{ session: OAuthSession; likeUri: string }> {
  const fresh = await ensureFresh(session, fetchImpl);
  const { session: next, uri } = await createRecord(
    fresh,
    { collection: LIKE_NSID, record: buildLikeRecord(post, nowIso) },
    fetchImpl,
  );
  rememberLike(post.uri, uri);
  return { session: next, likeUri: uri };
}

export async function unlikePost(
  session: OAuthSession,
  postUri: string,
  fetchImpl?: typeof fetch,
): Promise<OAuthSession> {
  const likeUri = likeUriFor(postUri);
  if (!likeUri) return session;
  const fresh = await ensureFresh(session, fetchImpl);
  const next = await deleteRecord(fresh, { collection: LIKE_NSID, rkey: rkeyFromUri(likeUri) }, fetchImpl);
  forgetLike(postUri);
  return next;
}
