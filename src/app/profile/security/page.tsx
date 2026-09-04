import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPasswordIdentity } from '@/features/auth/domain';
import { ProfileSectionShell } from '../_section-shell';
import { ChangePasswordForm, SetPasswordCard } from './change-password-form';

/**
 * /profile/security — change the password on an account you are signed in to.
 *
 * Sits under /profile rather than in a settings area of its own because
 * /profile is where the account already lives: the email, the plan and the sign
 * out control are all in the right rail there, and that rail is what links here.
 *
 * NOT one of the eight cards in `SECTION_GROUPS`. Those feed the profile
 * strength percentage, and a security setting is not a piece of an application
 * — adding it there would quietly re-weight every student's score.
 */
export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect('/auth?redirect=/profile/security');

  /*
   * Which form to show turns entirely on whether a password exists. A student
   * who has only ever used "Continue with Google" has no password hash, so the
   * current-password prompt would be unanswerable; they get the email route
   * instead. The API route re-checks this — the branch here is for the user's
   * benefit, not a security boundary.
   */
  const hasPassword = hasPasswordIdentity(user.identities);

  return (
    <ProfileSectionShell
      title="Password & security"
      description={
        hasPassword
          ? `Change the password for ${user.email}. You will stay signed in here and be signed out everywhere else.`
          : `How you sign in to ${user.email}.`
      }
    >
      {hasPassword ? (
        <ChangePasswordForm email={user.email} />
      ) : (
        <SetPasswordCard email={user.email} />
      )}
    </ProfileSectionShell>
  );
}
