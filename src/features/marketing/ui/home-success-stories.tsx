import { Section } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import {
  SUCCESS_STORY_FEATURE,
  SUCCESS_STORY_VOICES,
  type SuccessStoryVoice,
} from './success-stories-content';

/**
 * Success Stories — the proof section, between the scholarship showcase and the
 * standout numbers.
 *
 * Everything above this point on "/" is a claim in the abstract: "$150M in
 * total scholarship value", "3000+ scholarships", eleven crests orbiting a
 * headline. Those are marketing figures and the owner has ruled that they may
 * be (partner-scholarship-value.ts). This section is the answer to the question
 * they provoke — *who actually got one* — so it is the one place on the page
 * where nothing may be rounded, tiered or invented. All of it comes from
 * ./success-stories-content.ts, verbatim.
 *
 * The section has two beats, and they are doing different jobs:
 *
 *   1. ONE STUDENT'S OUTCOMES. Five named universities that offered Phạm Quỳnh
 *      Chi funding. This is evidence.
 *   2. SEVEN STUDENTS' WORDS. What the product is like to use. This is
 *      sentiment.
 *
 * Mixing them would weaken both — a quote sitting in a row of offers reads as
 * though it were an offer. So they are separated by a heading that states the
 * change of subject rather than labelling it.
 *
 * ─── THREE PLACES THIS DEPARTS FROM THE MOCKUP, AND WHY ──────────────────────
 *
 * The owner's mockup is a slide: a large portrait card on the left, a grid of
 * six equal quote cards on the right, each holding the words "Text Text Text".
 * Those placeholders are the tell — the layout was drawn before the quotes
 * existed, and the real ones do not fit it.
 *
 * 1. THE QUOTE GRID IS A COLUMN FLOW, NOT A GRID. The real quotes run from 14
 *    to 92 words, a 6.5× spread. An equal grid would either truncate the long
 *    ones or leave the short ones sitting in a third of a box. `columns-*` with
 *    `break-inside-avoid` is CSS multi-column: it balances the heights itself,
 *    keeps every quote whole, needs no JavaScript and no measuring pass.
 *    Truncation was never an option here. The last four characters of Hà Trung
 *    Khải's quote are `=))))`, and that is precisely the part that proves a
 *    student wrote it rather than a marketing team.
 *
 * 2. THERE ARE NO PHOTOGRAPHS, SO THE CARD IS TYPOGRAPHIC. The video is "add
 *    sau" and Chi has no stored portrait — she is seeded in
 *    supabase-team-members-seed.sql with a null photo, which is why her card in
 *    home-team.tsx falls back to a monogram. A layout built around a portrait
 *    would therefore ship as a grey rectangle for however many weeks it takes.
 *    So `media` is an optional slot: pass a node and the card splits into two
 *    columns, pass nothing and it is a single column that looks finished rather
 *    than pending. There is deliberately no placeholder, no blurred stand-in and
 *    no play button over an empty box.
 *
 * 3. NOTHING MOVES. No scroll reveal, no hover lift, no entrance. Two reasons,
 *    and neither is laziness: this section follows the partner orbit, which
 *    rotates continuously, so stillness is the strongest available contrast —
 *    and a hover effect on a quote card suggests it can be clicked, which is
 *    the same lie the preview cards in home-scholarship-preview.tsx were
 *    rewritten to avoid. These are read, not operated.
 *
 * ─── WHY ROSE APPEARS EXACTLY ONCE ───────────────────────────────────────────
 *
 * `text-fg-brand-on-inverse` is used on the award magnitudes and nowhere else
 * in the section. Scanned at arm's length the card reads as a short column of
 * rose marks down its left edge — 100%, 100%, Full — which is the section's
 * entire argument in one glance. Spend it anywhere else and that stops working.
 *
 * ⚠️ That token is NOT `text-brand`, and the two are not interchangeable here.
 * Brand rose is #e11d48, which measures about 2.7:1 on this band and fails WCAG
 * AA at any size. See the ⚠️ beside `--gb-text-brand-on-inverse` in tokens.css;
 * this section is what it was added for.
 *
 * ─── LOCALE ──────────────────────────────────────────────────────────────────
 *
 * The chrome goes through `getLocaleText` like the rest of Home. The quotes do
 * not: they are Vietnamese at the source, so both languages are written out in
 * the content file and picked here, and every node carrying a person's words,
 * name, school or university is marked `data-no-auto-translate` so DomTranslator
 * leaves them alone. Under `en`, one line says the quotes are translated —
 * without it the page would present an English sentence as something a student
 * said.
 */

/** Picks the written side of a bilingual pair. See the locale note above. */
function pick(locale: Locale, pair: { readonly vi: string; readonly en: string }): string {
  return locale === 'vi' ? pair.vi : pair.en;
}

