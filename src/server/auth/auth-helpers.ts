import { createClient } from '@/server/db/server';

/**
 * Check whether the current user (or a given userId) is an admin.
 *
 * Admin status is granted in two ways:
 *  1. The user's UUID is in the comma-separated ADMIN_USER_IDS env var
 *     (useful for bootstrapping the first admin without writing to the DB)
 *  2. The student_profiles row has is_admin = true
 *
 * Pass `userId` if you've already fetched it; otherwise it will pull from auth.
 */
export async function isAdmin(userId?: string): Promise<boolean> {
  const supabase = await createClient();

  let id = userId;
  if (!id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    id = user.id;
  }

  // Env-based admin list (no DB write required to bootstrap)
  const envAdmins = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (envAdmins.includes(id)) return true;

  // DB-based admin flag
  const { data } = await supabase
    .from('student_profiles')
    .select('is_admin')
    .eq('user_id', id)
    .maybeSingle();

  return data?.is_admin === true;
}

/**
 * Check whether the current user (or a given userId) is a coordinator.
 *
 * Mirrors {@link isAdmin}: coordinator status is granted either via the
 * comma-separated COORDINATOR_USER_IDS env var (bootstrap without a DB write)
 * or the student_profiles row having is_coordinator = true.
 */
export async function isCoordinator(userId?: string): Promise<boolean> {
  const supabase = await createClient();

  let id = userId;
  if (!id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    id = user.id;
  }

  // Env-based coordinator list (no DB write required to bootstrap)
  const envCoordinators = (process.env.COORDINATOR_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (envCoordinators.includes(id)) return true;

  // DB-based coordinator flag
  const { data } = await supabase
    .from('student_profiles')
    .select('is_coordinator')
    .eq('user_id', id)
    .maybeSingle();

  return data?.is_coordinator === true;
}
