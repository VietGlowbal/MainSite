'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  getCalendarMicroSteps,
  getKanbanMicroSteps,
  getPlannerMicroSteps,
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABEL,
  PLANNER_VIEWS,
  PLANNER_VIEW_LABEL,
  PLANNER_VIEW_PARAM,
  PROGRESS_STATUS,
  PROGRESS_STATUS_LABEL,
  parsePlannerView,
  type PlannerMicroStep,
  type PlannerReadModel,
  type PlannerView,
} from '../domain';
import { DeadlineControl } from './planner-shared';
import { useApplicationPlanner } from './use-application-planner';
import { Badge, ICONS, KitIcon, ProgressBar, SearchMark } from '@/shared/ui';

export function HierarchicalApplicationPlanner({
  applicationId,
  planner,
}: {
  applicationId: string;
  planner: PlannerReadModel;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<PlannerView>(() =>
    parsePlannerView(searchParams?.get(PLANNER_VIEW_PARAM)),
  );
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PlannerMicroStep['status'] | 'all'>('all');
  const controller = useApplicationPlanner(applicationId, planner);
  const visible = useMemo(
    () => filterPlanner(controller.planner, query, view === 'kanban' ? 'all' : status),
    [controller.planner, query, status, view],
  );

  function selectView(next: PlannerView) {
    setView(next);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === 'list') params.delete(PLANNER_VIEW_PARAM);
    else params.set(PLANNER_VIEW_PARAM, next);
    const query = params.toString();
    const currentPath = pathname ?? `/ai-strategy/${applicationId}/planner`;
    window.history.replaceState(null, '', query ? `${currentPath}?${query}` : currentPath);
  }

  const visibleCount = getPlannerMicroSteps(visible).length;

  if (controller.planner.lifecycle === 'complete') {
    return (
      <section className="rounded-gb-2xl border border-line bg-surface p-gb-3xl text-center shadow-gb-xs">
        <h2 className="font-display text-gb-display-xs font-semibold text-fg">
          Application Planner
        </h2>
        <p className="mt-gb-md text-gb-sm text-fg-muted">
          You&apos;ve completed the current plan. We&apos;ll update it if your application information changes.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-gb-xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-md">
        <h2 className="font-display text-gb-display-xs font-semibold text-fg">
          Application Planner
        </h2>
        <div
          role="tablist"
          aria-label="Planner view"
          className="inline-flex rounded-gb-xl border border-line bg-surface-muted p-1"
        >
          {PLANNER_VIEWS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={view === candidate}
              onClick={() => selectView(candidate)}
              className={`rounded-gb-lg px-gb-xl py-gb-sm text-gb-sm font-semibold transition-all ${
                view === candidate
                  ? 'bg-surface text-fg shadow-gb-xs'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {PLANNER_VIEW_LABEL[candidate]}
            </button>
          ))}
        </div>
      </div>

      {controller.error ? (
        <div
          role="alert"
          className="rounded-gb-lg border border-line-error bg-surface-error p-gb-md text-gb-sm text-fg-error"
        >
          {controller.error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs">
        <div className="flex flex-wrap items-center justify-between gap-gb-md border-b border-line bg-surface px-gb-xl py-gb-lg">
          <div className="flex flex-1 flex-wrap items-center gap-gb-md min-w-[14rem]">
            <div className="relative flex-1 min-w-[14rem] max-w-md">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
                <SearchMark frame={16} />
              </span>
              <input
                aria-label="Search tasks"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks"
                className="w-full rounded-gb-lg border border-line bg-surface pl-9 pr-gb-md py-gb-sm text-gb-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              />
            </div>
            {view !== 'kanban' ? (
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as PlannerMicroStep['status'] | 'all')
                }
                className="rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-sm text-gb-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              >
                <option value="all">All statuses</option>
                {PROGRESS_STATUS.map((item) => (
                  <option key={item} value={item}>
                    {PROGRESS_STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center rounded-gb-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-muted border border-line">
              {visibleCount} task{visibleCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {view === 'list' ? (
          <HierarchyList
            applicationId={applicationId}
            planner={visible}
            onStatus={controller.updateMicroStepStatus}
            onDeadline={controller.updateMicroStepDeadline}
          />
        ) : null}
        {view === 'calendar' ? (
          <MicroStepCalendar
            applicationId={applicationId}
            planner={visible}
            onDeadline={controller.updateMicroStepDeadline}
          />
        ) : null}
        {view === 'kanban' ? (
          <MicroStepBoard
            applicationId={applicationId}
            planner={visible}
            onStatus={controller.updateMicroStepStatus}
          />
        ) : null}
      </div>
    </section>
  );
}

function HierarchyList({
  applicationId,
  planner,
  onStatus,
  onDeadline,
}: {
  applicationId: string;
  planner: PlannerReadModel;
  onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void>;
  onDeadline: (id: string, deadline: string | null) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (planner.phases.length === 0) {
    return (
      <p className="p-gb-6xl text-center text-gb-sm text-fg-tertiary">
        No tasks match those filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-gb-xl p-gb-lg sm:p-gb-xl bg-surface-muted/30">
      {planner.phases.map((phase) => (
        <section
          key={phase.id}
          className="overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs transition-all"
        >
          <button
            type="button"
            onClick={() => toggle(phase.id)}
            className="flex w-full items-center justify-between gap-gb-md p-gb-xl text-left hover:bg-surface-muted/50 transition-colors"
          >
            <div className="flex items-center gap-gb-md min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-gb-md bg-surface-muted text-fg-secondary border border-line transition-transform duration-200 ${
                  collapsed.has(phase.id) ? '-rotate-90' : 'rotate-0'
                }`}
                aria-hidden="true"
              >
                <KitIcon art={ICONS.chevronDown} frame={14} />
              </span>
              <div className="min-w-0">
                <span className="block text-gb-base font-bold text-fg truncate">
                  {phase.title}
                </span>
                <span className="text-gb-xs text-fg-tertiary">
                  {phase.progress.completed} / {phase.progress.total} complete · {phase.progress.percentage}%
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-gb-md shrink-0">
              <div className="w-24">
                <ProgressBar
                  value={phase.progress.percentage}
                  size="sm"
                  label={`Progress for ${phase.title}`}
                />
              </div>
            </div>
          </button>

          {!collapsed.has(phase.id) ? (
            <div className="border-t border-line divide-y divide-line">
              {phase.steps.map((step) => (
                <div key={step.id} className="divide-y divide-line">
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    className="flex w-full items-center justify-between gap-gb-md bg-surface-muted/50 px-gb-xl py-gb-md text-left hover:bg-surface-muted transition-colors"
                  >
                    <div className="flex items-center gap-gb-sm min-w-0">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-gb-sm text-fg-tertiary transition-transform duration-200 ${
                          collapsed.has(step.id) ? '-rotate-90' : 'rotate-0'
                        }`}
                        aria-hidden="true"
                      >
                        <KitIcon art={ICONS.chevronDown} frame={12} />
                      </span>
                      <span className="text-gb-sm font-semibold text-fg truncate">
                        {step.title}
                      </span>
                    </div>
                    <span className="rounded-gb-full bg-surface px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-tertiary border border-line shrink-0">
                      {step.progress.completed} / {step.progress.total}
                    </span>
                  </button>

                  {!collapsed.has(step.id) ? (
                    <div className="divide-y divide-line bg-surface">
                      {step.microSteps.map((microStep) => (
                        <MicroStepRow
                          key={microStep.id}
                          applicationId={applicationId}
                          microStep={microStep}
                          onStatus={onStatus}
                          onDeadline={onDeadline}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function MicroStepRow({
  applicationId,
  microStep,
  onStatus,
  onDeadline,
}: {
  applicationId: string;
  microStep: PlannerMicroStep;
  onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void>;
  onDeadline: (id: string, deadline: string | null) => Promise<void>;
}) {
  const isCompleted = microStep.status === 'completed';

  return (
    <article className="flex flex-col gap-gb-md px-gb-xl py-gb-lg transition-colors hover:bg-surface-muted/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-gb-md min-w-0 flex-1">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-gb-full border-2 transition-colors ${
            isCompleted
              ? 'border-tier-safe bg-tier-safe text-on-tier-safe'
              : 'border-line-strong bg-surface'
          }`}
        >
          {isCompleted ? (
            <span className="text-[10px] leading-none font-bold">✓</span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <Link
            href={`/ai-strategy/${applicationId}/planner/tasks/${microStep.id}`}
            className="text-gb-sm font-semibold text-fg hover:text-fg-brand hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-brand"
          >
            {microStep.title}
          </Link>
          <div className="mt-gb-xxs flex items-center gap-gb-xs">
            {microStep.readiness === 'requires_user_input' ? (
              <Badge variant="brand-subtle" className="text-gb-xs py-gb-xxs px-gb-sm">
                Needs your input
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-gb-xs py-gb-xxs px-gb-sm">
                Needs enrichment
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-gb-sm shrink-0 sm:pl-gb-md">
        <StatusSelect microStep={microStep} onStatus={onStatus} />
        <DeadlineControl
          deadline={microStep.deadline}
          label={`Deadline for ${microStep.title}`}
          onChange={(deadline) => onDeadline(microStep.id, deadline)}
        />
      </div>
    </article>
  );
}

function MicroStepCalendar({
  applicationId,
  planner,
  onDeadline,
}: {
  applicationId: string;
  planner: PlannerReadModel;
  onDeadline: (id: string, deadline: string | null) => Promise<void>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const tasks = getCalendarMicroSteps(planner);
  const groups = new Map<string, typeof tasks>();
  for (const task of tasks)
    groups.set(task.deadline!, [...(groups.get(task.deadline!) ?? []), task]);

  return (
    <div className="grid gap-gb-lg p-gb-xl lg:grid-cols-[1fr_20rem] bg-surface-muted/20">
      <div className="flex flex-col gap-gb-lg">
        {[...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, items]) => (
            <section
              key={date}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => draggingId && void onDeadline(draggingId, date)}
              className="rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs transition-all"
            >
              <h3 className="mb-gb-md text-gb-sm font-bold text-fg flex items-center gap-gb-xs">
                <KitIcon art={ICONS.calendar} frame={16} className="text-fg-brand" />
                <span>{date}</span>
              </h3>
              <div className="flex flex-col gap-gb-sm">
                {items.map((item) => (
                  <MicroStepCard
                    key={item.id}
                    applicationId={applicationId}
                    item={item}
                    onDragStart={setDraggingId}
                  />
                ))}
              </div>
            </section>
          ))}
      </div>
      <aside
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => draggingId && void onDeadline(draggingId, null)}
        className="flex flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface-muted p-gb-lg"
      >
        <div className="flex items-center justify-between pb-gb-xs border-b border-line">
          <h3 className="text-gb-sm font-bold text-fg">Unscheduled</h3>
          <span className="rounded-gb-full bg-surface px-gb-sm py-gb-xxs text-gb-xs font-semibold text-fg-tertiary border border-line">
            {getPlannerMicroSteps(planner).filter((item) => item.deadline === null).length}
          </span>
        </div>
        <div className="flex flex-col gap-gb-sm">
          {getPlannerMicroSteps(planner)
            .filter((item) => item.deadline === null)
            .map((item) => (
              <div
                key={item.id}
                className="rounded-gb-xl bg-surface border border-line p-gb-md shadow-gb-xs flex flex-col gap-gb-xs"
              >
                <MicroStepCard
                  applicationId={applicationId}
                  item={item}
                  onDragStart={setDraggingId}
                />
                <DeadlineControl
                  deadline={item.deadline}
                  label={`Deadline for ${item.title}`}
                  onChange={(deadline) => onDeadline(item.id, deadline)}
                />
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
}

function MicroStepBoard({
  applicationId,
  planner,
  onStatus,
}: {
  applicationId: string;
  planner: PlannerReadModel;
  onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const items = getKanbanMicroSteps(planner);

  return (
    <div className="grid gap-gb-md p-gb-lg md:grid-cols-3 xl:grid-cols-5 bg-surface-muted/20">
      {KANBAN_COLUMNS.map((status) => {
        const columnItems = items.filter((item) => item.status === status);
        return (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => draggingId && void onStatus(draggingId, status)}
            className="flex min-h-[18rem] flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface-muted p-gb-md"
          >
            <header className="flex items-center justify-between pb-gb-xs border-b border-line">
              <h3 className="text-gb-sm font-bold text-fg">
                {KANBAN_COLUMN_LABEL[status]}
              </h3>
              <span className="rounded-gb-full bg-surface px-gb-sm py-gb-xxs text-gb-xs font-semibold text-fg-tertiary border border-line">
                {columnItems.length}
              </span>
            </header>
            <div className="flex flex-col gap-gb-sm">
              {columnItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-gb-xl bg-surface border border-line p-gb-md shadow-gb-xs flex flex-col gap-gb-xs"
                >
                  <MicroStepCard
                    applicationId={applicationId}
                    item={item}
                    onDragStart={setDraggingId}
                  />
                  <StatusSelect microStep={item} onStatus={onStatus} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MicroStepCard({
  applicationId,
  item,
  onDragStart,
}: {
  applicationId: string;
  item: ReturnType<typeof getPlannerMicroSteps>[number];
  onDragStart: (id: string) => void;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', item.id);
        onDragStart(item.id);
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <Link
        href={`/ai-strategy/${applicationId}/planner/tasks/${item.id}`}
        className="block text-gb-sm font-semibold text-fg hover:text-fg-brand hover:underline transition-colors"
      >
        {item.title}
      </Link>
      <p className="mt-gb-xxs text-gb-xs text-fg-tertiary">
        {item.phaseTitle} · {item.stepTitle}
      </p>
      {item.deadline ? (
        <p className="mt-gb-xs text-gb-xs font-medium text-fg-brand">
          Due {item.deadline}
        </p>
      ) : null}
    </article>
  );
}

function StatusSelect({
  microStep,
  onStatus,
}: {
  microStep: PlannerMicroStep;
  onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void>;
}) {
  return (
    <select
      aria-label={`Status for ${microStep.title}`}
      value={microStep.status}
      onChange={(event) =>
        void onStatus(microStep.id, event.target.value as PlannerMicroStep['status'])
      }
      className="rounded-gb-md border border-line bg-surface px-gb-md py-gb-xs text-gb-xs font-medium text-fg shadow-gb-xs hover:border-line-strong focus:border-brand focus:outline-none transition-all"
    >
      {PROGRESS_STATUS.map((status) => (
        <option key={status} value={status}>
          {PROGRESS_STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  );
}

function filterPlanner(
  model: PlannerReadModel,
  query: string,
  status: PlannerMicroStep['status'] | 'all',
): PlannerReadModel {
  const needle = query.trim().toLowerCase();
  const phases = model.phases
    .map((phase) => ({
      ...phase,
      steps: phase.steps
        .map((step) => ({
          ...step,
          microSteps: step.microSteps.filter(
            (microStep) =>
              (status === 'all' || microStep.status === status) &&
              [microStep.title, step.title, phase.title]
                .join(' ')
                .toLowerCase()
                .includes(needle),
          ),
        }))
        .filter((step) => step.microSteps.length > 0),
    }))
    .filter((phase) => phase.steps.length > 0);
  return { ...model, phases };
}
