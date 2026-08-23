import { z } from 'zod';
import {
  type ContentBlock,
  type ContentBlockValue,
  type ImprovementAction,
  type ImprovementActionType,
  type PillarKey,
} from '@/lib/match-insights';
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
  /** The detail page's genUI body — see `ContentBlock`'s doc comment in `@/lib/match-insights`. AI-authored, refreshed on regenerate. */
  contentSchema: ContentBlock | null;
  /** The student's saved answer, shaped to match `contentSchema`. Never touched by regenerate — see `reconcileRecommendations`. */
  contentValue: ContentBlockValue | null;
  submitChecklist: string[];
  tips: string[];
  suggestedQuestions: string[];
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

/** A structured-table row: arbitrary column keys, string cells (the table's own inputs are all text/number/date/select, and Postgres JSONB has no reason to prefer any of those over a string here). */
const contentTableRowSchema = z.record(z.string(), z.string());

/**
 * What `content_value` may hold — the student's saved answer to a
 * `content_schema` (`ContentBlock` in `@/lib/match-insights`). A discriminated
 * union mirroring the block it answers, so a `long_text` answer can never be
 * saved against a `checklist` schema by a client bug.
 */
/** Shared validation for student-owned content values across legacy and canonical tasks. */
export const contentValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('structured_table'), rows: z.array(contentTableRowSchema).max(50) }),
  z.object({ type: z.literal('long_text'), text: z.string().max(20_000) }),
  z.object({ type: z.literal('checklist'), checkedItems: z.array(z.string()).max(50) }),
  z.object({ type: z.literal('single_select'), value: z.string().min(1).max(500) }),
]);

/**
 * What `content_schema` may hold — mirrors `normalizeContentBlock` in
 * `src/lib/ai/match-insights.ts`, which guarantees a freshly-generated block
 * always has a non-empty `columns`/`items`. `parseContentBlock` below is what
 * enforces that guarantee still holds on the way back OUT of the database —
 * see its doc comment on why checking only `type` was not enough.
 */
const contentBlockColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select']),
  options: z.array(z.string()).optional(),
});

const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('structured_table'), columns: z.array(contentBlockColumnSchema).min(1) }),
  z.object({ type: z.literal('long_text'), prompt: z.string().min(1), minWords: z.number().optional() }),
  z.object({ type: z.literal('checklist'), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal('single_select'),
    prompt: z.string().min(1),
    options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).min(1).max(20),
    semanticKey: z.string().regex(/^[a-z][a-z0-9_.-]{1,100}$/),
  }),
]);

/** Validates a student value against the planning-owned schema before execution updates. */
export function isCompleteContentValue(schema: ContentBlock | null, value: ContentBlockValue | null): boolean {
  if (!schema || !value || schema.type !== value.type) return false;
  if (schema.type === 'single_select' && value.type === 'single_select') return schema.options.some((option) => option.value === value.value);
  if (schema.type === 'long_text' && value.type === 'long_text') {
    const words = value.text.trim() ? value.text.trim().split(/\s+/).length : 0;
    return words >= (schema.minWords ?? 1);
  }
  if (schema.type === 'checklist' && value.type === 'checklist') return schema.items.every((item) => value.checkedItems.includes(item));
  return value.type === 'structured_table' && value.rows.length > 0;
}

/**
 * What `PATCH .../recommendations/[recId]` accepts.
 *
 * All three fields optional, at least one required — the board sends a
 * status, the calendar sends a deadline, the detail page's content block
 * sends `contentValue`, and none of the three should have to echo the others
 * back and risk clobbering a change made elsewhere a moment earlier.
 *
 * `deadline` and `contentValue` are both nullable because clearing either is
 * a real action: dragging a task off the calendar sends `deadline: null`;
 * clearing a long-text answer back to empty sends `contentValue: null`
 * rather than an empty-string content value, so a re-generated
 * `contentSchema` isn't left validating a value that no longer answers it. A
 * plain `.optional()` could not express either — omitted means "leave it
 * alone", there'd be no way to say "clear it".
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
    contentValue: contentValueSchema.nullable().optional(),
  })
  .refine(
    (patch) =>
      patch.status !== undefined || patch.deadline !== undefined || patch.contentValue !== undefined,
    { message: 'Provide a status, a deadline, a content value, or a combination' },
  );

export type RecommendationPatch = z.infer<typeof recommendationPatchSchema>;

/** The unstarted, highest-priority recommendation — the Dashboard's "Next Priority" (9.1). */
export function nextPriority(recommendations: readonly Recommendation[]): Recommendation | null {
  const open = recommendations.filter((r) => r.status !== 'completed');
  return sortByPriority(open)[0] ?? null;
}

