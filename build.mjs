// Skylite build: bundle the TS app with esbuild, cache-bust the entry, and emit
// a self-contained static `dist/` (arecipe pattern — no framework, no router).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

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

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Bundle the app; hashed filenames let the service worker (Phase 3) cache-bust.
const result = await esbuild.build({
  entryPoints: [join(root, 'src', 'main.ts'), join(root, 'src', 'guardian.ts')],
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
  return '/' + out.replace(/^dist\//, '');
}
const mainJsHref = entryHref('src/main.ts');
const guardianJsHref = entryHref('src/guardian.ts');

// Static assets copied verbatim into dist.
for (const asset of ['manifest.webmanifest', 'styles.css', 'CNAME', 'icons', '.nojekyll']) {
  const from = join(root, asset);
  if (existsSync(from)) {
    cpSync(from, join(dist, asset), { recursive: true });
  }
}

// Render the HTML pages from their root templates, injecting version + entries.
const stylesHref = `/styles.css?v=${encodeURIComponent(version)}`;
function renderPage(templateName, replacements) {
  const template = readFileSync(join(root, templateName), 'utf8');
  let html = template.replaceAll('%VERSION%', version).replaceAll('%STYLES%', stylesHref);
  for (const [token, value] of Object.entries(replacements)) html = html.replaceAll(token, value);
  writeFileSync(join(dist, templateName), html);
}
renderPage('index.html', { '%MAIN_JS%': mainJsHref });
renderPage('guardian.html', { '%GUARDIAN_JS%': guardianJsHref });

console.log(`built ${version} -> dist/  (index: ${mainJsHref}, guardian: ${guardianJsHref})`);
