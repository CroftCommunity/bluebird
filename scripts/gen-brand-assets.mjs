// Derive the optimized PWA asset set from the owner brand renders.
//
// sharp is a BUILD-TIME tool only — it is NOT a committed dependency (so CI
// never installs or runs it). Regenerate with:
//
//   npm install --no-save sharp && node scripts/gen-brand-assets.mjs
//
// The derived, optimized assets it writes under icons/ are committed and are the
// only brand assets that ship. The multi-MB source renders never enter dist/
// (guarded by tests/e2e/brand-bundle.spec.ts).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'assets/brand/source');
const ICONS = join(root, 'icons');
const HEADER = join(ICONS, 'brand');
const SPLASH = join(ICONS, 'splash');
for (const d of [HEADER, SPLASH]) mkdirSync(d, { recursive: true });

// Window bounding boxes in the 1408x768 logo renders (same position in both).
const LOGO_WIN = { left: 475, top: 100, width: 450, height: 450 };
// Butterfly leaded-glass window in the 721x599 sunset render (above the baked wordmark).
const SPLASH_WIN = { left: 70, top: 40, width: 580, height: 420 };

const png = (b) => b.png({ compressionLevel: 9 });

/** A square app icon: the day-window on a white field, art at ~80% (maskable-safe). */
async function icon(size, artFraction, out) {
  const art = Math.round(size * artFraction);
  const window = await sharp(join(SRC, 'logo-light.png')).extract(LOGO_WIN).resize(art, art).toBuffer();
  await png(
    sharp({ create: { width: size, height: size, channels: 4, background: '#FFFFFF' } }).composite([
      { input: window, gravity: 'center' },
    ]),
  ).toFile(join(ICONS, out));
  console.log('icon', out, size);
}

/** A small header mark (the window only); CSS rounds the corners over any bg. */
async function headerMark(srcFile, out) {
  const window = await sharp(join(SRC, srcFile)).extract(LOGO_WIN).resize(128, 128).toBuffer();
  await png(sharp(window)).toFile(join(HEADER, out));
  console.log('header', out);
}

/** A PWA startup image: the butterfly window centered on a light field, whole,
 *  generous margins, NO baked wordmark (so no device crop can cut it). JPEG —
 *  photographic content, no transparency needed on the field, keeps the payload
 *  small (a PNG of these dimensions is multi-MB). */
async function splash(w, h, out) {
  const target = Math.round(Math.min(w, h) * 0.72);
  const butterfly = await sharp(join(SRC, 'splash-sunset.png')).extract(SPLASH_WIN).resize({ width: target }).toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: butterfly, gravity: 'center' }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(SPLASH, out));
  console.log('splash', out, `${w}x${h}`);
}

const SPLASHES = [
  ['splash-2048x2732.jpg', 2048, 2732],
  ['splash-1640x2360.jpg', 1640, 2360],
  ['splash-1620x2160.jpg', 1620, 2160],
  ['splash-1290x2796.jpg', 1290, 2796],
  ['splash-1170x2532.jpg', 1170, 2532],
  ['splash-750x1334.jpg', 750, 1334],
];

await icon(512, 0.8, 'icon-512.png');
await icon(192, 0.8, 'icon-192.png');
await icon(180, 0.86, 'apple-touch-icon-180.png');
await icon(32, 0.98, 'favicon-32.png');
await icon(16, 0.98, 'favicon-16.png');
await headerMark('logo-light.png', 'header-light.png');
await headerMark('logo-dark.png', 'header-dark.png');
for (const [name, w, h] of SPLASHES) await splash(w, h, name);
console.log('done');
