import { test, expect, type Route } from '@playwright/test';
import { FIXTURE_FEEDS, FIXTURE_POSTS } from '../fixtures/authorFeed.js';
import { seedExplorer } from './helpers.js';

// §B2 friends' hearts — the see-but-not-be-seen "lurk" read. This proves the
// whole point: a localOnly explorer with NO account and NO OAuth session sees
// which friends liked a garden post, sourced entirely from friends' PUBLIC like
// records read anonymously. Every request is fulfilled from fixtures — zero real
// network — and the assertions confirm no credential is ever presented.
//
// CSP note: the friend's PDS host must sit under the index.html connect-src
// allowlist (*.host.bsky.network) and DID resolution goes through plc.directory,
// both allowlisted — otherwise the browser blocks the fetch before route().

const FRIEND_DID = 'did:plc:friendpat';
const FRIEND_PDS = 'https://pds.host.bsky.network';
const LIKED_URI = FIXTURE_POSTS.A1.uri; // "Welcome to the sky!"

async function mockAppView(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const actor = url.searchParams.get('actor') ?? '';
  await route.fulfill({ json: FIXTURE_FEEDS[actor] ?? { feed: [] } });
}

async function mockDidDoc(route: Route): Promise<void> {
  await route.fulfill({
    json: {
      id: FRIEND_DID,
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: FRIEND_PDS,
        },
      ],
    },
  });
}

/** Records whether any listRecords request carried an Authorization header. */
function mockListRecords(sawAuth: { value: boolean }) {
  return async (route: Route): Promise<void> => {
    if (route.request().headers()['authorization']) sawAuth.value = true;
    await route.fulfill({
      json: {
        records: [
          {
            uri: `at://${FRIEND_DID}/ing.croft.skylite.like/1`,
            cid: 'cidlike1',
            value: { subject: { uri: LIKED_URI, cid: 'x' }, createdAt: '2026-07-15T00:00:00Z' },
          },
        ],
      },
    });
  };
}

test.describe('§B2 friends’ hearts (hermetic lurk read)', () => {
  test('a localOnly explorer sees "Liked by <friend>" with no account or session', async ({ page }) => {
    const sawAuth = { value: false };
    await seedExplorer(page, {
      showFriendsHearts: true,
      friends: [{ did: FRIEND_DID, displayName: 'Pat' }],
    });
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', mockAppView);
    await page.route(`**/plc.directory/${FRIEND_DID}`, mockDidDoc);
    await page.route('**/xrpc/com.atproto.repo.listRecords*', mockListRecords(sawAuth));

    await page.goto('/');

    // The liked post picks up the count-free, by-name annotation.
    const likedPost = page.locator(`[data-post-uri="${LIKED_URI}"]`);
    await expect(likedPost.locator('[data-friend-hearts]')).toHaveText('Liked by Pat');

    // A different post has no hearts line at all.
    const other = page.locator(`[data-post-uri="${FIXTURE_POSTS.C1.uri}"]`);
    await expect(other.locator('[data-friend-hearts]')).toHaveCount(0);

    // The whole point of the lurk read: it was anonymous. No credential was sent.
    expect(sawAuth.value).toBe(false);
    // And no sign-in prompt was needed for the read side.
    await expect(page.locator('[data-like-signedout]')).toHaveCount(0);
  });

  test('with showFriendsHearts off, no hearts are read or shown', async ({ page }) => {
    let listCalled = false;
    await seedExplorer(page, {
      showFriendsHearts: false,
      friends: [{ did: FRIEND_DID, displayName: 'Pat' }],
    });
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', mockAppView);
    await page.route('**/xrpc/com.atproto.repo.listRecords*', async (route) => {
      listCalled = true;
      await route.fulfill({ json: { records: [] } });
    });

    await page.goto('/');
    await expect(page.locator('[data-garden-list]')).toBeVisible();
    await expect(page.locator('[data-friend-hearts]')).toHaveCount(0);
    expect(listCalled).toBe(false); // the lurk fetch never fired
  });
});
