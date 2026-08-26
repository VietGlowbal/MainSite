import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recommendationsFromRoadmap,
  recommendationsFromStrategyReportV2,
  reconcileSeeds,
  strategyReportV2FromRow,
  type ExistingRecommendation,
} from '../domain';
import { seedToRow } from './generate-recommendations';

export type GenerateRoadmapTasksResult = {
  ok: boolean;
  /** Set when `ok` is false — a specific, user-facing-safe reason. */
  error?:
    | 'no_strategy_recommendation'
    | 'read_failed'
    | 'insert_failed'
    | 'update_failed'
    | 'archive_failed';
  inserted: number;
  updated: number;
  archived: number;
};

const ROADMAP_CATEGORY = 'strategy-roadmap';

/**
 * Turns the latest Strategy Report's Execution Roadmap into
 * `application_recommendations` rows — the "generate Planner tasks from this
 * strategy report" button.
 *
 * Two source shapes, latest-wins:
 * - `report_v2` (F8 five-section payload): one seed per roadmap DELIVERABLE,
 *   keyed by the deterministic `source_key` so regenerations update in place
 *   (`recommendationsFromStrategyReportV2`).
 * - legacy F7 `roadmap` column (prioritize/avoid prose): reconciled on
 *   (pillar, title) exactly as before — rows written by this path keep
 *   working unchanged.
 *
 * Same reconcile-not-append shape as `generateRecommendations` (see its doc
 * comment), scoped to `category = 'strategy-roadmap'` so re-clicking this
 * button only ever touches the rows it itself produced.
 */
export async function generateRoadmapTasks(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<GenerateRoadmapTasksResult> {
  const { data: latestStrategy } = await supabase
    .from('application_strategy_recommendations')
    .select('roadmap,report_v2')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // The report_v2 column ships in supabase-strategy-report-v2.sql; before it
  // runs, the combined select would fail outright — fall back to the legacy
  // column only.
  let roadmapJson = (latestStrategy?.roadmap ?? null) as {
    why: string;
    prioritize: string[];
    avoid: string[];
  } | null;
  let reportV2 = latestStrategy ? strategyReportV2FromRow(latestStrategy) : null;

  if (latestStrategy && !reportV2 && roadmapJson === null) {
    const retry = await supabase
      .from('application_strategy_recommendations')
      .select('roadmap')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    roadmapJson = (retry.data?.roadmap ?? null) as typeof roadmapJson;
    reportV2 = null;
  }

  if (!reportV2 && !roadmapJson) {
    return { ok: false, error: 'no_strategy_recommendation', inserted: 0, updated: 0, archived: 0 };
  }

  const seeds = reportV2
    ? recommendationsFromStrategyReportV2(applicationId, reportV2)
    : recommendationsFromRoadmap(applicationId, roadmapJson!);

  const existingSelect = supabase
    .from('application_recommendations')
    .select('id,pillar,title,status,source_key')
    .eq('application_id', applicationId)
    .eq('category', ROADMAP_CATEGORY)
    .is('archived_at', null);

  const { data: existingRows, error: readError } = await existingSelect;
  if (readError) {
    console.error('[generateRoadmapTasks] read existing failed', readError);
    return { ok: false, error: 'read_failed', inserted: 0, updated: 0, archived: 0 };
  }

  const existing: ExistingRecommendation[] = (existingRows ?? []).map((r) => ({
    id: r.id as string,
    pillar: r.pillar as ExistingRecommendation['pillar'],
    title: r.title as string,
    status: r.status as ExistingRecommendation['status'],
    sourceKey: (r.source_key as string | null) ?? null,
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
