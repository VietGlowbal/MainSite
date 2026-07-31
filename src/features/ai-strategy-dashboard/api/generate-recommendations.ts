import type { SupabaseClient } from '@supabase/supabase-js';
import { recommendationFromImprovementAction } from '../domain';
import type { ImprovementAction } from '@/lib/match-insights';

/**
 * Turns the latest Course Match Analysis's `improvement_actions` into
 * `application_recommendations` rows (requirements.md Requirement 10) — no
 * new AI call, see `recommendationFromImprovementAction`'s doc comment.
 *
 * Idempotent by title: skips an action whose recommendation already exists
 * for this application, so calling this on every Dashboard visit is safe.
 * Shared between `POST /api/applications/[id]/strategy/recommendations`
 * (explicit "regenerate") and the Dashboard page (generate-on-first-visit)
 * so the two don't drift.
 */
export async function generateRecommendations(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<{ generated: boolean; error?: string }> {
  const { data: latestMatch } = await supabase
    .from('application_match_analyses')
    .select('improvement_actions')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestMatch) return { generated: false, error: 'no_match_analysis' };

  const actions = (latestMatch.improvement_actions ?? []) as ImprovementAction[];
  if (actions.length === 0) return { generated: false };

  const { data: existing } = await supabase
    .from('application_recommendations')
    .select('title')
    .eq('application_id', applicationId)
    .not('category', 'is', null);
  const existingTitles = new Set((existing ?? []).map((r) => r.title as string));

  const rows = actions
    .filter((action) => !existingTitles.has(action.label))
    .map((action) => {
      const rec = recommendationFromImprovementAction(applicationId, action);
      return {
        application_id: rec.applicationId,
        recommendation_type: 'profile_improvement',
        category: rec.category,
        title: rec.title,
        body: rec.reason,
        priority: rec.priority,
        action_label: rec.actionLabel,
        action_type: rec.actionType,
        action_target: rec.actionTarget,
        status: 'not_started',
        estimated_effort: rec.estimatedEffort,
        deadline: rec.deadline,
        evidence_required: rec.evidenceRequired,
        related_requirement: rec.relatedRequirement,
      };
    });

  if (rows.length === 0) return { generated: false };

  const { error } = await supabase.from('application_recommendations').insert(rows);
  if (error) {
    console.error('[generateRecommendations] insert failed', error);
    return { generated: false, error: 'insert_failed' };
  }

  return { generated: true };
}
