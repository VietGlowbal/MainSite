'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  countryName,
  flagEmoji,
  nationalityEntry,
  searchNationalities,
} from '@/lib/nationality-catalog';
import { ICONS, KitIcon } from '@/shared/ui';

/**
 * The nationality question: a compact trigger showing the chosen flag, opening
 * onto a searchable grid of every nationality.
 *
 * ─── WHY NOT A `<select>` ────────────────────────────────────────────────────
 *
 * A native select over 197 options gives you type-ahead on the *label*, which
 * only helps a student who already knows we call them "British" rather than
 * "UK". The brief asks for flags and for search that understands country,
 * nationality and the common alternative names — none of which a native select
 * can do. What it does give up is the platform's own dropdown behaviour, so
 * the keyboard and dismiss handling below are rebuilt deliberately rather than
 * inherited: Escape closes, click-outside closes, the search field takes focus
 * on open, and every tile is a real focusable button.
 *
 * ─── THE FLAG IS NEVER THE LABEL ─────────────────────────────────────────────
 *
 * Every tile carries the nationality in text beside its flag, and the flag is
 * `aria-hidden`. Flags are ambiguous (several countries share a design closely
 * enough to misread at 20px), they do not render at all on some platforms, and
 * a picker that identified a country by flag alone would be unusable with a
 * screen reader. They are decoration that aids recognition — the text is the
 * answer.
 *
 * ─── THE LIST SCROLLS, THE PAGE DOES NOT ─────────────────────────────────────
 *
 * 197 tiles is several screens. The panel caps its own height and scrolls
 * internally, per the brief, so opening the picker never pushes the Next
 * button out of reach.
 */
export function NationalityPicker({
  value,
  onChange,
  locale,
  label,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  locale: string;
  label: string;
  searchPlaceholder: string;
  /** Shown when a search matches nothing. */
  emptyLabel: string;
  /** The trigger's text when nothing is chosen yet. */
  clearLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const selected = nationalityEntry(value);
  const results = useMemo(() => searchNationalities(query, locale), [query, locale]);

  // Focus the search the moment the panel opens: the student's next action is
  // almost always to type, and a picker of 197 tiles that opens with focus
  // still on the trigger makes them tab through the whole grid to reach it.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Close on click-outside and on Escape. Both are behaviours a native select
  // would have given us for free and a student will expect regardless.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        // Return focus to the trigger, or it lands on <body> and the next Tab
        // starts from the top of the page.
        rootRef.current?.querySelector('button')?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function pick(nationality: string) {
    onChange(nationality === value ? undefined : nationality);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-gb-md">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        className={`flex w-full items-center justify-between gap-gb-md rounded-gb-lg border bg-surface px-gb-lg py-gb-md text-left text-gb-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto sm:min-w-80 ${
          open ? 'border-brand' : 'border-line hover:border-line-strong'
        }`}
      >
        <span className="flex items-center gap-gb-md">
          {selected ? (
            <span aria-hidden="true" className="text-gb-xl leading-none">
              {flagEmoji(selected.iso2)}
            </span>
          ) : null}
          <span className={selected ? 'font-semibold text-fg' : 'text-fg-tertiary'}>
            {selected ? selected.nationality : clearLabel}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-fg-tertiary">
          <KitIcon art={ICONS.chevronDown} frame={16} />
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute left-0 right-0 top-full z-20 mt-gb-xs flex max-h-[26rem] flex-col overflow-hidden rounded-gb-xl border border-line bg-surface shadow-gb-lg"
        >
          <div className="border-b border-line p-gb-md">
            <div className="flex items-center gap-gb-md rounded-gb-lg border border-line px-gb-md py-gb-sm focus-within:border-brand">
              <span aria-hidden="true" className="shrink-0 text-fg-tertiary">
                <KitIcon art={ICONS.search} frame={16} />
              </span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full bg-transparent text-gb-sm text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
          </div>

          {results.length === 0 ? (
            <p className="p-gb-xl text-gb-sm text-fg-tertiary">{emptyLabel}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-gb-sm overflow-y-auto p-gb-md md:grid-cols-3 xl:grid-cols-4">
              {results.map((entry) => {
                const isSelected = entry.nationality === value;
                return (
                  <li key={entry.iso2}>
                    <button
                      type="button"
                      onClick={() => pick(entry.nationality)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-gb-md rounded-gb-lg border px-gb-md py-gb-sm text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        isSelected
                          ? 'border-brand bg-brand-subtle'
                          : 'border-transparent hover:border-line hover:bg-surface-muted'
                      }`}
                    >
                      <span aria-hidden="true" className="shrink-0 text-gb-lg leading-none">
                        {flagEmoji(entry.iso2)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-gb-sm font-medium text-fg">
                          {entry.nationality}
                        </span>
                        <span className="truncate text-gb-xs text-fg-tertiary">
                          {countryName(entry.iso2, locale)}
                        </span>
                      </span>
                      {isSelected ? (
                        <span aria-hidden="true" className="ml-auto shrink-0 text-fg-brand">
                          <KitIcon art={ICONS.checkCircle} frame={16} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
