import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileSectionShell } from '../_section-shell';
import { AcademicForm } from './academic-form';

export default async function AcademicPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('study_level, current_institution, current_qualification, predicted_grades, graduation_year, academic_background, target_subjects')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <ProfileSectionShell
      title="Academic background"
      description="Your education history, grades and subjects."
    >
      <AcademicForm userId={user.id} initialProfile={profile} />
    </ProfileSectionShell>
  );
}
