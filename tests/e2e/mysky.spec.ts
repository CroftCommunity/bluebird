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
    // Friendly name (captured at follow time), never the raw DID.
    const header = page.locator('[data-mysky-header]');
    await expect(header).toContainText('In your sky: Bluesky');
    await expect(header).not.toContainText('did:plc');
  });

  test('My Sky is empty until you follow someone', async ({ page }) => {
    await page.goto('/mysky.html');
    await expect(page.locator('[data-mysky-empty]')).toBeVisible();
  });

  test('follow-from-quoted: an inert quoted author can be pulled into My Sky', async ({ page }) => {
    const QUOTED_DID = 'did:plc:quoted';
    // A garden post that quotes an outside author (record#view embed).
    const quotePost = {
      uri: 'at://did:plc:bskyapp/app.bsky.feed.post/q1',
      cid: 'cid-q1',
      author: { did: 'did:plc:bskyapp', handle: 'bsky.app', displayName: 'Bluesky' },
      record: { text: 'Look at this', createdAt: '2026-07-14T12:00:00.000Z' },
      indexedAt: '2026-07-14T12:00:00.000Z',
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewRecord',
          uri: 'at://did:plc:quoted/app.bsky.feed.post/z1',
          author: { did: QUOTED_DID, handle: 'quoted.example', displayName: 'Quoted Author' },
          value: { text: 'A quoted thought', createdAt: '2026-07-14T11:00:00.000Z' },
        },
      },
    };
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => {
      const actor = new URL(r.request().url()).searchParams.get('actor') ?? '';
      if (actor.includes('quoted')) {
        return r.fulfill({ json: { feed: [{ post: { ...quotePost, embed: undefined } }] } });
      }
      return r.fulfill({ json: { feed: [{ post: quotePost }] } });
    });

    await page.goto('/');
    // The quote block carries a follow control for the inert quoted author.
    const quote = page.locator('[data-quote]');
    await expect(quote.getByText('Quoted Author')).toBeVisible();
    const quoteFollow = quote.locator(`[data-follow-btn="${QUOTED_DID}"]`);
    await expect(quoteFollow).toHaveText('＋ Follow');
    await quoteFollow.click();
    await expect(quoteFollow).toHaveText('✓ In My Sky');

    // The quoted author is now in My Sky, by name.
    await page.goto('/mysky.html');
    await expect(page.locator('[data-mysky-header]')).toContainText('Quoted Author');
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
