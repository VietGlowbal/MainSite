import { expect, test, type Page } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

/**
 * The enforced Content Security Policy blocks injected script and nothing else.
 *
 * Unit tests prove the proxy sends a nonce; only a browser proves Next actually
 * stamps it on every script it emits. A missed script does not throw — the
 * page simply stops hydrating — so this listens for `securitypolicyviolation`
 * events and checks that the Next runtime came up on each page.
 *
 * Report-only violations are logged, not failed: the origin allowlists are
 * report-only precisely because they are unverified, and this output is the
 * evidence for promoting them later.
 *
 * GA beacons are aborted so a local run never records page views against the
 * real property; gtag.js itself still loads, which is what exercises the nonce
 * handed to <GoogleAnalytics />.
 */

type Violation = { page: string; directive: string; blocked: string; disposition: string; sample: string };

async function watchViolations(page: Page): Promise<Violation[]> {
  const violations: Violation[] = [];
  await page.exposeFunction('__recordCspViolation', (violation: Violation) => violations.push(violation));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __recordCspViolation: (v: unknown) => void }).__recordCspViolation({
        page: location.pathname,
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        disposition: event.disposition,
        sample: event.sample,
      });
    });
  });
  await page.route(/google-analytics\.com|analytics\.google\.com/, (route) => route.abort());
  return violations;
}

async function visit(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'load' });
  expect(response?.status(), `${path} status`).toBeLessThan(400);
  expect(response?.headers()['content-security-policy'], `${path} has an enforced CSP`).toContain("'nonce-");
  // Set by Next's client bootstrap. If its inline or chunk scripts were
  // blocked, this never appears.
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { next?: unknown }).next), {
      message: `${path} hydrated`,
    })
    .toBe('object');
}

/** First same-origin link under `prefix` on the current page, if any. */
async function firstLink(page: Page, prefix: string, exclude?: RegExp): Promise<string | null> {
  const hrefs = await page.locator(`a[href^="${prefix}"]`).evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute('href') ?? ''),
  );
  return hrefs.find((href) => href.length > prefix.length && !(exclude?.test(href) ?? false)) ?? null;
}

/**
 * The four essay pages ship Node's `crypto` polyfill (docs/known-issues.md §0k),
 * and its asn1.js probes `vm.runInThisContext` inside try/catch. The refusal is
 * harmless and falls back to a plain function. Eval there is tolerated; eval on
 * any other page, or any other enforced violation anywhere, fails the test.
 */
const KNOWN_EVAL_PAGE =
  /^\/(apply\/[^/]+\/(statement-feedback|lor-feedback)|ai-strategy\/[^/]+\/statement|my-universities\/[^/]+\/writer)$/;

function report(violations: Violation[]) {
  const enforced = violations.filter(
    (v) => v.disposition === 'enforce' && !(v.blocked === 'eval' && KNOWN_EVAL_PAGE.test(v.page)),
  );
  const observed = violations.filter((v) => v.disposition === 'report');
  const unique = [...new Set(observed.map((v) => `${v.directive} ${v.blocked}`))];
  console.log(`[csp] report-only violations: ${observed.length} (${unique.length} unique)\n  ${unique.join('\n  ')}`);
  expect(enforced, 'enforced CSP violations').toEqual([]);
}

test('guest pages run under the enforced CSP', async ({ page }) => {
  test.setTimeout(240_000);
  const violations = await watchViolations(page);

  await visit(page, '/');
  // Accept analytics so GA and Vercel Analytics mount on every later page.
  const accept = page.getByRole('button', { name: 'Accept', exact: true });
  if (await accept.isVisible()) await accept.click();

  for (const path of ['/vi', '/about', '/how-it-works', '/universities', '/scholarships', '/advisors', '/news', '/auth', '/plus', '/privacy']) {
    await visit(page, path);
    if (path === '/news') {
      const article = await firstLink(page, '/news/');
      // Twice: a page served from ISR cache would carry a stale nonce.
      if (article) {
        await visit(page, article);
        await visit(page, article);
      }
    }
    if (path === '/universities') {
      const detail = await firstLink(page, '/universities/', /matches/);
      if (detail) await visit(page, detail);
    }
    if (path === '/advisors') {
      const advisor = await firstLink(page, '/advisors/');
      if (advisor) await visit(page, advisor);
    }
  }

  const gaMounted = await page.locator('script#_next-ga').count();
  if (gaMounted > 0) {
    expect(await page.evaluate(() => typeof (window as unknown as { gtag?: unknown }).gtag), 'GA bootstrap ran').toBe('function');
  }

  report(violations);
});

/**
 * Injected markup cannot run script. The payload is spliced into the server's
 * HTML in transit with the real CSP headers kept, which is how a stored XSS
 * arrives: a parser-inserted `<script>` and inline event handlers.
 *
 * Deliberately NOT tested: `document.createElement('script')` with inline text
 * run from code that is already executing. `'strict-dynamic'` trusts scripts
 * that trusted scripts create — that is how Next's chunk loader works — so it
 * runs (measured 2026-09-14). It needs script execution to begin with, so it
 * is not an injection vector.
 */
test('injected markup cannot run script, and eval is blocked', async ({ page }) => {
  const violations = await watchViolations(page);
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      const body = (await response.text()).replace(
        '<body',
        '<script>window.__parser = true</script><img src="data:," hidden onerror="window.__handler = true"><body',
      );
      return route.fulfill({ response, body });
    },
  );
  await visit(page, '/');

  const outcome = await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const holder = document.createElement('div');
    holder.innerHTML = '<img src="data:," hidden onerror="window.__innerHandler = true">';
    document.body.appendChild(holder);
    await new Promise((resolve) => setTimeout(resolve, 300));
    let evalRan: boolean;
    try {
      evalRan = new Function('return true')() === true;
    } catch {
      evalRan = false;
    }
    return {
      parserInsertedScript: w.__parser === true,
      inlineHandlerInHtml: w.__handler === true,
      innerHtmlHandler: w.__innerHandler === true,
      evalRan,
    };
  });

  expect(outcome).toEqual({
    parserInsertedScript: false,
    inlineHandlerInHtml: false,
    innerHtmlHandler: false,
    evalRan: false,
  });
  expect(violations.some((v) => v.disposition === 'enforce' && v.directive.startsWith('script-src'))).toBe(true);
});

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test('signed-in pages run under the enforced CSP', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run the signed-in crawl.');
  test.setTimeout(240_000);
  const violations = await watchViolations(page);

  await page.goto('/auth');
  await page.getByTestId(TID.authEmailInput).fill(EMAIL!);
  await page.getByTestId(TID.authPasswordInput).fill(PASSWORD!);
  await page.getByTestId(TID.authSubmit).click();
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });

  for (const path of ['/apply', '/profile', '/dashboard', '/ai-strategy', '/scholarships']) {
    await visit(page, path);
  }

  // The essay pages load the one client chunk that contains `eval` (asn1.js,
  // guarded by try/catch). They need an application id from the account.
  await visit(page, '/apply');
  const application = (await firstLink(page, '/apply/'))?.match(/^\/apply\/([0-9a-f-]{36})/)?.[1];
  if (application) {
    await visit(page, `/apply/${application}/statement-feedback`);
  } else {
    test.info().annotations.push({ type: 'note', description: 'No application on the E2E account; essay page not crawled.' });
  }

  report(violations);
});
