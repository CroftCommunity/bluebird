import { test, expect, type Route, type Page } from '@playwright/test';
import { FIXTURE_FEEDS } from '../fixtures/authorFeed.js';
import { seedExplorer } from './helpers.js';

// §D1 My Sky + follows. Hermetic: getAuthorFeed is served from fixtures for both
// handle actors (the garden) and DID actors (My Sky reads followed DIDs). Proves
// the device-local follow loop end-to-end with NO account — following works in
// localOnly by design.

const BSKY_DID = 'did:plc:bskyapp'; // fixture profile DID for handle 'bsky.app'

// Map a getAuthorFeed actor (handle OR did) back to the fixture key.
function feedFor(actor: string): unknown {
  if (actor.startsWith('did:')) {
    if (actor.includes('bskyapp')) return FIXTURE_FEEDS['bsky.app'];
    if (actor.includes('atprotocom')) return FIXTURE_FEEDS['atproto.com'];
    if (actor.includes('safetybskyapp')) return FIXTURE_FEEDS['safety.bsky.app'];
  }
  return FIXTURE_FEEDS[actor] ?? { feed: [] };
}

async function mockFeeds(page: Page): Promise<void> {
  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => {
    const actor = new URL(r.request().url()).searchParams.get('actor') ?? '';
    return r.fulfill({ json: feedFor(actor) });
  });
}

test.describe('§D1 My Sky (device-local follows, no account)', () => {
  test.beforeEach(async ({ page }) => {
    await seedExplorer(page); // localOnly — follows still work
    await mockFeeds(page);
  });

  test('following an author in the garden adds them to My Sky', async ({ page }) => {
    await page.goto('/');
    const followBtn = page.locator(`[data-follow-btn="${BSKY_DID}"]`).first();
    await expect(followBtn).toHaveText('＋ Follow');
    await followBtn.click();
    await expect(followBtn).toHaveText('✓ In My Sky');
    await expect(followBtn).toHaveAttribute('aria-pressed', 'true');

    // My Sky now shows that author's posts (read by DID, no account).
    await page.goto('/mysky.html');
    await expect(page.getByText('Welcome to the sky!')).toBeVisible();
    await expect(page.locator('[data-mysky-empty]')).toHaveCount(0);
  });

  test('My Sky is empty until you follow someone', async ({ page }) => {
    await page.goto('/mysky.html');
    await expect(page.locator('[data-mysky-empty]')).toBeVisible();
  });

  test('unfollowing from My Sky drops the author', async ({ page }) => {
    // Seed a follow via the garden first.
    await page.goto('/');
    await page.locator(`[data-follow-btn="${BSKY_DID}"]`).first().click();

    await page.goto('/mysky.html');
    const followBtn = page.locator(`[data-follow-btn="${BSKY_DID}"]`).first();
    await expect(followBtn).toHaveText('✓ In My Sky');
    await followBtn.click(); // unfollow → onChange re-renders My Sky
    await expect(page.locator('[data-mysky-empty]')).toBeVisible();
  });
});
