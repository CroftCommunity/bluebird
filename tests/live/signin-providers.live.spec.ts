import { test, expect } from '@playwright/test';
import { PROVIDERS, SIGNUP } from '../../src/signin/providers.js';

// @live: do the registered providers still exist, still speak OAuth, and still
// have the signup posture we claim? (croft-pwa/docs/DESIGN.md § Flows › Sign in.)
// The registry is hardcoded on purpose — the sheet paints synchronously — so the
// drift lives here. Local only (`npm run e2e:live`); never in push CI. A host that
// is DOWN is skipped (not our regression); a host that CHANGED fails.
for (const p of PROVIDERS) {
  test(`@live ${p.id}: ${p.entryway} still matches the registry`, async ({ request }) => {
    const desc = await request.get(`${p.entryway}/xrpc/com.atproto.server.describeServer`, { timeout: 15_000 });
    test.skip(!desc.ok(), `${p.id} unreachable (describeServer ${desc.status()}) — not our regression`);
    const d = (await desc.json()) as { inviteCodeRequired?: boolean };
    const posture = d.inviteCodeRequired ? SIGNUP.INVITE : SIGNUP.OPEN;
    expect(posture, `${p.id}: we say '${p.signups}', the server says '${posture}' — update src/signin/providers.json`).toBe(p.signups);

    const oauth = await request.get(`${p.entryway}/.well-known/oauth-authorization-server`, { timeout: 15_000 });
    expect(oauth.ok(), `${p.id}: no oauth-authorization-server (${oauth.status()})`).toBe(true);
    const meta = (await oauth.json()) as { prompt_values_supported?: string[]; scopes_supported?: string[] };
    expect(meta.prompt_values_supported ?? [], `${p.id}: no longer advertises prompt=create`).toContain('create');
    expect(meta.scopes_supported ?? [], `${p.id}: dropped the transition:generic scope`).toContain('transition:generic');

    // The pages allowlist each ENTRYWAY in connect-src on the strength of the
    // provider being its own authorization server; if that moves, PAR would be
    // CSP-refused on a phone, silently.
    const pr = await request.get(`${p.entryway}/.well-known/oauth-protected-resource`, { timeout: 15_000 });
    if (pr.ok()) {
      const servers = ((await pr.json()) as { authorization_servers?: string[] }).authorization_servers ?? [];
      expect(servers.map((x) => x.replace(/\/+$/, '')), `${p.id}: authorization server moved off the entryway`).toContain(p.entryway);
    }
  });
}
