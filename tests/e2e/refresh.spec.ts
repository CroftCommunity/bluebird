import { test, expect, type Route } from '@playwright/test';

// S6 refresh: an always-visible control plus a pull gesture; both re-poll config
// and re-fetch feeds. Offline shows the offline banner, not a dead spinner.

const CONFIG = {
  version: 2,
  localOnly: true,
  skin: 'simple',
  paused: false,
  updatedAt: '',
  channels: [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }],
};

function feed(text: string): unknown {
  return {
    feed: [
      {
        post: {
          uri: 'at://did:plc:a/app.bsky.feed.post/p1',
          cid: 'c',
          author: { did: 'did:plc:a', handle: 'a.test', displayName: 'Ada' },
          record: { text, createdAt: '2026-07-14T10:00:00.000Z' },
          indexedAt: '2026-07-14T10:00:00.000Z',
        },
      },
    ],
  };
}

/** A PDS-bound device so refresh re-polls the config record (getRecord) too. */
async function seedBound(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'skylite.binding',
      JSON.stringify({ sponsorDid: 'did:plc:test', rkey: 'abc', pdsHost: 'https://pds.host.bsky.network' }),
    );
  });
}

test.describe('S6 refresh', () => {
  test('the refresh control re-polls config and re-fetches feeds', async ({ page }) => {
    await seedBound(page);
    let getRecordCalls = 0;
    let feedCalls = 0;
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (route: Route) => {
      getRecordCalls++;
      return route.fulfill({ json: { uri: 'at://x', value: CONFIG } });
    });
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) => {
      feedCalls++;
      return route.fulfill({ json: feed('HELLO GARDEN') });
    });

    await page.goto('/');
    await expect(page.getByText('HELLO GARDEN')).toBeVisible();
    const refresh = page.locator('[data-refresh]');
    await expect(refresh).toBeVisible();

    const recordsBefore = getRecordCalls;
    const feedsBefore = feedCalls;
    await refresh.click();
    await expect.poll(() => getRecordCalls).toBeGreaterThan(recordsBefore);
    await expect.poll(() => feedCalls).toBeGreaterThan(feedsBefore);
    await expect(page.getByText('HELLO GARDEN')).toBeVisible();
  });

  test('the refresh control is hidden on the landing (un-set-up device)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-door="sponsor"]')).toBeVisible();
    await expect(page.locator('[data-refresh]')).toBeHidden();
  });

  test('offline refresh shows the offline banner, not a dead spinner', async ({ page }) => {
    await seedBound(page);
    let online = true;
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (route: Route) =>
      online ? route.fulfill({ json: { uri: 'at://x', value: CONFIG } }) : route.abort(),
    );
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) =>
      online ? route.fulfill({ json: feed('HELLO GARDEN') }) : route.abort(),
    );

    await page.goto('/');
    await expect(page.getByText('HELLO GARDEN')).toBeVisible();

    // Go offline, then refresh: the cached config keeps the gate open and the
    // offline banner appears; the loading spinner must not be left spinning.
    online = false;
    await page.locator('[data-refresh]').click();
    await expect(page.locator('[data-offline-banner]')).toBeVisible();
    await expect(page.locator('[data-garden-status="loading"]')).toHaveCount(0);
  });

  test('a pull-to-refresh gesture triggers a refresh', async ({ page }) => {
    await seedBound(page);
    let feedCalls = 0;
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (route: Route) =>
      route.fulfill({ json: { uri: 'at://x', value: CONFIG } }),
    );
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) => {
      feedCalls++;
      return route.fulfill({ json: feed('HELLO GARDEN') });
    });

    await page.goto('/');
    await expect(page.getByText('HELLO GARDEN')).toBeVisible();
    const before = feedCalls;

    // Simulate a touch pull from the top of the feed container.
    await page.locator('[data-garden]').evaluate((el) => {
      const opts = (y: number): PointerEventInit => ({ clientY: y, pointerType: 'touch', bubbles: true });
      el.dispatchEvent(new PointerEvent('pointerdown', opts(20)));
      el.dispatchEvent(new PointerEvent('pointermove', opts(120)));
      el.dispatchEvent(new PointerEvent('pointermove', opts(240)));
      el.dispatchEvent(new PointerEvent('pointerup', opts(240)));
    });

    await expect.poll(() => feedCalls).toBeGreaterThan(before);
  });
});
