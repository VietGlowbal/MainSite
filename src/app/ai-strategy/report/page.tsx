import { redirect } from 'next/navigation';
import {
  candidateContextHash,
  getPersonalReportRecord,
  loadCandidateContext,
} from '@/features/apply/api';
import { REPORT_PROMPT_VERSION } from '@/features/apply/domain';
import { PersonalReportView } from '@/features/apply/ui';
import { createClient } from '@/lib/supabase/server';
import { ReflectionChrome } from '../reflection-chrome';

export default async function PersonalReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const [context, stored] = await Promise.all([
    loadCandidateContext(supabase, user.id),
    getPersonalReportRecord(supabase, user.id),
  ]);
  const inputHash = candidateContextHash(context);
  const stale = Boolean(
    stored.record &&
      (stored.record.inputHash !== inputHash ||
        stored.record.promptVersion !== REPORT_PROMPT_VERSION),
  );

  return (
    <ReflectionChrome user={user}>
      <PersonalReportView
        initialReport={stored.record?.report ?? null}
        initialStale={stale}
        generatedAt={stored.record?.generatedAt ?? null}
        migrationMissing={stored.migrationMissing}
      />
    </ReflectionChrome>
  );
}
