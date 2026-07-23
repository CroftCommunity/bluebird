import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility scan (adopted from croft-pwa). Every page, both themes
// (contrast is theme-dependent), must have zero serious/critical axe violations.
//
// HERMETIC by construction: all cross-origin requests are blocked, so every page
// renders the same offline/shell state everywhere (a machine with network would
// otherwise fetch live atproto content and scan a different DOM than CI). This
// gates the shell chrome (topbar, nav, footer, CTA, links, offline/error states);
// a11y of live-fetched feed content is a separate concern for the feature specs.
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
      // Block all cross-origin traffic so the render is deterministic (offline
      // shell) regardless of whether the runner has network.
      await page.route('**/*', (route) => {
        const host = new URL(route.request().url()).hostname;
        if (host === 'localhost' || host === '127.0.0.1') void route.continue();
        else void route.abort();
      });
      await page.goto(path, { waitUntil: 'load' });

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact ?? '?'}) × ${v.nodes.length}`);

      expect(blocking, blocking.join(' · ')).toEqual([]);
    });
  }
}
