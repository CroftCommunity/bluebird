import { test, expect, type Page } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// P3: the wordmark, icon set, splash startup images, manifest wiring, and the
// per-theme header-mark swap.

test.describe('brand: manifest + icons + splash', () => {
  test('manifest is valid and declares the maskable icon set', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const m = (await res.json()) as { name: string; icons: { sizes: string; purpose?: string }[]; theme_color: string };
    expect(m.name).toBe('Skylite');
    const sizes = m.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.every((i) => (i.purpose ?? '').includes('maskable'))).toBe(true);
  });

  test('every declared icon file is served', async ({ request }) => {
    for (const href of [
      '/icons/favicon-16.png',
      '/icons/favicon-32.png',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/apple-touch-icon-180.png',
    ]) {
      const res = await request.get(href);
      expect(res.ok(), `${href} should be served`).toBeTruthy();
      expect(res.headers()['content-type']).toContain('image/png');
    }
  });

  test('portrait startup images are declared and served', async ({ page, request }) => {
    await page.goto('/');
    const links = page.locator('link[rel="apple-touch-startup-image"]');
    await expect(links).toHaveCount(6);
    const first = (await links.first().getAttribute('href')) ?? '';
    expect(first).toMatch(/icons\/splash\/splash-.*\.jpg$/);
    const res = await request.get(first);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('image/jpeg');
  });
});

const headerMarkUrl = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.querySelector('[data-header-mark]');
    return el ? getComputedStyle(el).backgroundImage : '';
  });

test.describe('brand: header mark + wordmark', () => {
  test.beforeEach(async ({ page }) => {
    await seedExplorer(page); // set-up device → the branded topbar is visible
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r) => r.fulfill({ json: { feed: [] } }));
  });

  test('the header mark swaps day-window (light) for constellation (dark)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect.poll(() => headerMarkUrl(page)).toContain('header-light.png');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => headerMarkUrl(page)).toContain('header-dark.png');
  });

  test('the wordmark is a crisp inline SVG labelled Skylite', async ({ page }) => {
    await page.goto('/');
    const mark = page.locator('.topbar__wordmark svg.wordmark[aria-label="Skylite"]');
    await expect(mark).toBeVisible();
    // Vector: a <text> element, not a raster.
    await expect(mark.locator('text')).toHaveText('Skylite');
  });
});