function Voice({ locale, voice }: { locale: Locale; voice: SuccessStoryVoice }) {
  return (
    /* `break-inside-avoid` is what makes the column flow behave as a masonry
       rather than slicing a quote across a column boundary. The bottom margin
       is the vertical rhythm — `gap` only sets the gutter BETWEEN columns in a
       multi-column flow, it does nothing between stacked items inside one. */
    <li className="mb-gb-3xl break-inside-avoid rounded-gb-md border border-line-on-inverse bg-surface-inverse-deep p-gb-3xl">
      {/* Capped at 60 characters. These are long quotes on a dark band, which
          is the least forgiving combination for line length. */}
      <blockquote
        data-no-auto-translate
        className="max-w-[60ch] text-pretty text-gb-md leading-relaxed text-fg-on-inverse"
      >
        {pick(locale, voice.quote)}
      </blockquote>
      <footer className="mt-gb-xl flex flex-col gap-gb-xxs border-t border-line-on-inverse pt-gb-xl">
        <span data-no-auto-translate className="text-gb-sm font-semibold text-fg-on-inverse">
          {voice.name}
        </span>
        {/* One student's school was not supplied, so the line is absent rather
            than empty — same rule as the null `programme` in home-team.tsx. */}
        {voice.school === null ? null : (
          <span data-no-auto-translate className="text-gb-xs text-fg-on-inverse-muted">
            {voice.school}
          </span>
        )}
      </footer>
    </li>
  );
}

export function HomeSuccessStories({
  locale = 'en',
  media,
}: {
  locale?: Locale;
  /** The Quỳnh Chi video, when it exists. See departure 2 in the header. */
  media?: React.ReactNode;
} = {}) {
  const feature = SUCCESS_STORY_FEATURE;
  const hasMedia = media !== undefined && media !== null;

  return (
    <Section
      tone="dark"
      padded={false}
      className="py-gb-9xl"
      containerClassName="flex flex-col gap-gb-7xl"
    >
      {/* Left-aligned, where the orbit above is centred. The change of axis is
          what separates the two dark bands — a colour change would have meant
          a visible seam, and there is no seam here, just a different shape. */}
      <div className="flex max-w-[54ch] flex-col gap-gb-xl">
        <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg-on-inverse md:text-gb-display-md">
          {getLocaleText(locale, 'Success stories')}
        </h2>
        <p className="text-balance text-gb-lg leading-relaxed text-fg-on-inverse-muted">
          {getLocaleText(locale, 'Real offers, and what students say in their own words.')}
        </p>
      </div>

      {/* ⚠️ THE WIDTH CAP IS CONDITIONAL AND LOAD-BEARING. A bordered card holds
          the eye to its edges, so a full-width one with a single column of
          content inside reads as though the other half failed to load — which
          is the same "looks pending" failure the media slot exists to avoid,
          moved indoors. Capped, the same content reads as a deliberate column
          and the empty space falls outside the border where it costs nothing.
          Once `media` is supplied the second column fills that width honestly,
          so the cap lifts on the same branch. */}
      <article
        className={`rounded-gb-xl border border-line-on-inverse bg-surface-inverse-deep p-gb-4xl md:p-gb-6xl${
          hasMedia ? '' : ' lg:max-w-[880px]'
        }`}
      >
        <div
          className={
            hasMedia
              ? 'grid items-start gap-gb-6xl lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
              : 'flex flex-col'
          }
        >
          {hasMedia ? media : null}

          <div className="flex min-w-0 flex-col gap-gb-4xl">
            <div className="flex flex-col gap-gb-md">
              <h3
                data-no-auto-translate
                className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg-on-inverse md:text-gb-display-sm"
              >
                {feature.name}
              </h3>
              <p className="text-gb-lg text-fg-on-inverse-secondary">
                {pick(locale, feature.summary)}
              </p>
            </div>

            {/* The ledger. A list, not a table: there are no column headings to
                give a table, and the magnitude is absent on two rows, which a
                table would render as two empty cells. */}
            <ul className="flex list-none flex-col">
              {feature.awards.map((entry) => (
                <li
                  key={entry.institution}
                  className="grid gap-gb-xs border-t border-line-on-inverse py-gb-2xl sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-gb-2xl"
                >
                  {/* Empty on the two rows whose value was not supplied. It
                      stays a grid cell rather than collapsing, so the five
                      institution names still line up on one edge. */}
                  <span className="font-display text-gb-xl font-semibold text-fg-brand-on-inverse">
                    {entry.magnitude}
                  </span>
                  <div className="flex min-w-0 flex-col gap-gb-xs">
                    <span className="flex flex-wrap items-center gap-gb-md">
                      <span
                        data-no-auto-translate
                        className="font-display text-gb-xl font-semibold text-fg-on-inverse"
                      >
                        {entry.institution}
                      </span>
                      {entry.enrolled ? (
                        <span className="rounded-gb-sm border border-line-on-inverse px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-on-inverse-secondary">
                          {getLocaleText(locale, 'Now studying here')}
                        </span>
                      ) : null}
                    </span>
                    <span
                      data-no-auto-translate
                      className="text-gb-sm text-fg-on-inverse-muted"
                    >
                      {entry.award}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <div className="flex flex-col gap-gb-4xl">
        {/* Counted from the array, so removing a student does not leave this
            line stating a number the page no longer shows. */}
        <h3 className="max-w-[54ch] font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg-on-inverse">
          {getLocaleText(locale, '{count} students, on what GlowBal changed for them', {
            count: SUCCESS_STORY_VOICES.length,
          })}
        </h3>

        <ul className="list-none gap-gb-3xl md:columns-2 lg:columns-3">
          {SUCCESS_STORY_VOICES.map((voice) => (
            <Voice key={voice.name} locale={locale} voice={voice} />
          ))}
        </ul>

        {locale === 'vi' ? null : (
          <p className="text-gb-xs text-fg-on-inverse-muted">
            {getLocaleText(locale, 'Quotes translated from Vietnamese.')}
          </p>
        )}
      </div>
    </Section>
  );
}
