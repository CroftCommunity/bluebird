import { test, expect } from '@playwright/test';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// RUN-BLUEBIRD gate: the shipped payload must carry NO trace of the old name in
// any case. This runs in the e2e tier, after `npm run build`, so it inspects a
// real dist/. Frozen-seed files (CONCEPT.md, seeds/, RUN-*-SUMMARY.md, …) are
// never copied into dist by build.mjs, so they cannot trip this — the old name
// survives only where it is meant to: the historical record, not the product.

const DIST = 'dist';

// Binary assets can't meaningfully contain the brand string as text; skip them
// so a stray byte sequence in a PNG never yields a confusing failure.
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|map)$/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

test.describe('no skylite in dist', () => {
  test('no shipped file contains the string "skylite" (any case)', () => {
    expect(existsSync(DIST), 'dist/ should exist (run npm run build)').toBe(true);
    const offenders: string[] = [];
    for (const file of walk(DIST)) {
      if (BINARY.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (/skylite/i.test(text)) offenders.push(file);
    }
    expect(offenders, `"skylite" leaked into dist: ${offenders.join(', ')}`).toEqual([]);
  });
});
