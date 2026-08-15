import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { PreferencesForm } from './preferences-form';

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { return: returnParam } = await searchParams;
  const [{ data: profile }, { returnTo, applicationLabel }] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('preferred_countries, preferred_cities, target_subjects, budget_range, campus_preferences, support_needs, study_mode_preference, target_intake, application_cycle_year')
      .eq('user_id', user.id)
      .maybeSingle(),
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  return (
    <ProfileSectionShell
      title="Target preferences"
      description="Where and what you want to study, your budget, and the support you need."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <PreferencesForm userId={user.id} initialProfile={profile} returnTo={returnTo} updatedLabel="Study plans" />
    </ProfileSectionShell>
  );
}
