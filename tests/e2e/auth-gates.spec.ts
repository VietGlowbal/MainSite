import { expect, test } from '@playwright/test';

/**
 * Route protection in src/proxy.ts.
 *
 * That file is 115 lines of redirect logic guarding every private route, with
 * no unit coverage — a bad edit there silently exposes or locks out pages.
 * These tests need no account: they only assert where a signed-out visitor
 * lands.
 */

/** Mirrors PROTECTED_ROUTES in src/proxy.ts. */
const PROTECTED = ['/profile', '/dashboard', '/my-universities', '/admin', '/onboarding/complete'];

for (const route of PROTECTED) {
  test(`guest visiting ${route} is sent to /auth with a redirect back`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/auth/);

    // The proxy preserves the original destination so sign-in can return there.
    const redirect = new URL(page.url()).searchParams.get('redirect');
    expect(redirect, `${route} should round-trip through ?redirect=`).toContain(route);
  });
}

test('public routes are not gated', async ({ page }) => {
  for (const route of ['/universities', '/mentors', '/news']) {
    await page.goto(route);
    await expect(page, `${route} should stay public`).toHaveURL(new RegExp(`${route}$`));
  }
});

test('scholarships requires an account', async ({ page }) => {
  // Gated by a redirect inside the page rather than by the proxy, so it is
  // worth asserting separately — the mechanism differs from PROTECTED above.
  await page.goto('/scholarships');
  await expect(page).toHaveURL(/\/auth/);
});