/**
 * Defensively reads a `content_schema` JSONB column back into its typed
 * shape, via `contentBlockSchema` (the same validation `content_value`
 * already got from `recommendationPatchSchema`).
 *
 * ⚠️ USED TO ONLY CHECK THE `type` DISCRIMINANT, not the rest of the shape —
 * a row whose `columns`/`items` were missing or empty (a row written before
 * `normalizeContentBlock`'s guarantees existed, or hand-edited in the SQL
 * editor) passed straight through as a real `ContentBlock`, and
 * `StructuredTableInput`/`ChecklistInput` then called `.map()` on the
 * missing array and crashed the whole detail page — reported live 12/08 as
 * "each of the planner tasks... don't load up". Full-shape validation is
 * what the doc comment always claimed to do; now it actually does it, and a
 * malformed row degrades to `null` (no content block, same as a task that
 * finishes elsewhere) instead of taking the page down.
 */
export function parseContentBlock(raw: unknown): ContentBlock | null {
  const parsed = contentBlockSchema.safeParse(raw);
  // zod's `.optional()` types the field as `T | undefined`, present-but-undefined
  // included; `ContentBlockColumn`/`ContentBlock`'s `exactOptionalPropertyTypes`
  // only allow the field to be absent. The cast is safe: `safeParse` already
  // guarantees the runtime shape, this only reconciles the two type styles.
  return parsed.success ? (parsed.data as ContentBlock) : null;
}

/** Same discipline as `parseContentBlock`, for the student-authored value column. */
export function parseContentBlockValue(raw: unknown): ContentBlockValue | null {
  const parsed = contentValueSchema.safeParse(raw);
  return parsed.success ? (parsed.data as ContentBlockValue) : null;
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
    contentSchema: parseContentBlock(row.content_schema),
    contentValue: parseContentBlockValue(row.content_value),
    submitChecklist: Array.isArray(row.submit_checklist) ? (row.submit_checklist as string[]) : [],
    tips: Array.isArray(row.tips) ? (row.tips as string[]) : [],
    suggestedQuestions: Array.isArray(row.suggested_questions)
      ? (row.suggested_questions as string[])
      : [],
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
    contentSchema: action.contentBlock,
    submitChecklist: action.submitChecklist,
    tips: action.tips,
    suggestedQuestions: action.suggestedQuestions,
    sourceAnalysisId,
  };
}

/** The slice of an existing DB row `reconcileRecommendations`/`reconcileSeeds` needs to match against. */
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
  | 'contentSchema'
  | 'submitChecklist'
  | 'tips'
  | 'suggestedQuestions'
  | 'sourceAnalysisId'
> & {
  /**
   * Deterministic semantic identity (e.g. `strategy-roadmap::{phase}::{key}`).
   * When present, reconciliation matches on it INSTEAD of (pillar, title) —
   * a regenerated report that rewords a task updates the same row rather
   * than duplicating it.
   */
  sourceKey?: string;
};

