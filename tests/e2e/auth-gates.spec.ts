import { expect, test } from '@playwright/test';

/**
 * Route protection in src/proxy.ts.
 *
 * That file is 115 lines of redirect logic guarding every private route, with
 * no unit coverage — a bad edit there silently exposes or locks out pages.
 * These tests need no account: they only assert where a signed-out visitor
 * lands.
 */

/**
 * Mirrors PROTECTED_ROUTES in src/proxy.ts.
 *
 * ⚠️ `/my-universities/program`, not the bare `/my-universities`. The saved list
 * merged into /apply on 31/07 and the bare path is now a 308 to it — a guest
 * asking for it lands on `/auth?redirect=%2Fapply`, so asserting the round-trip
 * against `/my-universities` would fail on the *redirect*, not on the gate.
 * PROTECTED_ROUTES still carries the `/my-universities` prefix precisely
 * because the children below it are still real pages; this is one of them, so
 * it is what actually exercises that entry.
 */
const PROTECTED = [
  '/profile',
  '/dashboard',
  '/my-universities/program',
  '/admin',
  '/onboarding/complete',
];

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
  for (const route of ['/universities', '/advisors', '/news', '/scholarships']) {
    await page.goto(route);
    await expect(page, `${route} should stay public`).toHaveURL(new RegExp(`${route}$`));
  }
});

test('scholarships AI workspace requires an account', async ({ page }) => {
  // Gated by a redirect inside the page rather than by the proxy, so it is
  // worth asserting separately — the mechanism differs from PROTECTED above.
  await page.goto('/scholarships?view=ai');
  await expect(page).toHaveURL(/\/auth/);

  const redirect = new URL(page.url()).searchParams.get('redirect');
  expect(redirect, 'AI workspace should preserve its return destination').toContain('/scholarships');
  expect(redirect, 'AI workspace should preserve its view').toContain('view=ai');
});

test('the old saved-list URL is a permanent redirect into /apply', async ({ page }) => {
  /*
   * /my-universities and /apply merged into one page on 31/07 (Figma
   * 562:15078). The old URL was the post-login landing for months, so it is in
   * histories and bookmarks; next.config.ts 308s it. The children under it did
   * NOT move, and a careless `/:path*` there would swallow them — which is what
   * the second half of this test guards.
   */
  const response = await page.goto('/my-universities');
  expect(new URL(page.url()).pathname, '/my-universities should land on /apply').toBe('/auth');
  // Signed out, so /apply's own gate takes over and names itself as the return.
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/apply');
  expect(response?.status(), 'the redirect chain should end in a real page').toBeLessThan(400);

  // The picker below it is still its own page, not swallowed by the redirect.
  await page.goto('/my-universities/program?u=1');
  expect(new URL(page.url()).searchParams.get('redirect')).toContain('/my-universities/program');
});
