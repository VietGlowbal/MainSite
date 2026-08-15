'use client';

import { useState } from 'react';
import { Avatar, Badge, Button } from '@/shared/ui';
import { RECOMMENDER, type RecommenderStatus } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

const STATUS_LABEL: Record<RecommenderStatus, string> = {
  not_requested: 'Not requested',
  requested: 'Requested',
  confirmed: 'Confirmed',
};

const STATUS_VARIANT: Record<RecommenderStatus, 'neutral' | 'brand-subtle' | 'safe'> = {
  not_requested: 'neutral',
  requested: 'brand-subtle',
  confirmed: 'safe',
};

/** A recommender-request tracker — not a document editor, this is coordination, not generation. */
export function RecommendationWorkspace({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [status, setStatus] = useState<RecommenderStatus>(RECOMMENDER.status);

  return (
    <TaskWorkspaceShell title="Recommendation pack" onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        Everything your recommender needs to write a strong letter, in one place.
      </p>

      <div className="flex items-center gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-lg">
        <Avatar name={RECOMMENDER.name} size="lg" />
        <div className="flex flex-1 flex-col gap-gb-xxs">
          <p className="text-gb-sm font-semibold text-fg">{RECOMMENDER.name}</p>
          <p className="text-gb-xs text-fg-tertiary">{RECOMMENDER.role}</p>
          <p className="text-gb-xs text-fg-muted">Requested {RECOMMENDER.requestedOn}</p>
        </div>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      <div className="rounded-gb-2xl border border-line bg-brand-subtle p-gb-lg text-gb-sm text-fg-tertiary">
        We&rsquo;ve packaged your reflections, achievements and strategy into a one-page brief so
        {' '}{RECOMMENDER.name.split(' ')[1] ?? RECOMMENDER.name} doesn&rsquo;t start from a blank page.
      </div>

      <div className="flex flex-wrap gap-gb-lg">
        {status !== 'confirmed' ? (
          <Button
            size="lg"
            onClick={() => setStatus(status === 'not_requested' ? 'requested' : 'confirmed')}
          >
            {status === 'not_requested' ? 'Send request' : 'Mark as confirmed'}
          </Button>
        ) : null}
        <Button
          variant={status === 'confirmed' ? 'primary' : 'secondary'}
          size="lg"
          onClick={() => {
            onComplete();
            onBack();
          }}
        >
          Back to my plan
        </Button>
      </div>
    </TaskWorkspaceShell>
  );
}
