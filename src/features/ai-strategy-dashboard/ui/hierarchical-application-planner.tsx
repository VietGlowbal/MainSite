'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  calendarMonthGrid,
  getCalendarMicroSteps,
  getKanbanMicroSteps,
  getPlannerMicroSteps,
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABEL,
  monthLabel,
  PLANNER_VIEWS,
  PLANNER_VIEW_LABEL,
  PLANNER_VIEW_PARAM,
  PROGRESS_STATUS,
  PROGRESS_STATUS_LABEL,
  parsePlannerView,
  plannerMicroStepGuidance,
  shiftMonth,
  toIsoDate,
  type PlannerMicroStep,
  type PlannerReadModel,
  type PlannerView,
} from '../domain';
import { DeadlineControl } from './planner-shared';
import { useApplicationPlanner } from './use-application-planner';
import { useMediaQuery } from './use-media-query';
import { Badge, ICONS, KitIcon, ProgressBar, SearchMark } from '@/shared/ui';
import { useT } from '@/lib/i18n';

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
  const guidance = plannerMicroStepGuidance(microStep.title, microStep.guidance);

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
          <p className="mt-gb-xxs text-gb-xs leading-relaxed text-fg-tertiary">
            {guidance}
          </p>
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
}const MICRO_STEP_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_INDICATORS: Record<PlannerMicroStep['status'], { dot: string }> = {
  not_started: { dot: 'bg-slate-400' },
  in_progress: { dot: 'bg-blue-500' },
  needs_review: { dot: 'bg-amber-500' },
  completed: { dot: 'bg-emerald-500' },
  blocked: { dot: 'bg-rose-500' },
};

/**
 * Canonical Planner — calendar view.
 */
