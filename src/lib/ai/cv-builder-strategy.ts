import {
  strategyRecommendationFromRow,
  type StrategyRecommendationRecord,
} from '@/features/ai-strategy-dashboard/domain';
import type { DirectionOption } from '@/features/ai-strategy-dashboard/domain';

export const CV_STRATEGY_SNAPSHOT_VERSION = 1 as const;

export type CvStrategyFrameworkId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
export const CV_STRATEGY_FRAMEWORKS: readonly CvStrategyFrameworkId[] = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
];

export type CvStrategySnapshot = StrategyRecommendationRecord & {
  version: typeof CV_STRATEGY_SNAPSHOT_VERSION;
  recommendationId: string;
  frameworks: typeof CV_STRATEGY_FRAMEWORKS;
  positioning: {
    before: string;
    after: string;
    rationale: string;
  };
  differentiation: {
    insight: string;
    proposal: string;
  };
};

/** The one F7 option a student selected for this CV run. Always resolve it from
 * the owner-scoped snapshot; never accept the option details from the browser. */
export type CvSelectedDirection = DirectionOption;

export function resolveCvSelectedDirection(
  strategy: CvStrategySnapshot,
  selectedDirection: string,
): CvSelectedDirection | null {
  return (
    strategy.directionOptions.find(({ name }) => name === selectedDirection) ?? null
  );
}

export type CvStrategyDatabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => {
            limit: (count: number) => Promise<{
              data: unknown;
              error?: unknown;
            }>;
          };
        };
      };
    };
  };
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function cvStrategySnapshotFromRow(
  row: Record<string, unknown>,
): CvStrategySnapshot | null {
  const recommendation = strategyRecommendationFromRow(row);
  if (
    !recommendation ||
    !isNonEmptyString(recommendation.id) ||
    !isNonEmptyString(recommendation.applicationId) ||
    !isNonEmptyString(recommendation.createdAt) ||
    Number.isNaN(Date.parse(recommendation.createdAt))
  ) {
    return null;
  }

  return {
    ...recommendation,
    version: CV_STRATEGY_SNAPSHOT_VERSION,
    recommendationId: recommendation.id,
    frameworks: CV_STRATEGY_FRAMEWORKS,
    positioning: {
      before: recommendation.positioningBefore,
      after: recommendation.positioningAfter,
      rationale: recommendation.positioningRationale,
    },
    differentiation: {
      insight: recommendation.differentiationInsight,
      proposal: recommendation.differentiationProposal,
    },
  };
}

/** Load the newest owner-scoped, schema-valid F7 row for a CV request. */
export async function loadLatestCvStrategySnapshot(
  supabase: CvStrategyDatabase,
  applicationId: string,
  userId: string,
): Promise<CvStrategySnapshot | null> {
  const { data, error } = await supabase
    .from('application_strategy_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return null;

  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const snapshot = cvStrategySnapshotFromRow(row as Record<string, unknown>);
    if (snapshot?.applicationId === applicationId) return snapshot;
  }
  return null;
}
