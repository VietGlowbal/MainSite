'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import {
  clampMonthValue,
  currentMonthValue,
  formatMonthValue,
  monthLabels,
  monthValue,
  parseMonthValue,
} from '@/shared/lib/month-value';
import { CONTROL_BASE, CONTROL_IDLE, CONTROL_INVALID, FormField } from './form-field';
import { ICONS, KitIcon } from './icons';

/**
 * MonthPicker — a month-and-year calendar in a popover, for "when do you want
 * to start?" questions.
 *
 * ⚠️ NO FIGMA SOURCE. The redesign draws no date control of any kind, so this
 * is a product decision, not a frame: /profile asked for the target intake with
 * a free-text box ("e.g. Sep 2027") and the owner's note was that typing a date
 * reads as unprofessional and unreliable. Everything visible here is
 * nonetheless assembled from the kit's own parts — the trigger wears
 * `CONTROL_BASE`, so it sits flush with the Select beside it in the same grid,
 * and the popover is the menu surface `MultiSelect` already uses (bordered card,
 * divider rows, footer button). Ask the designer before treating the grid
 * proportions as final.
 *
 * ─── WHY MONTHS AND NOT DAYS ────────────────────────────────────────────────
 *
 * A university intake is a month, not a date. Offering a day grid would ask a
 * student to invent a precision they do not have and the matching engine has no
 * use for — `course_applications.intake` is where a specific programme's
 * published start lives.
 *
 * ─── THE VALUE ──────────────────────────────────────────────────────────────
 *
 * `value` is the canonical `YYYY-MM` token from `shared/lib/month-value`, or
 * `''`. A caller holding a legacy free-text answer runs it through
 * `toMonthValue` first; when that yields `''` the answer names no month, and
 * the caller should keep the original string rather than silently dropping it
 * (see the profile forms).
 */

type Props = {
  /** Doubles as the element id, like `Input` — that is what wires the label. */
  name: string;
  /** Canonical `YYYY-MM`, or `''` when nothing is chosen. */
  value: string;
  onChange: (next: string) => void;
  label?: string | undefined;
  hint?: string | undefined;
  /** Present => the control renders invalid and the hint is replaced. */
  error?: string | undefined;
  /** Shown on the trigger while `value` is empty. */
  placeholder?: string | undefined;
  /**
   * Earliest selectable month, canonical. Defaults to the current one — an
   * intake that has already started is not a plan.
   *
   * A `value` older than this is never hidden: the floor drops to it so the
   * student can see and re-pick the answer they already gave.
   */
  min?: string | undefined;
  /** Latest selectable month. Defaults to eight years past the floor. */
  max?: string | undefined;
  required?: boolean | undefined;
  /** Applied to the wrapper. */
  fieldClassName?: string | undefined;
  clearLabel?: string | undefined;
  /** Accessible name for the popover and its month grid. */
  dialogLabel?: string | undefined;
  disabled?: boolean | undefined;
  /** Fixed "today", for tests. Defaults to the real clock. */
  now?: Date | undefined;
};

/** How far ahead the picker offers, from the floor. */
const YEARS_AHEAD = 8;

