import { test, expect } from '@playwright/test';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Bundle hygiene: the multi-MB owner source renders must NEVER enter the built
// PWA payload — only derived, optimized assets ship. This runs in the e2e tier,
// after `npm run build`, so it inspects a real dist/.

const SOURCE_DIR = 'assets/brand/source';
const DIST = 'dist';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

test.describe('brand bundle hygiene', () => {
  test('no source render appears in dist/', () => {
    expect(existsSync(DIST), 'dist/ should exist (run npm run build)').toBe(true);
    const sourceNames = new Set(readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.png')));
    expect(sourceNames.size).toBeGreaterThan(0);

    const distFiles = walk(DIST);
    const leaked = distFiles.filter((f) => sourceNames.has(f.split('/').pop() ?? ''));
    expect(leaked, `source renders leaked into dist: ${leaked.join(', ')}`).toEqual([]);
  });

  test('no single dist asset is source-render-sized (> 600 KB)', () => {
    // The renders are ~1 MB each; nothing derived should approach that.
    const big = walk(DIST)
      .filter((f) => /\.(png|jpe?g)$/.test(f))
      .filter((f) => statSync(f).size > 600 * 1024);
    expect(big, `unexpectedly large image assets in dist: ${big.join(', ')}`).toEqual([]);
  });
});
