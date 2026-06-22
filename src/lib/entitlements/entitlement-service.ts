/**
 * Entitlement and Usage Tracking Service
 * 
 * Enforces usage limits for AI Course Search and Apply features:
 * - Free tier: 3 AI course search sessions per month + 5 active applications
 * - Plus tier: Unlimited searches and applications (999,999 limit)
 * 
 * Only complete sessions count toward quota.
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Plan tiers
 */
export type PlanTier = 'free' | 'plus' | 'team' | 'admin';

/**
 * User entitlement with usage information
 */
export interface UserEntitlement {
  plan: PlanTier;
  courseSearchLimit: number;
  courseSearchesUsed: number;
  courseAddLimit: number;
  coursesAdded: number;
}

/**
 * Result of an entitlement check
 */
export interface EntitlementCheckResult {
  allowed: boolean;
  usage?: UserEntitlement;
  upgradeRequired?: boolean;
  reason?: string;
}

/**
 * Default limits per plan tier
 * 
 * Task 27.1: Fair-use limits for subscribed users
 * Even Plus/Team users have generous but finite limits to prevent abuse
 */
const PLAN_LIMITS = {
  free: {
    courseSearchLimit: 3,
    courseAddLimit: 5,
  },
  plus: {
    // Task 27.1: Fair-use limits - high but not infinite
    courseSearchLimit: 100, // 100 searches per month (vs 3 for free)
    courseAddLimit: 100, // 100 active courses (vs 5 for free)
  },
  team: {
    courseSearchLimit: 100,
    courseAddLimit: 100,
  },
  admin: {
    // Admins get unlimited
    courseSearchLimit: 999999,
    courseAddLimit: 999999,
  },
} as const;

/**
 * Check if user has an active GlowBal Plus subscription
 */
export async function hasActiveGlowBalSubscription(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('student_profiles')
    .select('plus_status')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.plus_status === true;
}

/**
 * Check if user has admin role (Task 27.2)
 */
async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('student_profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.is_admin === true;
}

/**
 * Get user's entitlement tier and current usage
 */
export async function getUserEntitlement(userId: string): Promise<UserEntitlement> {
  const supabase = await createClient();
  
  // Task 27.2: Check admin status first - admins bypass all limits
  const isAdmin = await isUserAdmin(userId);
  if (isAdmin) {
    return {
      plan: 'admin',
      courseSearchLimit: PLAN_LIMITS.admin.courseSearchLimit,
      courseSearchesUsed: 0, // Admin usage doesn't count
      courseAddLimit: PLAN_LIMITS.admin.courseAddLimit,
      coursesAdded: 0, // Admin usage doesn't count
    };
  }
  
  // Check if user has Plus subscription
  const hasPlus = await hasActiveGlowBalSubscription(userId);
  const plan: PlanTier = hasPlus ? 'plus' : 'free';
  
  // Get plan limits
  const limits = PLAN_LIMITS[plan];
  
  // Get current usage for course searches this month.
  // Only count complete sessions that actually returned results — a search
  // that returns 0 results should not consume the user's quota.
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { count: searchesUsed, error: searchError } = await supabase
    .from('course_search_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'complete')
    .gt('result_count', 0)
    .gte('created_at', firstOfMonth.toISOString());
  
  if (searchError) {
    console.error('Error fetching course search usage:', searchError);
  }
  
  // Get current usage for active courses (status != 'archived')
  const { count: coursesAdded, error: courseError } = await supabase
    .from('course_applications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'archived');
  
  if (courseError) {
    console.error('Error fetching course applications usage:', courseError);
  }
  
  return {
    plan,
    courseSearchLimit: limits.courseSearchLimit,
    courseSearchesUsed: searchesUsed || 0,
    courseAddLimit: limits.courseAddLimit,
    coursesAdded: coursesAdded || 0,
  };
}

/**
 * Check if user can create a new course search session
 * 
 * Task 27.1: Enforces fair-use limits for all tiers
 * 
 * @param userId - The user ID to check
 * @returns EntitlementCheckResult with allowed status, usage info, and upgrade prompt
 */
export async function canCreateCourseSearchSession(userId: string): Promise<EntitlementCheckResult> {
  const usage = await getUserEntitlement(userId);
  
  // Check if user has remaining quota
  const remaining = usage.courseSearchLimit - usage.courseSearchesUsed;
  
  if (remaining > 0) {
    return {
      allowed: true,
      usage,
    };
  }
  
  // Task 27.1: User has exceeded their quota
  // Free users see upgrade prompt, Plus users see rate limit message
  return {
    allowed: false,
    usage,
    upgradeRequired: usage.plan === 'free',
    reason: usage.plan === 'free'
      ? `You've used all ${usage.courseSearchLimit} course searches this month. Upgrade to GlowBal Plus for ${PLAN_LIMITS.plus.courseSearchLimit} searches per month.`
      : `You have reached your fair-use limit of ${usage.courseSearchLimit} course searches this month. This limit resets on the 1st of next month.`,
  };
}

/**
 * Check if user can add courses to Apply
 * 
 * Task 27.1: Enforces fair-use limits for all tiers
 * 
 * @param userId - The user ID to check
 * @param selectedCount - Number of courses to add (default: 1)
 * @returns EntitlementCheckResult with allowed status and upgrade prompt
 */
export async function canAddCoursesToApply(
  userId: string,
  selectedCount: number = 1
): Promise<EntitlementCheckResult> {
  const usage = await getUserEntitlement(userId);
  
  const newTotal = usage.coursesAdded + selectedCount;
  
  if (newTotal <= usage.courseAddLimit) {
    return {
      allowed: true,
      usage,
    };
  }
  
  // Task 27.1: User would exceed their quota
  // Free users see upgrade prompt, Plus users see fair-use limit message
  return {
    allowed: false,
    usage,
    upgradeRequired: usage.plan === 'free',
    reason: usage.plan === 'free'
      ? `You can have up to ${usage.courseAddLimit} active courses on the free plan. Archive a course or upgrade to GlowBal Plus for ${PLAN_LIMITS.plus.courseAddLimit} active courses.`
      : `You have reached your fair-use limit of ${usage.courseAddLimit} active courses. Archive some courses to add more.`,
  };
}

/**
 * Format remaining usage for display
 * Shows "Unlimited" for 999999, otherwise shows the number
 */
export function formatRemainingUsage(limit: number, used: number): string {
  const remaining = limit - used;
  
  if (limit >= 999999) {
    return 'Unlimited';
  }
  
  return remaining.toString();
}

/**
 * Get plan limits for display purposes
 */
export function getPlanLimits(plan: PlanTier) {
  return PLAN_LIMITS[plan];
}
