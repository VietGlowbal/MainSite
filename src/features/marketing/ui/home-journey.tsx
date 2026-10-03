import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { GlowbalIcon, ICONS, KitIcon } from '@/shared/ui';
import { JOURNEY_STEPS } from '../domain/home-content';
import { highlightPhrases } from './home-highlight';

/**
 * Your GlowBal journey — sales-journey handoff §6, worded per content PDF (3):
 * 'How to "Hunt Scholarship" with GlowBal?' and its four steps (see
 * JOURNEY_STEPS). Replaces both the "Have you ever?" pain-point cards and the
 * five-step "How it works" carousel.
 *
 * V2 moves the path onto a light surface with white cards, rose icon discs and
 * faint step numbers. The rail above the row — a hairline with a hollow rose
 * dot over each card and a glowing dot travelling along it — keeps the row
 * reading as a path rather than a list:
 *
 *  - desktop (lg): rail above the four-across row. Each rail dot sits exactly
 *    over its card's icon disc: card padding 32 + half the 44px disc = 54px,
 *    which is where the line starts and, one column in from the right, ends.
 *  - tablet (md): two-across, no rail — a rail across a wrapped grid would
 *    connect card 2 to card 3 through thin air.
 *  - mobile: a vertical timeline, line down the left with a dot per card.
 *
 * The travelling dot is hidden under reduced motion rather than frozen: a
 * stationary glowing dot on a rail reads as a bug, not as a still frame.
 *
 * A server component: the only motion is a CSS keyframe (`gb-journey-travel-*`
 * in tokens.css), so nothing here ships JavaScript.
 */

const CARD_HOVER =
  'transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-gb-lg motion-reduce:transform-none motion-reduce:transition-none';

function stepNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/**
 * A step title with its hyphenated compounds kept whole. At four-across the
 * card is narrow enough that "Best-Fit" broke at its hyphen, leaving "Fit" to
 * start the next line. A nowrap span rather than U+2011: the display font is
 * not guaranteed to carry a non-breaking-hyphen glyph.
 */
function StepTitle({ text }: { text: string }) {
  return text.split(/(\S+-\S+)/).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** The glowing dot. Rides a full-length wrapper so the move is a transform. */
function TravellingDot({ axis }: { axis: 'x' | 'y' }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 motion-reduce:hidden ${
        axis === 'x' ? 'animate-gb-journey-travel-x' : 'animate-gb-journey-travel-y'
      }`}
    >
      <span
        className={`absolute size-gb-lg rounded-gb-full bg-gb-brand-500 shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-gb-brand-500)_20%,transparent),0_0_24px_4px_color-mix(in_srgb,var(--color-gb-brand-500)_55%,transparent)] ${
          axis === 'x' ? '-left-gb-sm -top-[5px]' : '-left-[5px] -top-gb-sm'
        }`}
      />
    </span>
  );
}

export function HomeJourney({ locale = 'en' }: { locale?: Locale }) {
  return (
    /* Rose-100 easing to rose-50: the middle of the ramp's three-band fade to
       white (tokens.css, `--gb-home-band-journey`). The step cards are white
       surfaces, so they read on the tint without any change. */
    <section
      id="journey"
      className="scroll-mt-gb-9xl bg-[image:var(--gb-home-band-journey)] py-gb-7xl text-fg md:py-gb-9xl"
    >
      <div className="mx-auto w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl">
        {/* Content PDF (3) §6: 'How to "Hunt Scholarship" with GlowBal?'. It
            replaces the earlier brief's "Have you ever?" hook and two-line
            title. */}
        <div className="mx-auto flex max-w-gb-width-xl flex-col items-center text-center">
          {/* A white disc: a rose-50 one vanished into the rose-100 band. */}
          <span className="flex size-gb-6xl items-center justify-center rounded-gb-full bg-surface text-brand shadow-gb-xs">
            <KitIcon art={ICONS.zapFast} frame={22} />
          </span>
          <p className="mt-gb-xl text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">
            {getLocaleText(locale, 'Your GlowBal journey')}
          </p>
          <h2 className="mt-gb-lg text-balance font-display text-gb-display-sm font-semibold tracking-gb-display-tight md:text-gb-display-md">
            {highlightPhrases(
              getLocaleText(locale, 'How to “Hunt Scholarship” with GlowBal?'),
              [getLocaleText(locale, 'Hunt Scholarship')],
              'tint',
            )}
          </h2>
        </div>

        {/* ── Desktop rail (lg+) ─────────────────────────────────────────── */}
        <div aria-hidden="true" className="relative mt-gb-6xl hidden h-gb-3xl lg:block">
          <div className="absolute left-[54px] right-[calc((100%-72px)/4-54px)] top-[11px] h-[2px] rounded-gb-xs bg-line">
            <TravellingDot axis="x" />
          </div>
          <div className="absolute inset-0 grid grid-cols-4 gap-gb-3xl">
            {JOURNEY_STEPS.map((step) => (
              <div key={step.title} className="pl-[47px] pt-[5px]">
                <span className="block size-[14px] rounded-gb-full border-2 border-brand bg-surface" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Cards: tablet 2-up, desktop 4-up ───────────────────────────── */}
        <ol className="mt-gb-6xl hidden gap-gb-3xl md:grid md:grid-cols-2 lg:mt-gb-xl lg:grid-cols-4">
          {JOURNEY_STEPS.map((step, index) => (
            <li
              key={step.title}
              className={`flex flex-col rounded-gb-xl border border-line bg-surface p-gb-4xl shadow-gb-xs ${CARD_HOVER}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex size-[44px] items-center justify-center rounded-gb-full bg-brand text-white">
                  <GlowbalIcon name={step.icon} size={24} tone="current" />
                </span>
                <span aria-hidden="true" className="font-display text-gb-display-xs font-semibold text-fg-muted">
                  {stepNumber(index)}
                </span>
              </div>
              <h3 className="mt-gb-4xl text-balance font-display text-gb-xl font-semibold">
                <StepTitle text={getLocaleText(locale, step.title)} />
              </h3>
              <p className="mt-gb-lg text-gb-md leading-[26px] text-fg-tertiary">{getLocaleText(locale, step.body)}</p>
            </li>
          ))}
        </ol>

        {/* ── Mobile: vertical timeline ──────────────────────────────────── */}
        <div className="relative mt-gb-5xl pl-[36px] md:hidden">
          <div aria-hidden="true" className="absolute bottom-[38px] left-[11px] top-[38px] w-[2px] bg-line">
            <TravellingDot axis="y" />
          </div>
          <ol className="flex flex-col gap-gb-xl">
            {JOURNEY_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="relative rounded-gb-xl border border-line bg-surface p-gb-3xl shadow-gb-xs"
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-[32px] top-[31px] size-[14px] rounded-gb-full border-2 border-brand bg-surface"
                />
                <span className="text-gb-sm font-semibold text-gb-brand-500">{stepNumber(index)}</span>
                <h3 className="mt-gb-md font-display text-gb-xl font-semibold">
                  <StepTitle text={getLocaleText(locale, step.title)} />
                </h3>
                <p className="mt-gb-md text-gb-md text-fg-tertiary">{getLocaleText(locale, step.body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
