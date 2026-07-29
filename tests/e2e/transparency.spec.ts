import { test, expect, type Route } from '@playwright/test';

// §3 garden-change transparency — hermetic. Seed a prior cached config, then
// have the config poll return a changed inclusion list; the device diffs locally
// and shows a plain, always-on notice.

const CHANNELS_ONE = [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }];
const CHANNELS_TWO = [
  { id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }, { actor: 'b.test' }] },
];

function config(channels: unknown): unknown {
  return { version: 2, localOnly: true, skin: 'simple', paused: false, updatedAt: '', channels };
}

test.describe('§3 garden-change transparency', () => {
  test('shows a plain notice when the sponsor adds an account', async ({ page }) => {
    await page.addInitScript(
      (cfg) => {
        localStorage.setItem(
          'bluebird.binding',
          JSON.stringify({ sponsorDid: 'did:plc:t', rkey: 'abc', pdsHost: 'https://pds.host.bsky.network' }),
        );
        // Prior cache holds just a.test; the poll below adds b.test.
        localStorage.setItem('bluebird.config.cache', JSON.stringify({ config: cfg, fetchedAt: Date.now() }));
      },
      config(CHANNELS_ONE),
    );
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (route: Route) =>
      route.fulfill({ json: { uri: 'at://x', value: config(CHANNELS_TWO) } }),
    );
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) => route.fulfill({ json: { feed: [] } }));

    await page.goto('/');
    const notice = page.locator('[data-change-notice]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('1 account was added to your garden.');
  });

  test('no notice when the garden is unchanged', async ({ page }) => {
    await page.addInitScript(
      (cfg) => {
        localStorage.setItem(
          'bluebird.binding',
          JSON.stringify({ sponsorDid: 'did:plc:t', rkey: 'abc', pdsHost: 'https://pds.host.bsky.network' }),
        );
        localStorage.setItem('bluebird.config.cache', JSON.stringify({ config: cfg, fetchedAt: Date.now() }));
      },
      config(CHANNELS_ONE),
    );
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (route: Route) =>
      route.fulfill({ json: { uri: 'at://x', value: config(CHANNELS_ONE) } }),
    );
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) => route.fulfill({ json: { feed: [] } }));

    await page.goto('/');
    await expect(page.locator('[data-garden-status="empty"]')).toBeVisible();
    await expect(page.locator('[data-change-notice]')).toHaveCount(0);
  });
});
