'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { intakeOptionId, type IntakeChoice, type IntakeOption } from '../domain';
import { useT } from '@/lib/i18n';
import { localizeIntakeOption } from './intake-copy';
import { ICONS, KitIcon } from '@/shared/ui';

/**
 * The intake dropdown — a custom listbox rather than a styled `<select>`.
 *
 * ─── WHY NOT A `<select>` ────────────────────────────────────────────────────
 *
 * Each option is two lines ("Spring 2027" over "January – April 2027") with a
 * seasonal glyph. A native `<option>` renders text and nothing else, and its
 * appearance is not ours to style on most platforms, so the design's two-line
 * rows are simply not expressible. What a native select gives away is real —
 * keyboard, dismissal, focus management — so all of it is rebuilt here
 * deliberately rather than lost: Arrow Up/Down move the highlight, Enter and
 * Space select, Escape closes and returns focus to the trigger, Home/End jump
 * to the ends, and clicking outside closes.
 *
 * ─── THE GLYPHS ARE DECORATION ───────────────────────────────────────────────
 *
 * Every one is `aria-hidden`; the label and the month range carry the meaning.
 * A leaf does not tell anyone it means autumn.
 *
 * ─── THE OPTION LIST IS GENERATED, NOT LISTED ────────────────────────────────
 *
 * `options` comes from `intakeOptionsWith`, which derives the years from
 * today's date and guarantees the student's stored choice is present even
 * once it has aged out of the window. This component renders what it is
 * given and knows nothing about years.
 */
export function IntakePicker({
  options,
  value,
  onChange,
  label,
  placeholder,
}: {
  options: readonly IntakeOption[];
  value: IntakeChoice | undefined;
  onChange: (next: IntakeChoice) => void;
  label: string;
  placeholder: string;
}) {
  const t = useT();
  const localizedOptions = options.map((option) => localizeIntakeOption(option, t));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selectedId = value ? intakeOptionId(value) : null;
  const selected = localizedOptions.find((option) => option.id === selectedId);

  /**
   * Open, with the highlight on the current choice rather than the top of the
   * list — so Enter twice is a no-op instead of silently changing the answer.
   *
   * Done here rather than in an effect keyed on `open`: the index derives from
   * the act of opening, not from rendering, and setting state synchronously
   * inside an effect triggers a second render pass for something an event
   * handler already knows.
   */
  function openList() {
    const index = options.findIndex((option) => option.id === selectedId);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function choose(option: IntakeOption) {
    onChange(option.choice);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActive((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((prev) => Math.max(prev - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = options[active];
        if (option) choose(option);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`flex w-full items-center justify-between gap-gb-md rounded-gb-lg border bg-surface px-gb-lg py-gb-md text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          open ? 'border-brand' : 'border-line hover:border-line-strong'
        }`}
      >
        <span className="flex items-center gap-gb-md">
          <span aria-hidden="true" className="text-gb-lg leading-none">
            {selected?.glyph ?? '📅'}
          </span>
          {selected ? (
            <span className="flex flex-col">
              <span className="text-gb-sm font-semibold text-fg">{selected.label}</span>
              <span className="text-gb-xs text-fg-tertiary">{selected.detail}</span>
            </span>
          ) : (
            <span className="text-gb-sm text-fg-tertiary">{placeholder}</span>
          )}
        </span>
        <span aria-hidden="true" className="shrink-0 text-fg-tertiary">
          <KitIcon art={ICONS.chevronDown} frame={16} />
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-20 mt-gb-xs max-h-80 overflow-y-auto rounded-gb-xl border border-line bg-surface py-gb-xs shadow-gb-lg"
        >
          {localizedOptions.map((option, index) => {
            const isSelected = option.id === selectedId;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  // The pointer moves the highlight so mouse and keyboard
                  // never disagree about which row Enter would take.
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center gap-gb-lg px-gb-lg py-gb-md text-left transition-colors ${
                    index === active ? 'bg-brand-subtle' : 'bg-transparent'
                  }`}
                >
                  <span aria-hidden="true" className="shrink-0 text-gb-lg leading-none">
                    {option.glyph}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-gb-sm font-medium text-fg">{option.label}</span>
                    <span className="truncate text-gb-xs text-fg-tertiary">{option.detail}</span>
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
      ) : null}
    </div>
  );
}
