/**
 * CORE 1 — Gate 2: Source Adapter Boundary Parsers
 *
 * Minimal runtime validators for JSONB columns that have no exported Zod
 * schema in the repository. Used ONLY at the fetchPlanningContextSources
 * boundary to prevent unsafe casts from raw DB rows into typed domain objects.
 *
 * Rules:
 *   - Do NOT duplicate existing repository schemas (programmeFitSchema,
 *     strategyRecommendationSchema, etc.) — reuse them.
 *   - Do NOT add logic beyond what is needed to reject clearly malformed rows.
 *   - These parsers must never be used outside the Gate 2 source adapter.
 */

import type { ImprovementAction, PillarKey } from '@/lib/match-insights';
import type { ProfileEvaluation } from '@/shared/evaluation/engine';

// ─── ImprovementAction parser ─────────────────────────────────────────────────

const PILLAR_KEYS: ReadonlySet<string> = new Set([
  'academic',
  'activities',
  'essays',
  'impact',
  'personal',
]);

const ACTION_TYPES: ReadonlySet<string> = new Set([
  'upload_document',
  'internal_route',
  'external_url',
  'book_mentor',
  'none',
]);

/**
 * Runtime guard for one ImprovementAction item from the `improvement_actions`
 * JSONB column.
 *
 * Only checks required structural fields. Returns false on any structural
 * violation rather than throwing, so the caller can produce an `invalid`
 * diagnostic for the whole source rather than letting a cast silently succeed.
 */
function isImprovementAction(value: unknown): value is ImprovementAction {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.pillar === 'string' &&
    PILLAR_KEYS.has(row.pillar) &&
    typeof row.label === 'string' &&
    typeof row.detail === 'string' &&
    typeof row.estimatedUplift === 'number' &&
    typeof row.actionType === 'string' &&
    ACTION_TYPES.has(row.actionType) &&
    Array.isArray(row.submitChecklist) &&
    Array.isArray(row.tips) &&
    Array.isArray(row.suggestedQuestions)
  );
}

/**
 * Parse the raw `improvement_actions` JSONB column value into a typed
 * `ImprovementAction[]`.
 *
 * Returns `null` if the value is not an array or any element fails the guard,
 * signalling that the source row should be treated as `invalid`.
 */
export function parseImprovementActions(raw: unknown): ImprovementAction[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ImprovementAction[] = [];
  for (const item of raw) {
    if (!isImprovementAction(item)) return null;
    out.push(item as ImprovementAction);
  }
  return out;
}

// ─── ProfileEvaluation boundary guard ────────────────────────────────────────

/**
 * Structural guard for `ProfileEvaluation` read from the
 * `structured_evaluation` JSONB column.
 *
 * The Shared Evaluation Engine produces `ProfileEvaluation` deterministically
 * from `runProfileEvaluation()`, so every well-formed row has the same top-
 * level keys. This guard checks the minimal structural proof that the value is
 * a genuine `ProfileEvaluation` and not null / a legacy format / corrupted
 * JSONB.
 *
 * It does NOT re-run the full engine schema — that would duplicate the engine's
 * internal invariants and would be brittle across engine version upgrades.
 * The purpose is to prevent an unsafe JSONB cast, not to re-validate engine
 * correctness.
 */
export function isProfileEvaluation(value: unknown): value is ProfileEvaluation {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.subjectId === 'string' &&
    obj.vagueness !== undefined &&
    obj.reflection !== undefined &&
    obj.competencies !== undefined &&
    obj.evidence !== undefined &&
    obj.narrativeIdentity !== undefined &&
    obj.programmeFit !== undefined &&
    obj.confidence !== undefined &&
    typeof obj.generatedAt === 'string'
  );
}

// ─── PillarKey helper ─────────────────────────────────────────────────────────

/** Narrow an unknown string into a `PillarKey`, or return null. */
export function asPillarKey(value: unknown): PillarKey | null {
  if (typeof value === 'string' && PILLAR_KEYS.has(value)) return value as PillarKey;
  return null;
}
