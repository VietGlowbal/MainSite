import type { SupabaseClient } from '@supabase/supabase-js';
import { reconcileSeeds, recommendationsFromRoadmap, type ExistingRecommendation } from '../domain';
import { seedToRow } from './generate-recommendations';

export type GenerateRoadmapTasksResult = {
  ok: boolean;
  /** Set when `ok` is false — a specific, user-facing-safe reason. */
  error?: 'no_strategy_recommendation' | 'read_failed' | 'insert_failed' | 'update_failed' | 'archive_failed';
  inserted: number;
  updated: number;
  archived: number;
};

const ROADMAP_CATEGORY = 'strategy-roadmap';

/**
 * Turns the latest F7 Personalized Strategy report's Execution Roadmap into
 * `application_recommendations` rows — the "generate Planner tasks from this
 * strategy report" button on `strategy-recommendation-report.tsx`.
 *
 * Same reconcile-not-append shape as `generateRecommendations` (see its doc
 * comment), scoped to `category = 'strategy-roadmap'` so re-clicking this
 * button only ever touches the rows it itself produced — the F5-sourced
 * profile-improvement rows sitting in the same table are a different
 * generator's business.
 */
export async function generateRoadmapTasks(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<GenerateRoadmapTasksResult> {
  const { data: latestStrategy } = await supabase
    .from('application_strategy_recommendations')
    .select('roadmap')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestStrategy) {
    return { ok: false, error: 'no_strategy_recommendation', inserted: 0, updated: 0, archived: 0 };
  }

  const roadmap = latestStrategy.roadmap as {
    why: string;
    prioritize: string[];
    avoid: string[];
  };
  const seeds = recommendationsFromRoadmap(applicationId, roadmap);

  const { data: existingRows, error: readError } = await supabase
    .from('application_recommendations')
    .select('id, pillar, title, status')
    .eq('application_id', applicationId)
    .eq('category', ROADMAP_CATEGORY)
    .is('archived_at', null);

  if (readError) {
    console.error('[generateRoadmapTasks] read existing failed', readError);
    return { ok: false, error: 'read_failed', inserted: 0, updated: 0, archived: 0 };
  }

  const existing: ExistingRecommendation[] = (existingRows ?? []).map((r) => ({
    id: r.id as string,
    pillar: r.pillar as ExistingRecommendation['pillar'],
    title: r.title as string,
    status: r.status as ExistingRecommendation['status'],
  }));

  const plan = reconcileSeeds(existing, seeds);

  if (plan.toInsert.length > 0) {
    const { error } = await supabase
      .from('application_recommendations')
      .insert(plan.toInsert.map((seed) => seedToRow(seed, 'next_action')));
    if (error) {
      console.error('[generateRoadmapTasks] insert failed', error);
      return { ok: false, error: 'insert_failed', inserted: 0, updated: 0, archived: 0 };
    }
  }

  for (const update of plan.toUpdate) {
    const row = seedToRow({ applicationId, ...update.fields }, 'next_action');
    const { error } = await supabase
      .from('application_recommendations')
      .update(row)
      .eq('id', update.id);
    if (error) {
      console.error('[generateRoadmapTasks] update failed', error, update.id);
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
      console.error('[generateRoadmapTasks] archive failed', error);
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
