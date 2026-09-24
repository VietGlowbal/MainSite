import { Button, Section } from '@/shared/ui';
import { getLocaleText, homeCopy, type Locale } from '@/lib/i18n/locale';
import { HeroGlobe } from './hero-globe';

/**
 * Home hero — Figma 884:12039, with Home.md as the copy source of truth.
 *
 * The line and button under the globe are NOT in that frame: the owner added
 * them afterwards (2026-09-20) from a screenshot, so there is no node to bind
 * them to. The button is the kit's `secondary-on-dark` rather than a second
 * rose fill, so the hero keeps one primary action ("Plan your Global
 * Education"); switch the variant if the owner wants them equal.
 *
 * Layout is a grid, not the old flex row, because the caption has to sit under
 * the globe on desktop but NOT under it on a phone: there the globe stacks
 * above the headline, and a second CTA wedged between the two would push the
 * headline off the first screen. Hence three items and `order-*` below `lg`.
 * DOM order (copy, globe, caption) is kept as the reading order.
 */

export function HomeHero({ locale = 'en' }: { locale?: Locale } = {}) {
  const copy = homeCopy[locale];

  return (
    <Section
      tone="dark"
      containerClassName="grid items-center justify-items-center gap-x-gb-4xl gap-y-gb-6xl lg:grid-cols-[minmax(0,1fr)_auto] lg:justify-items-stretch lg:gap-y-gb-3xl"
    >
      <div className="order-2 flex min-w-0 flex-col gap-gb-6xl lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="flex flex-col gap-gb-xl">
          <h1 className="font-display text-gb-display-sm font-medium md:text-gb-display-lg">
            {copy.title}
          </h1>
          <p className="max-w-gb-width-xl text-gb-md md:text-gb-xl">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-col items-start gap-gb-lg">
          {/* /start, not /onboarding: the destination depends on whether this
              student has already answered the onboarding questions, and "/" is
              prerendered so it cannot know. src/app/start/route.ts decides —
              /onboarding for a new student, /universities for a returning one.

              `prefetch={false}` because /start is a route handler, not a page.
              This button is above the fold, so the default would fire a request
              at it on every home page view — and each one costs a Supabase
              session read to compute a redirect nobody asked for yet. There is
              nothing to prefetch either way: the response is a 307, so the
              router cannot warm the page it lands on. */}
          <Button
            href="/start"
            prefetch={false}
            size="xl"
            variant="primary-on-dark"
            className="whitespace-nowrap"
          >
            Plan your Global Education
          </Button>
          <p className="text-gb-md italic leading-relaxed text-white/80 md:text-gb-lg">
            Find a Scholarship that Fits You 100% free
          </p>
        </div>
      </div>

      {/* The rotating dot globe, in place of the 446KB static export of node
          104:7134. Decorative, hence aria-hidden inside the component; -24px is
          the nearest step to the design's -27px bleed.

          Square rather than the frame's 496x467: a sphere wants a square box,
          and the export's 29px of extra width was padding. */}
      <HeroGlobe className="order-1 w-[60%] max-w-[496px] lg:col-start-2 lg:row-start-1 lg:-mt-gb-3xl lg:w-[496px]" />

      {/* `#contact` is the consultation form at the foot of Home
          (home-contact.tsx). Smooth scroll comes from `html { scroll-behavior }`
          in globals.css — Next 16 no longer overrides it — and the section's own
          `scroll-mt` keeps it clear of the fixed nav. Same-page hash, so it
          resolves correctly on both "/" and "/vi". */}
      {/* Centred only from lg, where it sits under the globe as its own block.
          Below that the globe is at the top of the stack and this lands at the
          foot of the left-aligned copy, so centring it there just looks like a
          mistake. */}
      <div className="order-3 flex w-full max-w-[496px] flex-col items-start gap-gb-2xl lg:col-start-2 lg:row-start-2 lg:w-[496px] lg:items-center lg:text-center">
        {/* `text-balance` because at 496px the English copy leaves "journey"
            alone on a third line, and the Vietnamese wraps differently again. */}
        <p className="text-balance text-gb-lg font-medium text-white md:text-gb-xl">
          {getLocaleText(
            locale,
            'With 3000+ scholarships, we help you find and conquer the best route for your global education journey',
          )}
        </p>
        <Button href="#contact" size="xl" variant="secondary-on-dark">
          {getLocaleText(locale, 'Register for Free Consultation')}
        </Button>
      </div>
    </Section>
  );
}
