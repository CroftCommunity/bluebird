import { test, expect, type Page, type Route } from '@playwright/test';

// The out-of-band "something's wrong" handoff and the honest "how it works" page.

const emptyFeeds = (r: Route): Promise<void> => r.fulfill({ json: { feed: [] } });

async function localConfigWithHelp(page: Page, help: unknown): Promise<void> {
  await page.addInitScript(
    (h) => {
      localStorage.setItem(
        'skylite.config.local',
        JSON.stringify({ version: 1, paused: false, updatedAt: '', channels: [], help: h }),
      );
    },
    help,
  );
}

test.describe('Help handoff (IDEAS.md §3)', () => {
  test('opens the handoff and, with a contact, offers a prefilled mailto', async ({ page }) => {
    await localConfigWithHelp(page, { contactName: 'Mum', contactEmail: 'mum@example.com' });
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', emptyFeeds);
    await page.goto('/');
    await page.locator('[data-help-btn]').click();
    await expect(page.locator('[data-handoff-overlay]')).toBeVisible();
    const mailto = page.locator('[data-handoff-mailto]');
    await expect(mailto).toHaveAttribute('href', /^mailto:mum@example\.com\?/);
    await expect(mailto).toContainText('Mum');
  });

  test('without a contact, offers gentle guidance instead of a mailto', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', emptyFeeds);
    await page.goto('/');
    await page.locator('[data-help-btn]').click();
    await expect(page.locator('[data-handoff-overlay]')).toBeVisible();
    await expect(page.locator('[data-handoff-mailto]')).toHaveCount(0);
    await expect(page.locator('[data-handoff-overlay]')).toContainText('grown-up you trust');
  });

  test('"Never mind" dismisses the handoff', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', emptyFeeds);
    await page.goto('/');
    await page.locator('[data-help-btn]').click();
    await page.locator('[data-handoff-close]').click();
    await expect(page.locator('[data-handoff-overlay]')).toHaveCount(0);
  });
});

test.describe('How Skylite works', () => {
  test('explains what is public vs private and offers help', async ({ page }) => {
    await page.goto('/help.html');
    await expect(page.getByRole('heading', { name: "What's public and what's private" })).toBeVisible();
    await expect(page.getByText(/stay only on this device/)).toBeVisible();
    await page.locator('[data-help-btn]').click();
    await expect(page.locator('[data-handoff-overlay]')).toBeVisible();
  });
});
