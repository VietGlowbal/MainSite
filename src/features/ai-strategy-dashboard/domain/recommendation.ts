import { z } from 'zod';
import type { ImprovementAction, ImprovementActionType, PillarKey } from '@/lib/match-insights';
import { categoryByPillar } from './strategy-category';

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

/** The unstarted, highest-priority recommendation — the Dashboard's "Next Priority" (9.1). */
export function nextPriority(recommendations: readonly Recommendation[]): Recommendation | null {
  const open = recommendations.filter((r) => r.status !== 'completed');
  return sortByPriority(open)[0] ?? null;
}

/** The `application_recommendations` API/DB row shape (snake_case) → `Recommendation`. */
export function recommendationFromRow(row: Record<string, unknown>): Recommendation {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    category: (row.category as string | null) ?? null,
    pillar: (row.pillar as PillarKey | null) ?? null,
    title: row.title as string,
    reason: (row.body as string | null) ?? null,
    priority: (row.priority as RecommendationPriority) ?? 'medium',
    status: (row.status as ProgressStatus) ?? 'not_started',
    estimatedImpact: (row.estimated_impact as number | null) ?? null,
    estimatedEffort: (row.estimated_effort as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    evidenceRequired: Boolean(row.evidence_required),
    relatedRequirement: (row.related_requirement as string | null) ?? null,
    actionLabel: (row.action_label as string | null) ?? null,
    actionType: (row.action_type as ImprovementActionType | null) ?? null,
    actionTarget: (row.action_target as string | null) ?? null,
    confidence: (row.confidence as number) ?? 0,
    isDismissed: Boolean(row.is_dismissed),
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/**
 * A new recommendation, built from one AI-generated improvement action — the
 * row shape `POST /api/applications/[id]/strategy/recommendations` inserts.
 *
 * NO SECOND AI CALL. `match-insights`' pillar scoring already asked the model
 * for course-specific, evidence-based actions (`ImprovementAction`); this is
 * a deterministic reshaping of that output into the Dashboard's row shape,
 * the same "extend, don't replace" call `course-match.ts` makes for the
 * report. `estimatedEffort`, `deadline` and `relatedRequirement` have no
 * source yet, so they're left null rather than guessed.
 */
export function recommendationFromImprovementAction(
  applicationId: string,
  action: ImprovementAction,
): Pick<
  Recommendation,
  | 'applicationId'
  | 'category'
  | 'pillar'
  | 'title'
  | 'reason'
  | 'priority'
  | 'estimatedImpact'
  | 'estimatedEffort'
  | 'deadline'
  | 'evidenceRequired'
  | 'relatedRequirement'
  | 'actionLabel'
  | 'actionType'
  | 'actionTarget'
> {
  // Bucketed from the model's own estimatedUplift (0-40, see match-insights'
  // prompt) rather than re-deriving urgency from scratch — the pillar call
  // already reasoned about how much each action would help.
  const priority: RecommendationPriority =
    action.estimatedUplift >= 20 ? 'high' : action.estimatedUplift >= 10 ? 'medium' : 'low';

  return {
    applicationId,
    category: categoryByPillar(action.pillar)?.key ?? null,
    pillar: action.pillar,
    title: action.label,
    reason: action.detail || null,
    priority,
    estimatedImpact: action.estimatedUplift,
    estimatedEffort: null,
    deadline: null,
    evidenceRequired: action.actionType === 'upload_document',
    relatedRequirement: null,
    actionLabel: action.label,
    actionType: action.actionType,
    actionTarget: action.actionTarget ?? null,
  };
}
