import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileSectionShell } from '../_section-shell';
import { GoalsForm } from './goals-form';

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('goals, career_interests, target_intake, application_cycle_year')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <ProfileSectionShell
      title="Application goals"
      description="What you want to achieve through higher education and your dream career path."
    >
      <GoalsForm userId={user.id} initialProfile={profile} />
    </ProfileSectionShell>
  );
}
