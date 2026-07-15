import { test, expect, type Route } from '@playwright/test';
import { FIXTURE_FEEDS } from '../fixtures/authorFeed.js';
import { seedExplorer } from './helpers.js';

// §B4 the "full" skin — a cosmetic skin that echoes bsky.app's flat, edge-to-edge
// feed. These prove it is (a) visibly distinct from the calm "simple" cards and
// (b) purely cosmetic: it changes no capability and adds no counts. Hermetic.

async function mockAppView(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const actor = url.searchParams.get('actor') ?? '';
  await route.fulfill({ json: FIXTURE_FEEDS[actor] ?? { feed: [] } });
}

const firstPostShadow = (page: import('@playwright/test').Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.querySelector('[data-post-uri]');
    return el ? getComputedStyle(el).boxShadow : '';
  });

test.describe('§B4 full skin', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', mockAppView);
  });

  test('full skin renders a flat, hairline-divided feed (no card shadow)', async ({ page }) => {
    await seedExplorer(page, { skin: 'full' });
    await page.goto('/');

    expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe('full');

    const post = page.locator('[data-post-uri]').first();
    await expect(post).toBeVisible();
    // Flat: no floating-card shadow, and a hairline divider instead.
    expect(await firstPostShadow(page)).toBe('none');
    const border = await post.evaluate((el) => getComputedStyle(el).borderBottomWidth);
    expect(border).not.toBe('0px');
  });

  test('simple skin keeps the calm, shadowed cards (control)', async ({ page }) => {
    await seedExplorer(page); // default skin = simple
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe('simple');
    // The card carries a drop shadow — the opposite of the flat skin.
    expect(await firstPostShadow(page)).not.toBe('none');
  });

  test('skin is cosmetic only — it never grants a capability or shows counts', async ({ page }) => {
    // localOnly stays on; flipping the skin to "full" must NOT surface a like
    // control (that keys on localOnly, never skin) and must add no counts.
    await seedExplorer(page, { skin: 'full' });
    await page.goto('/');
    await expect(page.locator('[data-post-uri]').first()).toBeVisible();
    await expect(page.locator('[data-like-btn]')).toHaveCount(0);
    // No like/repost/reply counts anywhere, in any skin.
    await expect(page.locator('.post__count, [data-count]')).toHaveCount(0);
  });
});
