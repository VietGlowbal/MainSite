import { Section } from '@/shared/ui';
import { Avatar, Button } from '@/shared/ui';
import { MissingContent } from './missing-content';

/**
 * Home testimonials — Figma 104:7265 (1440x1066).
 *
 * A three-column masonry of student quotes, each card carrying the student's
 * university logo, the quote, and an avatar with name and "Student <UNI>". The
 * design fades the bottom row out under the CTA, which is the mask below.
 *
 * ⚠️ NO QUOTES SHIP. This is the one section where the placeholder problem is
 * not cosmetic: the mockup fills every card with Untitled UI's demo copy
 * ("Untitled has been a lifesaver for our team...") under invented names —
 * Nikolas Gibbons, Ammar Foley, Mathilde Lewis, Owen Garcia — and attributes
 * each to a REAL, NAMED university (RMIT, BUV, Fulbright).
 *
 * That is a fabricated endorsement, not lorem ipsum: a visitor reads it as four
 * named students at named institutions vouching for the product, and the
 * universities have not agreed to appear. So the layout ships and the content
 * does not. Pass real, consented testimonials via `entries` to switch it on.
 *
 * The university logos are equally a permissions question — using an RMIT or
 * Fulbright mark implies a relationship. Confirm before wiring `logoSrc`.
 */

export type Testimonial = {
  /** The student's own words. Never paraphrase or compose these. */
  quote: string;
  name: string;
  /** e.g. "Student RMIT" — the design's own wording. */
  role: string;
  avatarUrl?: string | null;
  /** Path under /public. Requires the university's permission. */
  logoSrc?: string;
  logoAlt?: string;
};

export function HomeTestimonials({
  entries = [],
  ctaHref = '/mentors',
}: {
  entries?: readonly Testimonial[];
  ctaHref?: string;
}) {
  return (
    <Section containerClassName="flex flex-col gap-gb-7xl">
      <div className="mx-auto max-w-gb-width-xl text-center">
        {/* Brand-coloured heading — the only one on Home that is, per 104:7266. */}
        <h2 className="font-display text-gb-display-sm font-medium text-brand md:text-gb-display-md">
          Learn from students who made it
        </h2>
        <p className="mt-gb-2xl text-gb-md text-fg-tertiary md:text-gb-lg">
          GlowBal connects you with students all over the world who share real experience of
          universities, scholarships, applications and student life.
        </p>
      </div>

      {entries.length === 0 ? (
        <MissingContent
          node="104:7265"
          label="Nhận xét của sinh viên — cần trích dẫn thật, có sự đồng ý của người nói và của trường"
          className="mx-auto max-w-gb-width-xl"
        />
      ) : (
        /* The design fades the last row out behind the CTA. `mask-image` rather
           than an overlay so the page background can be anything. */
        <div className="[mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)]">
          <div className="columns-1 gap-gb-3xl sm:columns-2 lg:columns-3">
            {entries.map((entry) => (
              <figure
                key={`${entry.name}-${entry.quote.slice(0, 24)}`}
                className="mb-gb-3xl break-inside-avoid rounded-gb-xl border border-line bg-surface p-gb-3xl shadow-gb-xs"
              >
                {entry.logoSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={entry.logoSrc}
                    alt={entry.logoAlt ?? ''}
                    height={24}
                    className="mb-gb-xl h-gb-3xl w-auto"
                  />
                ) : null}
                <blockquote className="text-gb-sm text-fg-secondary">{entry.quote}</blockquote>
                <figcaption className="mt-gb-3xl flex items-center gap-gb-lg">
                  <Avatar name={entry.name} src={entry.avatarUrl} />
                  <span className="min-w-0">
                    <span className="block text-gb-sm font-semibold text-fg">{entry.name}</span>
                    <span className="block text-gb-sm text-fg-muted">{entry.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
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
