import { Avatar, Button, Section } from '@/shared/ui';

/** A public mentor bio, rendered as a first-person student story on Home. */
export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  university?: string | null;
};

/**
 * Student stories — Figma 375:9996. This uses public mentor bios rather than
 * the source file's invented testimonials, names and university affiliations.
 */
export function HomeTestimonials({
  entries = [],
  ctaHref = '/mentors',
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
        <div className="[mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)]">
          <div className="columns-1 gap-gb-4xl sm:columns-2 lg:columns-3">
            {entries.map((entry) => (
              <figure
                key={`${entry.name}-${entry.quote.slice(0, 24)}`}
                className="mb-gb-4xl break-inside-avoid rounded-gb-xl border border-line bg-surface p-gb-4xl shadow-gb-xs"
              >
                {entry.university ? (
                  <p className="mb-gb-lg text-gb-sm font-semibold text-fg-brand">{entry.university}</p>
                ) : null}
                <blockquote className="text-gb-md text-fg-tertiary">{entry.quote}</blockquote>
                <figcaption className="mt-gb-6xl flex items-center gap-gb-lg">
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
          Find a mentor
        </Button>
      </div>
    </Section>
  );
}
