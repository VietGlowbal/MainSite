import { redirect } from 'next/navigation';
import { getLatestPersonalReportV2, listPersonalReportV2Versions, verifiedApplicationId } from '@/features/apply/api';
import { PersonalReportV2View } from '@/features/apply/ui';
import { applicationIdFromPath } from '@/shared/lib';
import { createClient } from '@/lib/supabase/server';
import { ReflectionChrome } from '../reflection-chrome';
import { ApplicationNavFromReturn } from '../reflection/application-nav-from-return';

/**
 * `/ai-strategy/personal-report` — the canonical, user-level Personal
 * Report.
 *
 * Renamed from `/ai-strategy/report` (see `docs/ai-evaluation-engine.md`
 * and the Personal Report rebuild notes): the old route now permanently
 * redirects here (`next.config.ts`). Reads the LATEST of a per-student
 * append-only version history (`student_personal_report_versions`, see
 * `supabase-personal-report-versions.sql`) — every past version stays
 * readable via the dropdown `PersonalReportV2View` renders from
 * `initialVersions`. A version is created by a student's own action
 * (`PersonalReportV2View`'s "Create report" / answering a report question,
 * via `POST /api/ai-strategy/personal-report`) or automatically whenever a
 * Matching Report is generated (`regeneratePersonalReport`, called from
 * `match-insights/route.ts`) — see that function's doc comment for why
 * there is no manual regeneration cooldown.
 *
 * Deliberately NOT scoped to an application: this report has no
 * `applicationId` anywhere in its data path, matching the product
 * requirement that changing a university application must never affect it.
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
 * the stored `report_v2` itself — the report is generated once and reused
 * across every application, so a stale `applicationId` from whichever visit
 * happened to trigger generation must never end up inside the cached
 * content, only in this request's own render.
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

  const [stored, versionList] = await Promise.all([
    getLatestPersonalReportV2(supabase, user.id),
    listPersonalReportV2Versions(supabase, user.id),
  ]);
  const studentName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'there';

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <PersonalReportV2View
        initialReport={stored.record?.reportV2 ?? null}
        initialVersionId={stored.record?.id ?? null}
        initialVersions={versionList.versions}
        studentName={studentName}
        generatedAt={stored.record?.generatedAt ?? null}
        migrationMissing={stored.migrationMissing}
        returnTo={applicationId ? returnTo : undefined}
        matchingReportHref={applicationId ? `/ai-strategy/${applicationId}/matching-report` : '/ai-strategy/matching'}
      />
    </ReflectionChrome>
  );
}
