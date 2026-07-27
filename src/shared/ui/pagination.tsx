'use client';

import { KitIcon, ICONS } from './icons';

/**
 * Pagination — Figma 105:8300 footer control: "← Previous", a numbered run
 * with a "…" gap, and "Next →", sitting under a 1px top rule.
 *
 * Page math is separated from rendering: `paginationRange` decides which numbers
 * and gaps to show, so it can be unit-tested and reused. The control itself is
 * presentational and calls `onPageChange` — the caller owns the current page.
 *
 * Arrows reuse ICONS.arrowRight (mirrored for "previous") rather than shipping a
 * second asset, matching how the rest of shared/ui treats the kit's icons.
 */

const DOTS = 'dots' as const;
type PageItem = number | typeof DOTS;

/**
 * The sequence of page numbers and gaps to render.
 *
 * Always shows the first and last page, the current page with `siblings` on each
 * side, and collapses the rest into `…`. Exported for tests.
 */
export function paginationRange(
  current: number,
  total: number,
  siblings = 1,
): PageItem[] {
  // 2 edges + current + 2*siblings + 2 dots. Below that, just list them all —
  // inserting a "…" that hides a single page is pointless.
  const maxSlots = siblings * 2 + 5;
  if (total <= maxSlots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, total);
  const showLeftDots = left > 2;
  const showRightDots = right < total - 1;

  const range: PageItem[] = [1];
  if (showLeftDots) range.push(DOTS);
  for (let p = showLeftDots ? left : 2; p <= (showRightDots ? right : total - 1); p++) {
    range.push(p);
  }
  if (showRightDots) range.push(DOTS);
  range.push(total);
  return range;
}

const NUMBER_BASE =
  'flex h-gb-5xl min-w-gb-5xl items-center justify-center rounded-gb-md px-gb-sm text-gb-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

const ARROW =
  'flex items-center gap-gb-md rounded-gb-md px-gb-md py-gb-md text-gb-sm font-semibold text-fg-secondary ' +
  'transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:pointer-events-none disabled:opacity-40';

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string | undefined;
  previousLabel?: string;
  nextLabel?: string;
}) {
  if (totalPages <= 1) return null;
  const items = paginationRange(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between border-t border-line pt-gb-2xl ${
        className ?? ''
      }`}
    >
      <button
        type="button"
        className={ARROW}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <KitIcon art={ICONS.arrowRight} frame={20} className="rotate-180" />
        <span className="hidden sm:inline">{previousLabel}</span>
      </button>

      <ul className="flex items-center gap-gb-xxs">
        {items.map((item, i) =>
          item === DOTS ? (
            <li key={`dots-${i}`} className="px-gb-sm text-gb-sm text-fg-muted" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={`${NUMBER_BASE} ${
                  item === page
                    ? 'bg-surface-muted text-fg'
                    : 'text-fg-secondary hover:bg-surface-hover'
                }`}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className={ARROW}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        <span className="hidden sm:inline">{nextLabel}</span>
        <KitIcon art={ICONS.arrowRight} frame={20} />
      </button>
    </nav>
  );
}
