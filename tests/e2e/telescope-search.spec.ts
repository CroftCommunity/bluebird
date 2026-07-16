import { test, expect, type Route, type Page } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// §Telescope rung 2 — search. Hermetic: searchPosts + getFeed served from
// fixtures. Proves the trust-gradient: tier gating, the blocklist/allowlist,
// the label floor on results, discovery author-bounding, and history logging.

const OPEN = { tier: 'open', useAllowlist: false, allowlistExtra: [], useBlocklist: true, blocklistExtra: [], logHistory: true };
const FEED = 'at://did:plc:gen/app.bsky.feed.generator/kids';

function post(rkey: string, did: string, name: string, text: string, labels?: unknown[]) {
  return {
    uri: `at://${did}/app.bsky.feed.post/${rkey}`,
    cid: `cid-${rkey}`,
    author: { did, handle: `${name.toLowerCase()}.test`, displayName: name },
    record: { text, createdAt: '2026-07-14T10:00:00.000Z' },
    indexedAt: '2026-07-14T10:00:00.000Z',
    ...(labels ? { labels } : {}),
  };
}

async function mockSearch(page: Page, posts: unknown[]): Promise<void> {
  await page.route('**/xrpc/app.bsky.feed.searchPosts*', (r: Route) => r.fulfill({ json: { posts } }));
}

test.describe('§Telescope search', () => {
  test('tier off shows no search box', async ({ page }) => {
    await seedExplorer(page, { approvedFeeds: [{ uri: FEED, name: 'Kids' }] }); // search tier defaults off
    await page.route('**/xrpc/app.bsky.feed.getFeed*', (r: Route) => r.fulfill({ json: { feed: [] } }));
    await page.goto('/telescope.html');
    await expect(page.locator('[data-search-input]')).toHaveCount(0);
  });

  test('open tier: an allowed query returns label-floored results with follow controls', async ({ page }) => {
    await seedExplorer(page, { search: OPEN });
    await mockSearch(page, [
      post('r1', 'did:plc:carl', 'Carl', 'A photo of Saturn.'),
      post('r2', 'did:plc:bad', 'Bad', 'HIDE ME', [{ val: 'porn', src: 'did:plc:mod' }]),
    ]);
    await page.goto('/telescope.html');
    await page.locator('[data-search-input]').fill('space');
    await page.locator('[data-search-go]').click();

    await expect(page.getByText('A photo of Saturn.')).toBeVisible();
    await expect(page.getByText('HIDE ME')).toHaveCount(0); // label floor on results
    await expect(page.locator('[data-search-results] [data-follow-btn="did:plc:carl"]')).toBeVisible();
  });

  test('a blocked query is refused, not searched, and logged as blocked', async ({ page }) => {
    await seedExplorer(page, { search: OPEN });
    let searched = false;
    await page.route('**/xrpc/app.bsky.feed.searchPosts*', (r: Route) => {
      searched = true;
      return r.fulfill({ json: { posts: [] } });
    });
    await page.goto('/telescope.html');
    await page.locator('[data-search-input]').fill('nsfw stuff');
    await page.locator('[data-search-go]').click();

    await expect(page.locator('[data-search-msg]')).toContainText("isn't allowed");
    expect(searched).toBe(false); // never hit the network
    // Logged (blocked) in the visible recent-searches — the role reads "sponsor".
    await expect(page.locator('[data-search-history]')).toContainText('blocked');
    await expect(page.locator('[data-search-history] summary')).toHaveText('Recent searches (your sponsor can see these)');
  });

  test('allowlist on: only approved topics run', async ({ page }) => {
    await seedExplorer(page, { search: { ...OPEN, useAllowlist: true } });
    await mockSearch(page, [post('r1', 'did:plc:carl', 'Carl', 'Dinosaur bones!')]);
    await page.goto('/telescope.html');

    await page.locator('[data-search-input]').fill('dinosaurs');
    await page.locator('[data-search-go]').click();
    await expect(page.getByText('Dinosaur bones!')).toBeVisible();

    await page.locator('[data-search-input]').fill('celebrity gossip');
    await page.locator('[data-search-go]').click();
    await expect(page.locator('[data-search-msg]')).toContainText('topic like');
  });

  test('discovery tier bounds results to approved-feed authors', async ({ page }) => {
    await seedExplorer(page, {
      search: { ...OPEN, tier: 'discovery' },
      approvedFeeds: [{ uri: FEED, name: 'Kids' }],
    });
    // The approved feed surfaces only Carl.
    await page.route('**/xrpc/app.bsky.feed.getFeed*', (r: Route) =>
      r.fulfill({ json: { feed: [{ post: post('f1', 'did:plc:carl', 'Carl', 'in the feed') }] } }),
    );
    // Search returns Carl (in-feed) AND Stranger (not).
    await mockSearch(page, [
      post('r1', 'did:plc:carl', 'Carl', 'Carl on comets'),
      post('r2', 'did:plc:stranger', 'Stranger', 'Stranger on comets'),
    ]);
    await page.goto('/telescope.html');
    await page.locator('[data-search-input]').fill('comets');
    await page.locator('[data-search-go]').click();

    await expect(page.getByText('Carl on comets')).toBeVisible();
    await expect(page.getByText('Stranger on comets')).toHaveCount(0); // outside the discovery ceiling
  });
});
