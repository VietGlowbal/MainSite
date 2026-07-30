import { Button, Section } from '@/shared/ui';
import { HeroGlobe } from './hero-globe';

/**
 * Home hero — Figma node 375:9857 (1440x646) on the "Khanh Linh - Chi" canvas,
 * which supersedes 104:7126. The layout is unchanged; the copy is not.
 *
 * The page's pitch moved from universities to scholarships: the headline is now
 * two lines instead of five, and the CTA reads "find matching scholarships"
 * rather than "find mine".
 *
 * ⚠️ THE UNIVERSITY COUNT DELIBERATELY DEPARTS FROM THE FRAME. 375:9857 says
 * "300+ trường đại học". The owner confirmed 200 on 24/07 and re-confirmed it
 * on 28/07 when the conflict was raised, so this ships 200+ and the frame is
 * wrong — not the other way round. It now agrees with the Features block, which
 * also says 200+.
 *
 * Those two places are the ONLY ones that state this number. Change them
 * together, and ask the designer to correct the frame rather than "fixing" this
 * back to match it.
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
            200+ universities and 3,000+ scholarships worth up to $150,000,000.
          </p>
        </div>

        <div className="flex max-w-gb-width-sm">
          <Button href="/onboarding" size="xl" variant="primary-on-dark">
            Find matching scholarships
          </Button>
        </div>
      </div>

      {/* The rotating dot globe, in place of the 446KB static export of node
          104:7134. Decorative, hence aria-hidden inside the component; -24px is
          the nearest step to the design's -27px bleed.

          Square rather than the frame's 496x467: a sphere wants a square box,
          and the export's 29px of extra width was padding. */}
      <HeroGlobe className="w-[60%] max-w-[496px] shrink-0 lg:-mt-gb-3xl lg:w-[496px]" />
    </Section>
  );
}
