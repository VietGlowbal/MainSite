'use client';

import { ICONS, KitIcon, type KitIconArt } from '@/shared/ui';

/**
 * The frame every Candidate Information question is drawn in, and the
 * navigation around it.
 *
 * ─── ONE CARD SHAPE, TWELVE QUESTIONS ────────────────────────────────────────
 *
 * The brief's strongest requirement is that the questionnaire should read as
 * one designed thing rather than a pile of unrelated form controls. That is a
 * structural property, not a styling one, so it is enforced structurally: every
 * question renders through `QuestionCard`, which owns the icon, the heading,
 * the one-line explanation and the card itself. A question cannot accidentally
 * grow its own heading treatment, because it never draws one.
 *
 * The icon comes from the question's own metadata (`ABOUT_QUESTIONS`), so the
 * visual and the copy are decided in the same place and cannot drift.
 *
 * ─── THE ICONS ARE DECORATION AND ARE MARKED AS SUCH ─────────────────────────
 *
 * Every icon here is `aria-hidden`, and every one sits beside a real text
 * heading. The brief asks for personality; the accessibility requirement is
 * that nothing is conveyed by the icon alone. Both hold as long as the icon is
 * never the only thing in the row, which is why the heading is required and
 * the icon is not.
 */

/** Icon key → the traced art. Unknown keys fall back rather than crashing. */
export function questionIcon(key: string): KitIconArt {
  const art = (ICONS as Record<string, KitIconArt | undefined>)[key];
  return art ?? ICONS.checkCircle;
}

export function QuestionCard({
  icon,
  heading,
  subtitle,
  section,
  children,
}: {
  icon: string;
  heading: string;
  subtitle?: string | undefined;
  /** The group this question belongs to, shown as a small chip. */
  section?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-gb-2xl rounded-gb-xl border border-line bg-surface p-gb-3xl shadow-gb-xs">
      <header className="flex items-start gap-gb-xl">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-gb-lg bg-brand-subtle text-fg-brand"
        >
          <KitIcon art={questionIcon(icon)} frame={22} />
        </span>
        <div className="flex flex-col gap-gb-xs">
          {section ? (
            <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              {section}
            </span>
          ) : null}
          <h2 className="font-display text-gb-xl font-semibold tracking-gb-display-tight text-fg">
            {heading}
          </h2>
          {subtitle ? <p className="text-gb-sm text-fg-tertiary">{subtitle}</p> : null}
        </div>
      </header>

      <div className="flex flex-col gap-gb-xl">{children}</div>
    </section>
  );
}

/**
 * The numbered tracker across the top of single-question mode.
 *
 * ─── WHY COMPLETED STEPS ARE BUTTONS AND FUTURE ONES ARE NOT ─────────────────
 *
 * Per the brief: a student may click back to a question they have already
 * reached, but may not jump ahead into one they have not. That is expressed in
 * the markup rather than only in the styling — a future step renders as a
 * `<span>`, so it is not focusable and there is nothing to click. Disabling a
 * `<button>` instead would leave a control that looks interactive to a
 * screen-reader user and does nothing.
 *
 * ─── AND WHY IT COLLAPSES ON SMALL SCREENS ───────────────────────────────────
 *
 * Twelve numbered circles do not fit on a phone without either shrinking below
 * a usable tap target or scrolling sideways, and the brief rules out horizontal
 * scrolling. Below `sm` this is a plain progress bar plus "Question 4 of 12",
 * which carries the same two facts — how far along, and where — in the space
 * available.
 */
