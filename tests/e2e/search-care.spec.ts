import { test, expect, type Route } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// §RUN-TRUEUP Phase 2 — care-aware refusal. A blocked query in the SELF-HARM
// category opens a door (the RUN-05 get-help handoff) instead of the flat "that
// search isn't available" line. Every other blocked category keeps the generic
// refusal. Logging is unchanged — both still land in the history as blocked.

const OPEN = {
  tier: 'open',
  useAllowlist: false,
  allowlistExtra: [],
  useBlocklist: true,
  blocklistExtra: [],
  logHistory: true,
};

const HELP = { contactName: 'Mum', contactEmail: 'mum@example.com' };

test.describe('§Care-aware refusal (self-harm)', () => {
  test('a self-harm query shows the supportive panel with the get-help control, no results, no network', async ({
    page,
  }) => {
    await seedExplorer(page, { search: OPEN, help: HELP });
    let searched = false;
    await page.route('**/xrpc/app.bsky.feed.searchPosts*', (r: Route) => {
      searched = true;
      return r.fulfill({ json: { posts: [] } });
    });
    await page.goto('/telescope.html');
    await page.locator('[data-search-input]').fill('how to commit suicide');
    await page.locator('[data-search-go]').click();

    const care = page.locator('[data-search-care]');
    await expect(care).toBeVisible();
    await expect(care).toContainText('too heavy to carry alone');
    await expect(care.locator('[data-search-care-help]')).toHaveText('Get help');

    // No generic refusal line, nothing searched, no results rendered.
    await expect(page.locator('[data-search-msg]')).toHaveText('');
    expect(searched).toBe(false);
    await expect(page.locator('[data-search-results] [data-garden-list]')).toHaveCount(0);

    // The control opens the EXISTING handoff, prefilled to the sponsor.
    await care.locator('[data-search-care-help]').click();
    await expect(page.locator('[data-handoff-overlay]')).toBeVisible();
    await expect(page.locator('[data-handoff-mailto]')).toHaveAttribute('href', /^mailto:mum@example\.com/);

    // Logging is unchanged: the attempt is in the history as blocked.
    await expect(page.locator('[data-search-history]')).toContainText('blocked');
  });

  test('a generic blocked query shows the plain refusal and NO care panel', async ({ page }) => {
    await seedExplorer(page, { search: OPEN, help: HELP });
    await page.goto('/telescope.html');
    await page.locator('[data-search-input]').fill('nsfw stuff');
    await page.locator('[data-search-go]').click();

    await expect(page.locator('[data-search-msg]')).toContainText("isn't allowed");
    await expect(page.locator('[data-search-care]')).toHaveCount(0);
    await expect(page.locator('[data-search-history]')).toContainText('blocked');
  });
});
