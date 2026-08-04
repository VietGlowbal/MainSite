import { Button, Container, ICONS, KitIcon } from '@/shared/ui';

/** A compact, public-safe projection for the Home scholarship rail. */
export type ScholarshipTeaser = {
  id: string;
  title: string;
  href: string;
  /** A university the scholarship applies to, when the awarding body is unknown. */
  university?: string;
  coverage?: string | null;
  deadline?: string | null;
};

/**
 * Scholarship library — Figma 375:9956. The rail keeps the 384 × 504 card
 * geometry and horizontal overflow from the design, while its content comes
 * from verified scholarship records instead of the source file's case-study
 * placeholder cards.
 */
export function HomeScholarships({
  entries = [],
  seeMoreHref = '/scholarships',
}: {
  entries?: readonly ScholarshipTeaser[];
  seeMoreHref?: string;
}) {
  return (
    <section className="bg-surface py-gb-9xl">
      <Container className="flex flex-col gap-gb-6xl">
        <div className="flex flex-wrap items-start justify-between gap-gb-3xl">
          <div className="min-w-0 max-w-gb-width-xl">
            <h2 className="font-display text-gb-display-sm font-semibold text-fg md:text-gb-display-md">
              Scholarship library
            </h2>
            <p className="mt-gb-2xl text-gb-lg text-fg-tertiary md:text-gb-xl">
              Browse a free preview. Create your profile to unlock full eligibility requirements
              and required documents, then save opportunities to your plan.
            </p>
          </div>
          <Button href={seeMoreHref} size="xl">
            See more
          </Button>
        </div>

        {entries.length > 0 ? (
          <>
            <div
              id="scholarship-rail"
              className="-mx-gb-xl flex snap-x snap-mandatory gap-gb-4xl overflow-x-auto px-gb-xl pb-gb-md md:mx-0 md:px-0"
            >
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex h-[504px] w-[384px] shrink-0 snap-start flex-col bg-surface-muted p-gb-2xl"
                >
                  <div className="flex flex-1 flex-col justify-between gap-gb-3xl p-gb-xl">
                    <p className="text-gb-lg font-semibold text-fg">
                      {entry.university ?? 'Scholarship opportunity'}
                    </p>
                    <div className="flex flex-wrap gap-gb-md text-gb-sm text-fg-tertiary">
                      {entry.coverage ? <span>{entry.coverage}</span> : null}
                      {entry.deadline ? <span>Deadline: {entry.deadline}</span> : null}
                    </div>
                  </div>
                  <div className="flex min-h-[240px] flex-col gap-gb-3xl bg-brand px-gb-3xl py-gb-4xl text-on-brand">
                    <h3 className="font-display text-gb-display-xs font-semibold">{entry.title}</h3>
                    <a
                      href={entry.href}
                      className="mt-auto inline-flex items-center gap-gb-sm self-start text-gb-md font-semibold text-on-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      View opportunity
                      <KitIcon art={ICONS.arrowRight} frame={20} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <p className="text-gb-sm text-fg-muted">Scroll or swipe to see more scholarships.</p>
          </>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center border border-line bg-surface-muted p-gb-5xl text-center">
            <div className="max-w-gb-width-sm">
              <h3 className="font-display text-gb-display-xs font-semibold text-fg">
                Find scholarships that fit your goals
              </h3>
              <p className="mt-gb-lg text-gb-md text-fg-tertiary">
                Create a free profile to save opportunities and build a focused application plan.
              </p>
              <Button href="/onboarding" className="mt-gb-3xl">
                Create a profile
              </Button>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
