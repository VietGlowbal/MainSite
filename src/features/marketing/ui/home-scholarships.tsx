import { Button, Container, KitIcon, ICONS } from '@/shared/ui';
import { MissingContent } from './missing-content';

/**
 * Home scholarship rail — Figma 104:7225 (1280x780).
 *
 * A heading with a "See more" action on the right, then a horizontally
 * scrolling rail of scholarship cards with prev/next controls beneath.
 *
 * Scrolling is CSS (`overflow-x-auto` + scroll snap) rather than a carousel
 * library: it keeps the section a Server Component, gives touch and trackpad
 * users the swipe they already expect, and keeps keyboard access without
 * managing focus by hand. The design's two round buttons are anchor links to
 * the rail edges — they cannot animate scroll without client JS, so they are
 * rendered only when there is content to move through.
 *
 * ⚠️ THE CARDS ARE UNTITLED UI'S. The heading in Figma is literally
 * "Kho học bổng ...." — trailing dots, unfinished — and every card below it
 * still reads "Layers / Untitled has saved us thousands of hours of work / Read
 * case study". None of that is a scholarship. The rail therefore renders real
 * scholarships when given them and MissingContent when not; it never invents an
 * award, a value, or a deadline.
 *
 * ⚠️ AND THE DATABASE CANNOT FILL THEM. Measured 28/07 across all 2,877
 * published rows: `provider` is null on 2,877 of them and `country` on 2,859.
 * The card's bold line and its logo slot are both the awarding body, so there
 * is nothing real to print — `name`, `coverage`, `deadline_text` and `insight`
 * are the columns that are actually populated. Filling the slot from the linked
 * university was considered and rejected: it is right for
 * "Excellence Scholarship – Institut Galilée" and wrong for Chevening or DAAD,
 * and a card that misattributes an award is worse than no card.
 *
 * So "/" passes showPlaceholders={false} and no entries: the heading, the blurb
 * and the "See more" link are real and useful, and nothing fake ships under
 * them. Populate `scholarships.provider` (or agree a card that does not need
 * it) and the rail lights up with no change here.
 */

export type ScholarshipTeaser = {
  id: string;
  /** Awarding body, e.g. "Chevening". */
  provider: string;
  /** The award itself, one line. */
  title: string;
  href: string;
  /** Optional provider mark under /public. */
  logoSrc?: string;
};

export function HomeScholarships({
  entries = [],
  seeMoreHref = '/scholarships',
  showPlaceholders = true,
}: {
  entries?: readonly ScholarshipTeaser[];
  seeMoreHref?: string;
  /** false on "/" — see the note above; the dashed box is for the preview only. */
  showPlaceholders?: boolean;
}) {
  return (
    <section className="bg-surface py-gb-9xl">
      <Container className="flex flex-col gap-gb-6xl">
        <div className="flex flex-wrap items-start justify-between gap-gb-3xl">
          <div className="min-w-0 max-w-gb-width-xl">
            <h2 className="font-display text-gb-display-xs font-medium md:text-gb-display-sm">
              Scholarship library
            </h2>
            <p className="mt-gb-lg text-gb-md text-fg-tertiary">
              Browse a preview for free. Create your profile to unlock the full eligibility
              criteria and required documents, and to save opportunities into your plan.
            </p>
          </div>
          <Button href={seeMoreHref}>See more</Button>
        </div>

        {entries.length === 0 ? (
          showPlaceholders ? (
            <MissingContent
              node="104:7225"
              label='Thẻ học bổng — Figma còn tiêu đề "Kho học bổng ...." bỏ dở và nội dung mẫu "Layers / Read case study"'
            />
          ) : null
        ) : (
          <>
            {/* -mx + px so the cards can bleed to the viewport edge on mobile
                while the first one still lines up with the container. */}
            <div
              id="scholarship-rail"
              className="-mx-gb-xl flex snap-x snap-mandatory gap-gb-4xl overflow-x-auto px-gb-xl pb-gb-md md:mx-0 md:px-0"
            >
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-gb-xl border border-line"
                >
                  <div className="flex h-[140px] items-center justify-center bg-surface-muted p-gb-3xl">
                    {entry.logoSrc ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={entry.logoSrc} alt="" className="max-h-gb-5xl w-auto" />
                    ) : (
                      <span className="text-gb-md font-semibold text-fg-muted">
                        {entry.provider}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-gb-lg bg-brand p-gb-3xl text-on-brand">
                    <p className="text-gb-md font-semibold">{entry.provider}</p>
                    <p className="flex-1 text-gb-sm">{entry.title}</p>
                    <a
                      href={entry.href}
                      className="inline-flex items-center gap-gb-md text-gb-sm font-semibold underline-offset-4 hover:underline"
                    >
                      View scholarship
                      <KitIcon art={ICONS.arrowRight} frame={20} />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <p className="text-gb-sm text-fg-muted">
              Scroll or swipe to see more scholarships.
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
