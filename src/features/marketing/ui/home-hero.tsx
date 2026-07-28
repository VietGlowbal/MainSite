import Image from 'next/image';
import { Button, Section } from '@/shared/ui';

/**
 * Home hero — Figma node 375:9857 (1440x646) on the "Khanh Linh - Chi" canvas,
 * which supersedes 104:7126. The layout is unchanged; the copy is not.
 *
 * The page's pitch moved from universities to scholarships: the headline is now
 * two lines instead of five, and the CTA reads "find matching scholarships"
 * rather than "find mine".
 *
 * ⚠️ THE CATALOGUE COUNT CONTRADICTS THE RECORD. This frame says "300+ trường
 * đại học"; the owner confirmed 200 on 24/07, and the Features block still says
 * 200. The frame is the newer artefact so it is what ships here, but 300 is the
 * direction that overstates coverage, and the two sections now disagree by 100
 * universities. Raised with the owner on 28/07 — whichever number is right, the
 * Features block has to move with this one.
 *
 * Copy is written in English and translated by the dictionary in
 * src/lib/i18n-dictionary.ts, which `DomTranslator` matches against the exact
 * trimmed text of a node. That is the pattern the landing page already uses,
 * and it is why this stays a server component: `t()` would force 'use client'
 * and push the largest text on the site behind hydration.
 *
 * Two things the design does that are easy to lose:
 *  - The heading is 48/54 Bricolage Medium, hand-set rather than bound to a
 *    text style — see --text-gb-display-lg in tokens.css.
 *  - The frame is called "Email capture" but contains only a button; there is
 *    no input field in it.
 */

/**
 * Figma places the globe at top:-27 relative to the container.
 *
 * public/home-hero-globe.png is the untouched export of node 104:7134. It is
 * 24bpp with no alpha and a black fill, which is fine only because this band is
 * black too — putting it on any other background will show a hard edge. If a
 * later section reuses it, get a transparent export first.
 */
const GLOBE = { width: 496, height: 467 };

export function HomeHero() {
  return (
    <Section tone="dark" containerClassName="flex flex-col-reverse items-center gap-gb-6xl lg:flex-row lg:items-center lg:gap-gb-4xl">
      <div className="flex min-w-0 flex-1 flex-col gap-gb-6xl">
        <div className="flex flex-col gap-gb-xl">
          <h1 className="font-display text-gb-display-sm font-medium md:text-gb-display-lg">
            A tool built for scholarship hunters
          </h1>
          <p className="max-w-gb-width-xl text-gb-md md:text-gb-xl">
            Personalised analysis and strategy, beside you for the whole scholarship hunt — across
            300+ universities and 3,000+ scholarships worth up to $150,000,000.
          </p>
        </div>

        <div className="flex max-w-gb-width-sm">
          <Button href="/onboarding" size="xl" variant="primary-on-dark">
            Find matching scholarships
          </Button>
        </div>
      </div>

      {/* Decorative; -24px is the nearest step to the design's -27px bleed. */}
      <Image
        src="/home-hero-globe.png"
        alt=""
        width={GLOBE.width}
        height={GLOBE.height}
        priority
        sizes="(max-width: 1024px) 60vw, 496px"
        className="h-auto w-[60%] max-w-[496px] shrink-0 lg:-mt-gb-3xl lg:w-[496px]"
      />
    </Section>
  );
}
