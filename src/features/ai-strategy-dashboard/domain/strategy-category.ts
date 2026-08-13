import type { PillarKey } from '@/lib/match-insights';
import type { StrategyToolKey } from './strategy-tool';

/**
 * Strategy Category — one AI-selected grouping shown on the Dashboard
 * (requirements.md 9.2). The generator decides which categories appear for a
 * given Strategy; nothing here is a hardcoded "the only possible set". What
 * this module provides is the Phase 1 seed set (9.3): five categories derived
 * one-to-one from match-insights' existing pillars, so the Dashboard has
 * something real to render before a bespoke category generator exists.
 */

export type StrategyCategory = {
  key: string;
  label: string;
  pillar: PillarKey | null;
  /**
   * The workspace this category opens into, if it has one.
   *
   * ⚠️ REPLACED A `comingSoon: boolean`. That flag said the CV / Portfolio
   * category had no workspace yet, and by the time anyone read it that was
   * false — the four-step CV builder existed and shipped a PDF export. It was
   * simply not linked from anywhere a student would look.
   *
   * It cannot be fixed by flipping the flag to `false` either, which is the
   * trap: no recommendation is ever assigned `cv-portfolio` (the category has
   * no pillar, and `categoryByPillar` is the only thing that assigns
   * categories), so its count is permanently 0 and the board's
   * "show if count > 0" rule would drop the card altogether. A category
   * earns its place on the board by having a tool OR having tasks — which is
   * what this field expresses and a boolean could not.
   */
  tool: StrategyToolKey | null;
};

export const SEEDED_CATEGORIES: readonly StrategyCategory[] = [
  { key: 'academics', label: 'Academics', pillar: 'academic', tool: null },
  { key: 'activities', label: 'Activities', pillar: 'activities', tool: null },
  // The one category that is both: it collects the `essays` pillar's
  // recommendations AND opens the writer that acts on them.
  { key: 'personal-statement', label: 'Personal Statement', pillar: 'essays', tool: 'statement' },
  { key: 'impact', label: 'Impact', pillar: 'impact', tool: null },
  { key: 'personal', label: 'Personal', pillar: 'personal', tool: null },
  // No pillar on purpose — a CV carries academics, activities and impact at
  // once, so it is a workspace rather than a bucket of tasks.
  { key: 'cv-portfolio', label: 'CV / Portfolio', pillar: null, tool: 'cv' },
  // No pillar either — these come from F7's Execution Roadmap
  // (`recommendationsFromRoadmap` in `recommendation.ts`), which reasons
  // across the whole strategy rather than one pillar at a time.
  { key: 'strategy-roadmap', label: 'Strategy Roadmap', pillar: null, tool: null },
];

export function categoryByPillar(pillar: PillarKey): StrategyCategory | undefined {
  return SEEDED_CATEGORIES.find((c) => c.pillar === pillar);
}
