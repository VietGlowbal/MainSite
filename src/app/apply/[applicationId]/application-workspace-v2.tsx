'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationWorkspaceView, ApplicationTask } from '@/lib/apply-types';
import { StagePanel } from '@/components/apply/StagePanel';
import { StatementFeedbackModal } from '@/components/statement/StatementFeedbackModal';
import { isStatementTask } from '@/components/statement/is-statement-task';
import { MatchInsightsPanel } from '@/components/apply/match-insights/MatchInsightsPanel';
import {
  ApplicationBanner,
  ApplicationJourney,
  ChecklistProgress,
  JourneyPending,
} from '@/features/apply/ui';
import {
  activeStageIndex as computeActiveIndex,
  displayCourseName,
  isParsePending,
  summariseTasks,
} from '@/features/apply/domain';
import { useParseRefresh } from '@/features/apply/hooks';
import { Button, Container, KitIcon, ICONS } from '@/shared/ui';

/**
 * The course workspace — Figma "Lập kế hoạch du học", the per-course screen.
 *
 * WHAT CHANGED FROM THE BUILD THIS REPLACES, and why:
 *
 *  1. THE NUMBERS ARE COUNTED, NOT ASSERTED. The sidebar hardcoded "In progress"
 *     as the literal 1 and derived "Not started" as total - completed - 1, so a
 *     live application rendered "Completed 0/0 · In progress 1 · Not started -1"
 *     under a 100% bar. Everything now comes from summariseTasks, and the
 *     percentage is the checklist's, not the `progress_percentage` column —
 *     legacy rows carry 100 there with no tasks behind it.
 *
 *  2. THE JOURNEY IS THE SHARED STEPPER. JourneyPipeline was a scrolling row of
 *     cards with its own status colours and a "View full timeline" button wired
 *     to nothing. The workspace and the AI strategy journey now draw the same
 *     component rather than two lookalikes that drift.
 *
 *  3. NO CHECKLIST IS A REAL STATE. Until the parse worker has read the course
 *     page there are no stages, which is the common case on live data — the
 *     previous build rendered it as an empty journey under a full progress bar.
 *
 *  4. THE HEADER LOSES ITS PILLS AND KEBAB. "On track" was a static string, not
 *     a computed state, and the kebab opened nothing.
 *
 * WHAT IS DELIBERATELY NOT HERE YET. The frame also draws the analysis blocks —
 * persona alignment, admission requirements, costs, profile gaps. Those are the
 * output of the university match pipeline, which does not exist yet; drawing
 * them now would mean shipping empty headings. MatchInsightsPanel stays as the
 * existing five-pillar view until that lands.
 */

type MatchInputs = { cv: boolean; essay: boolean; academic: boolean };

type Props = {
  workspace: ApplicationWorkspaceView;
  isPlus?: boolean;
  matchInputs?: MatchInputs;
  logoUrl?: string | null;
};

