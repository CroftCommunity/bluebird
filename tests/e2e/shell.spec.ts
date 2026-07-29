import { test, expect } from '@playwright/test';

// Drives the real built bundle from dist/ (hermetic: served locally, no network).
test.describe('Phase 0 shell', () => {
  // Keep it fully hermetic — the garden's AppView calls are stubbed to empty so
  // nothing reaches the real network.
  test.beforeEach(async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r) => r.fulfill({ json: { feed: [] } }));
  });

  test('an un-set-up device sees the landing wordmark (not the explorer chrome)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bluebird' })).toBeVisible();
    // The explorer-surface "Get help" button is NOT shown to a stranger (§S1:
    // product surface and project docs never share navigation).
    await expect(page.getByRole('button', { name: 'Get help' })).toBeHidden();
  });

  test('stamps a real build version into the page', async ({ page }) => {
    await page.goto('/');
    const stamp = page.locator('[data-version-stamp]');
    await expect(stamp).toBeVisible();
    // The build injects `v1 <semver>+<sha>`; the un-built template placeholder
    // (%VERSION%) must never survive to the browser.
    await expect(stamp).toHaveText(/^v1 \d+\.\d+\.\d+\+\S+$/);
    await expect(stamp).not.toHaveText('%VERSION%');
  });

  test('serves a valid web manifest', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const manifest = (await res.json()) as { name: string; icons: unknown[] };
    expect(manifest.name).toBe('Bluebird');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
