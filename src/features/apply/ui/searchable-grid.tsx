'use client';

import { useId, useMemo, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';
import { questionIcon } from './question-chrome';

/**
 * The searchable grid of selectable cards behind both the subjects question
 * and the countries question.
 *
 * ─── ONE COMPONENT, TWO QUESTIONS ────────────────────────────────────────────
 *
 * The spec asks for these two to share an implementation, and the reason is
 * the same one that governs the rest of this questionnaire: two grids that
 * merely look alike drift. Subjects pass an icon per item, countries pass a
 * flag; everything else — the search, the ranking, the selected state, the
 * Reset/Select-all footer, the empty state, the keyboard behaviour — is
 * decided once, here.
 *
 * ─── REAL CHECKBOXES ─────────────────────────────────────────────────────────
 *
 * Each card is a `<label>` wrapping a real `<input type="checkbox">`, not a
 * `<div>` with `role="checkbox"`. That buys Space to toggle, Tab to move, the
 * native focus ring, form semantics and correct screen-reader announcement
 * without rebuilding any of it — and it is why the selected state is never
 * carried by colour alone.
 *
 * The whole card is the label, so the entire tile is the hit target rather
 * than the 16px box.
 *
 * ─── THE GLYPH IS NEVER THE LABEL ────────────────────────────────────────────
 *
 * Flags and subject icons are `aria-hidden` and always sit beside the name in
 * text. A flag is ambiguous at 20px, absent on some platforms, and useless to
 * a screen reader; it is there to make the grid scannable, not to identify
 * anything.
 */

export type GridItem = {
  id: string;
  label: string;
  /** Second line, e.g. a country's English name under a localised one. */
  detail?: string | undefined;
  /** An `ICONS` key. Mutually exclusive with `glyph` in practice. */
  icon?: string | undefined;
  /** A literal character — a flag emoji. Decorative. */
  glyph?: string | undefined;
};

export function SearchableMultiSelectGrid({
  items,
  selectedIds,
  onChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  emptyLabel,
  emptyAction,
  onEmptyAction,
  footerNote,
  resetLabel,
  selectAllLabel,
  onSelectAll,
  label,
  columns = 4,
  initialVisible,
  showAllLabel,
}: {
  /** Already filtered by the caller, so search ranking stays in the domain. */
  items: readonly GridItem[];
  selectedIds: readonly string[];
  onChange: (next: string[]) => void;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (next: string) => void;
  /** Shown when the filter matches nothing; may contain the query. */
  emptyLabel: string;
  /** e.g. "Add as Other" — omitted when there is nothing sensible to offer. */
  emptyAction?: string | undefined;
  onEmptyAction?: (() => void) | undefined;
  footerNote: string;
  resetLabel: string;
  /** Omitted entirely where "select everything" is a meaningless answer. */
  selectAllLabel?: string | undefined;
  onSelectAll?: (() => void) | undefined;
  /** Accessible name for the group. */
  label: string;
  columns?: 3 | 4 | 5;
  /**
   * Show only this many until the student asks for the rest.
   *
   * The country grid is ~200 tiles; rendering all of them inline makes a page
   * nobody scrolls to the bottom of, and the useful ones are the first
   * twenty. Searching bypasses the cap entirely — someone who has typed knows
   * what they are looking for.
   */
  initialVisible?: number | undefined;
  showAllLabel?: string | undefined;
}) {
  const fieldId = useId();
  const [expanded, setExpanded] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const searching = searchValue.trim().length > 0;
  const capped =
    initialVisible !== undefined && !expanded && !searching
      ? items.slice(0, initialVisible)
      : items;
  const hidden = items.length - capped.length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  const gridClass =
    columns === 5
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
      : columns === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <fieldset className="flex flex-col gap-gb-lg">
      <legend className="sr-only">{label}</legend>

      {/* Search */}
      <div className="flex items-center gap-gb-md rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-md focus-within:border-brand">
        <span aria-hidden="true" className="shrink-0 text-fg-tertiary">
          <KitIcon art={ICONS.search} frame={18} />
        </span>
        <input
          id={fieldId}
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full bg-transparent text-gb-sm text-fg outline-none placeholder:text-fg-muted"
        />
        {searchValue ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={`${searchPlaceholder} — clear`}
            className="shrink-0 rounded-gb-sm p-gb-xxs text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.close} frame={14} />
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-gb-md rounded-gb-lg border border-line bg-surface-muted px-gb-xl py-gb-2xl">
          <p className="text-gb-sm text-fg-tertiary">{emptyLabel}</p>
          {emptyAction && onEmptyAction ? (
            <button
              type="button"
              onClick={onEmptyAction}
              className="rounded-gb-lg border border-brand px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-brand transition-colors hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {emptyAction}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className={`grid gap-gb-md ${gridClass}`}>
          {capped.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <li key={item.id}>
                <label
                  className={`flex h-full cursor-pointer items-center gap-gb-md rounded-gb-lg border px-gb-lg py-gb-md transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                    isSelected
                      ? 'border-brand bg-brand-subtle'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(item.id)}
                    className="size-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  {item.glyph ? (
                    <span aria-hidden="true" className="shrink-0 text-gb-lg leading-none">
                      {item.glyph}
                    </span>
                  ) : item.icon ? (
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-gb-md bg-brand-subtle text-fg-brand"
                    >
                      <KitIcon art={questionIcon(item.icon)} frame={15} />
                    </span>
                  ) : null}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-gb-sm font-medium text-fg">{item.label}</span>
                    {item.detail ? (
                      <span className="truncate text-gb-xs text-fg-tertiary">{item.detail}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && showAllLabel ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start rounded-gb-lg border border-line px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {showAllLabel}
        </button>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-gb-md border-t border-line pt-gb-lg">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selectedIds.length === 0}
          className="rounded-gb-lg border border-line px-gb-lg py-gb-xs text-gb-sm font-semibold text-fg-secondary transition-colors hover:border-line-strong disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {resetLabel}
        </button>

        <p className="order-last w-full text-gb-sm text-fg-tertiary sm:order-none sm:w-auto">
          {footerNote}
        </p>

        {selectAllLabel && onSelectAll ? (
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-gb-lg px-gb-lg py-gb-xs text-gb-sm font-semibold text-fg-brand transition-colors hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {selectAllLabel}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
