import Link from 'next/link';
import type { Recommendation } from '../domain';
import { SEEDED_CATEGORIES, STRATEGY_TOOLS, strategyToolHref } from '../domain';
import { Badge, ICONS, KitIcon, Panel } from '@/shared/ui';

/**
 * Strategy Categories — requirements.md Requirement 9.2-9.3, 9.6.
 *
 * Renders `SEEDED_CATEGORIES` with a live count of how many recommendations
 * fell into each. "AI decides which appear" (9.2) is honoured by only showing a
 * category once it has at least one recommendation — OR once it opens a
 * workspace, which is the other way a category earns its place.
 *
 * ⚠️ THIS USED TO RENDER A "Coming soon" BADGE ON CV / PORTFOLIO. The four-step
 * CV builder was already built and exporting PDFs at that point; the badge was
 * just never updated, so the Dashboard actively told students a finished tool
 * did not exist. See the note on `StrategyCategory.tool` for why the fix is a
 * tool binding rather than flipping a boolean.
 *
 * A category with a tool is a link; one without is a count. `personal-statement`
 * is both, and shows both.
 */
export function StrategyCategoryBoard({
  applicationId,
  recommendations,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
}) {
  const counts = new Map<string, number>();
  for (const rec of recommendations) {
    if (!rec.category) continue;
    counts.set(rec.category, (counts.get(rec.category) ?? 0) + 1);
  }

  const visible = SEEDED_CATEGORIES.filter(
    (category) => category.tool !== null || (counts.get(category.key) ?? 0) > 0,
  );

  if (visible.length === 0) return null;

  return (
    <div className="grid gap-gb-xl sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((category) => {
        const count = counts.get(category.key) ?? 0;
        const tool = category.tool === null ? null : STRATEGY_TOOLS[category.tool];

        return (
          <Panel key={category.key} padding="sm" className="flex flex-col gap-gb-md">
            <div className="flex items-center justify-between gap-gb-md">
              <p className="text-gb-sm font-semibold text-fg">{category.label}</p>
              {/* A tool-only category has no tasks to count, and a "0" badge
                  beside a working workspace reads as "nothing here". */}
              {count > 0 ? <Badge variant="brand-subtle">{count}</Badge> : null}
            </div>

            {tool ? (
              <>
                <p className="text-gb-xs text-fg-tertiary">{tool.blurb}</p>
                <Link
                  href={strategyToolHref(category.tool!, applicationId)}
                  className="inline-flex items-center gap-gb-xs self-start text-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {tool.label}
                  <KitIcon art={ICONS.arrowRight} frame={16} className="shrink-0" />
                </Link>
              </>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}
