'use client';

import Link from 'next/link';
import type { SubNavItem } from '@/shared/lib';
import { useLanguage } from '@/lib/i18n';

/**
 * A secondary navigation bar, scoped to one thing the student is working on.
 *
 * ─── WHY A SECOND BAR RATHER THAN MORE TOP-NAV ENTRIES ───────────────────────
 *
 * The top bar answers "what does GlowBal do"; it is the same on every page and
 * the owner wants it left alone. This answers "what can I do with THIS
 * application", which is a different question with a different answer per row
 * in My Portal. Folding these into the top bar would put six entries there that
 * are meaningless on every page outside one application.
 *
 * ─── LOCKED ITEMS ARE OMITTED, NOT DIMMED ────────────────────────────────────
 *
 * An item the student cannot reach yet used to render as inert dimmed text —
 * a promise of what finishing unlocks. In practice it just meant an entry
 * that looked clickable and was not, and it duplicated what the black stage
 * bar the report pages used to carry underneath this one already showed
 * (removed 12/08, see `report-chrome.tsx`). This bar now only lists what the
 * student can actually open; `applicationSubNav()` still marks the rest
 * `locked` for callers that need to know, this component just does not draw
 * them.
 *
 * It scrolls horizontally rather than wrapping — six entries do not fit a
 * narrow laptop, and a second row that appears and disappears as labels change
 * length between English and Vietnamese moves the page content under the
 * student's cursor.
 *
 * ─── TONE ────────────────────────────────────────────────────────────────────
 *
 * `light` is the bar on a white page. `on-brand` is the same bar sitting in the
 * brand-red band that heads every application page: the underline and the
 * active label become white, because a rose underline on rose is invisible, and
 * the resting labels drop to a partial white rather than a grey — grey text on
 * a saturated red reads as damaged rather than secondary.
 */
export type SubNavTone = 'light' | 'on-brand';

/** Per-tone classes, kept as whole strings so Tailwind's scanner extracts them. */
const TONES: Record<SubNavTone, { nav: string; active: string; rest: string; divider: string }> = {
  light: {
    nav: 'border-b border-line pb-gb-sm',
    active: 'bg-brand/10 text-fg-brand font-medium shadow-sm',
    rest: 'text-fg-secondary hover:text-fg hover:bg-surface-muted',
    divider: 'bg-line',
  },
  'on-brand': {
    nav: 'pb-gb-sm',
    active: 'bg-white/20 text-white font-medium shadow-sm',
    rest: 'text-white/80 hover:text-white hover:bg-white/10',
    divider: 'bg-white/20',
  },
};

function SubNavIcon({ icon, className = 'size-5' }: { icon: string; className?: string }) {
  switch (icon) {
    case 'home':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'fileText':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    case 'target':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'pencil':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      );
    case 'mail':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'folder':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
      );
    case 'chart':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'compass':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    default:
      return null;
  }
}

function resolveItemIcon(item: SubNavItem): string | null {
  if (item.icon) return item.icon;
  switch (item.key) {
    case 'overview':
    case 'reflections':
      return 'home';
    case 'personalReport':
      return 'fileText';
    case 'matchingReport':
      return 'target';
    case 'strategyReport':
      return 'compass';
    case 'planner':
      return 'calendar';
    case 'cv':
      return 'fileText';
    case 'essay':
    case 'statement':
      return 'pencil';
    case 'lor':
      return 'mail';
    case 'documents':
      return 'folder';
    case 'finalCheck':
      return 'chart';
    default:
      return null;
  }
}

export function SubNav({
  items,
  activeKey,
  label,
  tone = 'light',
}: {
  items: readonly SubNavItem[];
  activeKey: string | null;
  /** Accessible name — what this bar navigates within. */
  label: string;
  /** Which surface the bar is drawn on. See the note above. */
  tone?: SubNavTone | undefined;
}) {
  const { t } = useLanguage();
  const palette = TONES[tone];
  const focusRing =
    tone === 'on-brand'
      ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-brand'
      : 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  const reachable = items.filter((item) => !item.locked);

  return (
    <nav
      aria-label={label}
      className={`-mx-gb-xl overflow-x-auto px-gb-xl ${palette.nav}`}
    >
      <ul className="flex min-w-max items-center gap-1 sm:gap-2">
        {reachable.map((item) => {
          const isActive = item.key === activeKey;
          const icon = resolveItemIcon(item);

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-center transition-all ${focusRing} ${
                  isActive ? palette.active : palette.rest
                }`}
              >
                {icon ? (
                  <span className="shrink-0">
                    <SubNavIcon icon={icon} className="size-5" />
                  </span>
                ) : null}
                <span className="whitespace-nowrap text-gb-xs font-medium tracking-tight">
                  {t(item.label)}
                </span>
              </Link>
            </li>
          );
        })}
        {tone === 'on-brand' ? (
          <li className={`h-6 w-px ${palette.divider} my-auto ml-1 shrink-0`} aria-hidden="true" />
        ) : null}
      </ul>
    </nav>
  );
}
