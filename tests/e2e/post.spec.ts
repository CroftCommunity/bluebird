import { test, expect, type Route } from '@playwright/test';
import { FIXTURE_POSTS } from '../fixtures/authorFeed.js';

// §B3 post-view page + native share. Hermetic: getPosts is fulfilled from
// fixtures, so a single shared post renders with zero real network. The label
// floor still applies (a labeled post is "not available"), and share targets the
// Skylite permalink — never bsky.app.

const A1 = FIXTURE_POSTS.A1;

async function mockGetPosts(route: Route, posts: unknown[]): Promise<void> {
  await route.fulfill({ json: { posts } });
}

test.describe('§B3 post-view', () => {
  test('renders a single shared post in full', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getPosts*', (r) => mockGetPosts(r, [A1]));
    await page.goto(`/post.html?uri=${encodeURIComponent(A1.uri)}`);

    const post = page.locator(`[data-post-uri="${A1.uri}"]`);
    await expect(post).toBeVisible();
    await expect(post).toContainText('Welcome to the sky!');
    // Save + Share are present (both work with no account); no like control.
    await expect(post.locator('[data-save-btn]')).toHaveCount(1);
    await expect(post.locator('[data-share-btn]')).toHaveCount(1);
    await expect(post.locator('[data-like-btn]')).toHaveCount(0);
  });

  test('applies the label floor — a labeled post is not available', async ({ page }) => {
    const labeled = { ...A1, labels: [{ val: 'porn', src: 'did:plc:mod' }] };
    await page.route('**/xrpc/app.bsky.feed.getPosts*', (r) => mockGetPosts(r, [labeled]));
    await page.goto(`/post.html?uri=${encodeURIComponent(A1.uri)}`);
    await expect(page.locator('[data-post-status="unavailable"]')).toBeVisible();
    await expect(page.getByText('Welcome to the sky!')).toHaveCount(0);
  });

  test('a missing post reads as not available', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getPosts*', (r) => mockGetPosts(r, []));
    await page.goto(`/post.html?uri=${encodeURIComponent(A1.uri)}`);
    await expect(page.locator('[data-post-status="unavailable"]')).toBeVisible();
  });

  test('a malformed uri is rejected without a network read', async ({ page }) => {
    let called = false;
    await page.route('**/xrpc/app.bsky.feed.getPosts*', (r) => {
      called = true;
      return mockGetPosts(r, [A1]);
    });
    await page.goto('/post.html?uri=not-a-real-uri');
    await expect(page.locator('[data-post-status="empty"]')).toBeVisible();
    expect(called).toBe(false);
  });

  test('share targets the Skylite permalink via the native sheet', async ({ page }) => {
    await page.route('**/xrpc/app.bsky.feed.getPosts*', (r) => mockGetPosts(r, [A1]));
    // Install a fake Web Share API that records the payload.
    await page.addInitScript(() => {
      (window as unknown as { __shared?: unknown }).__shared = undefined;
      (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share = (data: ShareData) => {
        (window as unknown as { __shared?: unknown }).__shared = data;
        return Promise.resolve();
      };
    });
    await page.goto(`/post.html?uri=${encodeURIComponent(A1.uri)}`);
    await page.locator('[data-share-btn]').click();

    const shared = await page.evaluate(() => (window as unknown as { __shared?: { url?: string } }).__shared);
    expect(shared?.url).toBe(`${new URL(page.url()).origin}/post.html?uri=${encodeURIComponent(A1.uri)}`);
  });
});
