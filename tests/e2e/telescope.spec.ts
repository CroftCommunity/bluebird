import { test, expect, type Route } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// §D Telescope (rung 1: approved feeds). Hermetic: getFeed is served from a
// local fixture. Discovery shows outside authors, so the garden's safety layers
// must hold — label floor, no counts, and the D1 follow control to pull a
// discovered voice into My Sky.

const FEED_A = 'at://did:plc:gen/app.bsky.feed.generator/science';
const FEED_B = 'at://did:plc:gen/app.bsky.feed.generator/art';

function post(rkey: string, did: string, name: string, text: string, labels?: unknown[]) {
  return {
    post: {
      uri: `at://${did}/app.bsky.feed.post/${rkey}`,
      cid: `cid-${rkey}`,
      author: { did, handle: `${name.toLowerCase()}.test`, displayName: name },
      record: { text, createdAt: '2026-07-14T10:00:00.000Z' },
      indexedAt: '2026-07-14T10:00:00.000Z',
      ...(labels ? { labels } : {}),
    },
  };
}

const FEEDS: Record<string, unknown> = {
  [FEED_A]: {
    feed: [
      post('s1', 'did:plc:carl', 'Carl Sagan', 'The cosmos is all that is.'),
      post('s2', 'did:plc:bad', 'Bad Actor', 'THIS MUST BE HIDDEN', [{ val: 'porn', src: 'did:plc:mod' }]),
    ],
  },
  [FEED_B]: { feed: [post('a1', 'did:plc:frida', 'Frida', 'A painting of the sky.')] },
};

test.describe('§D Telescope (approved feeds)', () => {
  async function mockFeed(page: import('@playwright/test').Page): Promise<void> {
    await page.route('**/xrpc/app.bsky.feed.getFeed*', (r: Route) => {
      const feed = new URL(r.request().url()).searchParams.get('feed') ?? '';
      return r.fulfill({ json: FEEDS[feed] ?? { feed: [] } });
    });
  }

  test('browses an approved feed under the label floor, with follow controls', async ({ page }) => {
    await seedExplorer(page, {
      approvedFeeds: [
        { uri: FEED_A, name: 'Science' },
        { uri: FEED_B, name: 'Art' },
      ],
    });
    await mockFeed(page);
    await page.goto('/telescope.html');

    // The picker lists the approved feeds; the first is current.
    const picker = page.locator('[data-telescope-picker]');
    await expect(picker.getByText('Science')).toBeVisible();
    await expect(picker.getByText('Art')).toBeVisible();

    // The first feed's clean post renders; the labeled one is floored out.
    await expect(page.getByText('The cosmos is all that is.')).toBeVisible();
    await expect(page.getByText('THIS MUST BE HIDDEN')).toHaveCount(0);

    // A discovered author carries the follow-to-My-Sky control (D1).
    await expect(page.locator('[data-follow-btn="did:plc:carl"]')).toBeVisible();

    // Switching feeds loads the other one.
    await picker.getByText('Art').click();
    await expect(page.getByText('A painting of the sky.')).toBeVisible();
    await expect(page.getByText('The cosmos is all that is.')).toHaveCount(0);
  });

  test('following a discovered author adds them to My Sky', async ({ page }) => {
    await seedExplorer(page, { approvedFeeds: [{ uri: FEED_A, name: 'Science' }] });
    await mockFeed(page);
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => {
      const actor = new URL(r.request().url()).searchParams.get('actor') ?? '';
      return r.fulfill({
        json: actor.includes('carl')
          ? { feed: [post('s1', 'did:plc:carl', 'Carl Sagan', 'The cosmos is all that is.')] }
          : { feed: [] },
      });
    });
    await page.goto('/telescope.html');
    await page.locator('[data-follow-btn="did:plc:carl"]').click();
    await page.goto('/mysky.html');
    await expect(page.locator('[data-mysky-header]')).toContainText('Carl Sagan');
  });

  test('with no approved feeds, Telescope says so plainly', async ({ page }) => {
    await seedExplorer(page); // approvedFeeds: []
    await mockFeed(page);
    await page.goto('/telescope.html');
    await expect(page.locator('[data-telescope-status="empty"]')).toBeVisible();
  });
});
