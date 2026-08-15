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

/**
 * Check whether the current user (or a given userId/email) is the founder / payment admin
 * authorized to view sensitive financial data and approve payments.
 *
 * Checks against:
 * 1. MANUAL_PAYMENT_REVIEWER_USER_IDS or founder ID 'a8bccd1d-dcbc-409e-879c-90c483a7c3a1'
 * 2. MANUAL_PAYMENT_FOUNDER_EMAIL or founder email 'khanhlinh05.work@gmail.com'
 */
export async function isPaymentAdmin(userId?: string, userEmail?: string): Promise<boolean> {
  const supabase = await createClient();

  let id = userId;
  let email = userEmail;
  if (!id || !email) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    id = id ?? user.id;
    email = email ?? user.email;
  }

  const currentId = (id ?? '').trim().toLowerCase();
  const currentEmail = (email ?? '').trim().toLowerCase();

  // Known founder identifier defaults for resilience
  if (
    currentId === 'a8bccd1d-dcbc-409e-879c-90c483a7c3a1' ||
    currentEmail === 'khanhlinh05.work@gmail.com' ||
    currentEmail === 'taduchien314@gmail.com'
  ) {
    return true;
  }

  const reviewerIds = (process.env.MANUAL_PAYMENT_REVIEWER_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (reviewerIds.includes(currentId)) {
    return true;
  }

  const founderEmails = (process.env.MANUAL_PAYMENT_FOUNDER_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (founderEmails.includes(currentEmail)) {
    return true;
  }

  return false;
}

