// Generates the Bluebird app icon set as real PNGs, zero deps — a hand-rolled
// truecolor+alpha PNG encoder — so CI never fetches an image lib.
//
//   node tools/gen-icons.mjs
//
// The icon is the simplest possible read at small sizes: a bluebird silhouette
// centred on a solid green field (the green circle IS the easiest-run trail
// marker; a full-bleed green field masks to that circle on a home screen).
// The slalom brand mark (assets/brand/bluebird-mark.svg) is deliberately NOT the
// icon — it will not read at 48px.
//
// Splash startup images are the .jpg set derived by scripts/gen-brand-assets.mjs
// (sharp) and are not (re)generated here.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const headerDir = join(iconsDir, 'brand');
mkdirSync(iconsDir, { recursive: true });
mkdirSync(headerDir, { recursive: true });

// --- CRC32 (PNG chunk checksum) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, pixels /* Uint8ClampedArray RGBA */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.subarray(y * stride, (y + 1) * stride).forEach((v, i) => {
      raw[y * (stride + 1) + 1 + i] = v;
    });
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- palette ---
const GREEN = [47, 158, 68]; // --trail-green #2F9E44 (the easiest-run marker)
const WHITE = [255, 255, 255];
const EVERGREEN = [18, 58, 42]; // --evergreen #123A2A (dark bird, light header)

// --- geometry helpers (normalized art coords, y-down, box ~[-0.5,0.5]) ---
const inEllipse = (px, py, cx, cy, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/**
 * A side-profile songbird silhouette (facing right, upswept tail, raised wing),
 * as the UNION of a few primitives. Bold and closed so it survives down to 16px.
 * Point in normalized art coords centred on (0,0).
 */
function inBird(x, y) {
  if (inEllipse(x, y, -0.03, 0.06, 0.3, 0.2)) return true; // body
  if (inEllipse(x, y, -0.02, -0.06, 0.2, 0.13)) return true; // raised wing over the back
  if (inEllipse(x, y, 0.22, -0.1, 0.16, 0.16)) return true; // head
  if (inTriangle(x, y, 0.36, -0.14, 0.52, -0.09, 0.36, -0.04)) return true; // beak
  if (inTriangle(x, y, -0.28, 0.04, -0.54, -0.14, -0.4, 0.14)) return true; // upswept tail
  return false;
}

/** 2x2 supersampled coverage of the bird mask at a pixel, in [0,1]. */
function birdCoverage(nx, ny, step) {
  let hit = 0;
  for (const oy of [-0.25, 0.25]) for (const ox of [-0.25, 0.25]) {
    if (inBird(nx + ox * step, ny + oy * step)) hit++;
  }
  return hit / 4;
}

/**
 * Draw one square icon. `bg` fills the whole field (full-bleed → masks to the
 * green circle on a home screen); `bird` is the silhouette colour. Pass bg=null
 * for a transparent field (the themed header marks).
 */
function draw(size, bg, bird) {
  const px = new Uint8ClampedArray(size * size * 4);
  const art = 0.66 * size; // bird occupies the central ~66% (maskable safe zone)
  const step = 1 / art;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (bg) {
        px[i] = bg[0];
        px[i + 1] = bg[1];
        px[i + 2] = bg[2];
        px[i + 3] = 255;
      }
      const nx = (x + 0.5 - size / 2) / art;
      const ny = (y + 0.5 - size / 2) / art;
      const cov = birdCoverage(nx, ny, step);
      if (cov > 0) {
        const a = cov;
        px[i] = px[i] * (1 - a) + bird[0] * a;
        px[i + 1] = px[i + 1] * (1 - a) + bird[1] * a;
        px[i + 2] = px[i + 2] * (1 - a) + bird[2] * a;
        px[i + 3] = Math.max(px[i + 3], Math.round(a * 255));
      }
    }
  }
  return px;
}

// App icon set: full-bleed green + white bird.
for (const size of [512, 192, 180, 32, 16]) {
  const png = encodePng(size, size, draw(size, GREEN, WHITE));
  const name =
    size === 180 ? 'apple-touch-icon-180.png' : size <= 32 ? `favicon-${size}.png` : `icon-${size}.png`;
  writeFileSync(join(iconsDir, name), png);
  console.log(`wrote icons/${name} (${png.length} bytes)`);
}

// Topbar header marks: bird-only on a transparent field, themed for each mode.
// (light theme → dark bird; dark theme → white bird.) Filenames are unchanged so
// the per-theme swap wiring (tokens.css --header-mark, e2e) keeps working.
writeFileSync(join(headerDir, 'header-light.png'), encodePng(96, 96, draw(96, null, EVERGREEN)));
writeFileSync(join(headerDir, 'header-dark.png'), encodePng(96, 96, draw(96, null, WHITE)));
console.log('wrote icons/brand/header-light.png + header-dark.png (96px, transparent)');
