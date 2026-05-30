import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UploadedDocument } from '@/lib/types';
import { getMentorSummary } from '@/lib/mentor-status';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const [profileResult, documentsResult, mentorSummary] = await Promise.all([
    supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('uploaded_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    getMentorSummary(),
    supabase.from('course_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('work_experiences').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('english_test_scores').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const profile = profileResult.data;
  const documents = (documentsResult.data ?? []) as UploadedDocument[];

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Student';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <ProfileClient
          displayName={displayName}
          email={user.email ?? ''}
          avatarUrl={avatarUrl}
          initials={initials}
          memberSince={memberSince}
          profile={profile}
          documents={documents}
          activeApplications={3}
          isMentor={!!mentorSummary}
        />
      </div>
    </main>
  );
}
