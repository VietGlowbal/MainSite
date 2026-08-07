import { Avatar, Button, Section } from '@/shared/ui';

/** A public mentor bio, rendered as a first-person student story on Home. */
export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  university?: string | null;
  universityLogoUrl?: string | null;
};

function UniversityLogo({
  name,
  src,
}: {
  name?: string | null;
  src?: string | null;
}) {
  return (
    <div className="flex h-gb-4xl items-center">
      {src ? (
        /* A university logo comes from the mentor's joined university record.
           It may be on a university-owned or Wikimedia host, so Next Image
           would need an open-ended allowlist. Fixed dimensions prevent layout
           shift while retaining the real supplied mark. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={name ?? ''}
          loading="lazy"
          className="h-full max-w-[132px] object-contain object-left"
        />
      ) : name ? (
        <p data-no-auto-translate className="line-clamp-2 text-gb-sm font-semibold text-fg-brand">
          {name}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Student stories — Figma 375:9996. This uses public mentor bios rather than
 * the source file's invented testimonials, names and university affiliations.
 */
export function HomeTestimonials({
  entries = [],
  ctaHref = '/advisors',
}: {
  entries?: readonly Testimonial[];
  ctaHref?: string;
}) {
  return (
    <Section padded={false} className="pb-gb-9xl" containerClassName="flex flex-col gap-gb-7xl">
      <div className="mx-auto max-w-gb-width-xl text-center">
        <h2 className="font-display text-gb-display-sm font-semibold text-brand md:text-gb-display-md">
          Learn from students who have succeeded
        </h2>
        <p className="mt-gb-2xl text-gb-md text-fg-tertiary md:text-gb-xl">
          GlowBal connects you with students all over the world who share real experience of
          universities, scholarships, applications and student life.
        </p>
      </div>

      {entries.length > 0 ? (
        <div>
          <div className="grid auto-rows-fr grid-cols-1 gap-gb-4xl md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <figure
                key={`${entry.name}-${entry.quote.slice(0, 24)}`}
                className="flex h-full min-h-[392px] flex-col rounded-gb-xl border border-line bg-surface p-gb-4xl shadow-gb-xs"
              >
                <div className="flex min-h-[228px] flex-col gap-gb-lg">
                  <UniversityLogo
                    name={entry.university ?? null}
                    src={entry.universityLogoUrl ?? null}
                  />
                  <blockquote className="line-clamp-7 text-gb-md text-fg-tertiary">
                    {entry.quote}
                  </blockquote>
                </div>
                <figcaption className="mt-auto flex items-center gap-gb-lg pt-gb-4xl">
                  <Avatar name={entry.name} src={entry.avatarUrl} />
                  <span className="min-w-0">
                    <span className="block text-gb-md font-semibold text-fg">{entry.name}</span>
                    <span className="block text-gb-md text-fg-tertiary">{entry.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-gb-width-xl border border-line bg-surface-muted p-gb-5xl text-center">
          <p className="text-gb-lg text-fg-secondary">
            Meet students and graduates who can share their own study-abroad experience.
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <Button href={ctaHref} size="xl">
          Find an advisor
        </Button>
      </div>
    </Section>
  );
}
