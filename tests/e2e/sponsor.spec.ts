import { test, expect } from '@playwright/test';

// Hermetic: the sponsor dashboard is pure local authoring — no network at all.

test.describe('Sponsor multi-explorer dashboard (S2)', () => {
  test('shows the security checklist and a sponsor identity section', async ({ page }) => {
    await page.goto('/sponsor.html');
    await expect(page.getByRole('heading', { name: 'First, secure your account' })).toBeVisible();
    await expect(page.getByText('Turn on email 2FA')).toBeVisible();
    await expect(page.getByText('revoke device sessions')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'You (the sponsor)' })).toBeVisible();
    // No app-password fields anywhere.
    await expect(page.getByPlaceholder(/app password/i)).toHaveCount(0);
  });

  test('creates two explorers side by side, each with its own random rkey', async ({ page }) => {
    await page.goto('/sponsor.html');
    await page.locator('[data-add-explorer]').click();
    await page.locator('[data-add-explorer]').click();
    const cards = page.locator('[data-explorer]');
    await expect(cards).toHaveCount(2);
    const rkeys = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-explorer')));
    // Random, distinct, TID-shaped (13 base32-sortable chars).
    expect(rkeys[0]).not.toBe(rkeys[1]);
    for (const k of rkeys) expect(k).toMatch(/^[234567a-z]{13}$/);
  });

  test('editing a nickname updates the card and the exported record body', async ({ page }) => {
    await page.goto('/sponsor.html');
    await page.locator('[data-add-explorer]').click();
    const card = page.locator('[data-explorer]').first();
    await card.getByPlaceholder('e.g. Little Bear').fill('Comet');
    await expect(card.locator('[data-explorer-name]')).toHaveText('Comet');
    await expect(card.locator('[data-record-json]')).toHaveValue(/"displayName": "Comet"/);
    // The two switches default correctly in the record.
    await expect(card.locator('[data-record-json]')).toHaveValue(/"localOnly": true/);
    await expect(card.locator('[data-record-json]')).toHaveValue(/"skin": "simple"/);
  });

  test('a per-explorer provisioning link carries the sponsor DID and the record rkey', async ({ page }) => {
    await page.goto('/sponsor.html');
    await page.getByPlaceholder('did:plc:… (your sponsor DID)').fill('did:plc:sponsor1');
    await page.locator('[data-apply-identity]').click();
    await page.locator('[data-add-explorer]').click();

    const card = page.locator('[data-explorer]').first();
    const rkey = await card.getAttribute('data-explorer');
    const link = await card.locator('[data-provision-link]').inputValue();
    expect(link).toContain('s=did%3Aplc%3Asponsor1');
    expect(link).toContain(`r=${rkey}`);
  });

  test('explorers persist across reloads and can be removed', async ({ page }) => {
    await page.goto('/sponsor.html');
    await page.locator('[data-add-explorer]').click();
    await expect(page.locator('[data-explorer]')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('[data-explorer]')).toHaveCount(1);

    page.on('dialog', (d) => void d.accept());
    await page.locator('[data-remove-explorer]').click();
    await expect(page.locator('[data-explorer]')).toHaveCount(0);
    await expect(page.locator('[data-no-explorers]')).toBeVisible();
  });

  test('flipping the localOnly switch is reflected in the record', async ({ page }) => {
    await page.goto('/sponsor.html');
    await page.locator('[data-add-explorer]').click();
    const card = page.locator('[data-explorer]').first();
    await card.locator('.g-toggle--big input[type="checkbox"]').first().uncheck(); // localOnly off
    await expect(card.locator('[data-record-json]')).toHaveValue(/"localOnly": false/);
  });
});
