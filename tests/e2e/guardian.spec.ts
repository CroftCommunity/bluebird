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

  test('signs in and publishes the config to the PDS (mocked)', async ({ page }) => {
    // Mock the atproto write endpoints — no real network / credentials.
    await page.route('**/xrpc/com.atproto.server.createSession', (r) =>
      r.fulfill({
        json: {
          did: 'did:plc:guardian',
          handle: 'guardian.test',
          accessJwt: 'a',
          refreshJwt: 'r',
          didDoc: {
            id: 'did:plc:guardian',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.host.bsky.network' }],
          },
        },
      }),
    );
    let putBody: unknown;
    await page.route('**/xrpc/com.atproto.repo.putRecord', (r) => {
      putBody = r.request().postDataJSON();
      return r.fulfill({ json: { uri: 'at://did:plc:guardian/ing.croft.skylite.config/self', cid: 'c' } });
    });

    await page.goto('/guardian.html');
    await page.getByPlaceholder('handle or email').fill('guardian.test');
    await page.getByPlaceholder('app password (xxxx-xxxx-xxxx-xxxx)').fill('abcd-efgh-ijkl-mnop');
    await page.getByRole('button', { name: 'Sign in & publish' }).click();

    await expect(page.locator('[data-publish-msg]')).toContainText('Published as @guardian.test');
    // The publish fills the guardian DID for the device link.
    await expect(page.getByPlaceholder('did:plc:… (guardian DID)')).toHaveValue('did:plc:guardian');
    // The password field is cleared after publishing.
    await expect(page.getByPlaceholder('app password (xxxx-xxxx-xxxx-xxxx)')).toHaveValue('');
    expect((putBody as { collection: string }).collection).toBe('ing.croft.skylite.config');
  });
});
