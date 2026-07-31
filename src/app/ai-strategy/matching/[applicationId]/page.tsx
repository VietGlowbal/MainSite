import { notFound, redirect } from 'next/navigation';
import { getMatchingReportPageData } from '@/features/apply/api';
import { MatchingReportView } from '@/features/apply/ui';
import { createClient } from '@/lib/supabase/server';
import { ReflectionChrome } from '../../reflection-chrome';

export default async function MatchingReportPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const result = await getMatchingReportPageData(supabase, user.id, applicationId);
  if (!result.data) notFound();

  return (
    <ReflectionChrome user={user}>
      <MatchingReportView data={result.data} migrationMissing={result.migrationMissing} />
    </ReflectionChrome>
  );
}
