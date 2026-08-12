'use client';

import { ICONS, KitIcon } from '@/shared/ui';
import { questionIcon } from './question-chrome';

/**
 * A row of large selectable cards — the replacement for the plain dropdowns
 * the questionnaire used to ask its single-choice questions with.
 *
 * ─── WHY CARDS AND NOT A `<select>` ──────────────────────────────────────────
 *
 * On a one-question-per-screen form the question IS the screen, so a control
 * that hides its options behind a click wastes the space and the moment. Cards
 * show every option at once, give a comfortable tap target on a phone, and
 * leave room for the one-line gloss that stops "Associate Degree" needing to
 * be guessed at.
 *
 * ─── IT IS A REAL RADIOGROUP ─────────────────────────────────────────────────
 *
 * `role="radio"` inside `role="radiogroup"`, with `aria-checked` — not a set of
 * unrelated buttons that merely look selected. That is what makes the group
 * announce as "1 of 5" and respond to arrow keys, and it is why the selected
 * state is never carried by colour alone: the checkmark and `aria-checked`
 * both say it too, which the brief requires.
 *
 * Re-picking the selected option clears it, so a student who chose by accident
 * can get back to unanswered without a "none of these" card.
 */
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
  label,
  columns = 'auto',
}: {
  options: ReadonlyArray<{ value: T; label: string; hint?: string; icon?: string }>;
  value: T | undefined;
  onChange: (next: T | undefined) => void;
  label: string;
  /** `auto` fits as many as the width allows; `single` is one per row. */
  columns?: 'auto' | 'single';
}) {
  const grid =
    columns === 'single'
      ? 'grid-cols-1'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-gb-lg ${grid}`}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? undefined : option.value)}
            className={`relative flex flex-col items-start gap-gb-md rounded-gb-xl border p-gb-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected
                ? 'border-brand bg-brand-subtle'
                : 'border-line bg-surface hover:border-line-strong'
            }`}
          >
            {selected ? (
              <span
                aria-hidden="true"
                className="absolute right-gb-lg top-gb-lg text-fg-brand"
              >
                <KitIcon art={ICONS.checkCircle} frame={18} />
              </span>
            ) : null}

            {option.icon ? (
              <span
                aria-hidden="true"
                className={`flex size-10 items-center justify-center rounded-gb-lg ${
                  selected ? 'bg-surface text-fg-brand' : 'bg-brand-subtle text-fg-brand'
                }`}
              >
                <KitIcon art={questionIcon(option.icon)} frame={20} />
              </span>
            ) : null}

            <span className="flex flex-col gap-gb-xxs pr-gb-2xl">
              <span className={`text-gb-sm font-semibold ${selected ? 'text-fg' : 'text-fg'}`}>
                {option.label}
              </span>
              {option.hint ? (
                <span className="text-gb-xs text-fg-tertiary">{option.hint}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A full-width single-choice row — icon, title, description, radio on the
 * right.
 *
 * ─── WHY THIS EXISTS BESIDE `OptionCards` ────────────────────────────────────
 *
 * `OptionCards` is a grid of short labels; this is a stack of three rows that
 * each carry a sentence of explanation, which is what the intended-level
 * question needs ("Advanced study after your undergraduate degree"). Forcing
 * one component to do both would mean a `variant` prop deciding layout,
 * spacing and content shape at once — two components with the same selected-
 * state vocabulary is the smaller thing.
 *
 * The whole row is the control, not just the radio: the spec asks for that
 * explicitly, and a 16px target beside a 500px row is a target nobody aims at.
 */
export function SelectionCard({
  icon,
  glyph,
  title,
  description,
  selected,
  onSelect,
}: {
  icon?: string | undefined;
  /** A literal character, where an emoji reads better than a traced icon. */
  glyph?: string | undefined;
  title: string;
  description?: string | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-gb-xl rounded-gb-xl border p-gb-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        selected ? 'border-brand bg-brand-subtle' : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-gb-lg bg-brand-subtle text-gb-xl leading-none text-fg-brand"
      >
        {glyph ?? (icon ? <KitIcon art={questionIcon(icon)} frame={22} /> : null)}
      </span>

      <span className="flex min-w-0 flex-col gap-gb-xxs">
        <span className="text-gb-md font-semibold text-fg">{title}</span>
        {description ? (
          <span className="text-gb-sm text-fg-tertiary">{description}</span>
        ) : null}
      </span>

      {/* A drawn radio rather than an input: the row is already the control,
          and a real input here would be a second focusable thing inside it. */}
      <span
        aria-hidden="true"
        className={`ml-auto flex size-5 shrink-0 items-center justify-center rounded-gb-full border-2 ${
          selected ? 'border-brand' : 'border-line-strong'
        }`}
      >
        {selected ? <span className="size-2.5 rounded-gb-full bg-brand" /> : null}
      </span>
    </button>
  );
}

/**
 * The reassurance line the brief asks for under the single-choice questions.
 *
 * Its own component because it appears under several questions and is easy to
 * reword inconsistently otherwise — and because it is the one piece of copy
 * whose whole job is to lower the stakes of answering.
 */
export function NotSureNote({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-gb-sm rounded-gb-lg bg-brand-subtle px-gb-lg py-gb-md text-gb-sm text-fg-secondary">
      <span aria-hidden="true" className="mt-gb-xxs shrink-0 text-fg-brand">
        <KitIcon art={ICONS.zap} frame={14} />
      </span>
      {text}
    </p>
  );
}
