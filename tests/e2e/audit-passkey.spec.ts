import { test, expect, type Route } from '@playwright/test';
import { seal } from '../../src/crypto/sealedbox.js';

// §Verify-in-run (now hermetic via a virtual authenticator): the WebAuthn-PRF
// vault path. A platform passkey/biometric (here a CDP virtual authenticator
// with PRF) protects the sponsor's audit private key — no passphrase. Proves the
// whole loop: enable-with-passkey → seal → unlock-with-passkey → decrypt.

const KID_DID = 'did:plc:kidaccount';
const KID_PDS = 'https://pds.host.bsky.network';

test('sponsor enables + reads encrypted history with a passkey (no passphrase)', async ({ page }) => {
  // A virtual platform authenticator with PRF (hmac-secret) + auto user-verification.
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      hasPrf: true,
      automaticPresenceSimulation: true,
      isUserVerified: true,
    },
  });

  // 1. Enable the archive with the device passkey (no passphrase entered).
  await page.goto('/sponsor.html');
  await page.locator('[data-add-explorer]').click();
  const rkey = await page.locator('[data-explorer]').first().getAttribute('data-explorer');
  const control = page.locator('[data-archive-control]');
  await control.locator('[data-archive-on-passkey]').click();
  await expect(control.locator('[data-archive-off]')).toBeVisible();

  const vaultMethod = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('skylite.audit.vault') ?? '{}') as { method?: string }).method,
  );
  expect(vaultMethod).toBe('webauthn-prf');

  // 2. Seal a search to the published public key (as the explorer's device would).
  const pubKeyJwk = await page.evaluate((): JsonWebKey => {
    const v = JSON.parse(localStorage.getItem('skylite.audit.vault') ?? '{}') as { publicKeyJwk: JsonWebKey };
    return v.publicKeyJwk;
  });
  const box = await seal(JSON.stringify({ q: 'volcanoes', blocked: false, tier: 'open' }), pubKeyJwk);
  const sealedRecord = {
    uri: `at://${KID_DID}/ing.croft.skylite.search/1`,
    cid: 'c1',
    value: { enc: box, createdAt: '2026-07-15T00:00:00.000Z' },
  };

  // 3. Mock the public reads.
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (r: Route) => r.fulfill({ json: { did: KID_DID } }));
  await page.route(`**/plc.directory/${KID_DID}`, (r: Route) =>
    r.fulfill({
      json: { id: KID_DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: KID_PDS }] },
    }),
  );
  await page.route('**/xrpc/com.atproto.repo.listRecords*', (r: Route) => r.fulfill({ json: { records: [sealedRecord] } }));
  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill({ json: { feed: [] } }));

  // 4. Read it back — unlock with the passkey, no passphrase field at all.
  await page.goto(`/audit.html?r=${rkey}`);
  const section = page.locator('[data-history-section]');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-history-pass]')).toHaveCount(0); // passkey vault → no passphrase input
  await section.locator('[data-history-handle]').fill('kid.bsky.social');
  await section.locator('[data-history-show]').click();

  await expect(page.locator('[data-history-list]')).toContainText('volcanoes');
});
