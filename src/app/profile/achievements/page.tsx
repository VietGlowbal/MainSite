import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileSectionShell } from '../_section-shell';
import { AchievementsForm } from '../achievements-form';

export default async function AchievementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('achievements, skills')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <ProfileSectionShell
      title="Achievements"
      description="Awards, extracurricular activities, leadership roles and skills."
    >
      <AchievementsForm
        userId={user.id}
        initialAchievements={profile?.achievements ?? []}
        initialSkills={profile?.skills ?? []}
      />
    </ProfileSectionShell>
  );
}
