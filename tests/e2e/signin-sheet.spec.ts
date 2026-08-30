import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROVIDERS, featuredProviders, otherProviders, ATMO_GLOSS } from '../../src/signin/providers.js';
import { seedExplorer } from './helpers.js';

// The sign-in sheet — croft-pwa/docs/DESIGN.md § Components › Sheet, § Flows ›
// Sign in, § Copy › atmo. Both of Bluebird's sign-in surfaces open the SAME
// sheet: Patrol (the sponsor) and the Lodge's explorer banner (sharing on,
// signed out). Hermetic: nothing leaves localhost except what page.route answers;
// discovery for a chosen provider is mocked AT ITS ENTRYWAY, so a provider the
// page's CSP forgot fails here with a refusal instead of on a phone.
const OPEN = featuredProviders();
const INVITE = otherProviders();
function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`missing ${what}`);
  return v;
}
const PATROL = must(SURFACES_INIT()[0], 'patrol surface');
const LODGE = must(SURFACES_INIT()[1], 'lodge surface');

const rows = (page: Page, within: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} [data-provider-row]`)].map((r) => ({
        id: r.getAttribute('data-provider-row'),
        create: !!r.querySelector('[data-provider-create]'),
        signin: !!r.querySelector('[data-provider-signin]'),
        visible: r.getClientRects().length > 0,
        text: (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      })),
    within,
  );

function j(body: unknown, init: { status?: number } = {}): { status: number; headers: Record<string, string>; body: string } {
  return { status: init.status ?? 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

async function mockProvider(page: Page, entryway: string): Promise<{ par: () => URLSearchParams[] }> {
  const bodies: URLSearchParams[] = [];
  await page.route(`${entryway}/.well-known/oauth-protected-resource`, (r: Route) => r.fulfill(j({ authorization_servers: [entryway] })));
  await page.route(`${entryway}/.well-known/oauth-authorization-server`, (r: Route) =>
    r.fulfill(
      j({
        issuer: entryway,
        authorization_endpoint: `${entryway}/oauth/authorize`,
        token_endpoint: `${entryway}/oauth/token`,
        pushed_authorization_request_endpoint: `${entryway}/oauth/par`,
      }),
    ),
  );
  await page.route(`${entryway}/oauth/par`, (r: Route) => {
    bodies.push(new URLSearchParams(r.request().postData() ?? ''));
    return r.fulfill(j({ request_uri: 'urn:req:e2e', expires_in: 60 }, { status: 201 }));
  });
  await page.route(`${entryway}/oauth/authorize**`, (r: Route) => r.fulfill({ status: 200, body: 'held' }));
  return { par: () => bodies };
}

async function seedSharingOn(page: Page): Promise<void> {
  await seedExplorer(page);
  await page.addInitScript(() => {
    const raw = window.localStorage.getItem('bluebird.config.local');
    if (raw) window.localStorage.setItem('bluebird.config.local', JSON.stringify({ ...JSON.parse(raw), localOnly: false }));
  });
  await page.route('**/xrpc/app.bsky.feed.getAuthorFeed*', (r: Route) => r.fulfill(j({ feed: [] })));
}

type Surface = { name: string; path: string; trigger: string; seed?: (page: Page) => Promise<void> };
function SURFACES_INIT(): Surface[] {
  return [
  { name: 'Patrol (sponsor)', path: '/patrol.html', trigger: '[data-signin-btn]' },
  { name: 'Lodge (explorer banner)', path: '/', trigger: '[data-explorer-signin]', seed: seedSharingOn },
  ];
}
const SURFACES = SURFACES_INIT();

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') void route.continue();
    else void route.abort();
  });
});

async function openSheet(page: Page, s: Surface): Promise<void> {
  if (s.seed) await s.seed(page);
  await page.goto(s.path);
  await page.locator(s.trigger).click();
  await expect(page.locator('dialog[data-signin-sheet]')).toHaveAttribute('open', '');
}

test('the registry carries both postures, or this spec proves nothing', () => {
  expect(OPEN.length).toBeGreaterThan(0);
  expect(INVITE.length).toBeGreaterThan(0);
  expect(PROVIDERS.map((p) => p.id).sort()).toEqual(['blacksky', 'bsky', 'eurosky', 'northsky']);
});

for (const s of SURFACES) {
  test(`${s.name}: closed until asked; the trigger opens a native dialog titled for an atmo provider`, async ({ page }) => {
    if (s.seed) await s.seed(page);
    await page.goto(s.path);
    expect(await page.locator('dialog[data-signin-sheet][open]').count()).toBe(0);
    await page.locator(s.trigger).click();
    const d = page.locator('dialog[data-signin-sheet]');
    await expect(d).toHaveAttribute('open', '');
    await expect(d.locator('h2')).toHaveText('Choose your atmo provider');
    await expect(d.locator('h2 abbr')).toHaveAttribute('title', ATMO_GLOSS);
    await expect(d.locator('p').first()).toContainText('Personal Data Server');
  });

  test(`${s.name}: front page = open providers with Create + Sign in; invite-only behind Another provider`, async ({ page }) => {
    await openSheet(page, s);
    const front = await rows(page, 'dialog[data-signin-sheet] > .sheet-list');
    expect(front.map((r) => r.id)).toEqual(OPEN.map((p) => p.id));
    for (const r of front) expect(r.visible && r.create && r.signin, JSON.stringify(r)).toBe(true);
    for (const p of INVITE) expect(front.some((r) => r.id === p.id)).toBe(false);
    const before = await rows(page, '.sheet-other');
    expect(before.map((r) => r.id)).toEqual(INVITE.map((p) => p.id));
    expect(before.every((r) => !r.visible)).toBe(true);
    await page.locator('[data-provider-other]').click();
    await expect(page.locator('[data-provider-other]')).toBeHidden();
    for (const r of await rows(page, '.sheet-other')) {
      expect(r.visible).toBe(true);
      expect(r.create, `${r.id} is invite-only — a Create would land on a screen demanding a code`).toBe(false);
      expect(r.signin).toBe(true);
      expect(r.text).toMatch(/invite only/i);
    }
    await expect(page.locator('[data-provider-handle]')).toBeFocused();
  });

  test(`${s.name}: fits the narrowest phone — no sideways scroll at 320px, every control ≥44px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    if (s.seed) await s.seed(page);
    await page.goto(s.path);
    // The Lodge's topbar already overflows at 320px before any sheet opens (a
    // pre-existing finding, not this pattern's) — so the assertion is that the
    // OPEN sheet adds no width to the document, plus the sheet's own fit.
    const before = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.locator(s.trigger).click();
    await expect(page.locator('dialog[data-signin-sheet]')).toHaveAttribute('open', '');
    await page.locator('[data-provider-other]').click();
    const fit = await page.evaluate(() => {
      const d = document.querySelector('dialog[data-signin-sheet]') as HTMLElement;
      const small = [...d.querySelectorAll('button, input')]
        .map((b) => {
          const r = b.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return null;
          return r.width < 44 || r.height < 44 ? `${(b as HTMLElement).innerText || b.tagName} ${Math.round(r.width)}x${Math.round(r.height)}` : null;
        })
        .filter(Boolean);
      return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, sheetW: Math.round(d.getBoundingClientRect().width), small };
    });
    expect(fit.scrollW).toBeLessThanOrEqual(Math.max(before, fit.innerW) + 1);
    expect(fit.sheetW).toBeLessThanOrEqual(320);
    expect(fit.small).toEqual([]);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${s.name}: a11y — the OPEN sheet has no serious/critical violations (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          if (t === 'dark') localStorage.setItem('bluebird.theme', 'dark');
        } catch {
          /* private mode */
        }
      }, theme);
      await openSheet(page, s);
      await page.locator('[data-provider-other]').click();
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);
      expect(blocking, blocking.join(' · ')).toEqual([]);
    });
  }
}

