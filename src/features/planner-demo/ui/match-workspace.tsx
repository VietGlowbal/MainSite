'use client';

import { admissionBadgeVariant, Badge, Button, ScoreRing } from '@/shared/ui';
import { MATCHING_REPORT } from '../domain';
import { ConfidenceBadge } from './confidence-badge';
import { TaskWorkspaceShell } from './task-workspace-shell';

const TIER_LABEL: Record<typeof MATCHING_REPORT.tier, string> = {
  reach: 'Reach',
  recommended: 'Recommend',
  safe: 'Safe',
};

/** Ends with "Build my strategy →" from a fresh generation, spec §13. */
export function MatchWorkspace({
  reviewOnly,
  onBack,
  onComplete,
  onBuildStrategy,
}: {
  /** True for the Phase 2 "review" task — same report, no strategy CTA. */
  reviewOnly?: boolean;
  onBack: () => void;
  onComplete: () => void;
  onBuildStrategy?: () => void;
}) {
  return (
    <TaskWorkspaceShell title="Matching Report" onBack={onBack}>
      <div className="flex flex-col items-center gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-2xl">
        <ScoreRing value={MATCHING_REPORT.score} measure="match" size="lg" />
        <Badge variant={admissionBadgeVariant(MATCHING_REPORT.tier)}>{TIER_LABEL[MATCHING_REPORT.tier]}</Badge>
      </div>

      <div className="flex items-start justify-between gap-gb-lg">
        <p className="text-gb-md text-fg-tertiary">{MATCHING_REPORT.summary}</p>
        <ConfidenceBadge level={MATCHING_REPORT.confidence} />
      </div>

      <div className="flex flex-wrap gap-gb-lg">
        <Button
          size="lg"
          onClick={() => {
            onComplete();
            if (!reviewOnly && onBuildStrategy) onBuildStrategy();
            else onBack();
          }}
        >
          {reviewOnly ? 'Back to my plan' : 'Build my strategy →'}
        </Button>
      </div>
    </TaskWorkspaceShell>
  );
}
