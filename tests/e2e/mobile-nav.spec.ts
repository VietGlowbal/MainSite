import { devices, expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

/**
 * The mobile header and its hamburger sheet.
 *
 * Worth pinning because the build this replaced shipped TWO navigations on
 * every mobile page — a bottom tab bar and a top bar with its own drawer —
 * layered on top of each other, and neither agreed with the desktop sidebar
 * about which destinations exist. The assertions below are about that class of
 * bug: one navigation, holding everything the sidebar holds.
 */
test.use({ ...devices['Pixel 5'] });

test.describe('mobile navigation', () => {
  test('the sheet is closed until the hamburger is pressed', async ({ page }) => {
    await page.goto('/universities');

    const toggle = page.getByTestId(TID.navMobileToggle);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Closed means absent from the DOM, not merely hidden — nothing of the
    // sheet should be reachable by keyboard or assistive tech.
    await expect(page.getByTestId(TID.navMobileSheet)).toHaveCount(0);
  });

  test('exactly one navigation renders on mobile', async ({ page }) => {
    await page.goto('/universities');
    await expect(page.getByTestId(TID.navMobileToggle)).toBeVisible();

    // The regression this guards: a second, always-visible bar docked to the
    // bottom of the viewport underneath the page content.
    const visibleNavs = await page
      .locator('nav:visible, header:visible')
      .filter({ has: page.getByRole('link') })
      .count();
    expect(visibleNavs, 'a second global nav has come back').toBeLessThanOrEqual(1);
  });

  test('the sheet opens, lists destinations, and closes on Escape', async ({ page }) => {
    await page.goto('/universities');
    await page.getByTestId(TID.navMobileToggle).click();

    const sheet = page.getByTestId(TID.navMobileSheet);
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId(TID.navMobileToggle)).toHaveAttribute('aria-expanded', 'true');

    // Every destination the desktop sidebar offers a guest, plus the two CTAs.
    const links = await sheet.getByRole('link').count();
    expect(links, 'the sheet should carry the whole nav').toBeGreaterThan(3);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TID.navMobileSheet)).toHaveCount(0);
    await expect(page.getByTestId(TID.navMobileToggle)).toBeFocused();
  });

  test('choosing a destination navigates and dismisses the sheet', async ({ page }) => {
    await page.goto('/universities');
    await page.getByTestId(TID.navMobileToggle).click();

    const sheet = page.getByTestId(TID.navMobileSheet);
    await sheet.getByRole('link').filter({ hasNotText: /^$/ }).first().click();

    await expect(page.getByTestId(TID.navMobileSheet)).toHaveCount(0);
  });

  test('the header stays clear of page content', async ({ page }) => {
    await page.goto('/universities');

    const toggle = page.getByTestId(TID.navMobileToggle);
    await expect(toggle).toBeVisible();

    // The header is fixed, so main has to be offset by its height. Without the
    // offset the first screenful of every page hides behind the bar.
    const header = (await toggle.evaluate((el) => el.closest('header')?.getBoundingClientRect().bottom)) ?? 0;
    // The shell offsets with padding, not margin, so its border box still
    // starts at 0 — measure where its *content* begins. Pages nest their own
    // <main> inside the shell's, hence first().
    const mainTop = await page
      .getByRole('main')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop));

    expect(header).toBeGreaterThan(0);
    expect(mainTop, 'page content is hidden under the fixed header').toBeGreaterThanOrEqual(header - 1);
  });
});
