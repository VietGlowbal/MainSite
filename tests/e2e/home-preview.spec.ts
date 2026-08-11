import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';

/**
 * Baselines are per-platform (font rasterisation differs), and only the win32
 * PNGs are committed. Without this guard Playwright looks for
 * `<name>-chromium-linux.png` on the Ubuntu CI runner, does not find it, and
 * fails the run — so a machine with no baseline for its platform skips instead.
 * Mirrors kitchen-sink.spec.ts. To add the Linux baseline CI needs, run the
 * suite on Linux with `npm run test:e2e:update` and commit the generated PNG.
 */
const SNAPSHOT_DIR = path.join(__dirname, 'home-preview.spec.ts-snapshots');

function baselineExists(name: string): boolean {
  const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  return existsSync(path.join(SNAPSHOT_DIR, `${name}-chromium-${platform}.png`));
}

/**
 * /dev/home — the Home page being rebuilt from Figma 104:7113, section by
 * section, before it replaces "/".
 *
 * The assertions here are about the failure this layout is most likely to hit:
 * the new-user nav carries five nowrap labels plus two buttons inside a 1280px
 * container, including the long onboarding CTA. If
 * it ever stops fitting, the labels must not be clipped or wrap — the gap
 * shrinks instead.
 */

const WIDTHS = [1280, 1440] as const;

/**
 * Everything a full-page screenshot has to wait for.
 *
 * Not `networkidle` — Analytics and SpeedInsights hold connections open, so it
 * never settles. Not "every image" either: next/image lazy-loads anything
 * off-screen or inside a `hidden` container, so those never complete.
 *
 * `document.fonts.ready` is the one that was missing, and it cost a flake.
 * Bricolage and Inter are self-hosted through next/font, but they still arrive
 * a beat after first paint, and a screenshot taken across that boundary differs
 * from one taken after it by a few dozen antialiased pixels around whichever
 * glyphs happened to reflow — 33 on desktop, 789 on mobile, always clustered on
 * the hero button. It reads exactly like a real regression, which is what makes
 * it worth waiting properly rather than raising the diff threshold.
 */
async function settle(page: import('@playwright/test').Page) {
  await page.locator(`[data-testid="${TID.heroGlobe}"] canvas`).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/**
 * The two decorative animations every screenshot here has to mask.
 *
 * The hero globe rotates continuously, tips as the page scrolls, and lights
 * dots at random, so no two frames of it are alike and no baseline can ever
 * match it. It used to be a static PNG and `settle` waited for that image to
 * load; the wait went stale when the PNG was replaced, and the mask is what
 * should have replaced it.
 *
 * ⚠️ The "Our featured partners" orbit is the SAME problem and was missed when
 * the logos were set orbiting. It is worse than a mismatch: an element that
 * never stops moving means `toHaveScreenshot` cannot get two identical frames
 * in a row, so it times out with "Failed to take two consecutive stable
 * screenshots" and never reaches the pixel comparison at all. The desktop
 * baseline failed on this 3 runs out of 3 — it is not a flake.
 *
 * If a third decorative animation is ever added to this page, it belongs here
 * too.
 */
function masked(page: import('@playwright/test').Page) {
  return [
    page.locator(`[data-testid="${TID.heroGlobe}"]`),
    page.locator(`[data-testid="${TID.heroPartners}"]`),
  ];
}

test.describe('home preview — desktop', () => {
  for (const width of WIDTHS) {
    test(`nav fits and nothing overflows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');

      const header = page.getByTestId(TID.navHeader);
      await expect(header).toBeVisible();

      // Exactly one nav-header: the app sidebar must not render here, or the
      // preview shows two sets of chrome.
      await expect(header).toHaveCount(1);

      const nav = header.locator('nav');
      const clipped = await nav.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, 'nav labels are being clipped — shrink the gap, do not truncate').toBe(false);

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows, 'page scrolls horizontally').toBe(false);
    });
  }

  /**
   * The partner wall (Figma 104:7135) is eleven hand-placed tiles with the
   * heading floating in a lane the designer left clear between them. Nothing
   * about that lane is enforced by layout — it exists because every coordinate,
   * including the font size, is a percentage of one fixed-ratio stage. Change
   * any of those to a fixed px value and the heading starts landing on a crest
   * at some width nobody happened to look at.
   */
  for (const width of [1440, 1280, 1024]) {
    test(`partner heading clears every tile at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');

      const hit = await page.evaluate(() => {
        const stage = document
          .querySelector('img[alt="Harvard University"]')!
          .closest('section')!.firstElementChild!;
        const h = stage.querySelector('h2')!.getBoundingClientRect();
        return [...stage.querySelectorAll('li')]
          .filter((li) => {
            const r = li.getBoundingClientRect();
            return !(r.right <= h.left || r.left >= h.right || r.bottom <= h.top || r.top >= h.bottom);
          })
          .map((li) => li.querySelector('img')?.getAttribute('alt') ?? '?');
      });

      expect(hit, `heading overlaps ${hit.join(', ')}`).toEqual([]);
    });
  }

  /**
   * The container gutter, which is worth a test of its own because it went
   * wrong in a way nothing else would have caught.
   *
   * `Container` carried `px-gb-xl md:px-gb-4xl`, but the second class sat
   * directly against a `${` in a template literal, so Tailwind's scanner never
   * saw it and never emitted the rule. The class was in the DOM; the CSS did
   * not exist. Every section on the site kept the 16px mobile gutter at every
   * width for two rounds of work, and the only reason it surfaced was measuring
   * a feature block against its Figma coordinates.
   *
   * Asserting the computed value catches that class of failure — a class that
   * is present but inert — which no amount of reading the markup will.
   */
  for (const [width, expected] of [
    [1440, 32],
    [768, 32],
    [767, 16],
  ] as const) {
    test(`container gutter is ${expected}px at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');

      const padding = await page
        .locator('.max-w-gb-desktop')
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return { left: cs.paddingLeft, right: cs.paddingRight };
        });

      expect(padding).toEqual({ left: `${expected}px`, right: `${expected}px` });
    });
  }

  /** The two product mockups must never create a page-level scrollbar. */
  for (const width of [1440, 1280, 1024, 768]) {
    test(`the feature mockup bleed does not scroll the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'a product mockup is escaping its section').toBeLessThanOrEqual(0);
    });
  }

  test('the journey renders five steps in the supplied order', async ({ page }) => {
    await page.goto('/dev/home');

    const section = page
      .getByRole('heading', { name: /GlowBal is here to help you achieve your dream/i })
      .locator('..')
      .locator('..');
    const steps = section.locator('ol > li');
    await expect(steps).toHaveCount(5);
    await expect(steps.nth(0)).toContainText('Input simple information');
    await expect(steps.nth(4)).toContainText('Build your application, track progress and receive feedback');
  });

  test('only the two finished product demo sections are present', async ({ page }) => {
    await page.goto('/dev/home');

    await expect(page.getByRole('heading', { level: 3, name: 'GlowBal Matcher' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 3, name: 'Strategy Master' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 3, name: /Demo Video/i })).toHaveCount(0);
  });

  test('hero renders its heading and call to action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /plan your global education/i })).toBeVisible();
  });

  test('hero CTA stays on one line with the support message underneath', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/dev/home');

    const cta = page.getByRole('link', { name: 'Plan your Global Education' });
    const support = page.getByText('Find a University that Fits You 100% free');
    const [ctaBox, supportBox] = await Promise.all([cta.boundingBox(), support.boundingBox()]);

    expect(await cta.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap');
    expect(ctaBox).not.toBeNull();
    expect(supportBox).not.toBeNull();
    expect(supportBox!.y).toBeGreaterThanOrEqual(ctaBox!.y + ctaBox!.height);
    expect(await support.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  });

  test('the five-step journey can be explored directly', async ({ page }) => {
    await page.goto('/dev/home');

    await page.getByRole('button', { name: /3\. Receive specialised reports/i }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Receive specialised reports' })).toBeVisible();
    await expect(page.getByText('Evidence-backed clarity')).toBeVisible();
  });

  test('visual baseline', async ({ page }) => {
    test.skip(
      !baselineExists('home-desktop-884-12026'),
      `No visual baseline for ${process.platform}. Run npm run test:e2e:update here and commit the PNG.`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');
    await settle(page);
    await expect(page).toHaveScreenshot('home-desktop-884-12026.png', { fullPage: true, mask: masked(page) });
  });
});

/**
 * The đợt 5 tripwire. `MissingContent` marks copy the Figma file has not been
 * written — right now two of the three feature blocks and all three mockups.
 * It is only ever meant to be seen on /dev/home.
 *
 * The swap has happened: "/" renders the new composition as of 28/07. This
 * guard is what lets it, so it matters more now, not less — "/" drops the two
 * unwritten sections and passes showPlaceholders={false} to the two that are
 * partly written, and any of those coming undone shows a dashed box to real
 * visitors.
 */
test('the real home page never ships a missing-content marker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-missing-content]')).toHaveCount(0);
});

