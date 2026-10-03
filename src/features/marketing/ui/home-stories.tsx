'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { ICONS, KitIcon, Modal } from '@/shared/ui';
import {
  FEATURED_STORY,
  QUOTE_CLAMP_CHARS,
  STUDENT_QUOTES,
  type StudentQuote,
} from '../domain/home-content';
import { highlightPhrases } from './home-highlight';

/**
 * Success stories — sales-journey handoff §3 (NEW section).
 *
 * One full-width featured story (Phạm Quỳnh Chi), followed by a horizontally
 * scrolling track of student quotes. This follows the v2 prototype's visual
 * hierarchy while keeping the accessible carousel controls from v1.
 *
 * ─── REAL PEOPLE, SO THREE RULES ────────────────────────────────────────────
 *
 * - The quotes are verbatim. Vietnamese is the original; the English page shows
 *   the draft translation with a "Translated from Vietnamese" note.
 * - Portraits are the owner-supplied v2 assets. A student without a supplied
 *   image keeps the initials fallback rather than receiving an invented face.
 * - University marks: only VinUniversity has a logo file. The other four are
 *   plain name chips, never a redrawn crest.
 *
 * ─── VIDEO-READY, NOT VIDEO ─────────────────────────────────────────────────
 *
 * The handoff draws a play button and a "Watch Chi's story" chip over the
 * portrait. The box always shows as a video (owner, 2026-10-01): thumbnail,
 * play button, chip. Until `FEATURED_STORY.video` is set the button is
 * disabled and the chip reads "Coming soon"; setting it enables play with no
 * layout change. Clicking play swaps the portrait for the video in
 * place — muted, with controls, never autoplaying on load.
 *
 * The featured portrait and testimonial images are local, owner-supplied v2
 * assets; each quote box crops its photo square, as the content PDF asks.
 *
 * ─── EVERY QUOTE CARD IS THE SAME SIZE (owner, 2026-09-29) ─────────────────
 *
 * The row stretches, so each card takes the height of the tallest, and a
 * quote never grows its card: text past six lines ends in an ellipsis and
 * "Read more" opens the whole quote in a dialog. Expanding in place was the
 * previous build, and it is exactly what made the row uneven. A short quote
 * simply leaves the lower part of its card empty.
 *
 * Whether a quote is cut is MEASURED on the card (scrollHeight vs the clamped
 * height), not guessed from its length: the same quote wraps differently at
 * 300px and 360px, and in English and Vietnamese. The server render uses the
 * character heuristic so the first paint is already close.
 */

/** Desktop step for the arrow buttons: one 360px card plus its 24px gap. */
const DESKTOP_STEP_PX = 384;

/**
 * True when `node`'s text is cut by its line clamp. Re-measured whenever the
 * node resizes (breakpoints, font swap), starting from the server's guess.
 */
function useIsClamped(initial: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(initial);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const measure = () => setClamped(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, clamped] as const;
}

