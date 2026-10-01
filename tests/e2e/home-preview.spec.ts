import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { TID } from '../../src/shared/lib/testids';
import {
  ORBIT_SAMPLES,
  ORBIT_VIEWBOX,
  orbitDepthScale,
  orbitPointAt,
} from '../../src/features/marketing/domain/orbit-path';

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
    page.locator(`[data-testid="${TID.homeScholarships}"]`),
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
   * The partner heading floats inside the crests' orbit, in a lane nothing in
   * the layout enforces — it holds only because the curve, the crests and the
   * heading's width and font are all percentages of one fixed-ratio stage.
   *
   * ⚠️ WALKS THE WHOLE LAP, not the crests where they happen to be. The ring
   * moves, so the earlier version of this test (which checked the eleven
   * crests at one instant) passed or failed by timing: at 1024px it failed,
   * and at 1280/1440 it passed only because no crest was in the heading's
   * top-left corner at that moment — the overlap was there at every width.
   * Reduced motion stops the loop from moving the nodes, then one real crest
   * is placed at each sample in turn through the same custom properties the
   * loop writes, so its measured box has the real size and transform.
   *
   * Covers the resting orbit only; the hover lift and bounce are transient.
   * English is the longer copy (the Vietnamese lines measured narrower), so
   * /dev/home is the binding case.
   */
  for (const width of [1440, 1280, 1024]) {
    test(`partner heading clears the orbit at ${width}px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');

      const SAMPLES = 240;
      const samples = Array.from({ length: SAMPLES }, (_, index) => {
        const point = orbitPointAt(ORBIT_SAMPLES, index / SAMPLES);
        return {
          x: `${(point.x / ORBIT_VIEWBOX.width) * 100}%`,
          y: `${(point.y / ORBIT_VIEWBOX.height) * 100}%`,
          scale: String(orbitDepthScale(point.depth)),
        };
      });

      const hits = await page.evaluate((samples) => {
        const stage = document
          .querySelector('img[alt="Harvard University"]')!
          .closest('section')!.firstElementChild!;
        // The heading, the "Study <word>" line and the CTA.
        const block = [...stage.querySelector('h2')!.parentElement!.children];
        const targets = block.map((el) => ({ tag: el.tagName, rect: el.getBoundingClientRect() }));
        const node = stage.querySelector<HTMLElement>('[data-orbit-node]')!;
        const found: string[] = [];
        samples.forEach(({ x, y, scale }, index) => {
          node.style.setProperty('--orbit-x', x);
          node.style.setProperty('--orbit-y', y);
          node.style.setProperty('--orbit-scale', scale);
          node.style.setProperty('--orbit-tilt', '0');
          node.style.setProperty('--orbit-offset-px', '0px');
          const r = node.getBoundingClientRect();
          for (const { tag, rect: t } of targets) {
            if (!(r.right <= t.left || r.left >= t.right || r.bottom <= t.top || r.top >= t.bottom)) {
              found.push(`${tag} at ${(index / samples.length).toFixed(3)}`);
            }
          }
        });
        return found;
      }, samples);

      expect(hits, `a crest crosses the heading block: ${hits.join(', ')}`).toEqual([]);
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

  test('the journey renders four steps in the supplied order', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    // The first <ol> is the tablet/desktop grid; the second is the phone timeline.
    const steps = page.locator('#journey ol').first().locator('> li');
    await expect(steps).toHaveCount(4);
    // Content PDF (3) §6: Matcher · Free Consultation · Strategy Master · AI + experts.
    await expect(steps.nth(0)).toContainText('GlowBal Matcher: Unlock Best-Fit Scholarships and Universities');
    await expect(steps.nth(1)).toContainText('Free Consultation');
    await expect(steps.nth(3)).toContainText('Conquer your Dream with GlowBal AI and experts');
  });

  test('only the two finished product demo sections are present', async ({ page }) => {
    await page.goto('/dev/home');

    // Exact: the journey's step titles ("GlowBal Matcher: Unlock …") are h3s too.
    await expect(page.getByRole('heading', { level: 3, name: 'GlowBal Matcher', exact: true })).toHaveCount(1);
    // Content PDF (3) §7 names the second row "GlowBal AI".
    await expect(page.getByRole('heading', { level: 3, name: 'GlowBal AI', exact: true })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 3, name: /Demo Video/i })).toHaveCount(0);
    await expect(page.locator('#features a[href="#contact"]')).toHaveCount(0);
  });

  test('the team carousel holds the ten-person roster and exposes one card at a time', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const team = page.locator('#team');
    await expect(team.locator('article')).toHaveCount(10);
    // Only the centre card is exposed to assistive technology; it opens on #2.
    await expect(team.getByRole('heading', { level: 3 })).toHaveCount(1);
    await expect(team.getByRole('heading', { level: 3, name: 'Nguyễn Khánh Linh' })).toBeVisible();

    // No arrow buttons any more (owner, 2026-10-01) — the dots and ←/→ still move it.
    await expect(team.getByRole('button', { name: 'Next' })).toHaveCount(0);
    await team.getByRole('button', { name: 'Nguyễn Hoàng Linh' }).click();
    await expect(team.getByRole('heading', { level: 3, name: 'Nguyễn Hoàng Linh' })).toBeVisible();

    const order = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('h2')];
      return [
        'GlowBal Success Stories',
        'Numbers say it all',
        'GlowBal Team',
        'Become a GlowBal Mentee TODAY!',
        'Register for Free Scholarship Consultation with GlowBal Mentors',
      ].map((text) => headings.findIndex((heading) => heading.textContent?.trim() === text));
    });

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  /**
   * Owner, 2026-10-01: every member card one size, and the cards beside the
   * centre drawn as the sketch's trapezoids — inner edge as tall as the centre
   * card, outer edge receding. A card's bounding box is as tall as its tallest
   * edge, so the first side card must match the centre's height (its inner
   * edge sits in the centre's plane) while the second is shorter (both edges
   * recede). The old convex cover-flow scaled the first card down to .8.
   */
  test('team cards are one size and the side cards recede as a concave wall', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/home');

    const cards = await page.locator('#team article').evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          layout: `${(node as HTMLElement).offsetWidth}x${(node as HTMLElement).offsetHeight}`,
          left: box.left,
          width: box.width,
          height: box.height,
          shown: getComputedStyle(node).opacity !== '0',
          centre: node.getAttribute('aria-roledescription') === 'slide',
        };
      }),
    );
    expect(new Set(cards.map((card) => card.layout)).size, JSON.stringify(cards)).toBe(1);

    const shown = cards.filter((card) => card.shown).sort((a, b) => a.left - b.left);
    expect(shown).toHaveLength(5);
    const [outerLeft, innerLeft, centre, innerRight, outerRight] = shown;
    expect(centre!.centre).toBe(true);
    for (const inner of [innerLeft!, innerRight!]) {
      expect(Math.abs(inner.height - centre!.height)).toBeLessThanOrEqual(2);
      expect(inner.width).toBeLessThan(centre!.width * 0.5);
    }
    for (const outer of [outerLeft!, outerRight!]) {
      expect(outer.height).toBeLessThan(centre!.height * 0.8);
    }
  });

  test('a cut team card opens the whole profile in a dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/home');

    const team = page.locator('#team');
    const hiddenRows = () =>
      team
        .locator('article[aria-roledescription="slide"] ul > li')
        .evaluateAll((rows) => rows.filter((row) => getComputedStyle(row).visibility === 'hidden').length);
    // The cut is measured after hydration; a click before it would be lost.
    await expect.poll(hiddenRows).toBeGreaterThan(0);
    await team.getByRole('button', { name: 'James David Lapslie' }).click();
    const centre = team.locator('article[aria-roledescription="slide"]');
    await expect(centre.getByRole('heading', { level: 3 })).toHaveText('James David Lapslie');
    // Rows past the fit are hidden whole, never cut mid-line.
    const hidden = await centre.locator('ul > li').evaluateAll(
      (rows) => rows.filter((row) => getComputedStyle(row).visibility === 'hidden').length,
    );
    expect(hidden).toBeGreaterThan(0);

    await centre.getByRole('button', { name: /Read more/ }).click();
    const dialog = page.getByRole('dialog', { name: 'James David Lapslie' });
    await expect(dialog).toBeVisible();
    // Eight achievements: one in the spotlight, seven listed.
    await expect(dialog.locator('li')).toHaveCount(7);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('the team wall turns on its own, and pause stops it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const team = page.locator('#team');
    await team.locator('[aria-roledescription="carousel"]').scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2); // hovering the wall would pause it
    await expect(team.getByRole('heading', { level: 3, name: 'Nguyễn Khánh Linh' })).toBeVisible();
    await expect(team.getByRole('heading', { level: 3, name: 'Nguyễn Hoàng Linh' })).toBeVisible({ timeout: 9_000 });

    await team.getByRole('button', { name: 'Pause automatic rotation' }).click();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(6_500);
    await expect(team.getByRole('heading', { level: 3, name: 'Nguyễn Hoàng Linh' })).toBeVisible();
    await expect(team.getByRole('button', { name: 'Resume automatic rotation' })).toBeVisible();
  });

  test('hero renders its heading and its one call to action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.locator('a[href="#contact"]').filter({ hasText: 'Register for Free Consultation' }),
    ).toBeVisible();
  });

  /**
   * Owner, 2026-09-29: the background must read as ONE wash, black → rose →
   * white. Each band is its own gradient (tokens.css, `--gb-home-band-*`), so
   * the contract is that every band ends on exactly the colour the next one
   * starts on, and that the last band is white. Read from computed styles, so
   * it holds at any width without a pixel baseline.
   */
  test('the section backgrounds join into one black → rose → white ramp', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const bands = await page.evaluate(() =>
      [...document.querySelectorAll('main > section')].map((section) => {
        const style = getComputedStyle(section);
        const colours = style.backgroundImage.match(/rgba?\([^)]*\)/g) ?? [style.backgroundColor];
        return { id: section.id, first: colours[0], last: colours[colours.length - 1] };
      }),
    );

    expect(bands.length).toBeGreaterThanOrEqual(9);
    expect(bands[0]!.first).toBe('rgb(0, 0, 0)');
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]!.first, `seam into #${bands[i]!.id || 'hero'}`).toBe(bands[i - 1]!.last);
    }
    expect(bands.at(-1)!.last).toBe('rgb(255, 255, 255)');

    // Owner, 2026-10-01: the fade to white is spread over team, journey and
    // features, and white arrives where GlowBal Packages begins.
    const byId = Object.fromEntries(bands.map((band) => [band.id, band]));
    for (const id of ['team', 'journey', 'features']) {
      expect(byId[id]!.first, `#${id} should still be tinted`).not.toBe('rgb(255, 255, 255)');
    }
    expect(byId.features!.last).toBe('rgb(255, 255, 255)');
    expect(byId.pricing!.first).toBe('rgb(255, 255, 255)');
  });

  // Owner, 2026-10-01: a proof image at the foot of every number card (content
  // PDF (3) §4), the same size on all four so the cards stay one height.
  test('every number card ends in a proof image of one size', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const cards = page.locator('#numbers article');
    await expect(cards).toHaveCount(4);
    const boxes = await cards.evaluateAll((nodes) =>
      nodes.map((card) => {
        const slot = card.lastElementChild!.getBoundingClientRect();
        const box = card.getBoundingClientRect();
        return {
          card: Math.round(box.height),
          slot: `${Math.round(slot.width)}x${Math.round(slot.height)}`,
          flushBottom: Math.abs(slot.bottom - box.bottom) <= 2,
        };
      }),
    );
    expect(new Set(boxes.map((box) => box.card)).size, JSON.stringify(boxes)).toBe(1);
    expect(new Set(boxes.map((box) => box.slot)).size, JSON.stringify(boxes)).toBe(1);
    expect(boxes.every((box) => box.flushBottom)).toBe(true);
    await expect(page.locator('#numbers img[src*="web-access"]')).toHaveCount(1);
    await expect(page.locator('#numbers img[src*="venture-x-demo-day"]')).toHaveCount(1);
    await expect(page.locator('#numbers img[src*="young-entrepreneurship-2026"]')).toHaveCount(1);
  });

  test('the consultation form has the team photo beside it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const photo = page.locator('#contact figure img');
    await expect(photo).toHaveAttribute('alt', 'The GlowBal team at Venture X Demo Day');
    await expect(page.locator('#contact figcaption')).toContainText('The GlowBal team');
    // Left of the form on desktop.
    const [figure, form] = await Promise.all([
      page.locator('#contact figure').boundingBox(),
      page.locator('#contact form').boundingBox(),
    ]);
    expect(figure!.x + figure!.width).toBeLessThanOrEqual(form!.x);
  });

  // Owner, 2026-09-29: "càng ít dòng càng tốt" — the headline in as few lines as possible.
  for (const width of [390, 1024, 1440] as const) {
    test(`the hero headline fits on two lines at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dev/home');
      await page.evaluate(() => document.fonts.ready);

      const lines = await page.locator('h1').evaluate((heading) => {
        const style = getComputedStyle(heading);
        return Math.round(heading.getBoundingClientRect().height / parseFloat(style.lineHeight));
      });
      expect(lines).toBeLessThanOrEqual(2);
    });
  }

  // Owner, 2026-09-29: every student card the same size; a long quote ends in
  // an ellipsis and "Read more" shows the rest without resizing the card.
  test('student quote cards are one size and Read more opens the full quote', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');
    await page.evaluate(() => document.fonts.ready);

    const cards = page.locator('#stories [role="region"] article');
    await expect(cards).toHaveCount(8);
    const sizes = await cards.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return `${Math.round(box.width)}x${Math.round(box.height)}`;
      }),
    );
    expect(new Set(sizes).size, sizes.join(' ')).toBe(1);

    // Size only: clicking scrolls the card into view, so its position moves.
    const first = cards.first();
    const sizeOf = async () => {
      const box = await first.boundingBox();
      return { width: box?.width, height: box?.height };
    };
    const before = await sizeOf();
    await first.getByRole('button', { name: 'Read more' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nguyễn Hoàng Minh Anh' });
    await expect(dialog).toContainText('VinUni');
    expect(await sizeOf()).toEqual(before);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('the orbiting crests carry no "Up to" award strip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    await expect(page.locator('#scholarships li[data-orbit-node]')).toHaveCount(11);
    await expect(page.locator('#scholarships li[data-orbit-node]').filter({ hasText: /Up to/ })).toHaveCount(0);
  });

  test('hero CTA stays on one line with the data caption underneath', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/dev/home');

    const cta = page
      .locator('a[href="#contact"]')
      .filter({ hasText: 'Register for Free Consultation' });
    const caption = page.getByText(
      'A collection of insights from 3,000+ scholarships and 700+ universities worldwide.',
    );
    const [ctaBox, captionBox] = await Promise.all([cta.boundingBox(), caption.boundingBox()]);

    expect(await cta.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap');
    expect(ctaBox).not.toBeNull();
    expect(captionBox).not.toBeNull();
    expect(captionBox!.y).toBeGreaterThanOrEqual(ctaBox!.y + ctaBox!.height);
    expect(await caption.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  });

  test('a Pricing CTA scrolls to the form and pre-selects its package', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    await page.getByRole('button', { name: 'Get Yearly Plan' }).click();

    await expect(page.locator('#contact input[name="package"][value="yearly"]')).toBeChecked();
    await expect(page.getByText('You picked GlowBal Yearly — change anytime')).toBeVisible();
    await expect(page.locator('#contact')).toBeInViewport();
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

    const firstValue = page.locator('[aria-label="10,000+"] span');

    await expect(firstValue).toHaveText('10,000+');
    await firstValue.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(firstValue).not.toHaveText('10,000+');
    await expect(firstValue).toHaveText('10,000+', { timeout: 4_000 });
  });

  test('reduced motion keeps the complete figures static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dev/home');

    const firstValue = page.locator('[aria-label="10,000+"] span');
    await firstValue.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await expect(firstValue).toHaveText('10,000+');
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
