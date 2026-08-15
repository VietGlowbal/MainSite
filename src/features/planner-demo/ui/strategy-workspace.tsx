'use client';

import { Badge, Button } from '@/shared/ui';
import {
  SCHOLARSHIP_MATCHES,
  STRATEGY_GAPS,
  STRATEGY_POSITIONING,
  STRATEGY_PRIORITIES,
  STRATEGY_STRENGTHS,
} from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

/**
 * Strategy is not just a report — spec §13: it visibly produces tasks for
 * Phase 3/4/5. The callout at the bottom says so explicitly rather than
 * leaving it implicit, since that's the one thing a viewer can't infer just
 * from the priorities list.
 */
export function StrategyWorkspace({
  choosingPriorities,
  onBack,
  onComplete,
}: {
  /** True for the "Choose your priorities" task — same workspace, earlier framing. */
  choosingPriorities?: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <TaskWorkspaceShell title={choosingPriorities ? 'Choose your priorities' : 'Cambridge Strategy'} onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        {choosingPriorities
          ? 'Before we generate your strategy — which of these matter most to you?'
          : 'We turned your reports into a focused strategy that maximises your impact.'}
      </p>

      <ol className="flex flex-col gap-gb-lg">
        {STRATEGY_PRIORITIES.map((priority, i) => (
          <li
            key={priority.title}
            className="flex gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-lg"
          >
            <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-brand text-gb-xs font-semibold text-on-brand">
              {i + 1}
            </span>
            <div className="flex flex-col gap-gb-xxs">
              <span className="text-gb-sm font-semibold text-fg">
                {priority.icon} {priority.title}
              </span>
              <span className="text-gb-sm text-fg-tertiary">{priority.detail}</span>
            </div>
          </li>
        ))}
      </ol>

      {!choosingPriorities ? (
        <>
          <div className="rounded-gb-2xl border border-line bg-brand-subtle p-gb-lg">
            <p className="mb-gb-sm text-gb-xs font-semibold text-fg-brand">Recommended positioning statement</p>
            <p className="text-gb-sm italic text-fg">“{STRATEGY_POSITIONING}”</p>
          </div>

          <div className="grid grid-cols-1 gap-gb-lg sm:grid-cols-2">
            <div className="rounded-gb-2xl border border-line bg-surface p-gb-lg">
              <p className="mb-gb-md text-gb-xs font-semibold text-fg">Your key strengths</p>
              <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
                {STRATEGY_STRENGTHS.map((s) => (
                  <li key={s}>✓ {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-gb-2xl border border-line bg-surface p-gb-lg">
              <p className="mb-gb-md text-gb-xs font-semibold text-fg">Gaps to address</p>
              <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
                {STRATEGY_GAPS.map((g) => (
                  <li key={g}>○ {g}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-gb-2xl border border-line bg-surface p-gb-lg">
            <div className="mb-gb-sm flex items-center justify-between gap-gb-md">
              <p className="text-gb-xs font-semibold text-fg">Scholarship opportunity</p>
              <Badge variant="brand-subtle">Top match</Badge>
            </div>
            <p className="text-gb-sm font-semibold text-fg">{SCHOLARSHIP_MATCHES[0]?.name}</p>
            <p className="text-gb-sm text-fg-tertiary">{SCHOLARSHIP_MATCHES[0]?.note}</p>
          </div>

          <p className="text-gb-xs text-fg-muted">
            ✨ This strategy just added tasks to Phase 3 and Phase 4 of your plan.
          </p>
        </>
      ) : null}

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onBack();
        }}
        className="mb-gb-2xl"
      >
        {choosingPriorities ? 'Continue →' : 'Continue to next task →'}
      </Button>
    </TaskWorkspaceShell>
  );
}
