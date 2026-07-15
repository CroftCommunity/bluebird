import { test, expect, type Route } from '@playwright/test';

// D4 Scrapbook — local IndexedDB. Hermetic: garden served from a single mocked
// author so there's a post to save.

function feed(text: string): unknown {
  return {
    feed: [
      {
        post: {
          uri: 'at://did:plc:a/app.bsky.feed.post/clip1',
          cid: 'c',
          author: { did: 'did:plc:a', handle: 'a.test', displayName: 'Ada' },
          record: { text, createdAt: '2026-07-14T10:00:00.000Z' },
          indexedAt: '2026-07-14T10:00:00.000Z',
        },
      },
    ],
  };
}

async function localConfig(page: import('@playwright/test').Page): Promise<void> {
  // Unprovisioned would use the dev fixture (3 authors); pin to one local author.
  await page.addInitScript(() => {
    localStorage.setItem(
      'skylite.config.local',
      JSON.stringify({
        version: 1,
        paused: false,
        updatedAt: '',
        channels: [{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'a.test' }] }],
      }),
    );
  });
}

test.describe('Scrapbook (D4)', () => {
  test.beforeEach(async ({ page }) => {
    await localConfig(page);
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill({ json: feed('CLIP ME') }));
  });

  test('save a post, see it in the scrapbook, note it, then remove it', async ({ page }) => {
    await page.goto('/');
    const saveBtn = page.locator('[data-save-btn]').first();
    await expect(saveBtn).toHaveText('☆ Save');
    await saveBtn.click();
    await expect(saveBtn).toHaveText('★ Saved');

    // The clip is in the scrapbook.
    await page.goto('/scrapbook.html');
    const clip = page.locator('[data-clip]');
    await expect(clip).toHaveCount(1);
    await expect(clip).toContainText('CLIP ME');
    await expect(clip).toContainText('Ada');

    // A private note persists across reloads.
    await page.locator('[data-clip-note]').fill('want to draw this');
    await page.reload();
    await expect(page.locator('[data-clip-note]')).toHaveValue('want to draw this');

    // Remove empties the scrapbook.
    await page.locator('.clip__remove').click();
    await expect(page.locator('[data-scrapbook-empty]')).toBeVisible();
  });

  test('saved state is reflected back in the garden', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-save-btn]').first().click();
    await page.goto('/scrapbook.html');
    await page.goto('/');
    // On return, the button shows saved (async mark).
    await expect(page.locator('[data-save-btn]').first()).toHaveText('★ Saved');
  });
});
