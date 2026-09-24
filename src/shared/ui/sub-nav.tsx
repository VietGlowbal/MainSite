'use client';

import Link from 'next/link';
import type { SubNavItem } from '@/shared/lib';
import { useLanguage } from '@/lib/i18n';
import { GlowbalIcon } from './glowbal-icon';
import { isGlowbalIconName } from './glowbal-icon-art';
import type { GlowbalIconName } from './glowbal-icon-art';

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
 *
 * ─── ICONS ───────────────────────────────────────────────────────────────────
 *
 * Product icons (`GlowbalIcon`), never colour-picked here. On the band the
 * wrapper declares `data-surface="brand"`, so each icon follows its tab's text
 * through rest, hover and active; on a white page it is the two-tone ink + rose.
 * These replaced nine hand-drawn Feather-style glyphs on 2026-09-15.
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

/**
 * The icon for a tab that does not name its own. Keyed by `SubNavItem.key`, so
 * every caller of the bar gets the same icon for the same destination.
 */
const ITEM_ICON: Readonly<Record<string, GlowbalIconName>> = {
  overview: 'myApplication',
  reflections: 'reflection',
  personalReport: 'personalReport',
  matchingReport: 'matchingReport',
  strategyReport: 'personalizedStrategy',
  planner: 'applicationPlanner',
  cv: 'cvSupport',
  essay: 'essaySupport',
  statement: 'essaySupport',
  lor: 'lorSupport',
  documents: 'documents',
  finalCheck: 'finalEvaluation',
};

/**
 * An item's own `icon` wins when it names a real product icon. Anything else —
 * a stale name from before the icon set existed — falls back to the key's icon
 * rather than rendering nothing.
 */
function resolveItemIcon(item: SubNavItem): GlowbalIconName | null {
  if (item.icon && isGlowbalIconName(item.icon)) return item.icon;
  return ITEM_ICON[item.key] ?? null;
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
                {icon ? <GlowbalIcon name={icon} size={20} /> : null}
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
