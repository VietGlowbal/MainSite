import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Visual regression for the design system.
 *
 * One screenshot of /dev/kitchen-sink catches an accidental change to any
 * token — a swapped brand ramp, a drifted spacing step, a font that failed to
 * load — across the whole system, in the app's real CSS environment. That last
 * part is why this exists instead of Storybook: a component can look correct in
 * Storybook's isolated CSS and wrong in the product.
 *
 * Baselines are per-platform (font rasterisation differs), so a machine that
 * has no baseline for its platform skips rather than fails. To add the Linux
 * baseline CI needs, run the suite on Linux with `npm run test:e2e:update` and
 * commit the generated PNG.
 *
 * After an intended token change, refresh the baseline the same way.
 */
const SNAPSHOT_DIR = path.join(__dirname, 'kitchen-sink.spec.ts-snapshots');

function baselineExists(): boolean {
  const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  return existsSync(path.join(SNAPSHOT_DIR, `design-tokens-chromium-${platform}.png`));
}

test('design tokens render as expected', async ({ page }) => {
  const response = await page.goto('/dev/kitchen-sink');

  // playwright.config.ts sets ENABLE_DEV_ROUTES=1 on the web server. A 404 here
  // means the suite is pointed at an environment without it (e.g. a real
  // deployment via E2E_BASE_URL), where the route is correctly hidden.
  test.skip(response?.status() === 404, 'dev routes are disabled in this environment');

  test.skip(
    !baselineExists(),
    `No visual baseline for ${process.platform}. Run npm run test:e2e:update here and commit the PNG.`,
  );

  // Fonts must settle before the screenshot or the diff is pure flake.
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('design-tokens.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});