function MicroStepCalendar({
  applicationId,
  planner,
  onDeadline,
}: {
  applicationId: string;
  planner: PlannerReadModel;
  onDeadline: (id: string, deadline: string | null) => Promise<void>;
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)', true);
  const t = useT();
  const [today] = useState(() => new Date());
  const todayIso = toIsoDate(today);
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const allMicroSteps = getPlannerMicroSteps(planner);
  const byDay = new Map<string, typeof allMicroSteps>();
  for (const item of getCalendarMicroSteps(planner)) {
    const existing = byDay.get(item.deadline!);
    if (existing) existing.push(item);
    else byDay.set(item.deadline!, [item]);
  }
  const tray = allMicroSteps.filter((item) => item.deadline === null);
  const activeIso = selectedIso ?? todayIso;
  const weeks = calendarMonthGrid(cursor.year, cursor.month);

  function dropHandlers(target: string | null) {
    return {
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setOverDay(target);
      },
      onDragLeave: () => setOverDay((current) => (current === target ? null : current)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const id = draggingId ?? event.dataTransfer.getData('text/plain');
        setOverDay(null);
        setDraggingId(null);
        if (id) void onDeadline(id, target);
      },
    };
  }

  function selectMonth(delta: number) {
    setCursor((c) => shiftMonth(c.year, c.month, delta));
  }

  const monthHeader = (
    <div className="flex flex-wrap items-center justify-between gap-gb-md pb-gb-sm">
      <h3 className="font-display text-gb-display-xs font-bold text-fg">
        {monthLabel(cursor.year, cursor.month)}
      </h3>
      <div className="inline-flex items-center rounded-gb-xl border border-line bg-surface-muted p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => selectMonth(-1)}
          aria-label="Previous month"
          className="inline-flex size-8 items-center justify-center rounded-gb-lg text-fg-secondary transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowLeft} frame={16} />
        </button>
        <button
          type="button"
          onClick={() => setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })}
          className="rounded-gb-lg px-gb-lg py-gb-xs text-gb-xs font-bold text-fg-secondary transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => selectMonth(1)}
          aria-label="Next month"
          className="inline-flex size-8 items-center justify-center rounded-gb-lg text-fg-secondary transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowRight} frame={16} />
        </button>
      </div>
    </div>
  );

  const unscheduledAside = (
    <aside
      {...dropHandlers(null)}
      className={`flex flex-col gap-gb-md rounded-gb-2xl border p-gb-lg transition-all shadow-gb-xs ${
        overDay === null && draggingId !== null
          ? 'border-brand bg-brand-subtle/40 ring-2 ring-brand/20'
          : 'border-line bg-surface-muted/60'
      }`}
    >
      <div className="flex items-center justify-between pb-gb-xs border-b border-line">
        <h3 className="text-gb-sm font-bold text-fg">Unscheduled</h3>
        <span className="rounded-gb-full bg-surface px-gb-md py-gb-xxs text-gb-xs font-bold text-fg-tertiary border border-line shadow-2xs">
          {tray.length}
        </span>
      </div>
      <div className="flex flex-col gap-gb-sm">
        {tray.map((item) => (
          <div
            key={item.id}
            className="rounded-gb-xl bg-surface border border-line p-gb-md shadow-gb-xs flex flex-col gap-gb-sm hover:border-line-strong hover:shadow-gb-sm transition-all"
          >
            <MicroStepCard
              applicationId={applicationId}
              item={item}
              onDragStart={setDraggingId}
            />
            <div className="pt-gb-xxs border-t border-line/60">
              <DeadlineControl
                deadline={item.deadline}
                label={`Deadline for ${item.title}`}
                onChange={(deadline) => onDeadline(item.id, deadline)}
              />
            </div>
          </div>
        ))}
        {tray.length === 0 ? (
          <p className="rounded-gb-xl border border-dashed border-line bg-surface/50 px-gb-lg py-gb-xl text-center text-gb-xs text-fg-muted">
            {t('Everything has a date.')}
          </p>
        ) : null}
      </div>
    </aside>
  );

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-gb-lg bg-surface-muted/20 p-gb-xl">
        {monthHeader}

        <div className="overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs">
          <div className="grid grid-cols-7 border-b border-line bg-surface-muted/80">
            {MICRO_STEP_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-gb-sm text-center text-[11px] font-bold uppercase tracking-wider text-fg-tertiary"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-gb-xxs p-gb-xs">
            {weeks.flat().map((day) => {
              const tasks = byDay.get(day.iso) ?? [];
              const isSelected = day.iso === activeIso;
              const isToday = day.iso === todayIso;
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedIso(day.iso)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${day.dayOfMonth}, ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
                  className={`flex min-h-[44px] flex-col items-center justify-center rounded-gb-lg border transition-all focus-visible:outline-2 focus-visible:outline-brand ${
                    isSelected
                      ? 'border-brand bg-brand-subtle font-semibold ring-2 ring-brand'
                      : 'border-transparent hover:bg-surface-muted'
                  }`}
                >
                  <span
                    className={`rounded-gb-sm px-gb-xs text-gb-sm font-semibold ${
                      isToday && !isSelected
                        ? 'size-6 rounded-full bg-brand text-white flex items-center justify-center text-xs'
                        : isSelected
                          ? 'text-fg'
                          : day.inMonth
                            ? 'text-fg-secondary'
                            : 'text-fg-muted/60'
                    }`}
                  >
                    {day.dayOfMonth}
                  </span>
                  {tasks.length > 0 ? (
                    <span aria-hidden="true" className="text-[10px] font-bold text-fg-brand">
                      {tasks.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <section className="flex flex-col gap-gb-md" data-microstep-agenda={activeIso}>
          <h3 className="text-gb-sm font-bold text-fg flex items-center gap-gb-xs">
            <KitIcon art={ICONS.calendar} frame={16} className="text-fg-brand" />
            <span>{activeIso}</span>
          </h3>
          {(byDay.get(activeIso) ?? []).map((item) => (
            <MicroStepCard
              key={item.id}
              applicationId={applicationId}
              item={item}
              onDragStart={setDraggingId}
            />
          ))}
          {(byDay.get(activeIso) ?? []).length === 0 ? (
            <p className="rounded-gb-xl border border-dashed border-line bg-surface px-gb-lg py-gb-xl text-center text-gb-xs text-fg-muted">
              {t('No tasks on this day')}
            </p>
          ) : null}
        </section>

        <button
          type="button"
          onClick={() => setTrayOpen((open) => !open)}
          aria-expanded={trayOpen}
          className="inline-flex items-center justify-between rounded-gb-xl border border-line bg-surface px-gb-lg py-gb-md text-gb-sm font-semibold text-fg shadow-2xs transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand"
        >
          {trayOpen
            ? t('Hide unscheduled')
            : t('Show unscheduled ({count})', { count: tray.length })}
        </button>
        {trayOpen ? unscheduledAside : null}
      </div>
    );
  }

  return (
    <div className="bg-surface-muted/20 p-gb-xl">
      <div className="grid gap-gb-2xl xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-gb-lg">
          {monthHeader}

          {allMicroSteps.length === 0 ? (
            <p className="rounded-gb-2xl border border-dashed border-line bg-surface px-gb-xl py-gb-3xl text-center text-gb-sm text-fg-muted">
              {t('This plan has no micro-steps yet.')}
            </p>
          ) : (
            <div className="overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs">
              <div className="grid grid-cols-7 border-b border-line bg-surface-muted/80">
                {MICRO_STEP_WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-gb-md py-gb-sm text-center text-[11px] font-bold uppercase tracking-wider text-fg-tertiary"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {weeks.flat().map((day) => {
                  const tasks = byDay.get(day.iso) ?? [];
                  const isTarget = overDay === day.iso;
                  const isToday = day.iso === todayIso;
                  return (
                    <div
                      key={day.iso}
                      {...dropHandlers(day.iso)}
                      className={`flex min-h-[7.5rem] flex-col gap-gb-xs border-b border-r border-line p-gb-xs transition-all last:border-r-0 ${
                        isTarget
                          ? 'border-brand bg-brand-subtle/50 ring-2 ring-brand/30 ring-inset'
                          : day.inMonth
                            ? 'bg-surface hover:bg-slate-50/40'
                            : 'bg-surface-muted/40'
                      }`}
                    >
                      <span
                        className={`self-start text-xs font-semibold ${
                          isToday
                            ? 'size-6 rounded-full bg-brand text-white flex items-center justify-center shadow-xs'
                            : day.inMonth
                              ? 'text-fg-secondary px-gb-xs py-gb-xxs'
                              : 'text-fg-muted/60 px-gb-xs py-gb-xxs'
                        }`}
                      >
                        {day.dayOfMonth}
                      </span>
                      <div className="flex flex-col gap-1">
                        {tasks.map((item) => (
                          <MicroStepCard
                            key={item.id}
                            applicationId={applicationId}
                            item={item}
                            onDragStart={setDraggingId}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {unscheduledAside}
      </div>
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
  const [overColumn, setOverColumn] = useState<PlannerMicroStep['status'] | null>(null);
  const items = getKanbanMicroSteps(planner);

  return (
    <div className="grid gap-gb-md p-gb-lg md:grid-cols-3 xl:grid-cols-5 bg-surface-muted/20">
      {KANBAN_COLUMNS.map((status) => {
        const columnItems = items.filter((item) => item.status === status);
        const isTarget = overColumn === status;
        const meta = STATUS_INDICATORS[status];

        return (
          <section
            key={status}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOverColumn(status);
            }}
            onDragLeave={() => setOverColumn((curr) => (curr === status ? null : curr))}
            onDrop={(event) => {
              event.preventDefault();
              const id = draggingId ?? event.dataTransfer.getData('text/plain');
              setOverColumn(null);
              setDraggingId(null);
              if (id) void onStatus(id, status);
            }}
            className={`flex min-h-[22rem] flex-col gap-gb-md rounded-gb-2xl border p-gb-md transition-all shadow-2xs ${
              isTarget
                ? 'border-brand bg-brand-subtle/40 ring-2 ring-brand/20'
                : 'border-line bg-surface-muted/60'
            }`}
          >
            <header className="flex items-center justify-between pb-gb-xs border-b border-line">
              <div className="flex items-center gap-gb-xs">
                <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                <h3 className="text-gb-sm font-bold text-fg">
                  {KANBAN_COLUMN_LABEL[status]}
                </h3>
              </div>
              <span className="rounded-gb-full bg-surface px-gb-sm py-gb-xxs text-gb-xs font-bold text-fg-tertiary border border-line shadow-2xs">
                {columnItems.length}
              </span>
            </header>

            <div className="flex flex-col gap-gb-sm flex-1">
              {columnItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-gb-xl bg-surface border border-line p-gb-md shadow-gb-xs flex flex-col gap-gb-xs hover:border-line-strong hover:shadow-gb-sm transition-all"
                >
                  <MicroStepCard
                    applicationId={applicationId}
                    item={item}
                    onDragStart={setDraggingId}
                  />
                  <div className="pt-gb-xxs border-t border-line/60">
                    <StatusSelect microStep={item} onStatus={onStatus} />
                  </div>
                </div>
              ))}
              {columnItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-gb-xl border border-dashed border-line/80 bg-surface/30 p-gb-md text-center text-gb-xs text-fg-muted">
                  Nothing here yet
                </div>
              ) : null}
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
  compact = false,
}: {
  applicationId: string;
  item: ReturnType<typeof getPlannerMicroSteps>[number];
  onDragStart: (id: string) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <article
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', item.id);
          event.dataTransfer.effectAllowed = 'move';
          onDragStart(item.id);
        }}
        className="group cursor-grab rounded-gb-md border border-line bg-surface p-gb-xs shadow-2xs transition-all hover:border-brand/40 hover:shadow-gb-xs active:cursor-grabbing"
      >
        <Link
          href={`/ai-strategy/${applicationId}/planner/tasks/${item.id}`}
          className="block text-[11px] font-bold leading-snug text-fg hover:text-fg-brand line-clamp-2 transition-colors focus-visible:outline-2 focus-visible:outline-brand"
          draggable={false}
        >
          {item.title}
        </Link>
        <p className="mt-0.5 text-[10px] text-fg-tertiary truncate">
          {item.phaseTitle} · {item.stepTitle}
        </p>
        {item.deadline ? (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-fg-brand">
            <span className="size-1.5 rounded-full bg-brand shrink-0" />
            <span>Due {item.deadline}</span>
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', item.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(item.id);
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <Link
        href={`/ai-strategy/${applicationId}/planner/tasks/${item.id}`}
        className="block text-gb-sm font-bold text-fg hover:text-fg-brand hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-brand"
        draggable={false}
      >
        {item.title}
      </Link>
      <p className="mt-gb-xxs text-gb-xs text-fg-tertiary">
        {item.phaseTitle} · {item.stepTitle}
      </p>
      <div className="mt-gb-xs flex flex-wrap items-center gap-gb-xs">
        {item.readiness === 'requires_user_input' ? (
          <Badge variant="brand-subtle" className="text-[11px] py-gb-xxs px-gb-xs">
            Needs your input
          </Badge>
        ) : (
          <Badge variant="neutral" className="text-[11px] py-gb-xxs px-gb-xs">
            Needs enrichment
          </Badge>
        )}
        {item.deadline ? (
          <span className="text-gb-xs font-semibold text-fg-brand ml-auto">
            Due {item.deadline}
          </span>
        ) : null}
      </div>
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
      className="w-full rounded-gb-lg border border-line bg-surface px-gb-md py-gb-xs text-gb-xs font-medium text-fg shadow-2xs hover:border-line-strong focus:border-brand focus:outline-none transition-all cursor-pointer"
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
              [microStep.title, plannerMicroStepGuidance(microStep.title, microStep.guidance), step.title, phase.title]
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
