import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import { getLocalizedFooter } from '@/features/marketing/ui';
import { Badge, Container, Footer, VerifiedMark } from '@/shared/ui';
import { formatMoney } from '@/lib/currency';
import { T } from '@/lib/i18n';
import type { PublicMentor, PublicMentorReview } from '@/lib/mentors';
import type { Currency, MentorAvailabilitySlot } from '@/types/mentorship';
import { MentorBooking } from './mentor-booking';
import { LocalizedReviewByline } from './mentor-i18n';
import { localizePath, type Locale } from '@/lib/i18n/locale';

/**
 * /mentors/[id] — Figma 375:21633 "Detail cố vấn" (1440x1823).
 *
 * Layout comes straight off the frame: a 1200-wide header card, then a
 * 720 / 96 / 384 two-column body. The section cards really do have only 12px of
 * horizontal padding against 32–48px of vertical (Frame 120 puts its heading at
 * x=12, y=48) — it reads tight in isolation and correct on the page, so it is
 * reproduced rather than "corrected" to a uniform inset.
 *
 * ── Five departures from the frame, each deliberate ────────────────────────
 *
 * 1. **The booking section's heading in the frame reads "Điểm mạnh"** — the
 *    same heading as the strengths section two blocks above it, over a
 *    paragraph about choosing a day. It is a copy-paste artefact, not a label;
 *    shipping it would give the page two identically-named sections. Rendered
 *    as "Book a session".
 *
 * 2. **The frame's calendar is a broken instance.** Its date grid is ten
 *    columns wide (`Dates` is 412px with cells at x=0…360) under a seven-column
 *    weekday header, so 1–31 flow continuously and Jan 8 2027 — a Friday —
 *    lands in the ninth column. A calendar whose dates do not sit under their
 *    weekday is not a calendar, so this is built as a real 7-column month.
 *
 * 3. **The strengths section's paragraph has no column behind it.** In the
 *    frame it holds a course description ("Master of Health Administration
 *    (MHA)… includes a 1-year full-time paid residency"), which is not a
 *    statement about the mentor and matches no field on `achiever_profiles`.
 *    Same call as the lorem ipsum on /universities/[id]: the chips render, the
 *    invented paragraph does not.
 *
 * 4. **The header shows the pre-rename nav** ("AI lên chiến lược"). 375:9845
 *    is newer and won that rename; `SiteNavigation` is the single source.
 *
 * 5. **The frame draws only the empty state for reviews.** There is no design
 *    for a populated list, so one is composed from the same card and type
 *    tokens as the sections around it.
 *
 * A Server Component: everything except the booking calendar is read-only, and
 * that owns its own client boundary.
 */

const DEGREE_LABELS: Record<string, string> = {
  undergraduate: 'Undergraduate',
  masters: "Master's",
  phd: 'PhD',
  alumni: 'Alumni',
};

/**
 * The card every section on the left column is drawn in — Figma 375:21659 and
 * its four siblings, all 720 wide on a Neutral/50 fill.
 */
function SectionCard({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-gb-2xl bg-surface-muted px-gb-lg py-gb-4xl"
    >
      <h2
        id={`${id}-heading`}
        className="font-display text-gb-display-xs font-semibold text-fg"
      >
        <T k={heading} />
      </h2>
      <div className="mt-gb-3xl">{children}</div>
    </section>
  );
}

