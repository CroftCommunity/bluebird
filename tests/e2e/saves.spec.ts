import { test, expect, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

// D4 Saves — local IndexedDB. Hermetic: garden served from a single mocked
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

test.describe('Saves (D4)', () => {
  test.beforeEach(async ({ page }) => {
    await localConfig(page);
    await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill({ json: feed('CLIP ME') }));
  });

  test('save a post, see it in the saves, note it, then remove it', async ({ page }) => {
    await page.goto('/');
    const saveBtn = page.locator('[data-save-btn]').first();
    await expect(saveBtn).toHaveText('☆ Save');
    await saveBtn.click();
    await expect(saveBtn).toHaveText('★ Saved');

    // The clip is in the saves.
    await page.goto('/saves.html');
    const clip = page.locator('[data-clip]');
    await expect(clip).toHaveCount(1);
    await expect(clip).toContainText('CLIP ME');
    await expect(clip).toContainText('Ada');

    // A private note persists across reloads.
    await page.locator('[data-clip-note]').fill('want to draw this');
    await page.reload();
    await expect(page.locator('[data-clip-note]')).toHaveValue('want to draw this');

    // Remove empties the saves.
    await page.locator('.clip__remove').click();
    await expect(page.locator('[data-saves-empty]')).toBeVisible();
  });

  test('S5: back up saves, then restore them on a fresh device', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-save-btn]').first().click();
    await expect(page.locator('[data-save-btn]').first()).toHaveText('★ Saved');

    await page.goto('/saves.html');
    await expect(page.locator('[data-clip]')).toHaveCount(1);

    // Export → capture the downloaded backup file.
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-backup-export]').click();
    const download = await downloadPromise;
    const path = await download.path();
    const buffer = readFileSync(path);
    const backup = JSON.parse(buffer.toString()) as { $schema: string; saves: unknown[] };
    expect(backup.$schema).toBe('skylite.backup');
    expect(backup.saves).toHaveLength(1);

    // Simulate a fresh device: wipe the local Saves store.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase('skylite-saves');
          req.onsuccess = req.onerror = req.onblocked = (): void => resolve();
        }),
    );
    await page.reload();
    await expect(page.locator('[data-saves-empty]')).toBeVisible();

    // Import the backup → the clip and its origin return.
    await page.locator('[data-backup-import]').setInputFiles({
      name: 'skylite-backup.json',
      mimeType: 'application/json',
      buffer,
    });
    await expect(page.locator('[data-clip]')).toHaveCount(1);
    await expect(page.locator('[data-clip]')).toContainText('CLIP ME');
    await expect(page.locator('[data-backup-msg]')).toContainText('Restored 1 saved post');
  });

  test('saved state is reflected back in the garden', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-save-btn]').first().click();
    await page.goto('/saves.html');
    await page.goto('/');
    // On return, the button shows saved (async mark).
    await expect(page.locator('[data-save-btn]').first()).toHaveText('★ Saved');
  });
});