export function ApplicationWorkspaceV2({
  workspace,
  isPlus = false,
  matchInputs = { cv: false, essay: false, academic: false },
  logoUrl = null,
}: Props) {
  const router = useRouter();
  const { application, stages, sources } = workspace;

  const counts = useMemo(() => summariseTasks(stages), [stages]);
  const defaultIndex = useMemo(() => computeActiveIndex(stages), [stages]);

  /* The row exists the moment a URL is pasted; the checklist arrives a minute
     later. Without this the student sits on "we're reading the course page"
     until they reload — the exact bug the applications list already fixed. */
  useParseRefresh(isParsePending(application.parseStatus));

  const courseName = displayCourseName(application.courseName, application.parseStatus);

  const [activeStageId, setActiveStageId] = useState<string | undefined>(
    () => (defaultIndex >= 0 ? stages[defaultIndex]?.id : undefined),
  );

  const activeIndex = stages.findIndex((s) => s.id === activeStageId);
  const activeStage = activeIndex >= 0 ? stages[activeIndex] : undefined;

  const [statementModalOpen, setStatementModalOpen] = useState(false);

  const handleTaskToggle = async (taskId: string, newStatus: 'completed' | 'not_started') => {
    try {
      const response = await fetch(`/api/applications/${application.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      // router.refresh() rather than window.location.reload(): a full reload
      // throws away scroll position and re-runs every client component on the
      // page to reflect one checkbox.
      if (response.ok) router.refresh();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleTaskAction = (task: ApplicationTask) => {
    if (isStatementTask(task)) {
      setStatementModalOpen(true);
      return;
    }
    if (!task.actionType || !task.actionTarget) return;

    switch (task.actionType) {
      case 'external_url':
        window.open(task.actionTarget, '_blank', 'noopener,noreferrer');
        break;
      case 'internal_route':
        router.push(task.actionTarget);
        break;
      case 'book_mentor':
        router.push('/mentors');
        break;
      default:
        // upload_document and recalculate_match have no handler yet. Silently
        // doing nothing is better than the console.log this replaces, which
        // told the student nothing and the developer nothing useful either.
        break;
    }
  };

  const improvementTasks = stages
    .flatMap((s) => s.tasks ?? [])
    .filter((t) => t.taskType === 'improvement')
    .map((t) => ({ pillar: t.pillar, estimatedUplift: t.estimatedUplift, status: t.status }));

  const hasChecklist = stages.length > 0;

  return (
    <Container className="flex flex-col gap-gb-5xl py-gb-5xl">
      <ApplicationBanner
        universityName={application.universityName}
        {...(courseName ? { courseName } : {})}
        logoUrl={logoUrl}
      />

      <div className="grid gap-gb-5xl xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-gb-5xl">
          {hasChecklist ? (
            <ApplicationJourney
              stages={stages}
              activeIndex={activeIndex >= 0 ? activeIndex : 0}
              onSelectStage={setActiveStageId}
            />
          ) : (
            <JourneyPending
              {...(application.parseStatus ? { parseStatus: application.parseStatus } : {})}
              {...(application.parseError ? { parseError: application.parseError } : {})}
            />
          )}

          {activeStage ? (
            <StagePanel
              stage={activeStage}
              stageNumber={activeIndex + 1}
              totalStages={stages.length}
              onTaskToggle={handleTaskToggle}
              onTaskAction={handleTaskAction}
              onStatementFeedback={() => setStatementModalOpen(true)}
            />
          ) : null}

          <MatchInsightsPanel
            applicationId={application.id}
            analysis={workspace.matchAnalysis}
            isPlus={isPlus}
            improvementTasks={improvementTasks}
            inputs={matchInputs}
          />
        </div>

        <aside className="flex flex-col gap-gb-3xl">
          <ChecklistProgress counts={counts} />

          {application.courseUrl ? (
            <a
              href={application.courseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-gb-md rounded-gb-2xl border border-line p-gb-3xl text-gb-sm font-semibold text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              View the official course page
              <KitIcon art={ICONS.arrowUpRight} frame={20} className="shrink-0 text-fg-tertiary" />
            </a>
          ) : null}

          {/* Figma: the "Ready to study at ..." card. The CTA is the AI strategy
              journey; it is a plain link until that route exists. */}
          <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface-muted p-gb-3xl">
            <h2 className="text-gb-md font-semibold text-fg">
              Ready to strengthen this application?
            </h2>
            <p className="text-gb-sm text-fg-tertiary">
              Build your strategy with GlowBal&rsquo;s AI and see how well you match this course.
            </p>
            <Button href="/ai-strategy" size="lg" className="w-full">
              Continue
            </Button>
          </section>

          {sources.length > 0 ? (
            <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line p-gb-3xl">
              <h2 className="text-gb-md font-semibold text-fg">Official links</h2>
              <ul className="flex flex-col gap-gb-md">
                {sources.slice(0, 5).map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gb-sm text-fg-tertiary underline decoration-line-strong underline-offset-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {statementModalOpen ? (
        <StatementFeedbackModal
          applicationId={application.id}
          /* Course first, then university — the same order the banner reads in.
             Falls back to the university alone on an application whose course
             page has not been parsed yet, rather than printing "undefined ·". */
          targetName={
            courseName ? `${courseName} · ${application.universityName}` : application.universityName
          }
          contextNote={workspace.course?.entryRequirementsSummary ?? application.aiSummary}
          onClose={() => setStatementModalOpen(false)}
        />
      ) : null}
    </Container>
  );
}
