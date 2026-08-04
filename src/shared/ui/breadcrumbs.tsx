'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { breadcrumbTrail, type Crumb } from '@/shared/lib';
import { useLanguage } from '@/lib/i18n';

/**
 * Breadcrumbs.
 *
 * ─── WHY THE SYSTEM NEEDED THESE ─────────────────────────────────────────────
 *
 * Several screens are reached once, through a redirect chain, and then never
 * again — the AI reports are the clearest case: onboarding forwards a student
 * through four steps and lands them on the dashboard, and nothing on the page
 * says where they are or how to get back to what they just read. The browser's
 * Back button is not an answer when the route that brought you here redirects
 * you forward again on arrival.
 *
 * ─── THE TRAIL IS NOT THE URL ────────────────────────────────────────────────
 *
 * Parents come from the route registry, not from chopping path segments. The
 * parent of `/ai-strategy/<id>/strategy/analysis/portrait` is the application
 * workspace at `/apply/<id>`, which shares no prefix with it whatsoever. A
 * URL-derived trail would offer `/ai-strategy/<id>/strategy/analysis` — a route
 * that immediately forwards — and `/ai-strategy/<id>` , which is not a page.
 *
 * ─── IT RENDERS NOTHING WHERE THERE IS NOWHERE TO GO ─────────────────────────
 *
 * `breadcrumbTrail` returns an empty array for `/auth`, `/onboarding`,
 * `/coming-soon` and the landing page. Those are not oversights: a trail out of
 * a sign-in wall is an invitation to abandon it. A single-crumb trail is also
 * suppressed — "My Portal" alone, on My Portal, is furniture.
 */
export function Breadcrumbs({
  /**
   * Names for dynamic crumbs, e.g. `{ application: 'MSc Health Admin' }`.
   * Anything not supplied falls back to the honest generic word.
   */
  labels,
  className,
}: {
  labels?: Readonly<Record<string, string>>;
  className?: string;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const trail = breadcrumbTrail(pathname, labels);

  if (trail.length < 2) return null;

  return (
    <nav
      aria-label={t('Breadcrumb')}
      className={`flex min-w-0 items-center${className ? ` ${className}` : ''}`}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-x-gb-md gap-y-gb-xxs">
        {trail.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-x-gb-md">
            {index > 0 ? <Separator /> : null}
            <CrumbLabel crumb={crumb} isLast={index === trail.length - 1} translate={t} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function CrumbLabel({
  crumb,
  isLast,
  translate,
}: {
  crumb: Crumb;
  isLast: boolean;
  translate: (key: string) => string;
}) {
  /*
   * Dynamic crumbs carry real names — a course, a university, a person — and
   * must not be run through the dictionary: "Massachusetts Institute of
   * Technology" is not a UI string, and the dictionary's own header says not to
   * translate university names. A crumb with an href is a fixed label from the
   * registry; the last one may be either, so it is only translated when it
   * matches a known registry label.
   */
  const label = crumb.href ? translate(crumb.label) : crumb.label;

  if (isLast || !crumb.href) {
    return (
      <span
        aria-current={isLast ? 'page' : undefined}
        className="truncate text-gb-sm font-medium text-fg"
        title={label}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={crumb.href}
      className="truncate rounded-gb-sm text-gb-sm text-fg-tertiary transition-colors hover:text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      title={label}
    >
      {label}
    </Link>
  );
}

function Separator() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-fg-muted"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
