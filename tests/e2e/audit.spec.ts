import { test, expect, type Route } from '@playwright/test';

// S7 sponsor label-audit — hermetic. Seed one explorer in the sponsor store,
// mock getAuthorFeed with a labeled post, and assert the replay counts it.

const RKEY = '3kabcdefghij2';

const HIDDEN_FEED = {
  feed: [
    {
      post: {
        uri: 'at://did:plc:a/app.bsky.feed.post/clean',
        cid: 'c1',
        author: { did: 'did:plc:a', handle: 'a.test', displayName: 'Ada' },
        record: { text: 'A perfectly nice post', createdAt: '2026-07-14T10:00:00.000Z' },
        indexedAt: '2026-07-14T10:00:00.000Z',
      },
    },
    {
      post: {
        uri: 'at://did:plc:a/app.bsky.feed.post/bad',
        cid: 'c2',
        author: { did: 'did:plc:a', handle: 'a.test', displayName: 'Ada' },
        record: { text: 'SHOULD BE HIDDEN', createdAt: '2026-07-14T11:00:00.000Z' },
        indexedAt: '2026-07-14T11:00:00.000Z',
        labels: [{ val: 'porn', src: 'did:plc:mod' }],
      },
    },
  ],
};

test.describe('S7 label audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (rkey) => {
        localStorage.setItem(
          'skylite.sponsor.explorers',
          JSON.stringify({
            [rkey]: {
              version: 2,
              displayName: 'Comet',
              localOnly: true,
              skin: 'simple',
              paused: false,
              updatedAt: '',
              channels: [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }],
              friends: [],
              showFriendsHearts: false,
              approvedFeeds: [],
              telescope: false,
              showReposts: false,
              staleHours: 72,
            },
          }),
        );
      },
      RKEY,
    );
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (route: Route) => route.fulfill({ json: HIDDEN_FEED }));
  });

  test('shows label meanings and replays the filter over public data', async ({ page }) => {
    await page.goto(`/audit.html?r=${RKEY}`);

    // (a) Meanings table is present with the labels Skylite acts on.
    await expect(page.locator('[data-audit-meanings]')).toContainText('porn');
    await expect(page.locator('[data-audit-meanings]')).toContainText('Hidden from the garden entirely.');

    // (b) Effectiveness: one hidden post for a.test, surfaced with a count.
    await expect(page.locator('[data-audit-results]')).toBeVisible();
    await expect(page.locator('[data-audit-total]')).toHaveText('1');
    await expect(page.locator('[data-audit-hidden="a.test"]')).toHaveText('1 hidden');
    // The honest framing is present.
    await expect(page.getByText('Nothing is collected from the explorer’s device.')).toBeVisible();
  });

  test('a missing explorer explains where to open the audit from', async ({ page }) => {
    await page.goto('/audit.html?r=nope');
    await expect(page.locator('[data-audit-missing]')).toBeVisible();
  });
});
