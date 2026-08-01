import { createClient } from '@/server/db/server';
import { onboardingIsComplete } from '../domain';

/**
 * Where a visitor is in onboarding, read from the request's own session.
 *
 * Server-only, and RLS-scoped: this uses the cookie-backed client, not the
 * service-role one, so a row can only be read by the student it belongs to. No
 * user id is taken as an argument for exactly that reason — there is nothing to
 * pass, and therefore nothing to pass wrong.
 *
 * The rule for "complete" is `onboardingIsComplete` in ../domain, which is
 * where the reasoning lives.
 */

export type OnboardingStatus = {
  signedIn: boolean;
  /** False whenever `signedIn` is false — a guest has answered nothing. */
  completed: boolean;
};

const SIGNED_OUT: OnboardingStatus = { signedIn: false, completed: false };

export async function readOnboardingStatus(): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return SIGNED_OUT;

  const { data: profile, error } = await supabase
    .from('student_profiles')
    .select('onboarding_completed, study_level, preferred_countries')
    .eq('user_id', user.id)
    .maybeSingle();

  // A failed read is not evidence that the student is new. Reporting "not
  // completed" here would send someone who has finished onboarding back to the
  // start of it every time the database hiccups; reporting the opposite would
  // strand a genuinely new student on a page that needs their answers. The
  // caller sends `completed: false` to /onboarding, which is idempotent for
  // someone who has already answered — it restores their saved profile — so
  // that is the safe side to fail towards.
  if (error) return { signedIn: true, completed: false };

  return { signedIn: true, completed: onboardingIsComplete(profile) };
}
