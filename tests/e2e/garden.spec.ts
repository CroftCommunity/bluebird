import { test, expect, type Route } from '@playwright/test';
import { FIXTURE_FEEDS, FIXTURE_POSTS } from '../fixtures/authorFeed.js';
import { seedExplorer } from './helpers.js';

// Hermetic: every getAuthorFeed call is fulfilled from local fixtures, so the
// garden renders with zero network. Drives the real built bundle from dist/.

async function mockAppView(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const actor = url.searchParams.get('actor') ?? '';
  const body = FIXTURE_FEEDS[actor] ?? { feed: [] };
  await route.fulfill({ json: body });
}

test.describe('Phase 1 garden (hermetic)', () => {
  test.beforeEach(async ({ page }) => {
    await seedExplorer(page); // set-up device → `/` opens the garden, not the landing
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', mockAppView);
  });

  test('renders the merged garden newest-first', async ({ page }) => {
    await page.goto('/');
    const posts = page.locator('[data-post-uri]');
    await expect(posts).toHaveCount(4); // A1, B1, C1, A2 — hidden + repost excluded
    // Newest first: A1 then A2 last.
    await expect(posts.first()).toContainText('Welcome to the sky!');
    await expect(posts.last()).toContainText('Read more at our site');
  });

  test('applies the D3 label backstop and the inclusion ceiling', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-garden-list]')).toBeVisible();
    // Labeled post is hidden; reposted outside content never appears.
    await expect(page.getByText('THIS POST MUST BE HIDDEN')).toHaveCount(0);
    await expect(page.getByText('REPOSTED CONTENT FROM OUTSIDE')).toHaveCount(0);
  });

  test('renders image alt text and an external link card (domain only)', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('img.post__image');
    await expect(img).toHaveAttribute('alt', 'The crescent moon over a dark sky');
    const card = page.locator('.post__external');
    await expect(card).toContainText('example.com');
    await expect(card).toContainText('A Story About Stars');
  });

  test('D7: tapping an external link opens the leave interstitial', async ({ page }) => {
    await page.goto('/');
    await page.locator('.post__external').click();
    const overlay = page.locator('[data-leave-overlay]');
    await expect(overlay).toBeVisible();
    await expect(page.locator('[data-leave-domain]')).toHaveText('example.com');
    // Staying dismisses without navigating.
    await page.locator('[data-leave-stay]').click();
    await expect(overlay).toHaveCount(0);
    expect(page.url()).toContain('localhost');
  });

  test('D7: an in-text link is also gated', async ({ page }) => {
    await page.goto('/');
    // The A2 post has a link facet on "our site".
    const linkBtn = page.locator('button.seg--link', { hasText: 'our site' });
    await expect(linkBtn).toBeVisible();
    await linkBtn.click();
    await expect(page.locator('[data-leave-overlay]')).toBeVisible();
  });

  test('still shows the build version stamp', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-version-stamp]')).toHaveText(/^v1 \d+\.\d+\.\d+\+\S+$/);
  });

  test('shows an error state when every author fails', async ({ page }) => {
    // 400 is non-retryable, so all authors fail fast (no backoff loop).
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r) => r.fulfill({ status: 400, body: 'x' }));
    await page.goto('/');
    await expect(page.locator('[data-garden-status="error"]')).toBeVisible();
    // sanity: the fixture posts are not present
    await expect(page.getByText(FIXTURE_POSTS.A1.record.text)).toHaveCount(0);
  });
});
