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
 * ─── LOCKED ITEMS ARE SHOWN, NOT HIDDEN ──────────────────────────────────────
 *
 * An item the student cannot reach yet renders as plain text with a title
 * explaining why, instead of disappearing. Hiding it makes the product look
 * smaller than it is and gives no clue what finishing the analysis unlocks;
 * linking it would send them to a route that redirects straight back, which is
 * the exact confusion this bar exists to remove.
 *
 * It scrolls horizontally rather than wrapping — six entries do not fit a
 * narrow laptop, and a second row that appears and disappears as labels change
 * length between English and Vietnamese moves the page content under the
 * student's cursor.
 */
export function SubNav({
  items,
  activeKey,
  label,
  lockedHint,
}: {
  items: readonly SubNavItem[];
  activeKey: string | null;
  /** Accessible name — what this bar navigates within. */
  label: string;
  /** Tooltip on a locked entry. Says why, not just that. */
  lockedHint: string;
}) {
  const { t } = useLanguage();

  return (
    <nav
      aria-label={label}
      className="-mx-gb-xl overflow-x-auto border-b border-line px-gb-xl"
    >
      <ul className="flex min-w-max items-center gap-gb-2xl">
        {items.map((item) => {
          const isActive = item.key === activeKey;

          if (item.locked) {
            return (
              <li key={item.key}>
                <span
                  title={lockedHint}
                  aria-disabled="true"
                  className="inline-block cursor-default whitespace-nowrap border-b-2 border-transparent pb-gb-md pt-gb-sm text-gb-sm font-medium text-fg-muted opacity-60"
                >
                  {t(item.label)}
                </span>
              </li>
            );
          }

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-block whitespace-nowrap border-b-2 pb-gb-md pt-gb-sm text-gb-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  isActive
                    ? 'border-brand text-fg-brand'
                    : 'border-transparent text-fg-secondary hover:text-fg-brand'
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
