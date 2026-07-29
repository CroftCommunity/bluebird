import { test, expect } from '@playwright/test';

// §Phase 3A — the sponsor turns ON the encrypted search-history archive. Pure
// local authoring (no network): create the audit keypair (passphrase-protected)
// and publish its public key into the explorer's config.

test.describe('§Phase 3 sponsor: enable encrypted search history', () => {
  test('creating the audit key publishes a public key into the config', async ({ page }) => {
    await page.goto('/patrol.html');
    await page.locator('[data-add-explorer]').click();

    const control = page.locator('[data-archive-control]');
    await expect(control.locator('[data-archive-on]')).toBeVisible();
    // Phase 5: the enable copy may say "bank-grade encryption" (honest — same
    // primitives as banking), and never claims an absolute like "unbreakable".
    await expect(control).toContainText('bank-grade encryption');

    await control.locator('[data-archive-pass]').fill('a good passphrase');
    await control.locator('[data-archive-on]').click();

    // Flips to the ON state.
    await expect(control.locator('[data-archive-off]')).toBeVisible();
    await expect(control).toContainText('Encrypted history is ON');

    // The config the sponsor would publish now carries a PUBLIC audit key
    // (never a private scalar).
    const vault = await page.evaluate(() => localStorage.getItem('bluebird.audit.vault'));
    expect(vault).toContain('"kty":"EC"');
    const explorers = await page.evaluate(() => localStorage.getItem('bluebird.sponsor.explorers'));
    expect(explorers).toContain('auditPubKeyJwk');
    expect(explorers).toContain('"crv":"P-256"');
    expect(explorers).not.toContain('"d":'); // the published config never holds the private key
  });

  test('turning it off removes the key from the config', async ({ page }) => {
    await page.goto('/patrol.html');
    await page.locator('[data-add-explorer]').click();
    const control = page.locator('[data-archive-control]');
    await control.locator('[data-archive-pass]').fill('another passphrase');
    await control.locator('[data-archive-on]').click();
    await expect(control.locator('[data-archive-off]')).toBeVisible();

    await control.locator('[data-archive-off]').click();
    await expect(control.locator('[data-archive-on]')).toBeVisible();
    const explorers = await page.evaluate(() => localStorage.getItem('bluebird.sponsor.explorers'));
    expect(explorers).not.toContain('auditPubKeyJwk');
  });
});
