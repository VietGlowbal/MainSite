import { redirect } from 'next/navigation';

/**
 * Legacy application-scoped Applicant Portrait route.
 *
 * The canonical Personal Report is user-level and lives at
 * `/ai-strategy/personal-report`. Keep this route only as a compatibility
 * alias for old bookmarks/nav links while Strategy still uses the historical
 * `applicant_analyses` row internally. No application-specific Personal Report
 * is rendered here anymore.
 */
export default function ApplicantPortraitLegacyAlias() {
  redirect('/ai-strategy/personal-report');
}
