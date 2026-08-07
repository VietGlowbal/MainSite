import { expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

test.describe('unified top navigation', () => {
  for (const pathname of ['/', '/universities']) {
    test(`${pathname} renders exactly one desktop top bar`, async ({ page }) => {
      await page.goto(pathname);

      await expect(page.getByTestId(TID.navHeader)).toHaveCount(1);
      await expect(page.getByTestId(TID.navHeader)).toBeVisible();
    });
  }
});
