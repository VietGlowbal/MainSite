import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { EnglishTestScore, StandardizedTestScore } from '@/lib/types';
import { ProfileSectionShell } from '../_section-shell';
import { EnglishForm } from './english-form';

export default async function EnglishPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const [englishResult, standardizedResult] = await Promise.all([
    supabase
      .from('english_test_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('test_date', { ascending: false }),
    supabase
      .from('standardized_test_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('test_date', { ascending: false }),
  ]);

  const englishScores = (englishResult.data ?? []) as EnglishTestScore[];
  const standardizedScores = (standardizedResult.data ?? []) as StandardizedTestScore[];

  return (
    <ProfileSectionShell
      title="Test scores"
      description="Your English-language and standardized test results."
    >
      <EnglishForm
        userId={user.id}
        initialEnglishScores={englishScores}
        initialStandardizedScores={standardizedScores}
      />
    </ProfileSectionShell>
  );
}