/** The slice of an existing DB row `reconcileRecommendations`/`reconcileSeeds` needs to match against. */
export type ExistingRecommendation = {
  id: string;
  pillar: PillarKey | null;
  title: string;
  status: ProgressStatus;
  /** Deterministic identity written by newer generators; null on legacy rows. */
  sourceKey?: string | null;
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

function updateFields(seed: RecommendationSeed): Omit<RecommendationSeed, 'applicationId'> {
  return {
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
    // Refreshes with the rest of the AI-authored fields. `contentValue`
    // is deliberately absent here, same as `status` below — it's the
    // student's own answer, not something a regenerate may overwrite.
    // If a new `contentSchema`'s shape has moved on from what the
    // student already filled in, the content-block components render
    // whatever still matches and drop the rest; see `parseContentBlockValue`.
    contentSchema: seed.contentSchema,
    submitChecklist: seed.submitChecklist,
    tips: seed.tips,
    suggestedQuestions: seed.suggestedQuestions,
    sourceAnalysisId: seed.sourceAnalysisId,
  };
}

/**
 * Matches a fresh batch of seeds against a Strategy's existing recommendations
 * and decides what to insert, update, or retire — the regeneration logic
 * Requirement 10 needs and the original title-only dedup in
 * `generateRecommendations` didn't have. Shared by every seed source
 * (`recommendationFromImprovementAction`'s F5 actions, `recommendationsFromRoadmap`'s
 * F7 roadmap) — reconciling is the same problem regardless of what produced
 * the seed.
 *
 * MATCH KEY IS (pillar, title), NOT id. Nothing about an AI-authored seed is
 * stable across two separate calls — a "new" item for the same underlying
 * idea is, from the caller's side, indistinguishable from a genuinely new one
 * except by what it says. Pillar narrows the match before comparing titles,
 * which is enough in practice because each source is prompted for one item
 * per distinct thing, not a free-form list that could restate the same idea
 * two different ways.
 *
 * A completed recommendation that's still represented in the new batch is
 * left completely untouched — no field on it changes, matching "preserve
 * user progress" and "don't silently recreate completed work". One that's NO
 * LONGER represented is archived (not deleted) regardless of status, because
 * it is no longer what the source is currently recommending; archiving keeps
 * the record rather than erasing it.
 *
 * Callers scope `existing` to their own source before calling this (e.g. by
 * category), so one source's regenerate never archives another's rows.
 */
export function reconcileSeeds(
  existing: readonly ExistingRecommendation[],
  seeds: readonly RecommendationSeed[],
): ReconcilePlan {
  const titleKey = (pillar: PillarKey | null, title: string) => `${pillar ?? ''}::${title}`;

  // Two match keys, in priority order:
  //   1. source_key — deterministic semantic identity from generators that
  //      provide one (F8 roadmap deliverables). Reworded regenerations still
  //      match their row.
  //   2. (pillar, title) — legacy fallback for rows written before
  //      source_key existed.
  const existingByKey = new Map<string, ExistingRecommendation>();
  for (const rec of existing) {
    if (rec.sourceKey) existingByKey.set(rec.sourceKey, rec);
    else existingByKey.set(titleKey(rec.pillar, rec.title), rec);
  }

  const keyFor = (seed: RecommendationSeed) =>
    seed.sourceKey ?? titleKey(seed.pillar ?? null, seed.title);

  const matchedIds = new Set<string>();
  const toInsert: RecommendationSeed[] = [];
  const toUpdate: RecommendationUpdate[] = [];

  for (const seed of seeds) {
    const match = existingByKey.get(keyFor(seed));

    if (!match) {
      toInsert.push(seed);
      continue;
    }

    matchedIds.add(match.id);
    if (match.status === 'completed') continue; // preserve, untouched

    toUpdate.push({ id: match.id, fields: updateFields(seed) });
  }

  const toArchiveIds = existing.filter((rec) => !matchedIds.has(rec.id)).map((rec) => rec.id);

  return { toInsert, toUpdate, toArchiveIds };
}

/** `reconcileSeeds`, specialised to F5 Course Match Analysis actions. */
export function reconcileRecommendations(
  applicationId: string,
  existing: readonly ExistingRecommendation[],
  actions: readonly ImprovementAction[],
  sourceAnalysisId: string,
): ReconcilePlan {
  const seeds = actions.map((action) =>
    recommendationFromImprovementAction(applicationId, action, sourceAnalysisId),
  );
  return reconcileSeeds(existing, seeds);
}

/**
 * F7's Execution Roadmap (`StrategyRoadmap.prioritize`/`.avoid`), turned into
 * Planner tasks — the "generate Planner tasks from this strategy report"
 * button on `strategy-recommendation-report.tsx`.
 *
 * NO SECOND AI CALL, same reasoning as `recommendationFromImprovementAction`:
 * the F7 model call already produced the roadmap; this is a deterministic
 * reshaping, not a new generation. `prioritize` items become the actionable
 * tasks (`priority: 'high'` — they're literally what the report says to do
 * first); `avoid` items become low-priority reminders, prefixed so a student
 * scanning the Planner can tell the two apart at a glance. Everything lives
 * under the `strategy-roadmap` category (`pillar: null` — a roadmap item
 * reasons across the whole strategy, not one pillar), which is what keeps
 * `reconcileSeeds` from touching the F5-sourced rows sitting in the same
 * table.
 */
export function recommendationsFromRoadmap(
  applicationId: string,
  roadmap: { why: string; prioritize: readonly string[]; avoid: readonly string[] },
): RecommendationSeed[] {
  const base = {
    applicationId,
    category: 'strategy-roadmap',
    pillar: null as PillarKey | null,
    estimatedImpact: null,
    estimatedEffort: null,
    deadline: null,
    evidenceRequired: false,
    relatedRequirement: null,
    actionLabel: null,
    actionType: null,
    actionTarget: null,
    contentSchema: null,
    submitChecklist: [] as string[],
    tips: [] as string[],
    suggestedQuestions: [] as string[],
    sourceAnalysisId: null,
  };

  return [
    ...roadmap.prioritize.map(
      (item): RecommendationSeed => ({
        ...base,
        title: item,
        reason: roadmap.why,
        priority: 'high',
      }),
    ),
    ...roadmap.avoid.map(
      (item): RecommendationSeed => ({
        ...base,
        title: `Avoid: ${item}`,
        reason: roadmap.why,
        priority: 'low',
      }),
    ),
  ];
}

/**
 * ─── F8 STRATEGY REPORT (v2 payload) ─────────────────────────────────────────
 *
 * The five canonical sections from `docs/strategy-reports-spec.md`, generated
 * by prompt `strategy-report-f8-v3` and persisted in
 * `application_strategy_recommendations.report_v2`.
 *
 * Contract notes:
 * - Stable keys (`priority.key`, `theme.key`, `phase.phaseKey`,
 *   `deliverable.key`) are REQUIRED and must be deterministic slugs — student
 *   overrides and Planner reconciliation key on them, never on array index or
 *   prose.
 * - The model authors NO scores, NO classification and NO admission
 *   probability anywhere in this payload; those are deterministic outputs of
 *   the Personal Report / Matching Report inputs.
 */
export const strategyPriorityLevelSchema = z.enum(['critical', 'high', 'medium']);

export const strategyReportV2Schema = z.object({
  strategicOverview: z.object({
    currentPosition: z.object({
      profile: z.string().min(1).max(1200),
      keyStrength: z.string().min(1).max(600),
      biggestChallenge: z.string().min(1).max(600),
    }),
    strategicGoal: z.object({
      primaryObjective: z.string().min(1).max(600),
      positioning: z.string().min(1).max(600),
    }),
    topPriorities: z.array(z.string().min(1).max(200)).min(1).max(3),
    expectedOutcome: z.string().min(1).max(800),
  }),
  priorityTable: z
    .array(
      z.object({
        /** Deterministic slug — overrides + Planner seeds key on this. */
        key: z.string().regex(/^[a-z][a-z0-9_-]{2,60}$/),
        title: z.string().min(1).max(200),
        currentSituation: z.string().min(1).max(800),
        whyItMatters: z.string().min(1).max(600),
        recommendedActions: z.array(z.string().min(1).max(300)).min(1).max(5),
        expectedImpact: z.string().min(1).max(400),
        level: strategyPriorityLevelSchema,
      }),
    )
    .min(2)
    .max(6),
  profileDevelopmentStrategy: z.object({
    academic: z.object({
      currentStatus: z.string().min(1).max(600),
      gap: z.string().min(1).max(600),
      strategicFocus: z.string().min(1).max(600),
      expectedOutcome: z.string().min(1).max(400),
    }),
    experience: z.object({
      currentStatus: z.string().min(1).max(600),
      gap: z.string().min(1).max(600),
      strategicFocus: z.string().min(1).max(600),
      expectedOutcome: z.string().min(1).max(400),
    }),
    differentiation: z.object({
      currentAdvantage: z.string().min(1).max(600),
      uniqueness: z.string().min(1).max(600),
      amplifyHow: z.string().min(1).max(600),
      desiredPerception: z.string().min(1).max(400),
    }),
  }),
  narrativeStrategy: z.object({
    coreNarrative: z.object({
      centralStory: z.string().min(1).max(1200),
      supportingEvidence: z.array(z.string().min(1).max(300)).max(6),
      admissionsValue: z.string().min(1).max(600),
    }),
    themes: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z][a-z0-9_-]{2,60}$/),
          title: z.string().min(1).max(150),
          rationale: z.string().min(1).max(500),
          evidence: z.array(z.string().min(1).max(300)).max(5),
        }),
      )
      .min(1)
      .max(5),
    consistencyCheck: z.object({
      supports: z.string().min(1).max(600),
      feelsDisconnected: z.string().min(1).max(600),
      emphasise: z.string().min(1).max(500),
      supportingRole: z.string().min(1).max(500),
    }),
  }),
  executionRoadmap: z
    .object({
      phases: z
        .array(
          z.object({
            phaseKey: z.string().regex(/^[a-z][a-z0-9_-]{2,40}$/),
            name: z.string().min(1).max(150),
            objective: z.string().min(1).max(600),
            keyActions: z.array(z.string().min(1).max(300)).max(6),
            deliverables: z
              .array(
                z.object({
                  key: z.string().regex(/^[a-z][a-z0-9_-]{2,60}$/),
                  label: z.string().min(1).max(250),
                  /** Existing tool this maps to; absent → plain task. */
                  tool: z.enum(['personal_canvas', 'cv_builder', 'statement_writer']).optional(),
                }),
              )
              .max(8),
            successCriteria: z.array(z.string().min(1).max(300)).max(5),
            timeline: z.string().min(1).max(150),
          }),
        )
        .min(1)
        .max(6),
    }),
});

