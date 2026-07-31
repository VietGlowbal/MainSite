import { z } from 'zod';
import type { ImprovementActionType, PillarKey } from '@/lib/match-insights';

/**
 * Recommendation — one row of `application_recommendations`, extended.
 *
 * THIS IS A VIEW OVER AN EXISTING TABLE, NOT A NEW STORE. The table already
 * carried `priority`, `action_label/type/target`, `confidence` and
 * `is_dismissed` for the course-workspace "sidebar tips" feature
 * (`src/lib/api/application-workspace.ts`). The AI Strategy Dashboard's
 * recommendation table is a second, richer view over the same rows —
 * `status`, `estimated_effort`, `deadline`, `evidence_required`, `category`
 * and `related_requirement` are the columns this feature's migration adds.
 * A recommendation row from either producer renders correctly in both UIs;
 * they just show different columns.
 */

export const PROGRESS_STATUS = [
  'not_started',
  'in_progress',
  'completed',
  'needs_review',
  'blocked',
] as const;

export type ProgressStatus = (typeof PROGRESS_STATUS)[number];

export const PROGRESS_STATUS_LABEL: Record<ProgressStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  needs_review: 'Needs review',
  blocked: 'Blocked',
};

export const RECOMMENDATION_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export type Recommendation = {
  id: string;
  applicationId: string;
  category: string | null;
  pillar: PillarKey | null;
  title: string;
  reason: string | null;
  priority: RecommendationPriority;
  status: ProgressStatus;
  estimatedImpact: number | null;
  estimatedEffort: string | null;
  deadline: string | null;
  evidenceRequired: boolean;
  relatedRequirement: string | null;
  actionLabel: string | null;
  actionType: ImprovementActionType | null;
  actionTarget: string | null;
  confidence: number;
  isDismissed: boolean;
  createdAt: string;
  updatedAt: string;
};

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Highest priority first; ties broken by earliest deadline, undated last. */
export function sortByPriority(recommendations: readonly Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
}

/** Groups by `category`, each group's rows sorted by priority. Uncategorised rows group under `null`. */
export function groupByCategory(
  recommendations: readonly Recommendation[],
): Map<string | null, Recommendation[]> {
  const groups = new Map<string | null, Recommendation[]>();
  for (const rec of recommendations) {
    const key = rec.category;
    const existing = groups.get(key);
    if (existing) {
      existing.push(rec);
    } else {
      groups.set(key, [rec]);
    }
  }
  for (const [key, group] of groups) {
    groups.set(key, sortByPriority(group));
  }
  return groups;
}

/** Overall Progress / Completion % for the Dashboard top summary (requirements.md 9.1, 13.2). */
export function completionPercent(recommendations: readonly Recommendation[]): number {
  if (recommendations.length === 0) return 0;
  const completed = recommendations.filter((r) => r.status === 'completed').length;
  return Math.round((completed / recommendations.length) * 100);
}

export const recommendationStatusPatchSchema = z.object({
  status: z.enum(PROGRESS_STATUS),
});

export type RecommendationStatusPatch = z.infer<typeof recommendationStatusPatchSchema>;
