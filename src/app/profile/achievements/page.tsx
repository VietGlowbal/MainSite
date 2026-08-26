import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { AchievementsForm } from '../achievements-form';

export default async function AchievementsPage({
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
      .select('achievements, skills')
      .eq('user_id', user.id)
      .maybeSingle(),
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  return (
    <ProfileSectionShell
      title="Achievements"
      description="Awards, extracurricular activities, leadership roles and skills."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <AchievementsForm
        userId={user.id}
        initialAchievements={profile?.achievements ?? []}
        initialSkills={profile?.skills ?? []}
        returnTo={returnTo}
        updatedLabel="Achievements"
      />
    </ProfileSectionShell>
  );
}