/** Figma 375:21647 — the 1200x242 header card. */
function MentorHeader({ mentor }: { mentor: PublicMentor }) {
  const years = [mentor.study_start_year, mentor.graduation_year].filter(
    (y): y is number => typeof y === 'number',
  );
  // "2023 – 2025", or just one year when only one is known. A single year
  // repeated ("2023 – 2023") is what the frame shows, and it reads like a typo.
  const period = years.length === 2 && years[0] !== years[1]
    ? `${years[0]} – ${years[1]}`
    : (years[0]?.toString() ?? null);

  const degreeLabel = DEGREE_LABELS[mentor.degree_level] ?? mentor.degree_level;

  return (
    <div className="flex flex-col gap-gb-3xl rounded-gb-2xl bg-surface-muted p-gb-4xl sm:flex-row sm:gap-gb-5xl">
      <div className="size-[160px] shrink-0 overflow-hidden rounded-gb-full bg-surface">
        {mentor.avatar_url ? (
          /* Avatars come from user uploads and OAuth providers, so a plain <img>
             rather than next/image — an unconfigured host throws at runtime.
             Same call as the browse grid next door. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={mentor.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-gb-display-md font-semibold text-fg-muted">
            {mentor.display_name.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-gb-lg">
        {mentor.university?.logo_url ? (
          /* Crests come from arbitrary hosts — same reasoning as the avatar. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mentor.university.logo_url}
            alt={mentor.university.name}
            className="h-[40px] w-auto self-start object-contain"
          />
        ) : null}

        <div className="flex items-center gap-gb-lg">
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">
            {mentor.display_name}
          </h1>
          {/* Gated on verified_at, not on `approved` — see the note in
              PUBLIC_MENTOR_SELECT about why those are different claims. */}
          {mentor.verified_at ? (
            <span className="shrink-0 text-fg-verified">
              <VerifiedMark frame={16} />
            </span>
          ) : null}
        </div>

        <p className="text-gb-md text-fg-tertiary">
          {period ? <>{period} · </> : null}
          <T k={degreeLabel} />
          {mentor.subject ? <> · <T k={mentor.subject} /></> : null}
        </p>

        <MentorStats mentor={mentor} />
      </div>
    </div>
  );
}

/** The second supporting line — rating · sessions · languages (375:21655). */
function MentorStats({ mentor }: { mentor: PublicMentor }) {
  const rating = Number(mentor.avg_rating ?? 0);
  const sessions = Number(mentor.total_sessions ?? 0);

  /*
   * The frame's own copy for a brand-new mentor is "0.0 / 5 · chưa có đánh giá
   * nào" — the designer drew the zero state, which is what almost every row in
   * the table is today. So an unrated mentor says so instead of showing a 0.0
   * that reads like a bad score.
   */
  return (
    <p className="text-gb-md text-fg-tertiary">
      {sessions > 0 && rating > 0 ? (
        <T k="{rating} / 5" vars={{ rating: rating.toFixed(1) }} />
      ) : (
        <T k="No ratings yet" />
      )}
      {'  |  '}
      <T
        k={sessions === 1 ? '{count} session delivered' : '{count} sessions delivered'}
        vars={{ count: sessions }}
      />
      {mentor.languages.length > 0 ? (
        <>
          {'  |  '}
          {mentor.languages.map((language, index) => (
            <span key={language}>
              {index > 0 ? ', ' : null}
              <T k={language} />
            </span>
          ))}
        </>
      ) : null}
    </p>
  );
}

/** Figma 375:21811 — the booking card in the sidebar. */
function BookingCard({
  amount,
  currency,
  bookHref,
}: {
  amount: number;
  currency: Currency;
  bookHref: string;
}) {
  return (
    <div className="rounded-gb-2xl border border-line bg-surface p-gb-4xl shadow-gb-xs">
      <span className="flex size-[56px] items-center justify-center rounded-gb-lg border border-line bg-surface text-fg-secondary shadow-gb-xs">
        {/* The kit's paper plane, lifted for this card — see ICONS.send. */}
        <SendMark />
      </span>

      <div className="mt-gb-3xl flex flex-col gap-gb-xs">
        <p className="text-gb-md font-semibold text-fg-brand"><T k="Book this advisor" /></p>
        <p className="text-gb-xl font-semibold text-fg">
          {formatMoney(amount, currency)}
          <span className="text-fg-tertiary"><T k="/hour" /></span>
        </p>
        <p className="text-gb-sm text-fg-tertiary">
          <T k="+ 10% service fee · paid securely through Stripe" />
        </p>
      </div>

      {/*
       * An anchor to the calendar, not a second booking control. The frame
       * gives this card and the calendar footer the same "Đặt lịch ngay" label,
       * but a slot has to be chosen before anything can be booked — so the one
       * that has no slot in scope scrolls to the one that does.
       */}
      <a
        href={bookHref}
        className="mt-gb-2xl flex w-full items-center justify-center rounded-gb-md bg-brand px-gb-xl py-gb-lg text-gb-md font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <T k="Book a session" />
      </a>
    </div>
  );
}

/* Inlined rather than imported through KitIcon so the 56px tile can size it
   directly; the art itself lives in the shared registry. */
function SendMark() {
  return (
    <svg
      viewBox="0 0 24.4373 24.4373"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10.4763 13.961L22.7263 1.71095M10.6252 14.3437L13.6913 22.228C13.9614 22.9226 14.0965 23.2699 14.2911 23.3713C14.4598 23.4592 14.6607 23.4593 14.8295 23.3716C15.0243 23.2704 15.1597 22.9233 15.4306 22.2291L23.1194 2.52668C23.3639 1.89997 23.4862 1.58662 23.4193 1.38639C23.3612 1.2125 23.2248 1.07603 23.0509 1.01794C22.8507 0.951051 22.5373 1.07334 21.9106 1.3179L2.20823 9.00663C1.51398 9.27756 1.16685 9.41303 1.06569 9.60775C0.977992 9.77655 0.978111 9.97751 1.066 10.1462C1.16739 10.3408 1.51468 10.4759 2.20925 10.746L10.0936 13.8121C10.2346 13.8669 10.3051 13.8944 10.3644 13.9367C10.417 13.9742 10.4631 14.0202 10.5006 14.0728C10.5429 14.1322 10.5703 14.2027 10.6252 14.3437Z" />
    </svg>
  );
}

function ReviewList({
  reviews,
  count,
}: {
  reviews: readonly PublicMentorReview[];
  count: number;
}) {
  if (reviews.length === 0) {
    return (
      <p className="text-gb-lg text-fg-tertiary">
        <T k="No reviews yet — be the first to book and leave one." />
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-gb-2xl">
      <p className="text-gb-sm text-fg-muted">
        <T k={count === 1 ? '{count} review' : '{count} reviews'} vars={{ count }} />
      </p>
      <ul className="flex flex-col gap-gb-xl">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-gb-xl bg-surface p-gb-2xl">
            <p className="text-gb-sm font-semibold text-fg">
              <T k="{rating} / 5" vars={{ rating: review.rating }} />
            </p>
            {review.comment ? (
              <p className="mt-gb-md text-gb-md text-fg-tertiary">{review.comment}</p>
            ) : null}
            {/*
             * No author. `session_reviews` has no reviewer_name column — the
             * type declares one but the table does not have it, so every
             * review the old page rendered was already unattributed. Saying
             * "Glowbal student" is at least true.
             */}
            {/* Built as one string, not `text ·{' '}{date}` — adjacent text
                children do not survive hydration reliably, which cost a round
                on the availability copy in mentor-booking.tsx. */}
            <p className="mt-gb-md text-gb-xs text-fg-muted">
              <LocalizedReviewByline createdAt={review.created_at} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MentorDetail({
  mentor,
  slots,
  reviews,
  reviewCount,
  isSignedIn,
  locale = 'en',
}: {
  mentor: PublicMentor;
  slots: readonly MentorAvailabilitySlot[];
  reviews: readonly PublicMentorReview[];
  reviewCount: number;
  isSignedIn: boolean;
  locale?: Locale;
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  const currency = mentor.hourly_rate_currency;
  const amount = Number(mentor.hourly_rate_amount ?? 0);
  const hasPrice = amount > 0;
  const footer = getLocalizedFooter(locale);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" />

      <main>
        <Container className="pt-gb-5xl">
          {/* Not in the frame, which starts at the header card. Without it the
              only way back to the directory is the browser button — the same
              gap /universities/[id] fills with its own back link. */}
          <Link
            href={localizePath('/advisors', locale)}
            className="inline-flex items-center gap-gb-sm text-gb-sm font-semibold text-fg-tertiary transition-colors hover:text-fg"
          >
            <span aria-hidden="true">←</span> <T k="All advisors" />
          </Link>
        </Container>

        <Container className="pt-gb-2xl">
          <MentorHeader mentor={mentor} />
        </Container>

        <Container className="pb-gb-9xl pt-gb-5xl">
          <div className="flex flex-col gap-gb-9xl lg:grid lg:grid-cols-[minmax(0,720px)_384px] lg:items-start">
            {/* ── Left column, Figma 375:21658 ─────────────────────────── */}
            {/*
             * `order-2` on phones puts the price card above this, because the
             * single-column stack would otherwise place it after the calendar —
             * i.e. a student picks a time before learning what it costs. There
             * is no mobile frame for this page to defer to (the file's only
             * 375-wide frames are the nav menus), so this follows the rule the
             * desktop layout implies: price is visible while choosing.
             * `lg:order-none` hands both children back to grid auto-placement.
             */}
            <div className="order-2 flex min-w-0 flex-col gap-gb-5xl lg:order-none">
              {mentor.bio ? (
                <SectionCard id="about" heading="About">
                  <p className="whitespace-pre-line text-gb-lg text-fg-tertiary">
                    <T k={mentor.bio} />
                  </p>
                </SectionCard>
              ) : null}

              {mentor.strengths && mentor.strengths.length > 0 ? (
                <SectionCard id="strengths" heading="Strengths">
                  <ul className="flex flex-wrap gap-gb-md">
                    {mentor.strengths.map((strength) => (
                      <li key={strength}>
                        <Badge variant="brand-chip"><T k={strength} /></Badge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {mentor.help_topics.length > 0 ? (
                <SectionCard id="best-for" heading="Best for">
                  <ul className="flex flex-wrap gap-gb-md">
                    {mentor.help_topics.map((topic) => (
                      <li key={topic}>
                        <Badge variant="info-chip"><T k={topic} /></Badge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              <MentorBooking
                mentorId={mentor.id}
                mentorName={mentor.display_name}
                slots={slots}
                amount={amount}
                currency={currency}
                isSignedIn={isSignedIn}
              />

              <SectionCard id="reviews" heading="Reviews">
                <ReviewList reviews={reviews} count={reviewCount} />
              </SectionCard>
            </div>

            {/* ── Sidebar, Figma 375:21810 ─────────────────────────────── */}
            <aside className="order-1 lg:order-none lg:sticky lg:top-gb-5xl">
              {hasPrice ? (
                <BookingCard amount={amount} currency={currency} bookHref="#booking" />
              ) : (
                /*
                 * `hourly_rate_amount` is nullable and POST /checkout refuses a
                 * booking without it ("Mentor pricing is not configured"). A
                 * card showing a price of zero next to a live Book button would
                 * send the student to an error, so it says so up front.
                 */
                <div className="rounded-gb-2xl border border-line bg-surface p-gb-4xl">
                  <p className="text-gb-md font-semibold text-fg"><T k="Not bookable yet" /></p>
                  <p className="mt-gb-md text-gb-sm text-fg-tertiary">
                    <T k="This advisor hasn’t set a session price. Browse the directory for advisors who are taking bookings." />
                  </p>
                  <Link
                    href={localizePath('/advisors', locale)}
                    className="mt-gb-2xl flex w-full items-center justify-center rounded-gb-md border border-line bg-surface px-gb-xl py-gb-lg text-gb-md font-semibold text-fg transition-colors hover:bg-surface-hover"
                  >
                    <T k="Find an advisor" />
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </Container>
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={footer.tagline}
        columns={footer.columns}
        social={footer.social}
        copyright={footer.copyright}
        ratings={footer.ratings}
      />
    </div>
  );
}
