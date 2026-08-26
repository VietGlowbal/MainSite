import { redirect } from 'next/navigation';
import {
  getLatestApplicationPersonalReportV2,
  getLatestPersonalReportV2,
  listApplicationPersonalReportV2Versions,
  listPersonalReportV2Versions,
  verifiedApplicationId,
} from '@/features/apply/api';
import { PersonalReportV2View } from '@/features/apply/ui';
import { applicationIdFromPath } from '@/shared/lib';
import { createClient } from '@/lib/supabase/server';
import { ReflectionChrome } from '../reflection-chrome';
import { ApplicationNavFromReturn } from '../reflection/application-nav-from-return';

/**
 * `/ai-strategy/personal-report` — the report view. When opened from an
 * application it loads that application's report and history; without a
 * return context it remains a read-only legacy archive view.
 *
 * Renamed from `/ai-strategy/report` (see `docs/ai-evaluation-engine.md`
 * and the Personal Report rebuild notes): the old route now permanently
 * redirects here (`next.config.ts`). Reads the LATEST of a per-student
 * append-only version history (`student_personal_report_versions`, see
 * `supabase-personal-report-versions.sql`) — every past version stays
 * readable via the dropdown `PersonalReportV2View` renders from
 * `initialVersions`. An application-scoped version is created by a student's
 * own action (`PersonalReportV2View`'s "Create report" / answering a report
 * question, via the application report endpoint) or automatically whenever a
 * Matching Report is generated.
 *
 * ─── BUT STILL NAVIGABLE FROM ONE, VIA `?return=` ────────────────────────────
 *
 * Reported live 2026-08-14: arriving here from an application's nav bar lost
 * all context — no breadcrumb/nav band, "View confirmed information" sent a
 * student to reflections with no way back, and "Continue to Matching Report"
 * went to the generic chooser instead of this application's own report.
 * `?return=` (the same untrusted-until-verified path the reflection pages
 * already use — see `ApplicationNavFromReturn`'s own doc comment) is where
 * that context comes from when the student arrived via
 * `aiStrategyApplicationNav()`'s "Personal Report" entry. It is passed
 * through to `PersonalReportV2View` only once verified, and NEVER baked into
 * the stored `report_v2` itself — application ownership and confirmation are
 * checked again by every application-scoped read/write endpoint.
 */
export default async function PersonalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { return: returnTo } = await searchParams;
  const applicationId = returnTo
    ? await verifiedApplicationId(supabase, user.id, applicationIdFromPath(returnTo) ?? undefined)
    : undefined;

  const [stored, versionList] = applicationId
    ? await Promise.all([
        getLatestApplicationPersonalReportV2(supabase, { userId: user.id, applicationId }),
        listApplicationPersonalReportV2Versions(supabase, { userId: user.id, applicationId }),
      ])
    : await Promise.all([
        getLatestPersonalReportV2(supabase, user.id),
        listPersonalReportV2Versions(supabase, user.id),
      ]);
  const applicationState = applicationId
    ? await loadApplicationState(supabase, user.id, applicationId)
    : null;
  const latestSnapshotId = applicationState?.snapshotId ?? null;
  const stale = applicationId
    ? !applicationState?.confirmed || Boolean(stored.record && stored.record.confirmedSnapshotId !== latestSnapshotId)
    : false;
  const studentName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'there';

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <PersonalReportV2View
        initialReport={stored.record?.reportV2 ?? null}
        initialVersionId={stored.record?.id ?? null}
        initialVersions={versionList.versions}
        applicationId={applicationId}
        applicationConfirmed={applicationId ? applicationState?.confirmed : undefined}
        stale={stale}
        studentName={studentName}
        generatedAt={stored.record?.generatedAt ?? null}
        migrationMissing={stored.migrationMissing || versionList.migrationMissing}
        returnTo={applicationId ? returnTo : undefined}
        matchingReportHref={applicationId ? `/ai-strategy/${applicationId}/matching-report` : '/ai-strategy/matching'}
      />
    </ReflectionChrome>
  );
}

async function loadApplicationState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  applicationId: string,
): Promise<{ confirmed: boolean; snapshotId: string | null }> {
  const application = await supabase
    .from('course_applications')
    .select('candidate_confirmed_at')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (application.error || !application.data?.candidate_confirmed_at) {
    return { confirmed: false, snapshotId: null };
  }

  const snapshot = await supabase
    .from('confirmed_candidate_snapshots')
    .select('id')
    .eq('application_id', applicationId)
    .eq('user_id', userId)
    .order('confirmed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { confirmed: Boolean(snapshot.data?.id), snapshotId: (snapshot.data?.id as string | undefined) ?? null };
}
