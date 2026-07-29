import { test, expect, type Route } from '@playwright/test';

// S1 acceptance: the funnel is walkable cold for both roles, the copy is
// byte-verbatim, and a stranger can state the two roles and the one switch
// after a single screen. Hermetic — no network for the landing itself.

test.describe('S1 landing + role funnel', () => {
  test('shows the verbatim hero, one-switch explainer, and honesty copy', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.landing__title')).toHaveText('Bluebird');
    await expect(page.locator('.landing__subtitle')).toHaveText('A bluebird day on Bluesky.');
    await expect(page.locator('.landing__lede')).toHaveText(
      'A calm, read-first window into Bluesky, grown for you by someone who cares about you. No algorithm, no ads, no counts, no strangers.',
    );
    // The one switch that matters is stated on the first screen.
    await expect(page.getByText('One switch matters: Cabin Mode ("on this device only").')).toBeVisible();
    await expect(page.getByText('nothing about the explorer ever leaves the device')).toBeVisible();
    // Honesty, up front.
    await expect(page.locator('.landing__honesty')).toContainText('Gardens are public records');
    await expect(page.locator('.landing__honesty')).toContainText('Saves and notes never leave the device, ever.');
  });

  test('presents exactly the two doors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-door="sponsor"]')).toHaveText('I look after someone');
    await expect(page.locator('[data-door="explorer"]')).toHaveText('I was given a link or code');
  });

  test('Door A leads to the sponsor page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-door="sponsor"]')).toHaveAttribute('href', 'patrol.html');
  });

  test('the footer carries the project docs, not product nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.landing__footer')).toContainText('about the project');
    await expect(page.locator('.landing__footer')).toContainText('license');
  });

  test('Door B: pasting a link binds the device and opens the garden', async ({ page }) => {
    // The garden the pasted link resolves to (empty config → empty garden).
    await page.route('**/xrpc/com.atproto.repo.getRecord*', (route: Route) =>
      route.fulfill({
        json: {
          uri: 'at://did:plc:test/ing.croft.bluebird.config/abc',
          value: { version: 2, localOnly: true, skin: 'simple', paused: false, updatedAt: '', channels: [] },
        },
      }),
    );
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) => route.fulfill({ json: { feed: [] } }));

    await page.goto('/');
    await page.locator('[data-door="explorer"]').click();
    const origin = new URL(page.url()).origin;
    await page.locator('[data-paste-input]').fill(`${origin}/?s=did:plc:test&r=abc&pds=https://pds.host.bsky.network`);
    await page.locator('[data-paste-go]').click();

    // The landing is gone; the garden shell is shown (empty state here).
    await expect(page.locator('[data-door]')).toHaveCount(0);
    await expect(page.locator('[data-garden-status="empty"]')).toBeVisible();
    // The binding was persisted.
    const binding = await page.evaluate(() => window.localStorage.getItem('bluebird.binding'));
    expect(binding).toContain('did:plc:test');
  });

  test('a bad paste is rejected with an honest message', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-door="explorer"]').click();
    await page.locator('[data-paste-input]').fill('hello world');
    await page.locator('[data-paste-go]').click();
    await expect(page.locator('[data-paste-msg]')).toHaveText("That doesn't look like a Bluebird link.");
  });
});
