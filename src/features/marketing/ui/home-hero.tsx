import { Button, Section } from '@/shared/ui';
import { homeCopy, type Locale } from '@/lib/i18n/locale';
import { HeroGlobe } from './hero-globe';

/** Home hero — Figma 884:12039, with Home.md as the copy source of truth. */

export function HomeHero({ locale = 'en' }: { locale?: Locale } = {}) {
  const copy = homeCopy[locale];

  return (
    <Section tone="dark" containerClassName="flex flex-col-reverse items-center gap-gb-6xl lg:flex-row lg:items-center lg:gap-gb-4xl">
      <div className="flex min-w-0 flex-1 flex-col gap-gb-6xl">
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
            Find a University that Fits You 100% free
          </p>
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
