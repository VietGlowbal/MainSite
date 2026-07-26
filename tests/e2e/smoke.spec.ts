import { expect, test } from '@playwright/test';

/**
 * Every publicly reachable route returns 200 and renders without a page error.
 *
 * Highest value-per-line in the suite: it is the only thing that would catch a
 * bad `@layer` change, a broken import, or a server-component boundary
 * violation across all of the app's pages at once.
 */
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/universities',
  '/mentors',
  '/how-it-works',
  '/achievers',
  '/news',
  '/guides',
  '/auth',
  '/plus',
  '/privacy',
  '/terms',
  '/onboarding',
];

/**
 * Requests that 404 when running outside Vercel. Not application errors — the
 * analytics scripts are injected by @vercel/analytics and only exist once
 * deployed.
 */
const EXPECTED_MISSING = ['/_vercel/insights', '/_vercel/speed-insights'];

for (const route of PUBLIC_ROUTES) {
  test(`${route} renders without errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    const badRequests: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      const url = response.url();
      if (response.status() !== 404) return;
      if (EXPECTED_MISSING.some((prefix) => url.includes(prefix))) return;
      badRequests.push(url);
    });

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

    expect(response?.status(), `${route} should return 2xx/3xx`).toBeLessThan(400);
    expect(badRequests, `${route} requested a missing resource`).toEqual([]);

    // No exemptions. Hydration mismatches (React #418/#423) used to be present
    // app-wide and were excluded here; they are fixed, so the exclusion is gone
    // and a reintroduced mismatch fails the build.
    //
    // A mismatch is never cosmetic: React responds by discarding the
    // server-rendered HTML and re-rendering the whole tree on the client, which
    // throws away the entire benefit of SSR for that page.
    expect(pageErrors, `${route} threw a page error`).toEqual([]);
  });
}
