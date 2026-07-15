import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio, AA } from '../../src/brand/contrast.js';

// Parse the token values for a given theme selector out of tokens.css, then
// verify every fill+ink PAIR any component uses passes WCAG AA at its size.
// The tokens stylesheet is the single source of truth (raw hex lives ONLY there).

const CSS = readFileSync('tokens.css', 'utf8');

/** Extract `--name: #hex;` declarations inside the block for `selector`. */
function tokensFor(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const block = CSS.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    out[m[1] as string] = (m[2] as string).toUpperCase();
  }
  return out;
}

const light = tokensFor(':root');
const dark = tokensFor('[data-theme="dark"]');

function req(t: Record<string, string>, name: string): string {
  const v = t[name];
  if (!v) throw new Error(`missing token ${name}`);
  return v;
}

// The pairs the components actually use, with the AA size each is held to.
type Pair = { name: string; fill: string; ink: string; size: keyof typeof AA };
function pairs(t: Record<string, string>): Pair[] {
  return [
    { name: 'body text on bg', fill: req(t, '--bg'), ink: req(t, '--ink'), size: 'body' },
    { name: 'body text on bg-raised', fill: req(t, '--bg-raised'), ink: req(t, '--ink'), size: 'body' },
    { name: 'body text on bg-sunken', fill: req(t, '--bg-sunken'), ink: req(t, '--ink'), size: 'body' },
    { name: 'muted text on bg', fill: req(t, '--bg'), ink: req(t, '--ink-muted'), size: 'body' },
    { name: 'muted text on bg-raised', fill: req(t, '--bg-raised'), ink: req(t, '--ink-muted'), size: 'body' },
    // CTA buttons are large/bold text → large-text AA. Light navy-on-orange is
    // 5.37 (also body-safe); dark white-on-rich-monarch is 4.17 (large-text AA).
    { name: 'CTA', fill: req(t, '--cta'), ink: req(t, '--cta-ink'), size: 'large' },
    { name: 'highlight', fill: req(t, '--highlight'), ink: req(t, '--highlight-ink'), size: 'body' },
    { name: 'accent button (large)', fill: req(t, '--accent'), ink: req(t, '--accent-ink'), size: 'large' },
  ];
}

describe.each([
  ['light', light],
  ['dark', dark],
])('brand token pairs pass WCAG AA (%s)', (_theme, t) => {
  it.each(pairs(t))('$name', ({ fill, ink, size }) => {
    const ratio = contrastRatio(fill, ink);
    expect(ratio, `${fill} on ${ink} = ${ratio.toFixed(2)}:1 (need ${AA[size]})`).toBeGreaterThanOrEqual(AA[size]);
  });
});

describe('forbidden combinations', () => {
  it('light CTA ink is NOT white (white-on-orange fails AA)', () => {
    expect(light['--cta-ink']).not.toBe('#FFFFFF');
    expect(contrastRatio('#FFFFFF', req(light, '--cta'))).toBeLessThan(AA.large); // documents why
  });
  it('highlight ink is dark on both themes (never white-on-yellow)', () => {
    for (const t of [light, dark]) expect(t['--highlight-ink']).not.toBe('#FFFFFF');
  });
});

describe('contrastRatio sanity', () => {
  it('black/white is 21, identical is 1', () => {
    expect(Math.round(contrastRatio('#000000', '#FFFFFF'))).toBe(21);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1);
  });
});
