import { test, expect } from '@playwright/test';

// Hermetic smoke for the THROWAWAY device probe harness (Phase 0-prep A2). The
// WebAuthn/PRF panels can only be exercised on a real iOS device, but the D1
// storage-stamp panel and the AES-GCM wrap/unwrap wiring (via a "simulate
// material" path that skips WebAuthn) are testable here — so a broken harness is
// caught before it is carried to the device. This spec lives on the probe branch
// only and never merges, same as the page it guards.

test.describe('probe harness (device-independent smoke)', () => {
  test('D1 panel stamps and reads back both storage areas', async ({ page }) => {
    await page.goto('/probe.html');
    await page.click('[data-d1-stamp]');
    await expect(page.locator('[data-d1-session]')).toContainText('"n"');
    await expect(page.locator('[data-d1-local]')).toContainText('"n"');
  });

  test('wrap/unwrap round-trips with simulated material', async ({ page }) => {
    await page.goto('/probe.html');
    await page.click('[data-sim]');
    await expect(page.locator('[data-material]')).not.toBeEmpty();
    await page.click('[data-wrap]');
    await expect(page.locator('[data-wrapped]')).toContainText('ct');
    await page.click('[data-unwrap-current]');
    await expect(page.locator('[data-roundtrip]')).toContainText('OK');
  });
});
