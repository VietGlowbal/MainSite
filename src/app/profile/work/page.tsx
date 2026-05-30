import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { WorkExperience } from '@/lib/types';
import { ProfileSectionShell } from '../_section-shell';
import { WorkForm } from './work-form';

export default async function WorkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data } = await supabase
    .from('work_experiences')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false });

  const experiences = (data ?? []) as WorkExperience[];

  return (
    <ProfileSectionShell
      title="Work experience"
      description="Internships, part-time jobs, volunteering, and any other relevant experience."
    >
      <WorkForm userId={user.id} initialExperiences={experiences} />
    </ProfileSectionShell>
  );
}
