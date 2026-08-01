import type { Recommendation } from '../domain';
import { nextPriority } from '../domain';
import { Panel, ProgressBar, ScoreRing } from '@/shared/ui';

/** Top Summary — requirements.md Requirement 9.1. */
export function DashboardSummary({
  universityName,
  courseName,
  currentMatchPercent,
  goalMatchPercent,
  completionPercent,
  recommendations,
}: {
  universityName: string;
  courseName: string;
  currentMatchPercent: number;
  goalMatchPercent: number;
  completionPercent: number;
  recommendations: readonly Recommendation[];
}) {
  const next = nextPriority(recommendations);

  return (
    <Panel className="flex flex-col gap-gb-3xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-sm text-fg-tertiary">University</p>
        <p className="text-gb-lg font-semibold text-fg">{universityName}</p>
        <p className="mt-gb-md text-gb-sm text-fg-tertiary">Course</p>
        <p className="text-gb-lg font-semibold text-fg">{courseName}</p>
      </div>

      <div className="flex items-center gap-gb-4xl">
        <ScoreRing value={currentMatchPercent} measure="match" label="Current Match" />
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-sm text-fg-tertiary">Goal</p>
          <p className="text-gb-xl font-semibold text-fg">{goalMatchPercent}%</p>
        </div>
      </div>

      <div className="flex min-w-[200px] flex-col gap-gb-md">
        <ProgressBar value={completionPercent} label="Overall Progress" />
        <p className="text-gb-sm text-fg-tertiary">{completionPercent}% complete</p>
        {next ? (
          <div className="flex flex-col gap-gb-xxs">
            <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
              Next Priority
            </p>
            <p className="text-gb-sm font-medium text-fg">{next.title}</p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
