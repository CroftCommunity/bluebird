import { test, expect, type Route } from '@playwright/test';
import { EMBED_FIXTURE_FEEDS } from '../fixtures/embeds.js';
import { seedExplorer } from './helpers.js';

// Hermetic DOM-level proof of the §3 embed invariants. Each getAuthorFeed call
// is fulfilled from local fixtures; the real built bundle renders from dist/.

async function mockAppView(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const actor = url.searchParams.get('actor') ?? '';
  await route.fulfill({ json: EMBED_FIXTURE_FEEDS[actor] ?? { feed: [] } });
}

test.describe('§3 embed invariants (hermetic)', () => {
  test.beforeEach(async ({ page }) => {
    await seedExplorer(page);
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', mockAppView);
  });

  test('labeled-embed-never-renders: a labeled quote is absent, its host post remains', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-garden-list]')).toBeVisible();

    // The three host posts all render...
    await expect(page.getByText('GARDEN-POST-CLEAN')).toHaveCount(1);
    await expect(page.getByText('GARDEN-POST-LABELEDQUOTE')).toHaveCount(1);
    await expect(page.getByText('GARDEN-POST-LABELEDAUTHOR')).toHaveCount(1);

    // ...but only the clean quote renders a quote block. The labeled quote and
    // the labeled-author quote render NO quote block at all.
    await expect(page.locator('[data-quote]')).toHaveCount(1);
    // The quoted body text never appears for the labeled embeds. It appears once
    // (for the clean quote).
    await expect(page.getByText('QUOTED-EMBED-BODY')).toHaveCount(1);
  });

  test('navigation-wall-blocks-embed-browsing: a quote is inert, never a link into the outside feed', async ({
    page,
  }) => {
    await page.goto('/');
    const quote = page.locator('[data-quote]');
    await expect(quote).toHaveCount(1);

    // The quote author is rendered as inert text — not an anchor, not a button.
    const author = page.locator('[data-quote-author]');
    await expect(author).toHaveText(/Outside Author/);
    expect(await author.evaluate((el) => el.tagName)).toBe('SPAN');

    // No element anywhere inside the quote is a link or button (no door out to
    // the outside author's feed). The only deliberate path in is follow-to-My-Sky.
    await expect(quote.locator('a')).toHaveCount(0);
    await expect(quote.locator('button')).toHaveCount(0);
  });
});
