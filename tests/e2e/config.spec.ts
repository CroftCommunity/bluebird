import { test, expect, type Page, type Route } from '@playwright/test';

// Hermetic Phase 2: guardian config is served from local fixtures. Covers
// provisioning, pause enforcement, channel toggles, and the D5 offline/staleness
// gates — all without touching the network.

const DID = 'did:plc:testguardian';
const PDS = 'https://pds.host.bsky.network'; // within CSP connect-src (*.host.bsky.network)

interface Chan {
  id: string;
  name: string;
  enabled: boolean;
  accounts: { actor: string; displayName?: string }[];
}
function config(paused: boolean, channels: Chan[]): unknown {
  return { $type: 'ing.croft.skylite.config', version: 1, paused, updatedAt: '2026-07-14T00:00:00Z', channels };
}
function feed(actor: string, text: string): unknown {
  return {
    feed: [
      {
        post: {
          uri: `at://did:plc:${actor}/app.bsky.feed.post/1`,
          cid: 'c',
          author: { did: `did:plc:${actor}`, handle: actor, displayName: actor },
          record: { text, createdAt: '2026-07-14T10:00:00.000Z' },
          indexedAt: '2026-07-14T10:00:00.000Z',
        },
      },
    ],
  };
}

async function mockResolution(page: Page, record: unknown): Promise<void> {
  await page.route('https://plc.directory/**', (r: Route) =>
    r.fulfill({ json: { id: DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] } }),
  );
  await page.route('**/xrpc/com.atproto.repo.getRecord*', (r: Route) =>
    r.fulfill({ json: { uri: `at://${DID}/ing.croft.skylite.config/self`, value: record } }),
  );
}
async function mockFeeds(page: Page, feeds: Record<string, unknown>): Promise<void> {
  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => {
    const actor = new URL(r.request().url()).searchParams.get('actor') ?? '';
    return r.fulfill({ json: feeds[actor] ?? { feed: [] } });
  });
}

test.describe('Phase 2 guardian config (hermetic)', () => {
  test('pause flag in the record locks the device on poll', async ({ page }) => {
    await mockResolution(page, config(true, [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }]));
    await mockFeeds(page, {});
    await page.goto(`/?g=${DID}`);
    await expect(page.locator('[data-lock="paused"]')).toBeVisible();
  });

  test('only enabled channels reach the garden', async ({ page }) => {
    await mockResolution(
      page,
      config(false, [
        { id: 'on', name: 'On', enabled: true, accounts: [{ actor: 'a.test' }] },
        { id: 'off', name: 'Off', enabled: false, accounts: [{ actor: 'b.test' }] },
      ]),
    );
    await mockFeeds(page, { 'a.test': feed('a.test', 'ALPHA POST'), 'b.test': feed('b.test', 'BETA POST') });
    await page.goto(`/?g=${DID}`);
    await expect(page.getByText('ALPHA POST')).toBeVisible();
    await expect(page.getByText('BETA POST')).toHaveCount(0);
  });

  test('provisioning binds the device and clears the link from the URL', async ({ page }) => {
    await mockResolution(page, config(false, [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }]));
    await mockFeeds(page, { 'a.test': feed('a.test', 'ALPHA POST') });
    await page.goto(`/?g=${DID}&r=self`);
    await expect(page.getByText('ALPHA POST')).toBeVisible();
    expect(page.url()).not.toContain('g=');
    // Reload without params: the binding persists, garden still resolves.
    await page.reload();
    await expect(page.getByText('ALPHA POST')).toBeVisible();
  });

  test('D5: stale cache while offline locks the garden', async ({ page }) => {
    await page.addInitScript((did) => {
      localStorage.setItem('skylite.binding', JSON.stringify({ guardianDid: did, rkey: 'self' }));
      localStorage.setItem(
        'skylite.config.cache',
        JSON.stringify({
          config: { version: 1, paused: false, updatedAt: '', channels: [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }] },
          fetchedAt: Date.now() - 100 * 60 * 60 * 1000, // 100h > 72h window
        }),
      );
    }, DID);
    await page.route('https://plc.directory/**', (r: Route) => r.abort());
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (r: Route) => r.abort());
    await page.goto('/');
    await expect(page.locator('[data-lock="stale"]')).toBeVisible();
  });

  test('D5: fresh cache while offline shows the garden with an offline banner', async ({ page }) => {
    await page.addInitScript((did) => {
      localStorage.setItem('skylite.binding', JSON.stringify({ guardianDid: did, rkey: 'self' }));
      localStorage.setItem(
        'skylite.config.cache',
        JSON.stringify({
          config: { version: 1, paused: false, updatedAt: '', channels: [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }] },
          fetchedAt: Date.now() - 60 * 60 * 1000, // 1h — within window
        }),
      );
    }, DID);
    await page.route('https://plc.directory/**', (r: Route) => r.abort());
    await mockFeeds(page, { 'a.test': feed('a.test', 'CACHED POST') });
    await page.goto('/');
    await expect(page.locator('[data-offline-banner]')).toBeVisible();
    await expect(page.getByText('CACHED POST')).toBeVisible();
  });
});
