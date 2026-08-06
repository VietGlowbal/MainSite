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
  /** The Course Match Analysis run that produced (or last refreshed) this row. */
  sourceAnalysisId: string | null;
  /** Set once this row's underlying action no longer appears in the latest analysis. Active lists filter this out; nothing is ever hard-deleted. */
  archivedAt: string | null;
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

/**
 * The raw `{ completed, total }` pair behind `completionPercent` — the hero's
 * "N of M tasks completed" and each category card's "X / Y tasks completed"
 * need the counts themselves, not just the rounded percentage.
 */
export function taskCounts(recommendations: readonly Recommendation[]): {
  completed: number;
  total: number;
} {
  return {
    completed: recommendations.filter((r) => r.status === 'completed').length,
    total: recommendations.length,
  };
}

export const recommendationStatusPatchSchema = z.object({
  status: z.enum(PROGRESS_STATUS),
});

export type RecommendationStatusPatch = z.infer<typeof recommendationStatusPatchSchema>;

/**
 * What `PATCH .../recommendations/[recId]` accepts.
 *
 * Both fields optional, at least one required — the board sends a status, the
 * calendar sends a deadline, and neither should have to echo the other back
 * and risk clobbering a change made in the other view a moment earlier.
 *
 * `deadline` is nullable because unscheduling is a real action: dragging a
 * task off the calendar and back into the tray sends `null`. A plain
 * `.optional()` could not express that — omitted would mean "leave it alone"
 * and there would be no way to say "clear it".
 *
 * The date is validated as a bare `YYYY-MM-DD` rather than a datetime,
 * because the column is a Postgres DATE. Accepting an ISO timestamp here
 * would silently truncate in the database and hand back a different value
 * than the one that was sent.
 */
export const recommendationPatchSchema = z
  .object({
    status: z.enum(PROGRESS_STATUS).optional(),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
      .nullable()
      .optional(),
  })
  .refine((patch) => patch.status !== undefined || patch.deadline !== undefined, {
    message: 'Provide a status, a deadline, or both',
  });

export type RecommendationPatch = z.infer<typeof recommendationPatchSchema>;

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
    sourceAnalysisId: (row.source_analysis_id as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
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
export type RecommendationSeed = Pick<
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
  | 'sourceAnalysisId'
>;

export function recommendationFromImprovementAction(
  applicationId: string,
  action: ImprovementAction,
  sourceAnalysisId: string,
): RecommendationSeed {
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
    sourceAnalysisId,
  };
}

/** The slice of an existing DB row `reconcileRecommendations` needs to match against. */
export type ExistingRecommendation = {
  id: string;
  pillar: PillarKey | null;
  title: string;
  status: ProgressStatus;
};

export type RecommendationUpdate = {
  id: string;
  fields: Omit<RecommendationSeed, 'applicationId'>;
};

export type ReconcilePlan = {
  toInsert: RecommendationSeed[];
  toUpdate: RecommendationUpdate[];
  toArchiveIds: string[];
};

/**
 * Matches the latest analysis's actions against a Strategy's existing
 * recommendations and decides what to insert, update, or retire — the
 * regeneration logic Requirement 10 needs and the original title-only dedup
 * in `generateRecommendations` didn't have.
 *
 * MATCH KEY IS (pillar, title), NOT id. Nothing about an `ImprovementAction`
 * is stable across two separate AI calls — a "new" action for the same
 * underlying weakness is, from the caller's side, indistinguishable from a
 * genuinely new one except by what it says. Pillar narrows the match to the
 * right category before comparing titles, which is enough in practice
 * because the model is prompted for one action per weakness per pillar, not
 * a free-form list that could restate the same idea two different ways.
 *
 * A completed recommendation that's still represented in the new analysis
 * is left completely untouched — no field on it changes, matching
 * "preserve user progress" and "don't silently recreate completed work".
 * One that's NO LONGER represented is archived (not deleted) regardless of
 * status, because it is no longer what the AI is currently recommending;
 * archiving keeps the record rather than erasing it.
 */
export function reconcileRecommendations(
  applicationId: string,
  existing: readonly ExistingRecommendation[],
  actions: readonly ImprovementAction[],
  sourceAnalysisId: string,
): ReconcilePlan {
  const key = (pillar: PillarKey | null, title: string) => `${pillar ?? ''}::${title}`;

  const existingByKey = new Map<string, ExistingRecommendation>();
  for (const rec of existing) existingByKey.set(key(rec.pillar, rec.title), rec);

  const matchedIds = new Set<string>();
  const toInsert: RecommendationSeed[] = [];
  const toUpdate: RecommendationUpdate[] = [];

  for (const action of actions) {
    const match = existingByKey.get(key(action.pillar, action.label));
    const seed = recommendationFromImprovementAction(applicationId, action, sourceAnalysisId);

    if (!match) {
      toInsert.push(seed);
      continue;
    }

    matchedIds.add(match.id);
    if (match.status === 'completed') continue; // preserve, untouched

    toUpdate.push({
      id: match.id,
      fields: {
        category: seed.category,
        pillar: seed.pillar,
        title: seed.title,
        reason: seed.reason,
        priority: seed.priority,
        estimatedImpact: seed.estimatedImpact,
        estimatedEffort: seed.estimatedEffort,
        deadline: seed.deadline,
        evidenceRequired: seed.evidenceRequired,
        relatedRequirement: seed.relatedRequirement,
        actionLabel: seed.actionLabel,
        actionType: seed.actionType,
        actionTarget: seed.actionTarget,
        sourceAnalysisId: seed.sourceAnalysisId,
      },
    });
  }

  const toArchiveIds = existing.filter((rec) => !matchedIds.has(rec.id)).map((rec) => rec.id);

  return { toInsert, toUpdate, toArchiveIds };
}
