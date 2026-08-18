import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { EnglishTestScore, StandardizedTestScore } from '@/lib/types';
import { resolveApplicationReturn } from '../_application-return';
import { ProfileSectionShell } from '../_section-shell';
import { EnglishForm } from './english-form';

export default async function EnglishPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { return: returnParam } = await searchParams;
  const [englishResult, standardizedResult, { returnTo, applicationLabel }] = await Promise.all([
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
    resolveApplicationReturn(supabase, user.id, returnParam),
  ]);

  const englishScores = (englishResult.data ?? []) as EnglishTestScore[];
  const standardizedScores = (standardizedResult.data ?? []) as StandardizedTestScore[];

  return (
    <ProfileSectionShell
      title="Test scores"
      description="Your English-language and standardized test results."
      {...(applicationLabel ? { backHref: returnTo!, backLabel: `← ${applicationLabel}` } : {})}
      {...(returnTo ? { contextNote: 'We need this before analysing your application.' } : {})}
    >
      <EnglishForm
        userId={user.id}
        initialEnglishScores={englishScores}
        initialStandardizedScores={standardizedScores}
        returnTo={returnTo}
        updatedLabel="Test scores"
      />
    </ProfileSectionShell>
  );
}
