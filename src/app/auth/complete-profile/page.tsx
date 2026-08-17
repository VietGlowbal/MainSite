import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { contactDetailsComplete, safeInternalPath } from '@/features/auth/domain';
import { CompleteProfileForm } from './complete-profile-form';

/**
 * /auth/complete-profile — the one screen that collects what OAuth cannot ask
 * for.
 *
 * Google's consent screen returns a name, an email and a picture. It will not
 * render our phone and date-of-birth fields, and no OAuth provider will, so for
 * the 81% of accounts that arrive this way those two values can only be
 * collected after authentication. `src/proxy.ts` sends students here and does
 * not let them past until they are filled.
 *
 * It is a hard gate by design (owner's call, 2026-08-17): a student sees it
 * once, and every route that needs the data stays shut until then. The public
 * directory — /universities, /advisors — is deliberately NOT gated, so a
 * visitor browsing for value never hits this wall.
 *
 * Sits under /auth so it inherits the full-bleed, nav-less shell the sign-in
 * card uses; it is exempted from the "signed-in users get redirected off /auth"
 * rule in the proxy, which would otherwise bounce every arrival straight back
 * to /apply.
 */

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('phone, date_of_birth')
    .eq('user_id', user.id)
    .maybeSingle();

  const { next } = await searchParams;
  const safeNext = safeInternalPath(next, '/apply');

  // Already filled in — a stale bookmark or a second tab should not make anyone
  // re-enter details we hold.
  if (contactDetailsComplete(profile)) redirect(safeNext);

  const metadataName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';

  return (
    <div className="gb-page-full-bleed flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-gb-xl py-gb-6xl">
        <div className="w-full max-w-[400px]">
          <CompleteProfileForm
            initialName={metadataName}
            initialPhone={profile?.phone ?? ''}
            initialDob={profile?.date_of_birth ?? ''}
            next={safeNext}
          />
        </div>
      </main>
    </div>
  );
}
