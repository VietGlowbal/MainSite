import type { PillarKey } from '@/lib/match-insights';

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
  /** True while this category has no real workspace yet (requirements.md 9.6). */
  comingSoon: boolean;
};

export const SEEDED_CATEGORIES: readonly StrategyCategory[] = [
  { key: 'academics', label: 'Academics', pillar: 'academic', comingSoon: false },
  { key: 'activities', label: 'Activities', pillar: 'activities', comingSoon: false },
  { key: 'personal-statement', label: 'Personal Statement', pillar: 'essays', comingSoon: false },
  { key: 'impact', label: 'Impact', pillar: 'impact', comingSoon: false },
  { key: 'personal', label: 'Personal', pillar: 'personal', comingSoon: false },
  { key: 'cv-portfolio', label: 'CV / Portfolio', pillar: null, comingSoon: true },
];

export function categoryByPillar(pillar: PillarKey): StrategyCategory | undefined {
  return SEEDED_CATEGORIES.find((c) => c.pillar === pillar);
}
