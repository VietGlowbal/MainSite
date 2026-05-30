import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { EnglishTestScore } from '@/lib/types';
import { ProfileSectionShell } from '../_section-shell';
import { EnglishForm } from './english-form';

export default async function EnglishPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data } = await supabase
    .from('english_test_scores')
    .select('*')
    .eq('user_id', user.id)
    .order('test_date', { ascending: false });

  const scores = (data ?? []) as EnglishTestScore[];

  return (
    <ProfileSectionShell
      title="English proficiency"
      description="Your IELTS, TOEFL, PTE or other English language test results."
    >
      <EnglishForm userId={user.id} initialScores={scores} />
    </ProfileSectionShell>
  );
}
