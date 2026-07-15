import { test, expect, type Page } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// P2 theme mechanics: device-local theme, default = prefers-color-scheme, a
// manual override that persists and wins, and theme-color meta kept in sync.

const bgToken = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toUpperCase());

const themeColor = (page: Page): Promise<string> =>
  page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')?.toUpperCase() ?? '',
  );

const dataTheme = (page: Page): Promise<string | null> =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test.describe('P2 theme mechanics', () => {
  test('with no override, the emulated color-scheme drives the theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await dataTheme(page)).toBeNull(); // following the system, no override
    expect(await bgToken(page)).toBe('#FFFFFF');
    expect(await themeColor(page)).toBe('#FFFFFF');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    expect(await dataTheme(page)).toBeNull();
    expect(await bgToken(page)).toBe('#212121');
    expect(await themeColor(page)).toBe('#212121');
  });

  test('a manual override persists across reload and wins over the media query', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    // Simulate the explorer choosing dark while the system is light.
    await page.evaluate(() => localStorage.setItem('skylite.theme', 'dark'));
    await page.reload();

    expect(await dataTheme(page)).toBe('dark'); // override applied
    expect(await bgToken(page)).toBe('#212121'); // beats the light media query
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

  test('live system change is followed when there is no override', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await bgToken(page)).toBe('#FFFFFF');
    // No reload — the matchMedia listener should re-sync.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => bgToken(page)).toBe('#212121');
    await expect.poll(() => themeColor(page)).toBe('#212121');
  });
});
