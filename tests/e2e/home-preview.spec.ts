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

  /**
   * The three feature mockups are 762.98px wide inside 560px columns, so each
   * one runs past the container by design. `overflow-hidden` on the section is
   * the only thing standing between that and a horizontal scrollbar.
   */
  for (const width of [1440, 1280, 1024, 768]) {
    test(`the feature mockup bleed does not scroll the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'the 763px mockup is escaping its section').toBeLessThanOrEqual(0);
    });
  }

  test('the four steps sit four across at 1280 and two-up at 1024', async ({ page }) => {
    await page.goto('/dev/home');

    const boxes = async () =>
      page.evaluate(() => {
        // Anchored on the heading, not on [href="/universities"] — the top nav
        // links there too, and its <a> has no <section> to climb to.
        const heading = [...document.querySelectorAll('h2')].find(
          (h) => h.textContent?.trim() === 'How GLOWBAL works',
        )!;
        const row = heading.closest('section')!.querySelector('.grid')!;
        return [...row.children].map((c) => {
          const r = c.getBoundingClientRect();
          return { top: Math.round(r.top), width: Math.round(r.width) };
        });
      });

    await page.setViewportSize({ width: 1280, height: 900 });
    const wide = await boxes();
    expect(wide).toHaveLength(4);
    expect(new Set(wide.map((b) => b.top)).size, 'expected one row at 1280').toBe(1);
    expect(new Set(wide.map((b) => b.width)).size, 'cards are not equal width').toBe(1);

    await page.setViewportSize({ width: 1024, height: 900 });
    const narrow = await boxes();
    expect(new Set(narrow.map((b) => b.top)).size, 'expected two rows at 1024').toBe(2);
    // The design's wrapping flex row put 3 up and stretched the 4th across the
    // whole container; equal widths is what rules that out.
    expect(new Set(narrow.map((b) => b.width)).size, 'a card is stretching to fill its row').toBe(1);
  });

  test('hero renders its heading and call to action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Figma 375:9857 renamed this from "Find my scholarships".
    await expect(page.getByRole('link', { name: /find matching scholarships/i })).toBeVisible();
  });

  test('visual baseline', async ({ page }) => {
    test.skip(
      !baselineExists('home-desktop'),
      `No visual baseline for ${process.platform}. Run npm run test:e2e:update here and commit the PNG.`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');
    await settle(page);
    await expect(page).toHaveScreenshot('home-desktop.png', { fullPage: true, mask: masked(page) });
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

/**
 * The metric row is the one place on this page where the Vietnamese build can
 * break while the English one looks perfect: the column is 240px (Figma
 * 375:9889), sized for the kit's "400+" and "10k", and a value that wraps pushes
 * its own label a line below the others. "150M USD" -> "150 triệu USD" did
 * exactly that, which is why any unit lives in the label.
 *
 * The row went from three columns to five on the new canvas and the value
 * dropped 60px -> 48px to fit, so this guard matters MORE than it did: there is
 * less slack per column than there was.
 *
 * The language is forced through localStorage rather than a UI toggle, and
 * /api/translate is blocked outright — every string this section uses is in the
 * dictionary, so a request reaching the network would mean a missing key, and
 * the test would rather fail than paper over it with a live translation.
 */
test.describe('home preview — metric row', () => {
  test('Vietnamese values stay on one line and the labels stay in step', async ({ page }) => {
    await page.route('**/api/translate', (route) => route.abort());
    await page.addInitScript(() => localStorage.setItem('glowbal-language', 'vi'));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    await expect(page.getByRole('heading', { name: 'Những con số nổi bật' })).toBeVisible();

    const rows = await page.evaluate(() => {
      const heading = [...document.querySelectorAll('h2')].find(
        (h) => h.textContent?.trim() === 'Những con số nổi bật',
      )!;
      // A Metric is the only node here that is exactly two <p> children: the
      // value and its label, in that order.
      const metrics = [...heading.closest('section')!.querySelectorAll('div')].filter(
        (d) => d.children.length === 2 && d.children[0]?.tagName === 'P' && d.children[1]?.tagName === 'P',
      );
      return metrics.map((m) => {
        const value = m.children[0] as HTMLElement;
        const label = m.children[1] as HTMLElement;
        return {
          text: value.textContent!.trim(),
          lines: Math.round(
            value.getBoundingClientRect().height / parseFloat(getComputedStyle(value).lineHeight),
          ),
          labelTop: Math.round(label.getBoundingClientRect().top),
        };
      });
    });

    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      expect(r.lines, `"${r.text}" wraps onto ${r.lines} lines — shorten it or move the unit into the label`).toBe(1);
    }
    expect(new Set(rows.map((r) => r.labelTop)).size, 'metric labels are not on a common baseline').toBe(1);
  });

  test('the figures count up once the section enters view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const section = page.getByRole('heading', { name: 'Standout numbers' }).locator('..').locator('..').locator('..');
    const firstValue = section.locator('[aria-label="7,800+"] span');

    // The complete figure is in the initial HTML; the count only starts when
    // the visitor reaches the section, so no-JS and full-page captures keep
    // the truthful value instead of an unexplained zero.
    await expect(firstValue).toHaveText('7,800+');
    await section.scrollIntoViewIfNeeded();
    await expect(firstValue).not.toHaveText('7,800+');
    await expect(firstValue).toHaveText('7,800+', { timeout: 4_000 });
  });

  test('reduced motion keeps the complete figures static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const section = page.getByRole('heading', { name: 'Standout numbers' }).locator('..').locator('..').locator('..');
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
      !baselineExists('home-mobile'),
      `No visual baseline for ${process.platform}. Run npm run test:e2e:update here and commit the PNG.`,
    );
    await page.setViewportSize(MOBILE);
    await page.goto('/dev/home');
    await settle(page);
    await expect(page).toHaveScreenshot('home-mobile.png', { fullPage: true, mask: masked(page) });
  });
});