const MONTH_CELL =
  'rounded-gb-md px-gb-sm py-gb-lg text-gb-sm font-medium transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function MonthPicker({
  name,
  value,
  onChange,
  label,
  hint,
  error,
  placeholder = 'Select a month',
  min,
  max,
  required,
  fieldClassName,
  clearLabel = 'Clear',
  dialogLabel = label ?? 'Choose a month',
  disabled,
  now,
}: Props) {
  const id = name;
  const described = error ?? hint;

  /*
   * Month names are formatted here rather than left to the page translator.
   * /profile and /ai-strategy are PII routes, where that translator is
   * dictionary-only — and "Sep 2027" is composed at runtime, so it can never
   * be a dictionary key. See the note in shared/lib/month-value.ts.
   */
  const { lang } = useLanguage();
  const { abbreviations } = monthLabels(lang);

  const today = currentMonthValue(now ?? new Date());
  /**
   * Nothing before this may be picked. A `min` that is not a token falls back
   * to today rather than propagating an empty string into every comparison
   * below, which would disable the whole grid.
   */
  const floor = parseMonthValue(min) ? (min ?? today) : today;
  const ceiling =
    (parseMonthValue(max) ? max : null) ??
    monthValue((parseMonthValue(floor)?.year ?? 0) + YEARS_AHEAD, 12);
  /**
   * How far back the grid may be scrolled — the floor, unless the student's own
   * answer is older than it. Note this is not the same as lowering the floor:
   * the stale answer stays selectable, the months around it do not.
   */
  const navFloor = value && value < floor ? value : floor;

  const selectable = (month: string) =>
    month !== '' && ((month >= floor && month <= ceiling) || month === value);

  const [open, setOpen] = useState(false);
  /**
   * The month the grid's keyboard focus sits on, which also decides the year
   * on show. One piece of state rather than a separate `viewYear`, so the two
   * cannot disagree after a year step.
   */
  const [cursor, setCursor] = useState(() => clampMonthValue(value || today, navFloor, ceiling));

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /**
   * Whether the next render should pull focus into the grid.
   *
   * Opening and arrow keys set it; the year chevrons do not, because a mouse
   * user who clicks "next year" has not asked for focus to jump out from under
   * their pointer.
   */
  const pullFocus = useRef(false);

  const viewYear = parseMonthValue(cursor)?.year ?? parseMonthValue(today)?.year ?? 0;

  useEffect(() => {
    if (!open || !pullFocus.current) return;
    pullFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-value="${cursor}"]`)?.focus();
  }, [open, cursor]);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [open]);

  function openPicker() {
    setCursor(clampMonthValue(value || today, navFloor, ceiling));
    pullFocus.current = true;
    setOpen(true);
  }

  function closePicker(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(next: string) {
    onChange(next);
    closePicker(true);
  }

  function moveCursor(delta: number) {
    const parts = parseMonthValue(cursor);
    if (!parts) return;
    const target = parts.year * 12 + (parts.month - 1) + delta;
    const next = monthValue(Math.floor(target / 12), (target % 12) + 1);
    if (!next) return;
    pullFocus.current = true;
    // Focus cannot rest on a disabled cell, so a step that lands on one goes to
    // the nearest month that can actually be picked.
    setCursor(selectable(next) ? next : clampMonthValue(next, floor, ceiling));
  }

  function stepYear(delta: number) {
    const parts = parseMonthValue(cursor);
    if (!parts) return;
    setCursor(clampMonthValue(monthValue(parts.year + delta, parts.month), navFloor, ceiling));
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 3,
      ArrowUp: -3,
      PageDown: 12,
      PageUp: -12,
    };
    const delta = steps[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveCursor(delta);
      return;
    }
    // Home / End are the row ends in a calendar; here the row is the year.
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const month = event.key === 'Home' ? 1 : 12;
      pullFocus.current = true;
      setCursor(clampMonthValue(monthValue(viewYear, month), navFloor, ceiling));
    }
  }

  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <div
        ref={rootRef}
        className="relative"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            closePicker(true);
          }
        }}
        onBlur={(event) => {
          // Tabbing out of the popover closes it, the same as clicking away.
          if (open && !rootRef.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        {/* Kept so the control still submits inside a plain <form>; these
            editors save through the client, but the next caller may not. */}
        <input type="hidden" name={name} value={value} />

        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          /* No `aria-invalid` — the role does not support it on a button. The
             error reaches assistive tech through the described-by message
             `FormField` renders, and the eye through the border. */
          aria-describedby={described ? `${id}-message` : undefined}
          onClick={() => (open ? closePicker(false) : openPicker())}
          className={`${CONTROL_BASE} ${error ? CONTROL_INVALID : CONTROL_IDLE} flex items-center justify-between gap-gb-lg text-left`}
        >
          <span className={value ? 'text-fg' : 'text-fg-muted'}>
            {formatMonthValue(value, 'short', lang) || placeholder}
          </span>
          <span className="shrink-0 text-gb-neutral-400">
            <KitIcon art={ICONS.calendar} frame={18} />
          </span>
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label={dialogLabel}
            className="absolute left-0 top-full z-20 mt-gb-sm w-full rounded-gb-lg border border-line bg-surface shadow-gb-lg"
          >
            <div className="flex items-center justify-between border-b border-line px-gb-lg py-gb-md">
              <YearStep
                direction="previous"
                disabled={viewYear <= (parseMonthValue(navFloor)?.year ?? viewYear)}
                onClick={() => stepYear(-1)}
              />
              <span className="text-gb-sm font-semibold text-fg" aria-live="polite">
                {viewYear}
              </span>
              <YearStep
                direction="next"
                disabled={viewYear >= (parseMonthValue(ceiling)?.year ?? viewYear)}
                onClick={() => stepYear(1)}
              />
            </div>

            <div
              ref={gridRef}
              role="radiogroup"
              aria-label={dialogLabel}
              className="grid grid-cols-3 gap-gb-sm p-gb-md"
              onKeyDown={onGridKeyDown}
            >
              {abbreviations.map((abbreviation, index) => {
                const month = monthValue(viewYear, index + 1);
                const outOfRange = !selectable(month);
                const selected = month !== '' && month === value;
                const isToday = month === today;

                return (
                  <button
                    key={abbreviation}
                    type="button"
                    role="radio"
                    data-value={month}
                    aria-checked={selected}
                    aria-label={formatMonthValue(month, 'long', lang) || abbreviation}
                    disabled={outOfRange}
                    tabIndex={month === cursor ? 0 : -1}
                    onClick={() => pick(month)}
                    className={[
                      MONTH_CELL,
                      selected
                        ? 'bg-brand text-on-brand'
                        : outOfRange
                          ? 'cursor-not-allowed text-fg-muted opacity-50'
                          : 'text-fg-secondary hover:bg-surface-hover',
                      // The current month is outlined rather than filled, so it
                      // never reads as a choice the student has already made.
                      isToday && !selected ? 'ring-1 ring-line-strong' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {abbreviation}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-line px-gb-lg py-gb-md">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  closePicker(true);
                }}
                disabled={!value}
                className="rounded-gb-md border border-line px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clearLabel}
              </button>
              <span className="text-gb-xs text-fg-muted">
                {formatMonthValue(value, 'long', lang)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </FormField>
  );
}

/**
 * A year chevron. `chevronDown` rotated rather than a second and third icon:
 * the kit exports one chevron, and a "v" turned a quarter-turn is exactly the
 * "<" and ">" the other two would be.
 */
function YearStep({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'previous' ? 'Previous year' : 'Next year'}
      className="rounded-gb-sm p-gb-sm text-fg-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className={direction === 'previous' ? 'block rotate-90' : 'block -rotate-90'}>
        <KitIcon art={ICONS.chevronDown} frame={16} />
      </span>
    </button>
  );
}
