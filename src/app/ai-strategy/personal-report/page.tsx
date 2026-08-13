import { redirect } from 'next/navigation';
import { getPersonalReportV2Record } from '@/features/apply/api';
import { PersonalReportV2View } from '@/features/apply/ui';
import { createClient } from '@/lib/supabase/server';
import { ReflectionChrome } from '../reflection-chrome';

/**
 * `/ai-strategy/personal-report` — the canonical, user-level Personal
 * Report.
 *
 * Renamed from `/ai-strategy/report` (see `docs/ai-evaluation-engine.md`
 * and the Personal Report rebuild notes): the old route now permanently
 * redirects here (`next.config.ts`). Reads whatever `report_v2` is already
 * stored — generation itself happens from `PersonalReportV2View`'s own
 * "Create report"/"Update report" actions, which call
 * `POST /api/ai-strategy/personal-report`.
 *
 * Deliberately NOT scoped to an application: this report has no
 * `applicationId` anywhere in its data path, matching the product
 * requirement that changing a university application must never affect it.
 */
export default async function PersonalReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const stored = await getPersonalReportV2Record(supabase, user.id);
  const studentName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'there';

  return (
    <ReflectionChrome user={user}>
      <PersonalReportV2View
        initialReport={stored.record?.reportV2 ?? null}
        studentName={studentName}
        generatedAt={stored.record?.generatedAt ?? null}
        migrationMissing={stored.migrationMissing}
      />
    </ReflectionChrome>
  );
}
