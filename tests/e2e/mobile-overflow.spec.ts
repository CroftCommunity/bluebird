import { test, expect, type Page } from '@playwright/test';

// Mobile is a first-class client: on a narrow phone viewport no element may
// bleed past the right edge of the screen (the Android "text overrun" bug —
// nowrap toggle labels used to widen whole cards past the viewport). The body
// carries overflow-x: clip as a safety net, so page scrollWidth alone can't
// catch regressions; measure real element geometry instead.

test.use({ viewport: { width: 360, height: 780 } });

async function horizontalBleeders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      // Skip empty/hidden boxes and the 1px visually-hidden a11y helper.
      if (r.width <= 1) continue;
      if (r.right > viewportWidth + 1) {
        const cls = el instanceof HTMLElement && el.className ? `.${el.className.split(' ')[0]}` : '';
        offenders.push(`${el.tagName.toLowerCase()}${cls} right=${Math.round(r.right)}px (viewport ${viewportWidth}px)`);
      }
    }
    return offenders;
  });
}

test.describe('no horizontal text overrun on a 360px phone', () => {
  test('sponsor dashboard with an explorer card fully rendered', async ({ page }) => {
    await page.goto('/patrol.html');
    await page.locator('[data-advanced-identity] > summary').click();
    await page.getByPlaceholder('did:plc:…').fill('did:plc:sponsor1');
    await page.locator('[data-apply-identity]').click();
    await page.locator('[data-add-explorer]').click();
    await expect(page.locator('[data-explorer]')).toHaveCount(1);
    // The long checkbox sentences must wrap, not widen the card.
    await expect(page.getByText('Cabin Mode — on this device only, no account')).toBeVisible();
    expect(await horizontalBleeders(page)).toEqual([]);
  });

  test('landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.landing__doors')).toBeVisible();
    expect(await horizontalBleeders(page)).toEqual([]);
  });

  test('help explainer page', async ({ page }) => {
    await page.goto('/help.html');
    expect(await horizontalBleeders(page)).toEqual([]);
  });
});
