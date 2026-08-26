import type { SupabaseClient } from '@supabase/supabase-js';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import { isAdmin } from '@/server/auth/auth-helpers';

export type PlannerMode = 'canonical' | 'legacy';

/** The single entitlement boundary shared by Planner and Planner Ops. */
export async function getPlannerMode(supabase: SupabaseClient, userId: string): Promise<PlannerMode> {
  const { data } = await supabase.from('student_profiles')
    .select('plus_status,plus_expires_at,is_admin').eq('user_id', userId).maybeSingle();
  return isPlusEntitlementActive(data ?? {}) || await isAdmin(userId) ? 'canonical' : 'legacy';
}
