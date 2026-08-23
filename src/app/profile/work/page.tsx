import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { WorkExperience } from '@/lib/types';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { WorkForm } from './work-form';

export default async function WorkPage({
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
  const [{ data }, { returnTo, applicationLabel }] = await Promise.all([
    supabase
      .from('work_experiences')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false }),
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  const experiences = (data ?? []) as WorkExperience[];

  return (
    <ProfileSectionShell
      title="Work experience"
      description="Internships, part-time jobs, volunteering, and any other relevant experience."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <WorkForm
        userId={user.id}
        initialExperiences={experiences}
        returnTo={returnTo}
        updatedLabel="Work experience"
      />
    </ProfileSectionShell>
  );
}