function QuotePhoto({ quote, size }: { quote: StudentQuote; size: 'card' | 'dialog' }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-gb-xl border bg-black/30 ${
        size === 'card' ? 'size-[80px] border-white/15 md:size-[96px]' : 'size-[112px] border-line'
      }`}
    >
      {quote.portrait ? (
        <Image
          src={quote.portrait}
          alt={quote.name}
          fill
          sizes={size === 'card' ? '96px' : '112px'}
          className="object-cover"
          style={{ objectPosition: quote.focus }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gb-marketing-wine-800 to-gb-brand-500 font-display text-gb-display-xs font-semibold text-white"
        >
          {quote.initials}
        </span>
      )}
    </div>
  );
}

/** The whole quote, opened from a card's "Read more". */
function QuoteDialog({
  quote,
  locale,
  onClose,
}: {
  quote: StudentQuote | null;
  locale: Locale;
  onClose: () => void;
}) {
  return (
    <Modal open={quote !== null} onClose={onClose} label={quote?.name ?? ''} className="max-w-xl">
      {quote ? (
        <div className="flex flex-col gap-gb-2xl text-fg">
          <button
            type="button"
            onClick={onClose}
            aria-label={getLocaleText(locale, 'Close')}
            className="absolute right-gb-lg top-gb-lg flex size-[44px] items-center justify-center rounded-gb-full text-fg-tertiary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.close} frame={20} />
          </button>
          <header className="flex items-center gap-gb-xl pr-gb-5xl">
            <QuotePhoto quote={quote} size="dialog" />
            <div className="min-w-0">
              <p data-no-auto-translate className="font-display text-gb-xl font-semibold text-fg">
                {quote.name}
              </p>
              {quote.school ? (
                <p data-no-auto-translate className="mt-gb-xs text-gb-sm text-fg-tertiary">
                  {quote.school}
                </p>
              ) : null}
            </div>
          </header>
          <div className="border-t border-line pt-gb-2xl">
            <span aria-hidden="true" className="block h-gb-xl font-display text-[40px] font-bold leading-[28px] text-brand">
              “
            </span>
            {/* The student's own words: never machine-translated. */}
            <p data-no-auto-translate className="mt-gb-sm text-pretty text-gb-md leading-[26px] text-fg-secondary">
              {locale === 'vi' ? quote.vi : quote.en}
            </p>
            {locale === 'vi' ? null : (
              <p className="mt-gb-xl text-gb-xs text-fg-muted">{getLocaleText(locale, 'Translated from Vietnamese')}</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function QuoteCard({
  quote,
  locale,
  onReadMore,
  className,
}: {
  quote: StudentQuote;
  locale: Locale;
  onReadMore: (quote: StudentQuote) => void;
  className: string;
}) {
  const text = locale === 'vi' ? quote.vi : quote.en;
  const [textRef, clamped] = useIsClamped(text.length > QUOTE_CLAMP_CHARS);

  /* The content PDF's order for each box: square photo, name, school and
     city, then the quote with "… xem thêm" when it runs long. The v2 HTML
     and the F1 draft both set the square photo beside the name rather than
     across the top, which keeps a long quote from pushing the name out of
     sight. The row stretches its cards, so every card matches the tallest;
     the "Read more" row keeps its place at the foot even when empty.
     ⚠️ No `h-full` here: flexbox only stretches an item whose height is
     `auto`, and 100% of the row's indefinite height sizes it to its content. */
  return (
    <article
      className={`flex snap-start flex-col gap-gb-xl rounded-gb-2xl border border-white/12 bg-black/25 shadow-gb-lg backdrop-blur-sm ${className}`}
    >
      <header className="flex items-center gap-gb-lg">
        <QuotePhoto quote={quote} size="card" />
        <div className="min-w-0">
          <p data-no-auto-translate className="font-display text-gb-lg font-semibold leading-[24px] text-white">
            {quote.name}
          </p>
          {quote.school ? (
            <p data-no-auto-translate className="mt-gb-xs text-[13px] leading-[18px] text-white/60">
              {quote.school}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-gb-sm border-t border-white/10 pt-gb-xl">
        <span aria-hidden="true" className="h-gb-xl font-display text-[40px] font-bold leading-[28px] text-gb-brand-300">
          “
        </span>
        {/* The student's own words: never machine-translated. Always clamped
            to six lines; the browser adds the ellipsis where it cuts. */}
        <p ref={textRef} data-no-auto-translate className="line-clamp-6 text-pretty text-[15px] leading-[24px] text-white/88">
          {text}
        </p>
        <div className="mt-auto flex min-h-[44px] items-end md:min-h-[32px]">
          {clamped ? (
            <button
              type="button"
              onClick={() => onReadMore(quote)}
              aria-haspopup="dialog"
              className="min-h-[44px] text-gb-sm font-semibold text-gb-brand-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:min-h-[32px]"
            >
              {getLocaleText(locale, 'Read more')}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FeaturedStory({ locale }: { locale: Locale }) {
  const [playing, setPlaying] = useState(false);
  const video = FEATURED_STORY.video;

  return (
    <article className="grid w-full gap-gb-4xl rounded-gb-2xl border border-gb-brand-500/35 bg-black/20 p-gb-3xl shadow-gb-lg md:grid-cols-[minmax(260px,0.72fr)_minmax(0,1fr)] md:p-gb-4xl">
      <div className="relative aspect-[4/3] overflow-hidden rounded-gb-xl bg-gb-neutral-950 md:aspect-[5/4]">
        {video !== null && playing ? (
          <video
            className="size-full bg-black object-cover"
            src={video.src}
            poster={FEATURED_STORY.portrait}
            controls
            autoPlay
            muted
            playsInline
            aria-label={getLocaleText(locale, "Watch Chi's story")}
          />
        ) : (
          <>
            {/* The video's thumbnail. The box is a video slot whether or not
                the file exists yet (owner, 2026-10-01). */}
            <Image
              src={FEATURED_STORY.portrait}
              alt={FEATURED_STORY.name}
              fill
              sizes="(min-width: 1280px) 460px, (min-width: 768px) 38vw, calc(100vw - 80px)"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-black/85 px-gb-xl pb-gb-xl pt-gb-6xl">
              <p data-no-auto-translate className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-white">
                {FEATURED_STORY.name}
              </p>
            </div>
            <span className="absolute left-gb-lg top-gb-lg inline-flex items-center gap-gb-sm rounded-gb-full bg-black/60 px-gb-md py-gb-xs text-gb-xs font-semibold text-white backdrop-blur-sm">
              <span aria-hidden="true" className="size-gb-sm rounded-gb-full bg-gb-brand-500" />
              {getLocaleText(locale, video !== null ? "Watch Chi's story" : 'Coming soon')}
            </span>
            {/* Bottom-right, beside the name: centred, it covered her face.
                Until the file arrives the button is disabled rather than
                hidden, so the box already reads as a video and nothing moves
                when it lands. */}
            <button
              type="button"
              onClick={() => setPlaying(true)}
              disabled={video === null}
              aria-label={getLocaleText(locale, "Watch Chi's story")}
              className="absolute bottom-gb-xl right-gb-xl z-[1] flex size-gb-7xl items-center justify-center rounded-gb-full bg-brand text-white shadow-[0_0_0_8px_color-mix(in_srgb,var(--color-brand)_25%,transparent)] transition-[background-color,transform] hover:scale-105 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:scale-100 disabled:hover:bg-brand motion-reduce:hover:scale-100"
            >
              <span
                aria-hidden="true"
                className="ml-gb-xs h-0 w-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white"
              />
            </button>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-gb-xl">
        <div>
          <p data-no-auto-translate className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-white md:text-gb-display-sm">
            {FEATURED_STORY.name}
          </p>
          {/* Owner, 2026-09-29: "Star Mentee", not "Achievements". */}
          <p className="mt-gb-xs text-gb-sm font-semibold uppercase tracking-[0.08em] text-gb-brand-300">
            {getLocaleText(locale, 'Star Mentee')}
          </p>
        </div>
        <ul className="flex flex-col gap-gb-lg">
          {FEATURED_STORY.achievements.map((achievement) => (
            <li key={achievement} className="flex items-start gap-gb-lg text-[15px] leading-[22px] text-white/88">
              <KitIcon art={ICONS.checkCircle} frame={18} className="mt-gb-xxs shrink-0 text-gb-brand-500" />
              <span>{getLocaleText(locale, achievement)}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-auto flex flex-wrap gap-gb-md border-t border-white/10 pt-gb-xl">
          {FEATURED_STORY.schools.map((school) => (
            <li
              key={school.name}
              className={`flex h-[36px] items-center rounded-gb-md px-gb-lg ${
                school.logo === null ? 'border border-white/20 text-gb-xs font-semibold text-white/75' : 'bg-surface'
              }`}
            >
              {school.logo === null ? (
                <span data-no-auto-translate>{school.name}</span>
              ) : (
                <Image src={school.logo} alt={school.name} width={66} height={22} className="h-[22px] w-auto" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function HomeStories({ locale = 'en' }: { locale?: Locale }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<StudentQuote | null>(null);

  const scrollTrack = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (track === null) return;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({
      left: direction * (mobile ? window.innerWidth - 32 : DESKTOP_STEP_PX),
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  return (
    <section
      id="stories"
      data-surface="dark"
      className="scroll-mt-gb-9xl overflow-hidden bg-[image:var(--gb-home-band-stories)] py-gb-7xl text-white md:py-gb-9xl"
    >
      <div className="mx-auto flex max-w-gb-desktop flex-col items-start px-gb-xl md:px-gb-4xl">
        {/* No "Student stories" eyebrow above the title — owner, 2026-09-29:
            fewer text elements. The title carries the section on its own. */}
        <h2 className="max-w-[820px] text-balance font-display text-gb-display-sm font-semibold tracking-gb-display-tight md:text-gb-display-md">
          {/* Owner, 2026-09-29: "Scholarship" dropped from the title. */}
          {highlightPhrases(
            getLocaleText(locale, 'GlowBal Success Stories'),
            [getLocaleText(locale, 'Success Stories')],
            'dark',
          )}
        </h2>
      </div>

      <div className="mx-auto mt-gb-6xl w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl">
        <FeaturedStory locale={locale} />
      </div>

      {/* Student quotes carousel stretching across the screen */}
      <div className="mt-gb-3xl w-full">
        <div className="flex min-w-0 flex-col gap-gb-xl">
          <div
            ref={trackRef}
            tabIndex={0}
            role="region"
            aria-label={getLocaleText(locale, 'Student quotes')}
            className="snap-x snap-mandatory overflow-x-auto pb-gb-xs [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-scrollbar]:hidden"
          >
            {/* `items-stretch`: every card takes the tallest card's height. */}
            <div className="flex w-max items-stretch gap-gb-lg px-gb-xl md:gap-gb-3xl md:px-gb-4xl">
              {STUDENT_QUOTES.map((quote) => (
                <QuoteCard
                  key={quote.name}
                  quote={quote}
                  locale={locale}
                  onReadMore={setReading}
                  className="w-[300px] p-gb-2xl md:w-[360px] md:p-gb-3xl"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-gb-lg px-gb-xl md:px-gb-4xl">
            <span className="text-gb-xs text-gb-neutral-400">
              {locale === 'vi' ? '' : getLocaleText(locale, 'Translated from Vietnamese')}
            </span>
            <div className="flex gap-gb-lg">
              {([-1, 1] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  onClick={() => scrollTrack(direction)}
                  aria-label={getLocaleText(locale, direction < 0 ? 'Previous' : 'Next')}
                  className="flex size-[44px] items-center justify-center rounded-gb-full border-2 border-white/12 bg-surface text-fg-secondary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <KitIcon art={direction < 0 ? ICONS.arrowLeft : ICONS.arrowRight} frame={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <QuoteDialog quote={reading} locale={locale} onClose={() => setReading(null)} />
    </section>
  );
}
