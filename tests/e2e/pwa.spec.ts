import { test, expect, type Route } from '@playwright/test';
import { createHash as nodeHash } from 'node:crypto';

// Phase 3 PWA hardening: service worker registration and the D6 background lock.
// This spec exercises the real SW, so re-enable it (blocked by default elsewhere).
test.use({ serviceWorkers: 'allow' });

const emptyFeeds = (r: Route): Promise<void> => r.fulfill({ json: { feed: [] } });

test.describe('Service worker', () => {
  test('registers and activates', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', emptyFeeds);
    await page.goto('/');
    const active = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(active).toBe(true);
  });

  test('serves the app shell and keeps the version stamp', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', emptyFeeds);
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.locator('[data-version-stamp]')).toHaveText(/^v1 \d+\.\d+\.\d+\+\S+$/);
  });
});

test.describe('D6 background lock', () => {
  // Precompute the stored hash the way src/lock/pin.ts does: sha256("bluebird:PIN").
  const PIN = '2468';
  const pinHash = nodeHash('sha256').update(`bluebird:${PIN}`).digest('hex');

  test.beforeEach(async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', emptyFeeds);
    await page.addInitScript((hash) => localStorage.setItem('bluebird.pin', hash), pinHash);
  });

  test('locks when backgrounded and unlocks with the correct PIN', async ({ page }) => {
    await page.goto('/');
    // No lock while in the foreground.
    await expect(page.locator('[data-pinlock]')).toHaveCount(0);

    // Simulate backgrounding.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('[data-pinlock]')).toBeVisible();

    // Wrong PIN is rejected.
    await page.locator('[data-pin-input]').fill('0000');
    await page.locator('[data-pin-submit]').click();
    await expect(page.locator('[data-pin-error]')).toHaveText('Try again');
    await expect(page.locator('[data-pinlock]')).toBeVisible();

    // Correct PIN unlocks.
    await page.locator('[data-pin-input]').fill('2468');
    await page.locator('[data-pin-submit]').click();
    await expect(page.locator('[data-pinlock]')).toHaveCount(0);
  });

  test('does not lock when no PIN is set', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => localStorage.removeItem('bluebird.pin'));
    await page.goto('/');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('[data-pinlock]')).toHaveCount(0);
  });
});