// Intent reaches the seam, per provider — which is also the CSP proof.
for (const p of PROVIDERS) {
  test(`Patrol: ${p.id} — Sign in clears the CSP and reaches PAR at ${p.entryway}, with no login_hint`, async ({ page }) => {
    const { par } = await mockProvider(page, p.entryway);
    await openSheet(page, PATROL);
    if (p.signups === 'invite') await page.locator('[data-provider-other]').click();
    await page.locator(`[data-provider-row="${p.id}"] [data-provider-signin]`).click();
    await page.waitForURL(`${p.entryway}/oauth/authorize**`);
    expect(par()).toHaveLength(1);
    expect(par()[0]?.has('login_hint')).toBe(false);
    expect(par()[0]?.has('prompt')).toBe(false);
  });
}

test('Patrol: Create account starts OAuth in the CREATE intent', async ({ page }) => {
  const p = must(OPEN[0], 'an open provider');
  const { par } = await mockProvider(page, p.entryway);
  await openSheet(page, PATROL);
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-create]`).click();
  await page.waitForURL(`${p.entryway}/oauth/authorize**`);
  expect(par()[0]?.get('prompt')).toBe('create');
});

test('Lodge: the explorer banner reaches the same seam with the explorer scope', async ({ page }) => {
  const p = must(OPEN[0], 'an open provider');
  const { par } = await mockProvider(page, p.entryway);
  await openSheet(page, LODGE);
  await page.locator(`[data-provider-row="${p.id}"] [data-provider-signin]`).click();
  await page.waitForURL(`${p.entryway}/oauth/authorize**`);
  expect(par()[0]?.get('scope')).toContain('repo:ing.croft.bluebird.like');
});

test('a handle on any other provider reaches the same seam, leading @ stripped', async ({ page }) => {
  await openSheet(page, PATROL);
  await page.locator('[data-provider-other]').click();
  const seen: string[] = [];
  await page.route('**/xrpc/com.atproto.identity.resolveHandle*', (r: Route) => {
    seen.push(new URL(r.request().url()).searchParams.get('handle') ?? '');
    return r.fulfill(j({ error: 'InvalidRequest' }, { status: 400 }));
  });
  await page.locator('[data-provider-handle]').fill('@someone.zio.blue');
  await page.locator('[data-provider-handle-go]').click();
  await expect(page.locator('[data-signin-msg]')).toContainText(/failed/i);
  expect(seen).toEqual(['someone.zio.blue']);
});
