import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileSectionShell } from '../_section-shell';
import { PersonalForm } from './personal-form';

export default async function PersonalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('phone, date_of_birth, location, nationality, bio')
    .eq('user_id', user.id)
    .maybeSingle();

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Student';

  return (
    <ProfileSectionShell
      title="Personal information"
      description="Your name, nationality, location and contact details."
    >
      <PersonalForm
        userId={user.id}
        displayName={displayName}
        email={user.email ?? ''}
        initialProfile={profile}
      />
    </ProfileSectionShell>
  );
}
