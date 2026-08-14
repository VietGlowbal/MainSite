import { redirect } from 'next/navigation';

/**
 * Legacy application-scoped Applicant Portrait route.
 *
 * The canonical Personal Report is user-level and lives at
 * `/ai-strategy/personal-report`. Keep this route only as a compatibility
 * alias for old bookmarks/nav links while Strategy still uses the historical
 * `applicant_analyses` row internally. No application-specific Personal Report
 * is rendered here anymore.
 *
 * Carries `?return=` back to this application's analysis page — the id is
 * right here in the route, and dropping it silently is exactly what left a
 * real student with no header nav/breadcrumb on the canonical page (reported
 * live 2026-08-14, see `known-issues.md`).
 */
export default async function ApplicantPortraitLegacyAlias({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(
    `/ai-strategy/personal-report?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy/analysis`)}`,
  );
}
