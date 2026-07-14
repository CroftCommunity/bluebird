import { test, expect } from '@playwright/test';

// @live — hits the REAL public AppView with the dev inclusion list. Never runs
// in CI or in the hermetic gate (separate config, run via `npm run e2e:live`).
// Inherently network-dependent; it is a smoke check, not a gate.

test('@live real three-account garden renders from the public AppView', async ({ page }) => {
  await page.goto('/');
  // Give the real fetch + merge time; then expect a genuinely populated garden.
  const posts = page.locator('[data-post-uri]');
  await expect(posts.first()).toBeVisible({ timeout: 20_000 });
  expect(await posts.count()).toBeGreaterThan(0);
  // The build stamp is still present over live data.
  await expect(page.locator('[data-version-stamp]')).toHaveText(/^v1 /);
});
