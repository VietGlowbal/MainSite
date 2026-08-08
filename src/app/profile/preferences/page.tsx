import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileSectionShell } from '../_section-shell';
import { PreferencesForm } from './preferences-form';

export default async function PreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('preferred_countries, preferred_cities, target_subjects, budget_range, campus_preferences, support_needs, study_mode_preference, target_intake, application_cycle_year')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <ProfileSectionShell
      title="Target preferences"
      description="Where and what you want to study, your budget, and the support you need."
    >
      <PreferencesForm userId={user.id} initialProfile={profile} />
    </ProfileSectionShell>
  );
}
