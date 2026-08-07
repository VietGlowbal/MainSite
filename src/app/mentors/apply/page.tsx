import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MentorSignupForm } from '@/components/mentorship/MentorSignupForm';

export default async function MentorApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ quick_signup?: string; quick_SignUp?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/advisors/apply');
  }

  // Fast-track ("quick signup"): a token-gated link we share with people we
  // already know would make good mentors. The link carries a secret value
  // (?quick_signup=<token>) that must match MENTOR_QUICK_SIGNUP_TOKEN. When it
  // matches, the applicant skips the document-evidence step — but the profile
  // is still created as 'pending' for admin review. A plain ?quick_SignUp=true
  // with no/incorrect token does NOT unlock the fast-track.
  const sp = await searchParams;
  const providedToken = sp.quick_signup ?? sp.quick_SignUp ?? '';
  const expectedToken = process.env.MENTOR_QUICK_SIGNUP_TOKEN ?? '';
  const quickSignup = expectedToken.length > 0 && providedToken === expectedToken;

  // If they already have a mentor profile, send them to their dashboard.
  const { data: existing } = await supabase
    .from('achiever_profiles')
    .select('id, status')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) {
    redirect('/dashboard/advisor');
  }

  // Universities for the picker — names + countries only, public read OK.
  const { data: universities } = await supabase
    .from('universities')
    .select('id, name, country')
    .order('name');

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    '';

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <span className="glow-pill">Become an advisor</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Help the next generation of students
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Share your experience, set your hourly rate, and earn money helping applicants
            get into your university.{' '}
            {quickSignup
              ? 'You’ve been invited via a fast-track link, so you can skip the document-evidence step.'
              : 'We verify every advisor manually.'}
          </p>
        </div>

        <MentorSignupForm
          userId={user.id}
          defaultDisplayName={displayName}
          universities={universities ?? []}
          quickSignup={quickSignup}
          quickSignupToken={quickSignup ? providedToken : null}
        />
      </div>
    </main>
  );
}
