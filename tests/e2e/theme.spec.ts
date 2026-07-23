import { test, expect, type Page } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// P2 theme mechanics: device-local theme, default ALWAYS light (system dark is
// never followed), a manual override that persists and wins, theme-color synced.

const bgToken = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase());

const themeColor = (page: Page): Promise<string> =>
  page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')?.toUpperCase() ?? '',
  );

const dataTheme = (page: Page): Promise<string | null> =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test.describe('P2 theme mechanics', () => {
  test('with no override, the theme is always light — even on a dark-mode device', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await dataTheme(page)).toBeNull(); // no override
    expect(await bgToken(page)).toBe('#FFFFFF');
    expect(await themeColor(page)).toBe('#FFFFFF');

    // System dark must NOT flip the app — light is the hard default.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    expect(await dataTheme(page)).toBeNull();
    expect(await bgToken(page)).toBe('#FFFFFF');
    expect(await themeColor(page)).toBe('#FFFFFF');
  });

  test('a manual dark override persists across reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    // Simulate the explorer choosing dark.
    await page.evaluate(() => localStorage.setItem('skylite.theme', 'dark'));
    await page.reload();

    expect(await dataTheme(page)).toBe('dark'); // override applied
    expect(await bgToken(page)).toBe('#212121');
    expect(await themeColor(page)).toBe('#212121');
  });

  test('the topbar theme toggle flips the theme and persists', async ({ page }) => {
    await seedExplorer(page); // set-up device → the topbar (with the toggle) shows
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r) => r.fulfill({ json: { feed: [] } }));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const toggle = page.locator('[data-theme-toggle]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    expect(await dataTheme(page)).toBe('dark');
    expect(await bgToken(page)).toBe('#212121');

    await page.reload();
    expect(await dataTheme(page)).toBe('dark'); // persisted
  });

  test('a live system change is ignored when there is no override', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await bgToken(page)).toBe('#FFFFFF');
    // Flipping the device to dark must not change the app — light is the default.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => bgToken(page)).toBe('#FFFFFF');
    await expect.poll(() => themeColor(page)).toBe('#FFFFFF');
  });
});
