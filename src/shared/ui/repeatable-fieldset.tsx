'use client';

import { useId } from 'react';
import { KitIcon, ICONS } from './icons';

/**
 * RepeatableFieldset — a list of identical sub-forms the student can grow.
 *
 * Reflection uses it twice: academic achievements and non-academic activities.
 * The design draws each entry as a numbered card ("Thành tích 1", "Thành tích
 * 2") with a circular add control beneath the last one.
 *
 * IT RENDERS THE FRAME, NOT THE FIELDS. Callers supply the field markup per
 * entry through `renderEntry`, because achievements and activities share a
 * shape but not a schema. Keeping the fields out means this component never
 * has to know about either.
 *
 * ON KEYS. Entries are keyed by a caller-supplied `keyOf`, never by array
 * index. React reuses DOM nodes across renders, so an index key means removing
 * the second of three entries leaves the third's typed-but-uncommitted input
 * state sitting in the second's box — the classic form-list bug, and a
 * particularly bad one here because the student cannot tell it has happened.
 */

export function RepeatableFieldset<T>({
  legend,
  description,
  entries,
  keyOf,
  entryLabel,
  addLabel,
  onAdd,
  onRemove,
  renderEntry,
  max,
  emptyState,
}: {
  legend: string;
  description?: string | undefined;
  entries: T[];
  /** Stable identity per entry. Never the array index — see the note above. */
  keyOf: (entry: T, index: number) => string;
  /** Heading for one entry, e.g. `(i) => \`Achievement ${i + 1}\``. */
  entryLabel: (index: number) => string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderEntry: (entry: T, index: number) => React.ReactNode;
  /** Hides the add control once reached. Mirrors the schema's own cap. */
  max?: number | undefined;
  /** Shown in place of the list when there is nothing yet. */
  emptyState?: React.ReactNode;
}) {
  const headingId = useId();
  const atMax = max !== undefined && entries.length >= max;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-gb-3xl">
      <div className="flex flex-col gap-gb-xs">
        <h3 id={headingId} className="font-display text-gb-xl font-semibold text-fg">
          {legend}
        </h3>
        {description ? <p className="text-gb-sm text-fg-tertiary">{description}</p> : null}
      </div>

      {entries.length === 0 && emptyState ? (
        <div className="rounded-gb-2xl border border-dashed border-line-strong p-gb-3xl text-gb-sm text-fg-tertiary">
          {emptyState}
        </div>
      ) : null}

      <ol className="flex flex-col gap-gb-3xl">
        {entries.map((entry, index) => (
          <li
            key={keyOf(entry, index)}
            className="flex flex-col gap-gb-2xl rounded-gb-2xl border border-line bg-surface-muted p-gb-3xl"
          >
            <div className="flex items-center justify-between gap-gb-xl">
              <h4 className="text-gb-md font-semibold text-fg">{entryLabel(index)}</h4>
              <button
                type="button"
                onClick={() => onRemove(index)}
                /* Named for what it removes. A bare "Remove" repeated down the
                   page gives a screen-reader user a list of identical controls
                   with no way to tell which is which. */
                aria-label={`Remove ${entryLabel(index)}`}
                className="flex items-center gap-gb-xs rounded-gb-sm px-gb-md py-gb-xs text-gb-sm font-semibold text-fg-tertiary hover:text-fg-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Remove
              </button>
            </div>

            {renderEntry(entry, index)}
          </li>
        ))}
      </ol>

      {atMax ? (
        <p className="text-gb-sm text-fg-muted">
          That is the most we can include. Remove one to add another.
        </p>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-gb-md self-center rounded-gb-full border border-line-strong px-gb-3xl py-gb-lg text-gb-sm font-semibold text-fg-secondary hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.plus} frame={20} className="shrink-0" />
          {addLabel}
        </button>
      )}
    </section>
  );
}
