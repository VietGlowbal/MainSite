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
/**
 * Which surface the trail is drawn on. `on-brand` is the brand-red band at the
 * top of every application page: the same hierarchy (current crumb strongest,
 * parents one step back) expressed in white rather than in greys, which lose
 * all contrast against a saturated red.
 */
export type BreadcrumbsTone = 'light' | 'on-brand';

const TONES: Record<BreadcrumbsTone, { current: string; parent: string; separator: string }> = {
  light: {
    current: 'text-fg',
    parent:
      'text-fg-tertiary hover:text-fg-brand focus-visible:outline-brand',
    separator: 'text-fg-muted',
  },
  'on-brand': {
    current: 'text-on-brand',
    parent:
      'text-on-brand/75 hover:text-on-brand focus-visible:outline-on-brand',
    separator: 'text-on-brand/60',
  },
};

export function Breadcrumbs({
  /**
   * Names for dynamic crumbs, e.g. `{ application: 'MSc Health Admin' }`.
   * Anything not supplied falls back to the honest generic word.
   */
  labels,
  className,
  tone = 'light',
}: {
  labels?: Readonly<Record<string, string>>;
  className?: string;
  tone?: BreadcrumbsTone | undefined;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const trail = breadcrumbTrail(pathname, labels);

  if (trail.length < 2) return null;

  const palette = TONES[tone];

  return (
    <nav
      aria-label={t('Breadcrumb')}
      className={`flex min-w-0 items-center${className ? ` ${className}` : ''}`}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-x-gb-md gap-y-gb-xxs">
        {trail.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-x-gb-md">
            {index > 0 ? <Separator className={palette.separator} /> : null}
            <CrumbLabel
              crumb={crumb}
              isLast={index === trail.length - 1}
              translate={t}
              palette={palette}
            />
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
  palette,
}: {
  crumb: Crumb;
  isLast: boolean;
  translate: (key: string) => string;
  palette: { current: string; parent: string };
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
        className={`truncate text-gb-sm font-medium ${palette.current}`}
        title={label}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={crumb.href}
      className={`truncate rounded-gb-sm text-gb-sm transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${palette.parent}`}
      title={label}
    >
      {label}
    </Link>
  );
}

function Separator({ className }: { className: string }) {
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
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
