import { ScoreRing } from '@/shared/ui';
import type { TaskCounts } from '../domain';

/**
 * Application progress, counted from the checklist.
 *
 * Replaces the sidebar panel that invented its own numbers — it showed
 * "In progress" as the literal `1` and derived "Not started" as
 * `total - completed - 1`, so an application with no checklist rendered
 * "Completed 0/0 · In progress 1 · Not started -1" under a 100% bar.
 *
 * Every figure here comes from `summariseTasks`, and the ring shows the same
 * percentage the counts add up to rather than the `progress_percentage` column,
 * which legacy rows carry as 100 with no tasks behind it.
 */

const LEGEND: Array<{ key: keyof TaskCounts; label: string; dot: string }> = [
  { key: 'completed', label: 'Completed', dot: 'bg-tier-safe' },
  { key: 'inProgress', label: 'In progress', dot: 'bg-tier-recommend' },
  { key: 'notStarted', label: 'Not started', dot: 'bg-line-strong' },
];

export function ChecklistProgress({ counts }: { counts: TaskCounts }) {
  if (counts.total === 0) {
    return (
      <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line p-gb-3xl">
        <h2 className="text-gb-md font-semibold text-fg">Application progress</h2>
        <p className="text-gb-sm text-fg-tertiary">
          Your checklist is built from the official course page. Once it is ready, your progress
          appears here.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-gb-2xl rounded-gb-2xl border border-line p-gb-3xl">
      <h2 className="text-gb-md font-semibold text-fg">Application progress</h2>

      <div className="flex items-center gap-gb-3xl">
        <ScoreRing value={counts.percent} measure="progress" size="sm" showLabel={false} />

        <dl className="flex min-w-0 flex-1 flex-col gap-gb-md">
          {LEGEND.map(({ key, label, dot }) => (
            <div key={key} className="flex items-center justify-between gap-gb-lg">
              <dt className="flex items-center gap-gb-md text-gb-sm text-fg-tertiary">
                <span aria-hidden="true" className={`size-gb-md shrink-0 rounded-gb-full ${dot}`} />
                {label}
              </dt>
              <dd className="text-gb-sm font-semibold tabular-nums text-fg">
                {counts[key]}
                {key === 'completed' ? `/${counts.completed + counts.inProgress + counts.notStarted}` : null}
              </dd>
            </div>
          ))}

          {/* Only shown when it is not zero. A permanent "Parked 0" row invites
              the question "what is parked?" on every application that has none. */}
          {counts.parked > 0 ? (
            <div className="flex items-center justify-between gap-gb-lg border-t border-line pt-gb-md">
              <dt className="text-gb-sm text-fg-muted">Blocked or not applicable</dt>
              <dd className="text-gb-sm font-semibold tabular-nums text-fg-muted">
                {counts.parked}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
