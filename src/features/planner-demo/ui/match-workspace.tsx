'use client';

import { admissionBadgeVariant, Badge, Button, ScoreRing } from '@/shared/ui';
import { MATCH_RESULT } from '../domain';
import { ConfidenceBadge } from './confidence-badge';
import { TaskWorkspaceShell } from './task-workspace-shell';

const TIER_LABEL: Record<typeof MATCH_RESULT.tier, string> = {
  reach: 'Reach',
  recommended: 'Recommend',
  safe: 'Safe',
};

export function MatchWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <TaskWorkspaceShell title="Your Cambridge match" onClose={onClose}>
      <div className="flex flex-col items-center gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-2xl">
        <ScoreRing value={MATCH_RESULT.score} measure="match" size="lg" />
        <Badge variant={admissionBadgeVariant(MATCH_RESULT.tier)}>{TIER_LABEL[MATCH_RESULT.tier]}</Badge>
      </div>

      <div className="flex items-start justify-between gap-gb-lg">
        <p className="text-gb-md text-fg-tertiary">{MATCH_RESULT.summary}</p>
        <ConfidenceBadge level={MATCH_RESULT.confidence} />
      </div>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onClose();
        }}
        className="mb-gb-2xl"
      >
        Back to my plan
      </Button>
    </TaskWorkspaceShell>
  );
}
