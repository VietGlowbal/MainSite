'use client';

import { ICONS, KitIcon } from '@/shared/ui';

/**
 * The reflection flow's own breadcrumb — deliberately separate from
 * `shared/ui/breadcrumbs.tsx`. That component answers "which registered
 * ROUTE am I on" from `usePathname()`; this one answers "which ACTIVITY and
 * REFLECTION DIMENSION am I on right now", which lives in component state
 * (`reflectTarget`/`dimensionIndex` in `reflection-evidence-form.tsx`), not
 * in the URL — the reflection dialog is a modal, not a route. Extending the
 * pathname-based registry to a state this granular would mean turning every
 * dimension into its own route; this component derives the same visual/
 * accessibility contract (`nav aria-label="Breadcrumb"`, `aria-current` on
 * the last item, clickable ancestors) directly from that state instead.
 *
 * Items are `{ label, onClick? }`, not `{ label, href? }`: every "go back"
 * here is "close this modal / step back a level" rather than a URL
 * navigation, so there is nothing to link to.
 */

export type ReflectionBreadcrumbItem = {
  label: string;
  onClick?: (() => void) | undefined;
};

export function ReflectionBreadcrumb({
  items,
  mobile,
}: {
  items: ReflectionBreadcrumbItem[];
  /** Compact "← Back / Current · position" pattern shown instead, below `sm`. */
  mobile?: {
    backLabel: string;
    onBack: () => void;
    title: string;
    meta?: string | undefined;
  };
}) {
  if (items.length === 0) return null;

  return (
    <>
      <nav aria-label="Breadcrumb" className="hidden flex-wrap items-center gap-gb-sm text-gb-sm sm:flex">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="flex items-center gap-gb-sm">
              {index > 0 ? (
                <span aria-hidden="true" className="text-fg-muted">
                  /
                </span>
              ) : null}
              {isLast || !item.onClick ? (
                <span
                  {...(isLast ? { 'aria-current': 'page' as const } : {})}
                  className={isLast ? 'font-semibold text-fg' : 'text-fg-tertiary'}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="text-fg-tertiary hover:text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {item.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>

      {mobile ? (
        <div className="flex flex-col gap-gb-xs sm:hidden">
          <button
            type="button"
            onClick={mobile.onBack}
            className="flex items-center gap-gb-xs self-start text-gb-sm font-semibold text-fg-brand"
          >
            <KitIcon art={ICONS.arrowLeft} frame={16} />
            {mobile.backLabel}
          </button>
          <div className="flex items-baseline justify-between gap-gb-md">
            <p className="text-gb-md font-semibold text-fg">{mobile.title}</p>
            {mobile.meta ? <p className="text-gb-xs text-fg-tertiary">{mobile.meta}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
