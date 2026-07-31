'use client';

import { useId, useMemo, useState } from 'react';
import { Checkbox } from './checkbox';
import { SearchMark } from './icons';
import { Radio } from './radio';

/**
 * MultiSelect — Untitled UI's `_Multi-select menu item` list with the kit's
 * menu footer, from Figma 375:11536 (câu 6) and 375:11616 (câu 7).
 *
 * A search field over a scrolling list of checkboxes, with a Reset / Select all
 * footer.
 *
 * ⚠️ DELIBERATE DEPARTURE: THE PANEL DOES NOT OPEN AND CLOSE. Both frames draw
 * this control with its menu already down, and neither draws a closed state, a
 * trigger's resting appearance, or what the field shows once something is
 * picked. Building a dropdown would mean inventing all three. On these screens
 * the control IS the question — one per step, nothing below it to be covered —
 * so the list stays visible and the field filters it. If the designer later
 * draws the closed state, that is a change here, not a rewrite of the callers.
 *
 * The scrollbar in the frame is a real overflow, not decoration: `maxVisible`
 * caps the list height so a long option set scrolls instead of pushing the
 * "Tiếp tục" button off screen.
 *
 * Values are the option strings themselves, so a caller can write them straight
 * to a text column without a lookup table.
 */

export type MultiSelectOption = {
  value: string;
  label: string;
  /** Second line under the label. A node — see the note on Checkbox's prop. */
  description?: React.ReactNode;
};

type Props = {
  name: string;
  /** Placeholder for the filter field — "Select a GPA", "English Proficiency". */
  placeholder: string;
  options: readonly MultiSelectOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  /**
   * A non-selectable first row, used by câu 6's second list to show which
   * curriculum the grading scales belong to.
   */
  heading?: string | undefined;
  /** Rows shown before the list scrolls. The frames show five. */
  maxVisible?: number;
  /** Accessible name for the whole control. */
  label: string;
  /**
   * One answer only — picking replaces rather than adds, and "Select all"
   * disappears because it would be meaningless.
   *
   * The frames draw checkboxes everywhere, so this is a departure, added for
   * câu 6's grading-scale list (a GPA is one number on one scale, so "10-point"
   * AND "4.0" together describes nothing).
   *
   * Câu 6 no longer uses it — it asks the scale question per curriculum, which is
   * a `Radio` group of two or three options. The caller now is the "Chọn lại
   * ngành" picker (`src/app/my-universities/program`), whose two lists are the
   * same kit component in the frame (375:13703, 375:13716) and which stores one
   * subject per saved university, so "Select all" would have nothing to mean.
   */
  single?: boolean;
  resetLabel?: string;
  selectAllLabel?: string;
};

/**
 * Row height, and the list's own padding, kept as numbers because the max-height
 * has to land on a row boundary — a few pixels out and the last visible row is
 * sliced in half, which reads as a rendering bug rather than as "scroll me".
 *
 *   row  = py-gb-lg (12) * 2 + checkbox 24 + its mt-gb-xxs (2) = 50
 *   list = p-gb-md (8) * 2                                    = 16
 *
 * Note the row is sized by the CHECKBOX, not the label: the 24px control plus
 * its 2px nudge is taller than the 20px text line beside it. Measuring from the
 * text gives 44 and slices the last row.
 */
const ROW = 50;
const LIST_PADDING = 16;

export function MultiSelect({
  name,
  placeholder,
  options,
  value,
  onChange,
  heading,
  maxVisible = 5,
  label,
  single = false,
  resetLabel = 'Reset',
  selectAllLabel = 'Select all',
}: Props) {
  const [query, setQuery] = useState('');
  const fieldId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = useMemo(() => new Set(value), [value]);

  function toggle(optionValue: string) {
    if (single) {
      // Re-picking the current answer clears it, so a required-looking control
      // is still escapable without a "none" option.
      onChange(selected.has(optionValue) ? [] : [optionValue]);
      return;
    }
    const next = new Set(selected);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    onChange([...next]);
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      {/* Search field. `type="search"` rather than text so the browser's own
          clear affordance appears, which is what the frame draws at the right
          of the GPA and score fields. */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-gb-input-x flex items-center text-fg-muted">
          <SearchMark frame={20} />
        </span>
        <input
          id={fieldId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          aria-controls={`${fieldId}-list`}
          className="w-full rounded-gb-md border border-line bg-surface py-gb-lg pl-gb-6xl pr-gb-input-x text-gb-md text-fg shadow-xs outline-none placeholder:text-fg-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>

      <div className="rounded-gb-md border border-line bg-surface shadow-xs">
        {heading ? (
          <p className="border-b border-line px-gb-xl py-gb-lg text-gb-sm font-medium text-fg">
            {heading}
          </p>
        ) : null}

        <div
          id={`${fieldId}-list`}
          role="group"
          aria-label={label}
          className="overflow-y-auto p-gb-md"
          style={{ maxHeight: `${maxVisible * ROW + LIST_PADDING}px` }}
        >
          {visible.length === 0 ? (
            <p className="px-gb-lg py-gb-lg text-gb-sm text-fg-muted">No matches for “{query}”.</p>
          ) : (
            visible.map((option) => {
              /*
               * Round control in `single` mode. The frames draw squares
               * everywhere because they are all instances of the kit's
               * multi-select row, but a square box on a list where ticking one
               * unticks the last is a lie to anyone reading the shape — and to a
               * screen reader, which announces "checkbox, not checked" for five
               * options that are really one choice. The frame this mode was
               * built for (375:13716, the subject picker) draws circles.
               */
              const Control = single ? Radio : Checkbox;
              return (
                <div key={option.value} className="rounded-gb-sm px-gb-lg py-gb-lg hover:bg-surface-hover">
                  <Control
                    name={name}
                    value={option.value}
                    label={option.label}
                    {...(option.description ? { description: option.description } : {})}
                    checked={selected.has(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Menu footer (375:11552). Reset is disabled with nothing chosen —
            the frame draws it greyed, which is the same state. */}
        <div className="flex items-center justify-between border-t border-line px-gb-lg py-gb-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={value.length === 0}
            className="rounded-gb-md border border-line px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resetLabel}
          </button>
          {single ? null : (
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="rounded-gb-md border border-line px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-hover"
            >
              {selectAllLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
