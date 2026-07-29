import { describe, it, expect } from 'vitest';
import { RepoClient } from '../../src/atproto/repo.js';
import { fetchFriendHearts, friendHeartsSentence } from '../../src/social/friends-hearts.js';
import type { BluebirdFriend } from '../../src/config/types.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Mock the DID doc + listRecords chain for a set of friends' likes. */
/** A valid PDS host for a DID (no colons — those would parse as URL ports). */
const pdsHostFor = (did: string): string => `https://pds-${did.replace(/[^a-z0-9]+/gi, '-')}.example`;

function mockRepo(likesByDid: Record<string, string[]>): RepoClient {
  const fetchImpl = ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // DID doc resolution (plc.directory/<did>)
    for (const did of Object.keys(likesByDid)) {
      if (url.includes(`plc.directory/${did}`)) {
        return Promise.resolve(
          jsonResponse({ id: did, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: pdsHostFor(did) }] }),
        );
      }
      if (url.includes(pdsHostFor(did)) && url.includes('listRecords')) {
        const records = (likesByDid[did] ?? []).map((postUri, i) => ({
          uri: `at://${did}/ing.croft.bluebird.like/${i}`,
          cid: `c${i}`,
          value: { subject: { uri: postUri, cid: 'x' }, createdAt: '2026-07-15T00:00:00Z' },
        }));
        return Promise.resolve(jsonResponse({ records }));
      }
    }
    return Promise.resolve(new Response('nope', { status: 404 }));
  }) as typeof fetch;
  return new RepoClient({ fetchImpl });
}

const friend = (did: string, displayName?: string): BluebirdFriend =>
  displayName ? { did, displayName } : { did };

describe('fetchFriendHearts', () => {
  it('maps each garden post to the friends who liked it', async () => {
    const repo = mockRepo({
      'did:plc:pat': ['at://post/A', 'at://post/B'],
      'did:plc:sam': ['at://post/A'],
    });
    const map = await fetchFriendHearts([friend('did:plc:pat', 'Pat'), friend('did:plc:sam', 'Sam')], { repo });
    expect(map.get('at://post/A')?.sort()).toEqual(['Pat', 'Sam']);
    expect(map.get('at://post/B')).toEqual(['Pat']);
    expect(map.get('at://post/C')).toBeUndefined();
  });

  it('falls back to the DID when a friend has no display name', async () => {
    const repo = mockRepo({ 'did:plc:anon': ['at://post/A'] });
    const map = await fetchFriendHearts([friend('did:plc:anon')], { repo });
    expect(map.get('at://post/A')).toEqual(['did:plc:anon']);
  });

  it('a friend whose PDS is unreachable is skipped, not fatal', async () => {
    const repo = mockRepo({ 'did:plc:pat': ['at://post/A'] });
    // 'did:plc:ghost' isn't in the mock → its resolvePds 404s and is dropped.
    const map = await fetchFriendHearts([friend('did:plc:pat', 'Pat'), friend('did:plc:ghost', 'Ghost')], { repo });
    expect(map.get('at://post/A')).toEqual(['Pat']);
  });

  it('ignores non-DID friend entries', async () => {
    const repo = mockRepo({});
    const map = await fetchFriendHearts([friend('not-a-did', 'X')], { repo });
    expect(map.size).toBe(0);
  });
});

describe('friendHeartsSentence (count-free)', () => {
  it('reads relationally, never as a number', () => {
    expect(friendHeartsSentence([])).toBe('');
    expect(friendHeartsSentence(['Pat'])).toBe('Liked by Pat');
    expect(friendHeartsSentence(['Pat', 'Sam'])).toBe('Liked by Pat and Sam');
    expect(friendHeartsSentence(['Pat', 'Sam', 'Kai'])).toBe('Liked by Pat, Sam and Kai');
    expect(friendHeartsSentence(['Pat', 'Sam', 'Kai', 'Mo'])).toBe('Liked by Pat, Sam and others');
  });
});
