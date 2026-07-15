import { test, expect, type Route } from '@playwright/test';
import { seal } from '../../src/crypto/sealedbox.js';

// §Phase 3B — the whole encrypted-archive loop, end to end and hermetic:
// sponsor enables the archive (creates the vault + publishes the public key) →
// a search is sealed to that public key (done here in Node) → the audit view
// reads the sealed record, unlocks the vault with the passphrase, and DECRYPTS
// it to clear text that only this device can read.

const KID_DID = 'did:plc:kidaccount';
const KID_PDS = 'https://pds.host.bsky.network';

test('sponsor decrypts an explorer’s encrypted search history', async ({ page }) => {
  // 1. Enable the archive on the sponsor device.
  await page.goto('/sponsor.html');
  await page.locator('[data-add-explorer]').click();
  const rkey = await page.locator('[data-explorer]').first().getAttribute('data-explorer');
  const control = page.locator('[data-archive-control]');
  await control.locator('[data-archive-pass]').fill('history-pass');
  await control.locator('[data-archive-on]').click();
  await expect(control.locator('[data-archive-off]')).toBeVisible();

  // 2. Read the published public key and seal a search to it (as the explorer would).
  const pubKeyJwk = await page.evaluate((): JsonWebKey => {
    const v = JSON.parse(localStorage.getItem('skylite.audit.vault') ?? '{}') as { publicKeyJwk: JsonWebKey };
    return v.publicKeyJwk;
  });
  const box = await seal(JSON.stringify({ q: 'volcanoes', blocked: false, tier: 'open' }), pubKeyJwk);
  const sealedRecord = { uri: `at://${KID_DID}/ing.croft.skylite.search/1`, cid: 'c1', value: { enc: box, createdAt: '2026-07-15T00:00:00.000Z' } };

  // 3. Mock the public reads the audit view makes.
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (r: Route) => r.fulfill({ json: { did: KID_DID } }));
  await page.route(`**/plc.directory/${KID_DID}`, (r: Route) =>
    r.fulfill({
      json: { id: KID_DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: KID_PDS }] },
    }),
  );
  await page.route('**/xrpc/com.atproto.repo.listRecords*', (r: Route) => r.fulfill({ json: { records: [sealedRecord] } }));
  // The label-audit replay also runs on this page; keep it quiet.
  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill({ json: { feed: [] } }));

  // 4. Open the audit view for this explorer and decrypt.
  await page.goto(`/audit.html?r=${rkey}`);
  const section = page.locator('[data-history-section]');
  await expect(section).toBeVisible();
  await section.locator('[data-history-handle]').fill('kid.bsky.social');
  await section.locator('[data-history-pass]').fill('history-pass');
  await section.locator('[data-history-show]').click();

  // The sealed query is decrypted to clear text — readable only on this device.
  await expect(page.locator('[data-history-list]')).toContainText('volcanoes');
});

test('a wrong passphrase cannot decrypt the history', async ({ page }) => {
  await page.goto('/sponsor.html');
  await page.locator('[data-add-explorer]').click();
  const rkey = await page.locator('[data-explorer]').first().getAttribute('data-explorer');
  const control = page.locator('[data-archive-control]');
  await control.locator('[data-archive-pass]').fill('the-real-pass');
  await control.locator('[data-archive-on]').click();
  await expect(control.locator('[data-archive-off]')).toBeVisible();

  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill({ json: { feed: [] } }));
  await page.goto(`/audit.html?r=${rkey}`);
  const section = page.locator('[data-history-section]');
  await section.locator('[data-history-handle]').fill('kid.bsky.social');
  await section.locator('[data-history-pass]').fill('WRONG');
  await section.locator('[data-history-show]').click();
  await expect(section.locator('[data-history-msg]')).toContainText('didn’t work');
});
