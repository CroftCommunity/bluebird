import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility scan (adopted from croft-pwa). Every page, both themes
// (contrast is theme-dependent), must have zero serious/critical axe violations.
// Pages are scanned as they render offline (no data mocks) — this gates the shell
// chrome (topbar, nav, footer, empty/loading states); content that only appears
// after a live fetch is covered by the feature specs.
const PAGES = [
  '/index.html',
  '/help.html',
  '/saves.html',
  '/mysky.html',
  '/telescope.html',
  '/sponsor.html',
];

for (const path of PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`a11y: ${path} (${theme}) — no serious/critical violations`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          if (t === 'dark') localStorage.setItem('skylite.theme', 'dark');
        } catch {
          /* private mode */
        }
      }, theme);
      await page.goto(path, { waitUntil: 'load' });

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);

      expect(blocking, blocking.join(' · ')).toEqual([]);
    });
  }
}
