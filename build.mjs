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

// Bundle the app; hashed filename lets the service worker (Phase 3) cache-bust.
const result = await esbuild.build({
  entryPoints: [join(root, 'src', 'main.ts')],
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

// Find the emitted (hashed) entry JS relative to dist.
const mainJs = Object.keys(result.metafile.outputs).find(
  (o) => o.endsWith('.js') && result.metafile.outputs[o].entryPoint === 'src/main.ts',
);
if (!mainJs) {
  throw new Error('build: could not locate bundled entry in esbuild metafile');
}
const mainJsHref = '/' + mainJs.replace(/^dist\//, '');

// Static assets copied verbatim into dist.
for (const asset of ['manifest.webmanifest', 'styles.css', 'CNAME', 'icons', '.nojekyll']) {
  const from = join(root, asset);
  if (existsSync(from)) {
    cpSync(from, join(dist, asset), { recursive: true });
  }
}

// Render index.html from the root template, injecting version + hashed entry.
const template = readFileSync(join(root, 'index.html'), 'utf8');
const html = template
  .replaceAll('%MAIN_JS%', `${mainJsHref}`)
  .replaceAll('%VERSION%', version)
  .replaceAll('%STYLES%', `/styles.css?v=${encodeURIComponent(version)}`);
writeFileSync(join(dist, 'index.html'), html);

console.log(`built ${version} -> dist/  (entry: ${mainJsHref})`);