/**
 * "/" owns its chrome, so its own MobileNav is the only thing standing between
 * a phone and no navigation at all. Viewport inlined because MOBILE is declared
 * further down the file.
 */
test('the real home page has navigation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
});

test.describe('home preview — animated metrics', () => {
  test('the figures count up once the section enters view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const section = page
      .getByRole('heading', { name: 'Standout numbers' })
      .locator('..')
      .locator('..')
      .locator('..');
    const firstValue = section.locator('[aria-label="7,800+"] span');

    await expect(firstValue).toHaveText('7,800+');
    await section.scrollIntoViewIfNeeded();
    await expect(firstValue).not.toHaveText('7,800+');
    await expect(firstValue).toHaveText('7,800+', { timeout: 4_000 });
  });

  test('reduced motion keeps the complete figures static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const section = page
      .getByRole('heading', { name: 'Standout numbers' })
      .locator('..')
      .locator('..')
      .locator('..');
    const firstValue = section.locator('[aria-label="7,800+"] span');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await expect(firstValue).toHaveText('7,800+');
  });
});

/**
 * Viewport only, not a device preset: `test.use({ ...devices[...] })` inside a
 * describe forces a new worker and Playwright rejects it. Layout is all these
 * assertions care about.
 */
const MOBILE = { width: 393, height: 851 };

test.describe('home preview — mobile', () => {
  test('nothing overflows and the hamburger is the only chrome', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/dev/home');

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, 'page scrolls horizontally on mobile').toBe(false);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Now a real assertion, as the note here used to promise. TopNav is
    // desktop-only and NavReveal suppresses the legacy chrome on this route, so
    // the hamburger is the ONLY navigation a phone gets — if MobileNav is
    // dropped from the composition the page has no nav at all, which is exactly
    // how it shipped before 28/07.
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
  });

  test('visual baseline', async ({ page }) => {
    test.skip(
      !baselineExists('home-mobile-884-12026'),
      `No visual baseline for ${process.platform}. Run npm run test:e2e:update here and commit the PNG.`,
    );
    await page.setViewportSize(MOBILE);
    await page.goto('/dev/home');
    await settle(page);
    await expect(page).toHaveScreenshot('home-mobile-884-12026.png', { fullPage: true, mask: masked(page) });
  });
});
