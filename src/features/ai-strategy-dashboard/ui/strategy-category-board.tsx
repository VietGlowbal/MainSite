import Link from 'next/link';
import type { Recommendation } from '../domain';
import { SEEDED_CATEGORIES, STRATEGY_TOOLS, nextPriority, strategyToolHref, taskCounts } from '../domain';
import { IconCircle } from './planner-shared';
import { ICONS, KitIcon, Panel, ProgressBar, type KitIconArt } from '@/shared/ui';

/**
 * Strategy Categories — requirements.md Requirement 9.2-9.3, 9.6.
 *
 * ⚠️ HARD-LIMITED TO THREE, unlike the six `SEEDED_CATEGORIES` — Academics,
 * Activities and Personal Statement, per the reference screenshot and an
 * explicit decision to always show exactly those three rather than the
 * previous "AI decides which appear" count-based visibility. Impact,
 * Personal and CV/Portfolio still exist as categories (a recommendation can
 * still carry one of those keys and show up in the Planner's list/board/
 * calendar), they just don't get a card on this board.
 *
 * An empty category still renders here — 0/0, "Next up: Nothing yet" — it
 * doesn't disappear the way the old count-based board would have hidden it.
 *
 * ⚠️ THIS USED TO RENDER A "Coming soon" BADGE ON CV / PORTFOLIO. See the
 * note on `StrategyCategory.tool` for why a category's "has a workspace" and
 * "has tasks" are two independent things. `personal-statement` still opens
 * its tool (the SOP writer) below its progress, exactly as before — the
 * visual style changed, not that link.
 */
const BOARD_CATEGORY_KEYS = ['academics', 'activities', 'personal-statement'] as const;

const CATEGORY_ICON: Record<(typeof BOARD_CATEGORY_KEYS)[number], KitIconArt> = {
  academics: ICONS.graduationCap,
  activities: ICONS.usersTwo,
  'personal-statement': ICONS.edit02,
};

const CATEGORY_TONE: Record<(typeof BOARD_CATEGORY_KEYS)[number], 'safe' | 'info' | 'brand'> = {
  academics: 'safe',
  activities: 'info',
  'personal-statement': 'brand',
};

export function StrategyCategoryBoard({
  applicationId,
  recommendations,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
}) {
  const categories = SEEDED_CATEGORIES.filter((category) =>
    (BOARD_CATEGORY_KEYS as readonly string[]).includes(category.key),
  );

  return (
    <div className="grid gap-gb-xl sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const key = category.key as (typeof BOARD_CATEGORY_KEYS)[number];
        const categoryRecs = recommendations.filter((r) => r.category === category.key);
        const { completed, total } = taskCounts(categoryRecs);
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        const next = nextPriority(categoryRecs);
        const tool = category.tool === null ? null : STRATEGY_TOOLS[category.tool];

        return (
          <Panel key={category.key} padding="sm" className="flex flex-col gap-gb-lg">
            <div className="flex items-center gap-gb-lg">
              <IconCircle icon={CATEGORY_ICON[key]} tone={CATEGORY_TONE[key]} />
              <p className="text-gb-sm font-semibold text-fg">{category.label}</p>
            </div>

            <div className="flex flex-col gap-gb-xs">
              <ProgressBar value={percent} label={`${category.label} progress`} />
              <p className="text-gb-xs text-fg-tertiary">
                {completed} / {total} tasks completed
              </p>
            </div>

            <div className="flex flex-col gap-gb-xxs">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                Next up
              </p>
              {next ? (
                <Link
                  href={`/ai-strategy/${applicationId}/strategy/recommendations/${next.id}`}
                  className="inline-flex items-center gap-gb-xs self-start text-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {next.title}
                  <KitIcon art={ICONS.arrowRight} frame={16} className="shrink-0" />
                </Link>
              ) : (
                <p className="text-gb-sm text-fg-tertiary">Nothing left — nicely done.</p>
              )}
            </div>

            {tool ? (
              <Link
                href={strategyToolHref(category.tool!, applicationId)}
                className="inline-flex items-center gap-gb-xs self-start text-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {tool.label}
                <KitIcon art={ICONS.arrowRight} frame={16} className="shrink-0" />
              </Link>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}
