import { test, expect, type Route } from '@playwright/test';

// S2 OAuth — hermetic end-to-end. The whole atproto OAuth chain is mocked with
// CSP-allowlisted hosts (bsky.social + *.bsky.network). The mocked authorize
// endpoint redirects back to the app with the state captured from the PAR body,
// so the real begin→redirect→callback→token→publish path runs unmodified. Only
// the live consent screen and server-side DPoP validation are out of scope here.

const DID = 'did:plc:alice';
const PDS = 'https://pds.host.bsky.network';
const AUTH = 'https://bsky.social';

function json(body: unknown, init: ResponseInit = {}): { status: number; headers: Record<string, string>; body: string } {
  return {
    status: (init.status as number) ?? 200,
    headers: { 'content-type': 'application/json', ...((init.headers as Record<string, string>) ?? {}) },
    body: JSON.stringify(body),
  };
}

test.describe('Sponsor OAuth (hermetic end-to-end)', () => {
  test('sign in with Bluesky, then publish an explorer record over DPoP', async ({ page }) => {
    let parState = '';
    let parRedirect = '';
    let putBody: Record<string, unknown> | null = null;

    // Discovery.
    await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (r: Route) => r.fulfill(json({ did: DID })));
    await page.route('**/plc.directory/did:plc:alice', (r: Route) =>
      r.fulfill(
        json({
          id: DID,
          service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }],
        }),
      ),
    );
    await page.route('**/.well-known/oauth-protected-resource', (r: Route) =>
      r.fulfill(json({ authorization_servers: [AUTH] })),
    );
    await page.route('**/.well-known/oauth-authorization-server', (r: Route) =>
      r.fulfill(
        json({
          issuer: AUTH,
          authorization_endpoint: `${AUTH}/oauth/authorize`,
          token_endpoint: `${AUTH}/oauth/token`,
          pushed_authorization_request_endpoint: `${AUTH}/oauth/par`,
        }),
      ),
    );

    // PAR — capture state + redirect_uri, then hand back a request_uri.
    await page.route('**/oauth/par', (r: Route) => {
      const params = new URLSearchParams(r.request().postData() ?? '');
      parState = params.get('state') ?? '';
      parRedirect = params.get('redirect_uri') ?? '';
      return r.fulfill(json({ request_uri: 'urn:ietf:params:oauth:request_uri:abc', expires_in: 60 }, { status: 201 }));
    });

    // Authorize — a real consent screen; here, redirect straight back with the code+state.
    await page.route('**/oauth/authorize*', (r: Route) => {
      const back = new URL(parRedirect);
      back.searchParams.set('code', 'AUTH_CODE');
      back.searchParams.set('state', parState);
      back.searchParams.set('iss', AUTH);
      return r.fulfill({ status: 302, headers: { location: back.toString() } });
    });

    // Token — DPoP-bound tokens; sub must match the resolved DID.
    await page.route('**/oauth/token', (r: Route) =>
      r.fulfill(json({ access_token: 'ACCESS', refresh_token: 'REFRESH', token_type: 'DPoP', sub: DID })),
    );

    // Write.
    await page.route('**/xrpc/com.atproto.repo.putRecord', (r: Route) => {
      putBody = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill(json({ uri: `at://${DID}/ing.croft.skylite.config/rk`, cid: 'bafy' }));
    });

    await page.goto('/sponsor.html');

    // Author one explorer before signing in (survives the redirect round-trip).
    await page.locator('[data-add-explorer]').click();
    await expect(page.locator('[data-explorer]')).toHaveCount(1);

    // Sign in with Bluesky.
    await page.locator('[data-signin-handle]').fill('alice.test');
    await page.locator('[data-signin-btn]').click();

    // After the round-trip we're signed in as the DID.
    await expect(page.locator('[data-signin="in"]')).toBeVisible();
    await expect(page.locator('[data-signin="in"]')).toContainText(DID);

    // Publish the explorer's record to the PDS.
    await page.locator('[data-publish-btn]').first().click();
    await expect(page.locator('[data-publish-msg]').first()).toContainText('Published');

    expect(putBody).not.toBeNull();
    expect((putBody as unknown as { collection: string }).collection).toBe('ing.croft.skylite.config');
    expect((putBody as unknown as { repo: string }).repo).toBe(DID);
  });

  test('a normal load is not treated as a callback', async ({ page }) => {
    await page.goto('/sponsor.html');
    await expect(page.locator('[data-signin="out"]')).toBeVisible();
    await expect(page.locator('[data-signin-btn]')).toBeVisible();
  });
});
