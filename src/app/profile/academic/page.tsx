import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { AcademicForm } from './academic-form';

export default async function AcademicPage({
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
      .select('study_level, current_institution, current_qualification, predicted_grades, graduation_year, academic_background, target_subjects, curriculum, curriculum_grades, gpa_scale, gpa_value')
      .eq('user_id', user.id)
      .maybeSingle(),
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  return (
    <ProfileSectionShell
      title="Academic background"
      description="Your education history, grades and subjects."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <AcademicForm userId={user.id} initialProfile={profile} returnTo={returnTo} updatedLabel="Academic information" />
    </ProfileSectionShell>
  );
}
