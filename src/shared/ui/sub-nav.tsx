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
const TONES: Record<SubNavTone, { nav: string; active: string; rest: string }> = {
  light: {
    nav: 'border-b border-line',
    active: 'border-brand text-fg-brand',
    rest: 'border-transparent text-fg-secondary hover:text-fg-brand',
  },
  'on-brand': {
    nav: 'border-b border-on-brand/20',
    active: 'border-on-brand text-on-brand',
    rest: 'border-transparent text-on-brand/75 hover:text-on-brand',
  },
};

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
      <ul className="flex min-w-max items-center gap-gb-2xl">
        {reachable.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-block whitespace-nowrap border-b-2 pb-gb-md pt-gb-sm text-gb-sm font-medium transition-colors ${focusRing} ${
                  isActive ? palette.active : palette.rest
                }`}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
