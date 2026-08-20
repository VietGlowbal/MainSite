import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compileAssessments,
  compilePlanningContext,
  type AssessmentResult,
  type PlanningContext,
} from '../domain';
import { fetchPlanningContextSources } from './fetch-planning-context-sources';

/**
 * Core 1 runtime seam for an authorized application. Fetching remains at the
 * API boundary; both compilers remain pure domain functions.
 */
export async function getApplicationAssessments(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<{ context: PlanningContext; assessments: AssessmentResult[] }> {
  const sources = await fetchPlanningContextSources(supabase, applicationId, userId);
  const context = compilePlanningContext(sources);
  return { context, assessments: compileAssessments(context) };
}
