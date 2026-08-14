import type { SubNavItem } from './app-routes';

export type ApplicationRouteKey =
  | 'overview'
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
 */
export function aiStrategyApplicationNav(
  applicationId: string,
  readiness: ApplicationRouteReadiness,
): SubNavItem[] {
  const app = `/ai-strategy/${applicationId}`;
  return [
    { key: 'overview', label: 'Overview', href: `/apply/${applicationId}` },
    { key: 'personalReport', label: 'Personal Report', href: '/ai-strategy/personal-report' },
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
    { key: 'finalCheck', label: 'Final Check', href: `${app}/final-check`, locked: true },
  ];
}

export function activeAiStrategyApplicationKey(
  pathname: string,
  items: readonly SubNavItem[],
): string | null {
  const clean = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/';
  const exact = items.find((item) => item.href.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') === clean);
  if (exact) return exact.key;

  // Compatibility for old URLs while their route-level redirects resolve.
  if (/\/strategy\/analysis\/fit$/.test(clean)) return 'matchingReport';
  if (/\/strategy\/analysis\/recommendation$/.test(clean)) return 'strategyReport';
  if (/\/strategy\/(dashboard|recommendations)/.test(clean)) return 'planner';
  if (/\/strategy\/analysis\/portrait$/.test(clean)) return 'personalReport';
  return null;
}
