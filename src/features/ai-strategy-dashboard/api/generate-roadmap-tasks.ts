import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recommendationsFromRoadmap,
  recommendationsFromStrategyReportV3,
  recommendationsFromStrategyReportV2,
  reconcileSeeds,
  strategyRecommendationFromRow,
  strategyReportV2FromRow,
  strategyReportV3FromRow,
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

function isSchemaGap(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && ['42P01', 'PGRST204', 'PGRST205'].includes(error.code ?? ''));
}

function seedToUpdateRow(seed: Parameters<typeof seedToRow>[0]) {
  const row: Record<string, unknown> = { ...seedToRow(seed, 'next_action') };
  delete row.status;
  delete row.deadline;
  return row;
}

/**
 * Turns the latest Strategy Report's Execution Roadmap into
 * `application_recommendations` rows — the "generate Planner tasks from this
 * strategy report" button.
 *
 * Source precedence, latest-valid-wins:
 * - Strategy V3's four-section `report_v2`: one seed per roadmap DELIVERABLE,
 *   keyed by the deterministic `source_key` so regenerations update in place.
 * - historical F8 `report_v2`, using its existing adapter.
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
  const strategyQuery = supabase
    .from('application_strategy_recommendations')
    .select(
      'id,application_id,source_analysis_id,source_match_analysis_id,' +
      'direction_options,chosen_direction,chosen_direction_why,narrative,' +
      'positioning_before,positioning_after,positioning_rationale,' +
      'portfolio_evaluations,differentiation_insight,differentiation_proposal,' +
      'roadmap,report_v2,input_hash,model_name,prompt_version,created_at,pdf_storage_path',
    )
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(20);
  const strategyResult = await strategyQuery;
  const legacyColumnFallback = Boolean(strategyResult.error && isSchemaGap(strategyResult.error));
  const strategyRows = legacyColumnFallback
    ? (await supabase
        .from('application_strategy_recommendations')
        .select('roadmap')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(20)).data
    : strategyResult.data;

  const rows = (Array.isArray(strategyRows) ? strategyRows : strategyRows ? [strategyRows] : []) as Array<Record<string, unknown>>;
  const reportV3 = rows.map(strategyReportV3FromRow).find(Boolean) ?? null;
  const reportV2 = rows.map(strategyReportV2FromRow).find(Boolean) ?? null;
  const legacyRoadmap = rows
    .map((row) => strategyRecommendationFromRow(row)?.roadmap ?? null)
    .find(Boolean)
    // Before the report_v2 migration, the fallback query only returns the
    // legacy roadmap column, so retain that compatibility path.
    ?? (legacyColumnFallback ? rows.find((row) => row.roadmap)?.roadmap : null)
    ?? null;

  // The report_v2 column ships in supabase-strategy-report-v2.sql; before it
  // runs, the combined select would fail outright — fall back to the legacy
  // column only.
  if (!reportV3 && !reportV2 && !legacyRoadmap) {
    return { ok: false, error: 'no_strategy_recommendation', inserted: 0, updated: 0, archived: 0 };
  }

  const seeds = reportV3
    ? recommendationsFromStrategyReportV3(applicationId, reportV3)
    : reportV2
      ? recommendationsFromStrategyReportV2(applicationId, reportV2)
      : recommendationsFromRoadmap(applicationId, legacyRoadmap as { why: string; prioritize: string[]; avoid: string[] });

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
    const row = seedToUpdateRow({ applicationId, ...update.fields });
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
