// Generates placeholder Skylite app icons as real PNGs (night-sky palette from
// CONCEPT.md §4: deep-indigo sky, a crescent moon, a few stars). Zero deps — a
// hand-rolled truecolor+alpha PNG encoder — so CI never fetches an image lib.
// Placeholder only: the finished skylight artwork is a manual design follow-up.
//
//   node tools/gen-icons.mjs
//
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });

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
  // 10,11,12 = compression, filter, interlace = 0
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

// --- draw one icon ---
function draw(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // simple source-over onto existing
    const ia = a / 255;
    px[i] = px[i] * (1 - ia) + r * ia;
    px[i + 1] = px[i + 1] * (1 - ia) + g * ia;
    px[i + 2] = px[i + 2] * (1 - ia) + b * ia;
    px[i + 3] = Math.max(px[i + 3], a);
  };

  // Deep-indigo sky background (fills the maskable bleed area too).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = y / size;
      const r = Math.round(20 + t * 12);
      const g = Math.round(24 + t * 10);
      const b = Math.round(74 + t * 26);
      set(x, y, r, g, b, 255);
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.28; // keep art within maskable safe zone (~80%)

  // Crescent moon: yellow disc minus an offset disc.
  const moonX = cx + R * 0.15;
  const moonY = cy;
  const cutX = moonX + R * 0.55;
  const cutY = moonY - R * 0.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inMoon = (x - moonX) ** 2 + (y - moonY) ** 2 <= R * R;
      const inCut = (x - cutX) ** 2 + (y - cutY) ** 2 <= (R * 0.9) ** 2;
      if (inMoon && !inCut) set(x, y, 255, 214, 92, 255); // warm yellow
    }
  }

  // A few stars.
  const stars = [
    [0.28, 0.3, 0.02],
    [0.72, 0.7, 0.025],
    [0.66, 0.28, 0.015],
    [0.35, 0.68, 0.018],
  ];
  for (const [fx, fy, fr] of stars) {
    const sx = fx * size;
    const sy = fy * size;
    const sr = Math.max(1, fr * size);
    for (let y = -Math.ceil(sr); y <= sr; y++) {
      for (let x = -Math.ceil(sr); x <= sr; x++) {
        if (x * x + y * y <= sr * sr) set(Math.round(sx + x), Math.round(sy + y), 255, 255, 255, 235);
      }
    }
  }
  return px;
}

for (const size of [180, 192, 512]) {
  const png = encodePng(size, size, draw(size));
  const name = size === 180 ? 'apple-touch-icon-180.png' : `icon-${size}.png`;
  writeFileSync(join(outDir, name), png);
  console.log(`wrote icons/${name} (${png.length} bytes)`);
}

// --- iOS launch splashes (apple-touch-startup-image) ---
// Night-sky gradient with a centered crescent moon. Placeholder art, real PNGs.
function drawSplash(w, h) {
  const px = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const ia = a / 255;
    px[i] = px[i] * (1 - ia) + r * ia;
    px[i + 1] = px[i + 1] * (1 - ia) + g * ia;
    px[i + 2] = px[i + 2] * (1 - ia) + b * ia;
    px[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(20 + t * 8);
    const g = Math.round(22 + t * 6);
    const b = Math.round(74 - t * 40);
    for (let x = 0; x < w; x++) set(x, y, r, g, b, 255);
  }
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.14;
  const cutX = cx + R * 0.55;
  const cutY = cy - R * 0.1;
  for (let y = Math.floor(cy - R - 2); y <= cy + R + 2; y++) {
    for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
      const inMoon = (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
      const inCut = (x - cutX) ** 2 + (y - cutY) ** 2 <= (R * 0.9) ** 2;
      if (inMoon && !inCut) set(x, y, 255, 214, 92, 255);
    }
  }
  return px;
}

// [name, width, height] — common portrait iOS device pixel sizes.
const SPLASHES = [
  ['splash-2048x2732', 2048, 2732], // iPad Pro 12.9
  ['splash-1640x2360', 1640, 2360], // iPad Air 10.9
  ['splash-1620x2160', 1620, 2160], // iPad 10.2
  ['splash-1290x2796', 1290, 2796], // iPhone 14/15 Pro Max
  ['splash-1170x2532', 1170, 2532], // iPhone 12/13/14
  ['splash-750x1334', 750, 1334], // iPhone SE/8
];
const splashDir = join(outDir, 'splash');
mkdirSync(splashDir, { recursive: true });
for (const [name, w, h] of SPLASHES) {
  const png = encodePng(w, h, drawSplash(w, h));
  writeFileSync(join(splashDir, `${name}.png`), png);
  console.log(`wrote icons/splash/${name}.png (${png.length} bytes)`);
}
