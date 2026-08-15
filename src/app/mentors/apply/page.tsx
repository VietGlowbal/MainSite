import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MentorSignupForm } from '@/components/mentorship/MentorSignupForm';
import { T } from '@/lib/i18n';
import { Badge, ICONS, KitIcon } from '@/shared/ui';

function ApplicationOverviewStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <li className="flex flex-col gap-gb-sm rounded-gb-xl border border-line-on-inverse p-gb-xl">
      <span className="text-gb-xs font-semibold text-brand">
        <T k="Step {number}" vars={{ number }} />
      </span>
      <h2 className="text-gb-sm font-semibold text-fg-on-inverse"><T k={title} /></h2>
      <p className="text-gb-xs leading-relaxed text-fg-on-inverse-muted"><T k={description} /></p>
    </li>
  );
}

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
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-4xl md:px-gb-4xl md:py-gb-7xl">
      <div className="mx-auto flex max-w-3xl flex-col gap-gb-3xl">
        <Link
          href="/advisors"
          className="inline-flex w-fit items-center gap-gb-xs text-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowLeft} frame={20} />
          <T k="Back to all advisors" />
        </Link>

        <section className="flex flex-col gap-gb-3xl rounded-gb-2xl bg-surface-inverse-deep p-gb-3xl shadow-gb-lg md:p-gb-5xl">
          <div className="flex flex-col items-start gap-gb-lg">
            <Badge variant="outline"><T k="Advisor application" /></Badge>
            <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg-on-inverse md:text-gb-display-sm">
              <T k="Help the next generation of students" />
            </h1>
            <p className="max-w-gb-width-xl text-gb-md leading-relaxed text-fg-on-inverse-muted">
              <T k="Share your experience, set your hourly rate, and earn money helping applicants make stronger university decisions." />{' '}
              {quickSignup ? (
                <T k="You have a fast-track invitation, so the document-evidence step is optional." />
              ) : (
                <T k="Every advisor is verified manually before their profile goes live." />
              )}
            </p>
          </div>

          <ol className="grid gap-gb-lg sm:grid-cols-3">
            <ApplicationOverviewStep
              number={1}
              title="Complete your profile"
              description="University, experience and support topics"
            />
            <ApplicationOverviewStep
              number={2}
              title="Submit for review"
              description="Your evidence stays private"
            />
            <ApplicationOverviewStep
              number={3}
              title="Go live after approval"
              description="Set times and accept bookings"
            />
          </ol>
        </section>

        <div className="flex flex-col gap-gb-sm">
          <h2 className="text-gb-xl font-semibold text-fg"><T k="Complete your application" /></h2>
          <p className="text-gb-sm text-fg-tertiary">
            <T k="Required fields are marked with an asterisk. You can review everything before submitting." />
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
