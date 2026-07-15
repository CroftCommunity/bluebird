import { test, expect, type Page, type Route } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// B1/B2 — the "sharing on" like path. Likes are capability-gated on localOnly
// (never skin); the whole OAuth round-trip is mocked on CSP-allowlisted hosts.

const KID_DID = 'did:plc:kid';
const PDS = 'https://pds.host.bsky.network';
const AUTH = 'https://bsky.social';

const POST = {
  uri: 'at://did:plc:a/app.bsky.feed.post/p1',
  cid: 'bafypost',
  author: { did: 'did:plc:a', handle: 'a.test', displayName: 'Ada' },
  record: { text: 'A likeable post', createdAt: '2026-07-14T10:00:00.000Z' },
  indexedAt: '2026-07-14T10:00:00.000Z',
};

function j(body: unknown, init: ResponseInit = {}): { status: number; headers: Record<string, string>; body: string } {
  return {
    status: (init.status as number) ?? 200,
    headers: { 'content-type': 'application/json', ...((init.headers as Record<string, string>) ?? {}) },
    body: JSON.stringify(body),
  };
}

async function seedSharingOn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'skylite.config.local',
      JSON.stringify({
        version: 2,
        displayName: 'Star',
        localOnly: false, // sharing on → likes exist
        skin: 'simple',
        paused: false,
        updatedAt: '',
        channels: [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }],
        friends: [],
        showFriendsHearts: false,
        approvedFeeds: [],
        telescope: false,
        showReposts: false,
        staleHours: 72,
      }),
    );
  });
}

async function mockFeed(page: Page): Promise<void> {
  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill(j({ feed: [{ post: POST }] })));
}

/** Mock the whole explorer OAuth chain; returns a getter for the last write body. */
async function mockExplorerOAuth(page: Page): Promise<() => Record<string, unknown> | null> {
  let parState = '';
  let parRedirect = '';
  let lastWrite: Record<string, unknown> | null = null;

  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (r: Route) => r.fulfill(j({ did: KID_DID })));
  await page.route('**/plc.directory/did:plc:kid', (r: Route) =>
    r.fulfill(j({ id: KID_DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] })),
  );
  await page.route('**/.well-known/oauth-protected-resource', (r: Route) => r.fulfill(j({ authorization_servers: [AUTH] })));
  await page.route('**/.well-known/oauth-authorization-server', (r: Route) =>
    r.fulfill(
      j({
        issuer: AUTH,
        authorization_endpoint: `${AUTH}/oauth/authorize`,
        token_endpoint: `${AUTH}/oauth/token`,
        pushed_authorization_request_endpoint: `${AUTH}/oauth/par`,
      }),
    ),
  );
  await page.route('**/oauth/par', (r: Route) => {
    const p = new URLSearchParams(r.request().postData() ?? '');
    parState = p.get('state') ?? '';
    parRedirect = p.get('redirect_uri') ?? '';
    return r.fulfill(j({ request_uri: 'urn:req:kid', expires_in: 60 }, { status: 201 }));
  });
  await page.route('**/oauth/authorize*', (r: Route) => {
    const back = new URL(parRedirect);
    back.searchParams.set('code', 'CODE');
    back.searchParams.set('state', parState);
    return r.fulfill({ status: 302, headers: { location: back.toString() } });
  });
  await page.route('**/oauth/token', (r: Route) =>
    r.fulfill(j({ access_token: 'AT', refresh_token: 'RT', token_type: 'DPoP', sub: KID_DID, expires_in: 3600 })),
  );
  await page.route('**/xrpc/com.atproto.repo.createRecord', (r: Route) => {
    lastWrite = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill(j({ uri: `at://${KID_DID}/ing.croft.skylite.like/3klike`, cid: 'bafylike' }));
  });
  await page.route('**/xrpc/com.atproto.repo.deleteRecord', (r: Route) => {
    lastWrite = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill(j({}));
  });

  return () => lastWrite;
}

test.describe('B1/B2 likes', () => {
  test('localOnly (default): no heart, no sign-in prompt — reading only', async ({ page }) => {
    await seedExplorer(page); // localOnly true
    await mockFeed(page);
    await page.goto('/');
    await expect(page.locator('[data-post-uri]')).toHaveCount(1);
    await expect(page.locator('[data-like-btn]')).toHaveCount(0);
    await expect(page.locator('[data-explorer-signin-banner]')).toHaveCount(0);
  });

  test('sharing on but signed out: gentle degrade, garden unaffected', async ({ page }) => {
    await seedSharingOn(page);
    await mockFeed(page);
    await page.goto('/');
    // The garden renders fine...
    await expect(page.getByText('A likeable post')).toBeVisible();
    // ...the heart invites sign-in, and the banner is offered.
    const heart = page.locator('[data-like-btn]');
    await expect(heart).toHaveAttribute('data-like-signedout', 'true');
    await expect(heart).toContainText('Sign in to like');
    await expect(page.locator('[data-explorer-signin-banner]')).toBeVisible();
  });

  test('sign in with Bluesky, then like and unlike a post', async ({ page }) => {
    await seedSharingOn(page);
    await mockFeed(page);
    const lastWrite = await mockExplorerOAuth(page);

    await page.goto('/');
    await page.locator('[data-explorer-handle]').fill('kid.test');
    await page.locator('[data-explorer-signin]').click();

    // Signed in → hearts are active, banner gone.
    const heart = page.locator('[data-like-btn]');
    await expect(heart).not.toHaveAttribute('data-like-signedout', 'true');
    await expect(page.locator('[data-explorer-signin-banner]')).toHaveCount(0);

    // Like → creates a like record whose subject is the post.
    await heart.click();
    await expect(heart).toContainText('Liked');
    await expect.poll(() => lastWrite()?.collection).toBe('ing.croft.skylite.like');
    const record = lastWrite()?.record as { subject?: { uri?: string } } | undefined;
    expect(record?.subject?.uri).toBe(POST.uri);

    // Unlike → deletes it.
    await heart.click();
    await expect(heart).toContainText('Like');
    await expect(heart).not.toContainText('Liked');
    await expect.poll(() => (lastWrite() as { rkey?: string })?.rkey).toBe('3klike');
  });
});
