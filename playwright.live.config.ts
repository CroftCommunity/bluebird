import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// @live tier — real network against the public AppView. Local only; never CI.
// Reuses the built dist/ via the same static server, but does NOT mock routes.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;
const PORT = 4174;

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'chromium-live',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `node tools/serve.mjs dist ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
