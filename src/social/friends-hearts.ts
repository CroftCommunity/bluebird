import { RepoClient } from '../atproto/repo.js';
import type { SkyliteFriend } from '../config/types.js';
import { LIKE_NSID } from './likes.js';

/**
 * §B2 friends' hearts. Reads each curated friend's like collection with PUBLIC,
 * unauthenticated listRecords and maps which garden posts a friend liked. This
 * is the see-but-not-be-seen "lurk" read: it needs NO account and NO credential,
 * so a localOnly explorer (with the sponsor's showFriendsHearts on) can see
 * friends' hearts without any repo of her own. The like records are public;
 * Skylite just shows them among friends, by name — never a global count.
 */

interface LikeValue {
  subject?: { uri?: string };
}

export interface FriendHeartsDeps {
  repo?: RepoClient;
  perFriend?: number;
}

/** Map of post URI -> friend display names who liked it (relational, not counts). */
export async function fetchFriendHearts(
  friends: SkyliteFriend[],
  deps: FriendHeartsDeps = {},
): Promise<Map<string, string[]>> {
  const repo = deps.repo ?? new RepoClient();
  const perFriend = deps.perFriend ?? 100;
  const byPost = new Map<string, string[]>();

  const settled = await Promise.allSettled(
    friends
      .filter((f) => f.did.startsWith('did:'))
      .map(async (f) => {
        const pds = await repo.resolvePds(f.did);
        const { records } = await repo.listRecords<LikeValue>(pds, {
          repo: f.did,
          collection: LIKE_NSID,
          limit: perFriend,
        });
        return { friend: f, records };
      }),
  );

  for (const r of settled) {
    if (r.status !== 'fulfilled') continue; // a friend's PDS being unreachable is non-fatal
    const name = r.value.friend.displayName?.trim() || r.value.friend.did;
    for (const rec of r.value.records) {
      const uri = rec.value?.subject?.uri;
      if (typeof uri !== 'string') continue;
      const list = byPost.get(uri) ?? [];
      if (!list.includes(name)) list.push(name);
      byPost.set(uri, list);
    }
  }
  return byPost;
}

/** Plain, count-free wording for who liked a post ("Liked by Pat and Sam"). */
export function friendHeartsSentence(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `Liked by ${names[0]}`;
  if (names.length === 2) return `Liked by ${names[0]} and ${names[1]}`;
  if (names.length === 3) return `Liked by ${names[0]}, ${names[1]} and ${names[2]}`;
  return `Liked by ${names[0]}, ${names[1]} and others`;
}
