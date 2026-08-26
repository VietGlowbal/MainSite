import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { GoalsForm } from './goals-form';

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { return: returnParam } = await searchParams;
  const [{ data: profile }, { returnTo, applicationLabel }] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('goals, career_interests, target_intake, application_cycle_year')
      .eq('user_id', user.id)
      .maybeSingle(),
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  return (
    <ProfileSectionShell
      title="Application goals"
      description="What you want to achieve through higher education and your dream career path."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <GoalsForm
        userId={user.id}
        initialProfile={profile}
        returnTo={returnTo}
        updatedLabel="Application goals"
      />
    </ProfileSectionShell>
  );
}
