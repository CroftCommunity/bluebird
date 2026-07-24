// Skylite build: bundle the TS app with esbuild, cache-bust the entry, and emit
// a self-contained static `dist/` (arecipe pattern — no framework, no router).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

/** Subresource Integrity hash for a byte buffer (sha384, base64). */
const sriFor = (bytes) => 'sha384-' + createHash('sha384').update(bytes).digest('base64');

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

/** Build stamp: package version + short git SHA (falls back gracefully). */
function computeVersion() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  let sha = 'nogit';
  try {
    sha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: root })
      .toString()
      .trim();
  } catch {
    // No git (e.g. tarball build) — leave the sentinel.
  }
  return `v1 ${pkg.version}+${sha}`;
}

const version = computeVersion();

// Each destination page: its root HTML template, TS entry, and the token the
// template uses for the hashed script src (arecipe page-per-destination shape).
const PAGES = [
  { html: 'index.html', entry: 'src/main.ts', token: '%MAIN_JS%' },
  { html: 'sponsor.html', entry: 'src/sponsor.ts', token: '%SPONSOR_JS%' },
  { html: 'audit.html', entry: 'src/audit.ts', token: '%AUDIT_JS%' },
  { html: 'saves.html', entry: 'src/saves/page.ts', token: '%SAVES_JS%' },
  { html: 'post.html', entry: 'src/post/page.ts', token: '%POST_JS%' },
  { html: 'mysky.html', entry: 'src/mysky/page.ts', token: '%MYSKY_JS%' },
  { html: 'telescope.html', entry: 'src/telescope/page.ts', token: '%TELESCOPE_JS%' },
  { html: 'help.html', entry: 'src/help.ts', token: '%HELP_JS%' },
  { html: 'guide.html', entry: 'src/guide.ts', token: '%GUIDE_JS%' },
  // THROWAWAY device probe (Phase 0-prep A2). Branch-only; never merges to main.
  { html: 'probe.html', entry: 'src/probe/page.ts', token: '%PROBE_JS%' },
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Bundle the app; hashed filenames let the service worker (Phase 3) cache-bust.
const result = await esbuild.build({
  entryPoints: PAGES.map((p) => join(root, p.entry)),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  entryNames: 'assets/[name]-[hash]',
  outdir: dist,
  metafile: true,
  define: {
    __SKYLITE_VERSION__: JSON.stringify(version),
  },
});

// Find an emitted (hashed) entry JS for a given source entry point.
function entryHref(srcEntry) {
  const out = Object.keys(result.metafile.outputs).find(
    (o) => o.endsWith('.js') && result.metafile.outputs[o].entryPoint === srcEntry,
  );
  if (!out) throw new Error(`build: could not locate bundled entry for ${srcEntry}`);
  // Relative (no leading slash) so the site works at a domain root OR under a
  // subpath — needed for the per-PR preview deploys we plan (/pr-preview/pr-N/).
  return out.replace(/^dist\//, '');
}
const pageHrefs = Object.fromEntries(PAGES.map((p) => [p.entry, entryHref(p.entry)]));

// Static assets copied verbatim into dist. (Note: assets/brand/source/ is NEVER
// listed here — the multi-MB source renders must not ship; see tests/e2e/
// brand-bundle.spec.ts.)
for (const asset of ['manifest.webmanifest', 'CNAME', 'icons', '.nojekyll', 'LICENSE', 'oauth']) {
  const from = join(root, asset);
  if (existsSync(from)) {
    cpSync(from, join(dist, asset), { recursive: true });
  }
}

// The served stylesheet is tokens.css (brand tokens, the only place raw hex
// lives) concatenated with styles.css (components), so tokens resolve first in
// a single request with no per-page <link> juggling.
const stylesCss = `${readFileSync(join(root, 'tokens.css'), 'utf8')}\n${readFileSync(join(root, 'styles.css'), 'utf8')}`;
writeFileSync(join(dist, 'styles.css'), stylesCss);
const stylesSri = sriFor(Buffer.from(stylesCss, 'utf8'));

// Subresource Integrity for each page's hashed JS (computed from the emitted
// bytes), so a tampered or mis-served bundle fails the integrity check and does
// not execute. The SRI token for a page is its JS token with _JS% → _JS_SRI%.
const jsSri = Object.fromEntries(
  PAGES.map((p) => [p.token, sriFor(readFileSync(join(dist, pageHrefs[p.entry])))]),
);

// Render the HTML pages from their root templates, injecting version + entries.
const stylesHref = `styles.css?v=${encodeURIComponent(version)}`;
function renderPage(templateName, replacements) {
  const template = readFileSync(join(root, templateName), 'utf8');
  let html = template
    .replaceAll('%VERSION%', version)
    .replaceAll('%STYLES%', stylesHref)
    .replaceAll('%STYLES_SRI%', stylesSri);
  for (const [token, value] of Object.entries(replacements)) html = html.replaceAll(token, value);
  writeFileSync(join(dist, templateName), html);
}
for (const p of PAGES) {
  const sriToken = p.token.replace('_JS%', '_JS_SRI%');
  renderPage(p.html, { [p.token]: pageHrefs[p.entry], [sriToken]: jsSri[p.token] });
}

// Guard: asset/nav paths must be RELATIVE, never absolute-root. Skylite deploys
// to a domain root today (skylite.croft.ing), but per-PR previews (planned) serve
// a build under a /pr-preview/pr-N/ subpath, where an absolute-root href/src like
// `/icons/x.png` resolves to the domain root and 404s — a silently-blank preview.
// The hermetic gate serves at a root and cannot catch this; fail the build.
// (scheme-absolute URLs like https://… are fine and not matched.)
const absoluteOffenders = PAGES.map((p) => ({
  file: p.html,
  hits: readFileSync(join(dist, p.html), 'utf8').match(/(?:href|src)="\/[^"]*"/g),
})).filter((o) => o.hits);
if (absoluteOffenders.length > 0) {
  const detail = absoluteOffenders.map((o) => `  ${o.file}: ${o.hits.join(', ')}`).join('\n');
  throw new Error(
    `build: absolute-root asset path(s) found — these break a /pr-preview/ subpath.\n${detail}\n` +
      `Use relative paths (e.g. "icons/x.png", not "/icons/x.png").`,
  );
}

// Generate the service worker with a precache manifest keyed to this exact build
// (IDEAS.md §4: skipWaiting + clients.claim + a visible version stamp, so a
// child always runs the build we shipped — a stale SW can strand safety patches).
// Relative to the service worker's scope, so precache works at a domain root or
// under a subpath.
const precache = [
  './',
  ...PAGES.map((p) => p.html),
  'manifest.webmanifest',
  stylesHref,
  ...PAGES.map((p) => pageHrefs[p.entry]),
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon-180.png',
];
const sw = `// GENERATED by build.mjs — do not edit. Build ${version}.
const CACHE = 'skylite-${version.replace(/[^\w.+-]/g, '_')}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // App shell HTML: network-first so a shipped update is picked up next open,
  // falling back to the cached shell when offline.
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Bluesky blob images: cache-first so the garden's pictures survive offline.
  if (url.hostname.endsWith('cdn.bsky.app')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Feed / config reads: network-first with cache fallback (offline garden).
  if (url.pathname.startsWith('/xrpc/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Content-hashed same-origin assets: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});
`;
writeFileSync(join(dist, 'sw.js'), sw);

// Bundle-size budget (adopted from croft-pwa). skylite code-splits, so this caps
// any SINGLE emitted JS file's gzipped size — a tripwire against one file
// ballooning, not the transitive per-page total. Raise it deliberately (e.g. a
// new heavy dependency) rather than letting it drift.
const MAX_JS_GZ = 28 * 1024;
const jsFiles = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
const oversize = jsFiles
  .map((f) => ({ f, gz: gzipSync(readFileSync(join(dist, 'assets', f))).length }))
  .filter((x) => x.gz > MAX_JS_GZ);
if (oversize.length > 0) {
  throw new Error(
    `build: bundle-size budget exceeded (${(MAX_JS_GZ / 1024).toFixed(0)}K gz/file):\n` +
      oversize.map((x) => `  ${x.f}: ${(x.gz / 1024).toFixed(1)}K gz`).join('\n'),
  );
}

console.log(`built ${version} -> dist/  (${PAGES.length} pages, sw + precache ${precache.length}, budget ok)`);