export function QuestionTracker({
  total,
  current,
  furthestReached,
  onJump,
  label,
}: {
  total: number;
  /** 0-based index of the question on screen. */
  current: number;
  /** 0-based index of the furthest question the student has reached. */
  furthestReached: number;
  onJump: (index: number) => void;
  /** e.g. "Question 4 of 12" — also the small-screen caption. */
  label: string;
}) {
  const percent = Math.round(((current + 1) / total) * 100);

  return (
    <div className="flex flex-col gap-gb-md">
      {/* Desktop and tablet: the numbered tracker. */}
      <ol className="hidden flex-wrap items-center gap-gb-xs sm:flex" aria-label={label}>
        {Array.from({ length: total }, (_, index) => {
          const done = index < current;
          const isCurrent = index === current;
          const reachable = index <= furthestReached;

          const base =
            'flex size-8 items-center justify-center rounded-gb-full border text-gb-sm font-semibold transition-colors';
          const tone = isCurrent
            ? 'border-brand bg-brand text-on-brand'
            : done
              ? 'border-brand bg-surface text-fg-brand'
              : 'border-line bg-surface text-fg-muted';

          return (
            <li key={index} className="flex items-center gap-gb-xs">
              {reachable && !isCurrent ? (
                <button
                  type="button"
                  onClick={() => onJump(index)}
                  aria-label={`Question ${index + 1}`}
                  aria-current={undefined}
                  className={`${base} ${tone} hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
                >
                  {/* A checkmark AND the number's aria-label: the tick is the
                      quick visual, the label is what a screen reader reads. */}
                  {done ? <KitIcon art={ICONS.checkCircle} frame={16} /> : index + 1}
                </button>
              ) : (
                <span
                  className={base + ' ' + tone}
                  {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
                >
                  {index + 1}
                </span>
              )}
              {index < total - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px w-4 ${index < current ? 'bg-brand' : 'bg-line'}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Phones: the same two facts, without twelve tap targets. */}
      <div className="flex flex-col gap-gb-xs sm:hidden">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
          className="h-2 w-full overflow-hidden rounded-gb-full bg-line"
        >
          <span className="block h-full rounded-gb-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <p className="text-gb-sm text-fg-tertiary">{label}</p>
    </div>
  );
}

/**
 * "One question at a time" / "Show all questions".
 *
 * A radiogroup rather than two buttons or a checkbox: it is one setting with
 * two mutually exclusive values, which is what a radiogroup means, and it
 * gives arrow-key movement between the options for nothing.
 */
export function DisplayModeToggle({
  mode,
  onChange,
  oneLabel,
  allLabel,
  groupLabel,
}: {
  mode: 'one' | 'all';
  onChange: (mode: 'one' | 'all') => void;
  oneLabel: string;
  allLabel: string;
  groupLabel: string;
}) {
  const options: Array<{ value: 'one' | 'all'; label: string }> = [
    { value: 'one', label: oneLabel },
    { value: 'all', label: allLabel },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="inline-flex rounded-gb-lg border border-line bg-surface-muted p-gb-xxs"
    >
      {options.map((option) => {
        const selected = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-gb-md px-gb-lg py-gb-sm text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected
                ? 'bg-surface text-fg shadow-gb-xs'
                : 'text-fg-tertiary hover:text-fg-secondary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The "✓ Saved" acknowledgement.
 *
 * Deliberately tiny and non-blocking. The brief asks that saving never
 * interrupt the flow, so this is a line of text that appears and fades rather
 * than a toast that occupies a corner or a modal that has to be dismissed.
 * `aria-live="polite"` announces it once to a screen reader without stealing
 * focus mid-answer.
 */
export function SaveIndicator({ state, savingLabel, savedLabel, errorLabel }: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  savingLabel: string;
  savedLabel: string;
  errorLabel: string;
}) {
  if (state === 'idle') return <span aria-live="polite" className="text-gb-sm" />;

  const tone = state === 'error' ? 'text-fg-error' : 'text-fg-tertiary';
  const text = state === 'saving' ? savingLabel : state === 'saved' ? savedLabel : errorLabel;

  return (
    <span aria-live="polite" className={`flex items-center gap-gb-xs text-gb-sm ${tone}`}>
      {state === 'saved' ? (
        <KitIcon art={ICONS.checkCircle} frame={14} className="shrink-0" />
      ) : null}
      {text}
    </span>
  );
}
