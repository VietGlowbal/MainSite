import { isAdmin } from '@/server/auth/auth-helpers';
import { createAdminClient } from '@/server/db/admin';
import { createClient } from '@/server/db/server';
import type { AchieverStatus } from '@/types/achievers';

const APPLICATION_SELECT = `
  id,
  display_name,
  subject,
  degree_level,
  bio,
  help_topics,
  languages,
  session_price_vnd,
  session_duration_mins,
  status,
  created_at,
  university:universities!achiever_profiles_university_id_fkey (
    id,
    name,
    country
  )
`;

export type AdminAdvisorApplication = {
  id: string;
  display_name: string;
  subject: string;
  degree_level: string;
  bio: string | null;
  help_topics: string[];
  languages: string[];
  session_price_vnd: number;
  session_duration_mins: number;
  status: AchieverStatus;
  created_at: string;
  university: { id: number; name: string; country: string } | null;
};

type AdminFailure<Status extends 401 | 403 | 409 | 500 = 401 | 403 | 409 | 500> = {
  ok: false;
  error: string;
  status: Status;
};

type AdminAuthorization =
  | { ok: true }
  | AdminFailure<401 | 403>;

export type AdvisorApplicationListResult =
  | { ok: true; applications: AdminAdvisorApplication[] }
  | AdminFailure<401 | 403 | 500>;

export type AdvisorApplicationDecision = Extract<
  AchieverStatus,
  'approved' | 'rejected'
>;

export type AdvisorApplicationDecisionResult =
  | {
      ok: true;
      application: {
        id: string;
        status: AdvisorApplicationDecision;
        verified_at: string | null;
      };
    }
  | AdminFailure<401 | 403 | 409 | 500>;

async function authorizeAdmin(): Promise<AdminAuthorization> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, error: 'Sign in required', status: 401 };
  }
  if (!(await isAdmin(user.id))) {
    return { ok: false, error: 'Forbidden', status: 403 };
  }
  return { ok: true };
}

/**
 * Reads the advisor review queue through the trusted server client.
 *
 * The normal authenticated policy only exposes approved profiles and the
 * caller's own profile, so an admin's request-scoped client cannot see other
 * applicants' pending rows. Authorization stays inside this data boundary
 * because a parent layout check does not protect independently executed data
 * access.
 */
export async function listAdvisorApplicationsForAdmin(): Promise<AdvisorApplicationListResult> {
  const authorization = await authorizeAdmin();
  if (!authorization.ok) return authorization;

  const { data, error } = await createAdminClient()
    .from('achiever_profiles')
    .select(APPLICATION_SELECT)
    .in('status', ['pending', 'approved', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Admin advisor application query failed:', error.message);
    return { ok: false, error: 'Could not load advisor applications', status: 500 };
  }

  return {
    ok: true,
    applications: (data ?? []) as unknown as AdminAdvisorApplication[],
  };
}

/**
 * Records one final admin decision. Only pending rows may transition through
 * this control, preventing a stale tab from overwriting a decision made by a
 * second admin.
 */
export async function decideAdvisorApplication(
  id: string,
  status: AdvisorApplicationDecision,
): Promise<AdvisorApplicationDecisionResult> {
  const authorization = await authorizeAdmin();
  if (!authorization.ok) return authorization;

  const verifiedAt = status === 'approved' ? new Date().toISOString() : null;
  const { data, error } = await createAdminClient()
    .from('achiever_profiles')
    .update({ status, verified_at: verifiedAt })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, status, verified_at')
    .maybeSingle();

  if (error) {
    console.error('Admin advisor application decision failed:', error.message);
    return { ok: false, error: 'Could not update the advisor application', status: 500 };
  }
  if (!data) {
    return {
      ok: false,
      error: 'This application is no longer pending. Refresh and try again.',
      status: 409,
    };
  }

  return {
    ok: true,
    application: {
      id: data.id as string,
      status: data.status as AdvisorApplicationDecision,
      verified_at: (data.verified_at as string | null) ?? null,
    },
  };
}
