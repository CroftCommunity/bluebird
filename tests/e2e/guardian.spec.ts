import { test, expect } from '@playwright/test';

// Hermetic: the guardian page is pure local authoring — no network at all.

test.describe('Guardian setup page', () => {
  test('renders the setup sections', async ({ page }) => {
    await page.goto('/guardian.html');
    await expect(page.getByRole('heading', { name: '1 · Pause switch' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2 · Channels' })).toBeVisible();
  });

  test('editing an account is reflected live in the exported JSON', async ({ page }) => {
    await page.goto('/guardian.html');
    const firstActor = page.locator('.g-account .g-input').first();
    await firstActor.fill('nasa.gov');
    const json = page.locator('textarea.g-json[readonly]');
    await expect(json).toHaveValue(/nasa\.gov/);
    await expect(json).toHaveValue(/"paused": false/);
  });

  test('toggling pause updates the exported record', async ({ page }) => {
    await page.goto('/guardian.html');
    await page.locator('.g-toggle--big input[type="checkbox"]').check();
    await expect(page.locator('textarea.g-json[readonly]')).toHaveValue(/"paused": true/);
  });

  test('makes a provisioning link from a DID', async ({ page }) => {
    await page.goto('/guardian.html');
    await page.getByPlaceholder('did:plc:… (guardian DID)').fill('did:plc:abc123');
    await page.getByRole('button', { name: 'Make device link' }).click();
    const link = page.locator('input.g-input[readonly]');
    await expect(link).toHaveValue(/[?&]g=did%3Aplc%3Aabc123/);
  });

  test('saves config to this device', async ({ page }) => {
    await page.goto('/guardian.html');
    await page.locator('.g-account .g-input').first().fill('nasa.gov');
    await page.getByRole('button', { name: 'Save to this device' }).click();
    const stored = await page.evaluate(() => localStorage.getItem('skylite.config.local'));
    expect(stored).toContain('nasa.gov');
  });
});
