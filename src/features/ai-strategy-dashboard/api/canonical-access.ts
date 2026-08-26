import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlannerMode } from './planner-mode';

/** Stable error boundary for every canonical Planner server operation. */
export class CanonicalPlannerAccessError extends Error {
  constructor(readonly code: 'not_entitled' | 'not_found') {
    super(code === 'not_entitled' ? 'Planner access requires GlowBal Plus.' : 'Application was not found for this user.');
    this.name = 'CanonicalPlannerAccessError';
  }
}

/** Canonical access requires both entitlement and application ownership. */
export async function assertCanonicalPlannerAccess(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<void> {
  if (await getPlannerMode(supabase, userId) !== 'canonical') {
    throw new CanonicalPlannerAccessError('not_entitled');
  }
  const { data, error } = await supabase.from('course_applications').select('id')
    .eq('id', applicationId).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new CanonicalPlannerAccessError('not_found');
}
