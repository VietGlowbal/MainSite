import type { SubNavItem } from './app-routes';

export type ApplicationRouteKey =
  | 'overview'
  | 'reflections'
  | 'personalReport'
  | 'matchingReport'
  | 'strategyReport'
  | 'planner'
  | 'cv'
  | 'essay'
  | 'scholarships'
  | 'finalCheck';

export type ApplicationRouteReadiness = {
  analysisReady: boolean;
  strategyReady: boolean;
  plannerReady: boolean;
  candidateConfirmed: boolean;
};

/**
 * One canonical route definition for the application workspace.
 *
 * Personal Report is intentionally global/user-level. Matching, Strategy and
 * Planner are application-level and use their canonical route names. CV and
 * Essay remain on the current `/apply` implementations until their dedicated
 * merge phase; changing those two here would switch users between two existing
 * builders without migrating state.
 *
 * Scholarships and Final Check are included as locked future destinations so
 * the route model represents the complete product architecture without
 * rendering dead links. `SubNav` omits locked items.
 *
 * Overview is the pre-report landing page; once reports exist, Reflections
 * (this application's confirmed, read-only Candidate Information) takes its
 * place as the way back to "what this was generated from" — owner decision,
 * 2026-08-14, ported here from `applicationSubNav()` (`app-routes.ts`) when
 * this canonical model replaced it as the nav's actual data source. The two
 * are deliberately mutually exclusive rather than both shown:
 * `candidateConfirmed` is always true by the time `analysisReady` is, since
 * confirmation gates analysis in `nextOnboardingStep`, but the
 * `candidateConfirmed` check here is what stops Reflections' link (a page
 * that redirects away until confirmed) from ever appearing before it
 * resolves to something.
 *
 * Personal Report's own link carries the same `?return=` shape as
 * Reflections', even though the report page itself has no `applicationId` in
 * its path — reported live 2026-08-14: arriving at the user-level Personal
 * Report from an application lost all context (no nav band, no way back to
 * this application's Matching Report). `PersonalReportPage` reads it the
 * same untrusted-until-verified way every other `?return=` consumer does.
 */
export function aiStrategyApplicationNav(
  applicationId: string,
  readiness: ApplicationRouteReadiness,
): SubNavItem[] {
  const app = `/ai-strategy/${applicationId}`;
  const returnParam = `?return=${encodeURIComponent(`${app}/strategy/analysis`)}`;
  const leadItem: SubNavItem = readiness.analysisReady
    ? {
        key: 'reflections',
        label: 'Reflections',
        href: `/ai-strategy/reflection/confirm${returnParam}`,
        ...(readiness.candidateConfirmed ? {} : { locked: true }),
      }
    : { key: 'overview', label: 'Overview', href: `/apply/${applicationId}` };

  return [
    leadItem,
    { key: 'personalReport', label: 'Personal Report', href: `/ai-strategy/personal-report${returnParam}` },
    {
      key: 'matchingReport',
      label: 'Matching Report',
      href: `${app}/matching-report`,
      ...(readiness.analysisReady ? {} : { locked: true }),
    },
    {
      key: 'strategyReport',
      label: 'Personalized Strategy',
      href: `${app}/strategy-report`,
      ...(readiness.strategyReady ? {} : { locked: true }),
    },
    {
      key: 'planner',
      label: 'Planner',
      href: `${app}/planner`,
      ...(readiness.plannerReady ? {} : { locked: true }),
    },
    // Deliberate compatibility adapters pending the CV/Essay consolidation.
    { key: 'cv', label: 'CV Support', href: `/apply/${applicationId}/cv` },
    { key: 'essay', label: 'Essay Support', href: `/apply/${applicationId}/statement-feedback` },
    // Canonical future destinations. Locked items are intentionally omitted by
    // SubNav until their product phases are implemented.
    { key: 'scholarships', label: 'Scholarships', href: `${app}/scholarships`, locked: true },
    // Final Check is implemented and unlocked. The page handles its own
    // "not enough attached yet" state rather than being gated here, because a
    // student needs to see WHAT is missing — which is most of the report's
    // value before any document exists.
    { key: 'finalCheck', label: 'Final Check', href: `${app}/final-check` },
  ];
}

export function activeAiStrategyApplicationKey(
  pathname: string,
  items: readonly SubNavItem[],
): string | null {
  const clean = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/';
  const exact = items.find((item) => item.href.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') === clean);
  if (exact) return exact.key;

  // All three Candidate Information pages (Reflections, Achievements,
  // Review & Confirm) belong under the Reflections tab regardless of which
  // `?return=` they were opened with.
  if (/^\/ai-strategy\/reflection(\/|$)/.test(clean)) return 'reflections';

  // Compatibility for old URLs while their route-level redirects resolve.
  if (/\/strategy\/analysis\/fit$/.test(clean)) return 'matchingReport';
  if (/\/strategy\/analysis\/recommendation$/.test(clean)) return 'strategyReport';
  if (/\/strategy\/(dashboard|recommendations)/.test(clean)) return 'planner';
  if (/\/strategy\/analysis\/portrait$/.test(clean)) return 'personalReport';
  return null;
}
