import type { Recommendation } from '../domain';
import { completionPercent as computeCompletionPercent, nextPriority, taskCounts } from '../domain';
// `formatDate` must come from `planner-presentation` (a plain module), not
// from `planner-shared` (`'use client'`) — this file is a server component,
// and calling a client module's export from one throws at render. `IconCircle`
// is fine to import from there: it is a component, so it renders as a Client
// Component rather than being called. See `docs/known-issues.md §5l`.
import { formatDate } from './planner-presentation';
import { IconCircle } from './planner-shared';
import { ICONS, KitIcon, Panel, ProgressBar, ScoreRing } from '@/shared/ui';

/**
 * The Planner's hero card — university photo, course/location, and four
 * stat blocks (Profile Match, Application Progress, Next Priority, Final
 * Deadline). Rebuilt from the reference screenshot; see docs/README.md for
 * the accepted deviations (country-only location, no purple token).
 */
export function DashboardSummary({
  universityName,
  courseName,
  imageUrl,
  location,
  currentMatchPercent,
  deadline,
  recommendations,
  canonicalProgress,
}: {
  universityName: string;
  courseName: string;
  /** The university's hero photo. Null for a manually-pasted application with no linked university. */
  imageUrl: string | null;
  /** Country only — no city-level field exists on `universities`. Null when there's no linked university. */
  location: string | null;
  currentMatchPercent: number;
  /** `course_applications.deadline`, an ISO date string, or null when unset. */
  deadline: string | null;
  recommendations?: readonly Recommendation[];
  /** Canonical hierarchy progress. When supplied, legacy recommendations are ignored. */
  canonicalProgress?: { completed: number; total: number; percentage: number; nextTitle: string | null } | null;
}) {
  const isCanonical = canonicalProgress !== undefined;
  const next = isCanonical ? null : nextPriority(recommendations ?? []);
  const legacyCounts = isCanonical ? null : taskCounts(recommendations ?? []);
  const completed = canonicalProgress?.completed ?? legacyCounts?.completed ?? 0;
  const total = canonicalProgress?.total ?? legacyCounts?.total ?? 0;
  const percentDone = canonicalProgress?.percentage ?? (isCanonical ? 0 : computeCompletionPercent(recommendations ?? []));
  const nextTitle = isCanonical
    ? canonicalProgress === null ? 'Not available' : (canonicalProgress?.nextTitle ?? 'All caught up')
    : (next?.title ?? 'All caught up');

  return (
    <Panel className="flex flex-col gap-gb-3xl lg:flex-row lg:items-center p-gb-2xl sm:p-gb-3xl shadow-gb-xs">
      <div className="flex flex-col gap-gb-2xl sm:flex-row lg:w-2/5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unregistered university photo hosts; next/image's domain allowlist isn't worth it for a best-effort hero image.
          <img
            src={imageUrl}
            alt=""
            className="h-40 w-full shrink-0 rounded-gb-2xl object-cover shadow-2xs sm:w-52"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-40 w-full shrink-0 items-center justify-center rounded-gb-2xl bg-surface-muted sm:w-52"
          >
            <KitIcon art={ICONS.graduationCap} frame={40} className="text-fg-muted" />
          </div>
        )}

        <div className="flex flex-col justify-center gap-gb-xs">
          <p className="text-gb-xs font-medium uppercase tracking-wide text-fg-tertiary">University</p>
          <p className="text-gb-lg font-bold text-fg">{universityName}</p>
          <p className="mt-gb-sm text-gb-xs font-medium uppercase tracking-wide text-fg-tertiary">Course</p>
          <p className="text-gb-base font-semibold text-fg">{courseName}</p>
          {location ? (
            <div className="mt-gb-xs flex items-center gap-gb-xs text-gb-sm text-fg-tertiary">
              <KitIcon art={ICONS.markerPin02} frame={16} className="shrink-0" />
              <span>{location}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grow grid-cols-2 gap-gb-2xl lg:grid-cols-4 lg:border-l lg:border-line lg:pl-gb-3xl">
        <div className="flex flex-col items-center justify-center gap-gb-xs text-center">
          <ScoreRing value={currentMatchPercent} measure="match" label="Profile Match" />
        </div>

        <div className="flex flex-col justify-center gap-gb-md">
          <p className="text-gb-xs font-medium uppercase tracking-wide text-fg-tertiary">Application Progress</p>
          <ProgressBar value={percentDone} label="Application progress" />
          <p className="text-gb-xs text-fg-tertiary">
            {isCanonical && canonicalProgress === null ? 'Not available' : `${percentDone}% complete · ${completed} of ${total} tasks completed`}
          </p>
        </div>

        <div className="flex items-center gap-gb-md">
          <IconCircle icon={ICONS.edit02} tone="brand" />
          <div className="flex flex-col gap-gb-xxs min-w-0">
            <p className="text-gb-xs font-medium uppercase tracking-wide text-fg-tertiary">Next Priority</p>
            <p className="text-gb-sm font-semibold text-fg truncate">{nextTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-gb-md">
          <IconCircle icon={ICONS.calendar} tone="brand" />
          <div className="flex flex-col gap-gb-xxs min-w-0">
            <p className="text-gb-xs font-medium uppercase tracking-wide text-fg-tertiary">Final Deadline</p>
            <p className="text-gb-sm font-semibold text-fg">
              {deadline ? formatDate(deadline) : 'Not set'}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
