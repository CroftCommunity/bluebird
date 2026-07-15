import { test, expect, type Route } from '@playwright/test';
import { seedExplorer } from './helpers.js';

// §Telescope encrypted archive (phase 2), hermetic. The actual sealed write to a
// PDS needs a real OAuth session (verify-in-run, like likes/follows); here we
// prove the config exchange + honesty copy, and that with no session the search
// still works and no record write is attempted.

const AUDIT_PUBKEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 'IV2KepBHG_Cqztv6ibhxS_owAAZ_N5gNvpianVRereg',
  y: 'e7ErMeyIA772-0pm9polKMcbdVO09icWXg7d80XT9rc',
};

const OPEN_ARCHIVE = {
  tier: 'open',
  useAllowlist: false,
  allowlistExtra: [],
  useBlocklist: true,
  blocklistExtra: [],
  logHistory: true,
  auditPubKeyJwk: AUDIT_PUBKEY,
};

test.describe('§Telescope encrypted archive', () => {
  test('shows the "stored scrambled" honesty note when the archive is on', async ({ page }) => {
    await seedExplorer(page, { search: OPEN_ARCHIVE });
    await page.route('**/xrpc/app.bsky.feed.searchPosts*', (r: Route) => r.fulfill({ json: { posts: [] } }));
    await page.goto('/telescope.html');
    await expect(page.locator('[data-archive-note]')).toContainText('stored scrambled');
  });

  test('with no account, search still works and writes no record', async ({ page }) => {
    await seedExplorer(page, { search: OPEN_ARCHIVE }); // localOnly → no session
    let wrote = false;
    await page.route('**/xrpc/com.atproto.repo.createRecord*', (r: Route) => {
      wrote = true;
      return r.fulfill({ json: {} });
    });
    await page.route('**/xrpc/app.bsky.feed.searchPosts*', (r: Route) =>
      r.fulfill({
        json: {
          posts: [
            {
              uri: 'at://did:plc:carl/app.bsky.feed.post/r1',
              cid: 'c',
              author: { did: 'did:plc:carl', handle: 'carl.test', displayName: 'Carl' },
              record: { text: 'Saturn', createdAt: '2026-07-14T10:00:00Z' },
              indexedAt: '2026-07-14T10:00:00Z',
            },
          ],
        },
      }),
    );
    await page.goto('/telescope.html');
    await page.locator('[data-search-input]').fill('space');
    await page.locator('[data-search-go]').click();
    await expect(page.getByText('Saturn')).toBeVisible();
    // The attempt is in the on-device history…
    await expect(page.locator('[data-search-history]')).toContainText('space');
    // …but no repo write was attempted (no session).
    expect(wrote).toBe(false);
  });
});
