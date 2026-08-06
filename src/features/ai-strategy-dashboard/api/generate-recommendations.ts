import type { SupabaseClient } from '@supabase/supabase-js';
import { reconcileRecommendations, type ExistingRecommendation, type RecommendationSeed } from '../domain';
import type { ImprovementAction } from '@/lib/match-insights';

export type GenerateRecommendationsResult = {
  ok: boolean;
  /** Set when `ok` is false — a specific, user-facing-safe reason. */
  error?: 'no_match_analysis' | 'read_failed' | 'insert_failed' | 'update_failed' | 'archive_failed';
  inserted: number;
  updated: number;
  archived: number;
};

/**
 * Logs which manual migration is missing, instead of just "insert failed" —
 * matching the diagnosis pattern `docs/known-issues.md §1c` established for
 * this repo's migrate-by-hand-in-the-SQL-editor setup. Checked against two
 * real PostgREST/Postgres codes:
 *   - `PGRST204` "Could not find the '<col>' column" — a column from
 *     `supabase-strategy-recommendation-fields.sql` hasn't been added yet.
 *   - `42501` "new row violates row-level security policy" — the INSERT
 *     policy from `supabase-strategy-recommendations-insert-policy.sql`
 *     hasn't been added yet (this table shipped in `supabase-apply-v2.sql`
 *     with a SELECT and an UPDATE policy but no INSERT policy, so every
 *     first-time recommendation insert was rejected by RLS until that's run).
 */
function logMigrationHint(context: string, error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (error.code === 'PGRST204') {
    console.error(
      `[generateRecommendations] ${context}: looks like a missing column — run supabase-strategy-recommendation-fields.sql and/or supabase-strategy-recommendation-content-blocks.sql against the production database.`,
    );
  } else if (error.code === '42501') {
    console.error(
      `[generateRecommendations] ${context}: looks like a missing RLS policy — run supabase-strategy-recommendations-insert-policy.sql against the production database.`,
    );
  }
}

function seedToRow(seed: RecommendationSeed) {
  return {
    application_id: seed.applicationId,
    // Closest existing recommendation_type to "an AI-generated action
    // improving the student's profile" — the CHECK constraint on this
    // column is fixed (supabase-apply-v2.sql); `category` is what actually
    // distinguishes a Dashboard row from a course-workspace sidebar tip.
    recommendation_type: 'profile_improvement',
    category: seed.category,
    pillar: seed.pillar,
    title: seed.title,
    body: seed.reason,
    priority: seed.priority,
    estimated_impact: seed.estimatedImpact,
    action_label: seed.actionLabel,
    action_type: seed.actionType,
    action_target: seed.actionTarget,
    status: 'not_started',
    estimated_effort: seed.estimatedEffort,
    deadline: seed.deadline,
    evidence_required: seed.evidenceRequired,
    related_requirement: seed.relatedRequirement,
    content_schema: seed.contentSchema,
    submit_checklist: seed.submitChecklist,
    tips: seed.tips,
    suggested_questions: seed.suggestedQuestions,
    source_analysis_id: seed.sourceAnalysisId,
    archived_at: null,
  };
}

/**
 * Turns the latest Course Match Analysis's `improvement_actions` into
 * `application_recommendations` rows (requirements.md Requirement 10) — no
 * new AI call, see `recommendationFromImprovementAction`'s doc comment.
 *
 * RECONCILES, RATHER THAN JUST APPENDING. `domain/recommendation.ts#reconcileRecommendations`
 * matches the new analysis's actions against what already exists (by
 * pillar+title): a still-relevant, not-yet-completed recommendation gets its
 * content refreshed in place; a completed one is left untouched; one no
 * longer represented is archived, never deleted. This replaces the original
 * title-only "skip if it already exists" version, which could never update a
 * changed recommendation or retire a stale one.
 *
 * Shared between `POST /api/applications/[id]/strategy/recommendations`
 * (explicit "regenerate") and the Dashboard page (generate-on-first-visit)
 * so the two don't drift.
 */
export async function generateRecommendations(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<GenerateRecommendationsResult> {
  const { data: latestMatch } = await supabase
    .from('application_match_analyses')
    .select('id, improvement_actions')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestMatch) return { ok: false, error: 'no_match_analysis', inserted: 0, updated: 0, archived: 0 };

  const actions = (latestMatch.improvement_actions ?? []) as ImprovementAction[];

  const { data: existingRows, error: readError } = await supabase
    .from('application_recommendations')
    .select('id, pillar, title, status')
    .eq('application_id', applicationId)
    .not('category', 'is', null)
    .is('archived_at', null);

  if (readError) {
    console.error('[generateRecommendations] read existing failed', readError);
    logMigrationHint('read existing', readError);
    return { ok: false, error: 'read_failed', inserted: 0, updated: 0, archived: 0 };
  }

  const existing: ExistingRecommendation[] = (existingRows ?? []).map((r) => ({
    id: r.id as string,
    pillar: r.pillar as ExistingRecommendation['pillar'],
    title: r.title as string,
    status: r.status as ExistingRecommendation['status'],
  }));

  const plan = reconcileRecommendations(applicationId, existing, actions, latestMatch.id as string);

  if (plan.toInsert.length > 0) {
    const { error } = await supabase
      .from('application_recommendations')
      .insert(plan.toInsert.map(seedToRow));
    if (error) {
      console.error('[generateRecommendations] insert failed', error);
      logMigrationHint('insert', error);
      return { ok: false, error: 'insert_failed', inserted: 0, updated: 0, archived: 0 };
    }
  }

  for (const update of plan.toUpdate) {
    const row = seedToRow({ applicationId, ...update.fields });
    const { error } = await supabase
      .from('application_recommendations')
      .update(row)
      .eq('id', update.id);
    if (error) {
      console.error('[generateRecommendations] update failed', error, update.id);
      logMigrationHint('update', error);
      return {
        ok: false,
        error: 'update_failed',
        inserted: plan.toInsert.length,
        updated: 0,
        archived: 0,
      };
    }
  }

  if (plan.toArchiveIds.length > 0) {
    const { error } = await supabase
      .from('application_recommendations')
      .update({ archived_at: new Date().toISOString() })
      .in('id', plan.toArchiveIds);
    if (error) {
      console.error('[generateRecommendations] archive failed', error);
      return {
        ok: false,
        error: 'archive_failed',
        inserted: plan.toInsert.length,
        updated: plan.toUpdate.length,
        archived: 0,
      };
    }
  }

  return {
    ok: true,
    inserted: plan.toInsert.length,
    updated: plan.toUpdate.length,
    archived: plan.toArchiveIds.length,
  };
}
