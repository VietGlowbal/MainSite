import type { SupabaseClient } from '@supabase/supabase-js';
import { compileDecisions, compilePlan } from '../domain';
import { generatePlanEnrichment } from './generate-plan-enrichment';
import { getApplicationAssessments } from './get-application-assessments';

/** Production orchestration: deterministic scaffold first, optional AI second. */
export async function getEnrichedApplicationPlan(supabase: SupabaseClient, applicationId: string, userId: string) {
  const { assessments, context } = await getApplicationAssessments(supabase, applicationId, userId);
  const decisions = compileDecisions(assessments, context.plannerInputs);
  const deterministic = compilePlan(decisions);
  // Persist this Core 1 snapshot fingerprint in the plan id. It lets the page
  // cheaply decide whether source facts changed without ever calling an LLM.
  const scaffold = {
    ...deterministic,
    id: `${deterministic.id}:source:${context.provenance.contextHash}`,
  };
  return generatePlanEnrichment({ scaffold, decisions, assessments, context });
}
