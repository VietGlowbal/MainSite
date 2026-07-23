import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite.
 *
 * Deliberately small. Its job is to survive a full UI rewrite, so every
 * assertion targets a `data-testid` from src/shared/lib/testids.ts, a URL, or a
 * network response — never a CSS class (the stylesheet is being replaced) and
 * never visible copy (the app is bilingual EN/VI and all of it is being
 * rewritten).
 *
 * Runs against a production build, because the two pages under test behave
 * differently in dev (no Data Cache, different hydration timing).
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Signed-in specs mutate a shared test account, so no parallelism within a
  // file; separate files are independent.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    /**
     * ⚠️ Locally this attaches to whatever already answers on :3000 — including
     * a `next dev` server running someone else's branch. CI never reuses, so a
     * green local run is not evidence CI will be green.
     *
     * If a visual baseline disagrees between your machine and CI, check this
     * first. `devIndicators: false` in next.config.ts removes the one visible
     * dev/prod difference that used to poison screenshots, but stale code on
     * :3000 is still stale code.
     */
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // The suite runs a production build on purpose, so /dev/kitchen-sink has
    // to be unlocked explicitly. Real deployments never set this.
    env: { ENABLE_DEV_ROUTES: '1' },
  },
});
