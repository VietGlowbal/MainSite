'use client';

/**
 * Shared, page-numbered pagination control.
 *
 * Windowed page list: always show the first and last page, plus the current
 * page and its immediate neighbours, with `'ellipsis'` filling the gaps.
 * e.g. (current 4, total 9) → [1, 'ellipsis', 3, 4, 5, 'ellipsis', 9].
 */
function buildPageItems(current: number, total: number): (number | 'ellipsis')[] {
  const items: (number | 'ellipsis')[] = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= current - 1 && p <= current + 1)) {
      items.push(p);
    } else if (items[items.length - 1] !== 'ellipsis') {
      items.push('ellipsis');
    }
  }
  return items;
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const items = buildPageItems(page, pageCount);
  const arrow = 'flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-pink-200 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600';
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-6" aria-label="Pagination">
      <button type="button" className={arrow} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {items.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1 text-sm text-slate-400 select-none">…</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
              item === page
                ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_6px_16px_rgba(255,77,140,0.3)]'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:text-pink-600'
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button type="button" className={arrow} onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </nav>
  );
}
