import type { Recommendation } from '../domain';
import { SEEDED_CATEGORIES } from '../domain';
import { Badge, Panel } from '@/shared/ui';

/**
 * Strategy Categories — requirements.md Requirement 9.2-9.3, 9.6.
 *
 * Renders `SEEDED_CATEGORIES` (the five match-insights-pillar-derived
 * categories, plus a "Coming soon" CV/Portfolio placeholder — see Open
 * decision 2) with a live count of how many recommendations fell into each.
 * "AI decides which appear" (9.2) is honoured by only showing a category
 * once it has at least one recommendation, except the placeholder, which is
 * always shown so students know the category exists.
 */
export function StrategyCategoryBoard({
  recommendations,
}: {
  recommendations: readonly Recommendation[];
}) {
  const counts = new Map<string, number>();
  for (const rec of recommendations) {
    if (!rec.category) continue;
    counts.set(rec.category, (counts.get(rec.category) ?? 0) + 1);
  }

  const visible = SEEDED_CATEGORIES.filter(
    (category) => category.comingSoon || (counts.get(category.key) ?? 0) > 0,
  );

  if (visible.length === 0) return null;

  return (
    <div className="grid gap-gb-xl sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((category) => (
        <Panel key={category.key} padding="sm" className="flex items-center justify-between gap-gb-md">
          <p className="text-gb-sm font-semibold text-fg">{category.label}</p>
          {category.comingSoon ? (
            <Badge variant="neutral">Coming soon</Badge>
          ) : (
            <Badge variant="brand-subtle">{counts.get(category.key) ?? 0}</Badge>
          )}
        </Panel>
      ))}
    </div>
  );
}
