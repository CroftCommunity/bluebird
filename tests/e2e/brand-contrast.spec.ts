import { test, expect, type Page } from '@playwright/test';
import { contrastRatio, AA } from '../../src/brand/contrast.js';

// P4: extend the Phase-1 pair discipline to REAL rendered components — sample
// the live CTA and body text in both themes and assert WCAG AA on the computed
// colors. (Accent-colored labels are held to large-text AA by design; this
// sweeps the load-bearing text/CTA pairs.)

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return '#000000';
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

async function computed(page: Page, selector: string): Promise<{ color: string; bg: string }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { color: '', bg: '' };
    const cs = getComputedStyle(el);
    return { color: cs.color, bg: cs.backgroundColor };
  }, selector);
}

const bgToken = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());

for (const scheme of ['light', 'dark'] as const) {
  test(`CTA and body text pass WCAG AA (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await page.waitForSelector('[data-door="sponsor"]');

    // The primary CTA (Door A): its own fill + ink, large-text AA (>=3.0).
    const cta = await computed(page, '[data-door="sponsor"]');
    const ctaRatio = contrastRatio(rgbToHex(cta.color), rgbToHex(cta.bg));
    expect(ctaRatio, `CTA ${cta.color} on ${cta.bg} = ${ctaRatio.toFixed(2)}`).toBeGreaterThanOrEqual(AA.large);

    // Body text (the lede) over the page background: body AA (>=4.5).
    const lede = await computed(page, '.landing__lede');
    const bg = (await bgToken(page)) || '#FFFFFF';
    const bodyRatio = contrastRatio(rgbToHex(lede.color), bg);
    expect(bodyRatio, `body ${lede.color} on --bg = ${bodyRatio.toFixed(2)}`).toBeGreaterThanOrEqual(AA.body);
  });
}