export type StrategyReportV2 = z.infer<typeof strategyReportV2Schema>;
export type StrategyPriorityLevel = z.infer<typeof strategyPriorityLevelSchema>;

/**
 * F8's Execution Roadmap turned into Planner task seeds.
 *
 * ONE TASK PER DELIVERABLE, deliberately. Deliverables are the only roadmap
 * items the F8 schema gives stable keys (`phaseKey`/`key` slugs), which is
 * what lossless reconciliation requires; keyActions stay in the report as
 * phase guidance rather than becoming untracked prose-keyed tasks that would
 * duplicate on every regeneration. `tool` flows through to action_type/target
 * where a canonical route exists (personal_canvas / cv / statement-feedback).
 */
export function recommendationsFromStrategyReportV2(
  applicationId: string,
  report: Pick<StrategyReportV2, 'executionRoadmap' | 'strategicOverview'>,
): RecommendationSeed[] {
  const seeds: RecommendationSeed[] = [];

  for (const phase of report.executionRoadmap.phases) {
    for (const deliverable of phase.deliverables) {
      const sourceKey = `strategy-roadmap::${phase.phaseKey}::${deliverable.key}`;
      seeds.push({
        applicationId,
        category: 'strategy-roadmap',
        pillar: null,
        sourceKey,
        title: deliverable.label,
        reason: `${phase.name}: ${phase.objective}`,
        priority: phase.phaseKey === 'finalise_optimise' ? 'high' : 'medium',
        estimatedImpact: null,
        estimatedEffort: null,
        deadline: null,
        evidenceRequired: false,
        relatedRequirement: null,
        actionLabel: deliverable.tool ? 'Open tool' : null,
        actionType:
          deliverable.tool === 'cv_builder'
            ? 'internal_route'
            : deliverable.tool === 'statement_writer'
              ? 'internal_route'
              : deliverable.tool === 'personal_canvas'
                ? 'internal_route'
                : 'none',
        actionTarget:
          deliverable.tool === 'cv_builder'
            ? `/apply/${applicationId}/cv`
            : deliverable.tool === 'statement_writer'
              ? `/apply/${applicationId}/statement-feedback`
              : deliverable.tool === 'personal_canvas'
                ? '/ai-strategy/personal-report'
                : null,
        contentSchema: null,
        submitChecklist: phase.successCriteria.slice(0, 4),
        tips: [],
        suggestedQuestions: [],
        sourceAnalysisId: null,
      });
    }
  }

  return seeds;
}
