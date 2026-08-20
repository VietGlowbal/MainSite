import type { SupabaseClient } from '@supabase/supabase-js';
import { compileDecisions, type DecisionResult } from '../domain';
import { getApplicationAssessments } from './get-application-assessments';

/**
 * Core 2 runtime seam for an authorized application. Core 1 owns source
 * fetching and assessment compilation; Decide only consumes those findings.
 */
export async function getApplicationDecisions(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<DecisionResult[]> {
  const { assessments, context } = await getApplicationAssessments(supabase, applicationId, userId);
  return compileDecisions(assessments, context.plannerInputs);
}
