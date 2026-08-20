import type { SupabaseClient } from '@supabase/supabase-js';
import { compilePlan, type PlanResult } from '../domain';
import { getApplicationDecisions } from './get-application-decisions';

/**
 * Core 3's read-only runtime seam. Core 2 owns the single Core 1 source-fetch
 * chain; Plan only structures the decisions it returns.
 */
export async function getApplicationPlan(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<PlanResult> {
  const decisions = await getApplicationDecisions(supabase, applicationId, userId);
  return compilePlan(decisions);
}
