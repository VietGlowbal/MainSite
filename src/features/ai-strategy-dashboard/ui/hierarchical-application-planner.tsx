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

export function HierarchicalApplicationPlanner({ applicationId, planner }: { applicationId: string; planner: PlannerReadModel }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<PlannerView>(() => parsePlannerView(searchParams?.get(PLANNER_VIEW_PARAM)));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PlannerMicroStep['status'] | 'all'>('all');
  const controller = useApplicationPlanner(applicationId, planner);
  const visible = useMemo(() => filterPlanner(controller.planner, query, view === 'kanban' ? 'all' : status), [controller.planner, query, status, view]);

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
  if (controller.planner.lifecycle === 'complete') return <section className="rounded-gb-2xl border border-line bg-surface p-gb-3xl text-center"><h2 className="font-display text-gb-display-xs font-semibold text-fg">Application Planner</h2><p className="mt-gb-md text-gb-sm text-fg-muted">You&apos;ve completed the current plan. We&apos;ll update it if your application information changes.</p></section>;
  return (
    <section className="flex flex-col gap-gb-xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-lg">
        <h2 className="font-display text-gb-display-xs font-semibold text-fg">Application Planner</h2>
        <div role="tablist" aria-label="Planner view" className="flex gap-gb-xxs rounded-gb-lg border border-line bg-surface-muted p-gb-xxs">
          {PLANNER_VIEWS.map((candidate) => <button key={candidate} type="button" role="tab" aria-selected={view === candidate} onClick={() => selectView(candidate)} className={`rounded-gb-md px-gb-xl py-gb-sm text-gb-sm font-semibold ${view === candidate ? 'bg-surface text-fg shadow-gb-xs' : 'text-fg-muted'}`}>{PLANNER_VIEW_LABEL[candidate]}</button>)}
        </div>
      </div>
      {controller.error ? <p role="alert" className="text-gb-sm text-fg-error">{controller.error}</p> : null}
      <div className="overflow-hidden rounded-gb-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-gb-lg border-b border-line p-gb-xl">
          <input aria-label="Search tasks" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" className="min-w-[14rem] flex-1 rounded-gb-lg border border-line px-gb-lg py-gb-sm text-gb-sm" />
          {view !== 'kanban' ? <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as PlannerMicroStep['status'] | 'all')} className="rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-sm text-gb-sm"><option value="all">All statuses</option>{PROGRESS_STATUS.map((item) => <option key={item} value={item}>{PROGRESS_STATUS_LABEL[item]}</option>)}</select> : null}
          <span className="text-gb-sm text-fg-muted">{visibleCount} task{visibleCount === 1 ? '' : 's'}</span>
        </div>
        {view === 'list' ? <HierarchyList applicationId={applicationId} planner={visible} onStatus={controller.updateMicroStepStatus} onDeadline={controller.updateMicroStepDeadline} /> : null}
        {view === 'calendar' ? <MicroStepCalendar applicationId={applicationId} planner={visible} onDeadline={controller.updateMicroStepDeadline} /> : null}
        {view === 'kanban' ? <MicroStepBoard applicationId={applicationId} planner={visible} onStatus={controller.updateMicroStepStatus} /> : null}
      </div>
    </section>
  );
}

function HierarchyList({ applicationId, planner, onStatus, onDeadline }: { applicationId: string; planner: PlannerReadModel; onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void>; onDeadline: (id: string, deadline: string | null) => Promise<void> }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  if (planner.phases.length === 0) return <p className="p-gb-4xl text-center text-gb-sm text-fg-tertiary">No tasks match those filters.</p>;
  return <div className="flex flex-col gap-gb-lg p-gb-lg sm:p-gb-xl">{planner.phases.map((phase) => <section key={phase.id} className="rounded-gb-xl border border-line">
    <button type="button" onClick={() => toggle(phase.id)} className="flex w-full items-center justify-between gap-gb-md p-gb-lg text-left"><span><span className="block text-gb-base font-semibold text-fg">{collapsed.has(phase.id) ? '›' : '⌄'} {phase.title}</span><span className="text-gb-xs text-fg-tertiary">{phase.progress.completed} / {phase.progress.total} complete · {phase.progress.percentage}%</span></span></button>
    {!collapsed.has(phase.id) ? <div className="border-t border-line">{phase.steps.map((step) => <div key={step.id} className="border-b border-line last:border-b-0">
      <button type="button" onClick={() => toggle(step.id)} className="flex w-full items-center justify-between gap-gb-md bg-surface-muted px-gb-lg py-gb-md text-left"><span className="text-gb-sm font-semibold text-fg">{collapsed.has(step.id) ? '›' : '⌄'} {step.title}</span><span className="text-gb-xs text-fg-tertiary">{step.progress.completed} / {step.progress.total}</span></button>
      {!collapsed.has(step.id) ? <div>{step.microSteps.map((microStep) => <MicroStepRow key={microStep.id} applicationId={applicationId} microStep={microStep} onStatus={onStatus} onDeadline={onDeadline} />)}</div> : null}
    </div>)}</div> : null}
  </section>)}</div>;
}

function MicroStepRow({ applicationId, microStep, onStatus, onDeadline }: { applicationId: string; microStep: PlannerMicroStep; onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void>; onDeadline: (id: string, deadline: string | null) => Promise<void> }) {
  return <article className="flex flex-col gap-gb-md border-b border-line p-gb-lg last:border-b-0 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><Link href={`/ai-strategy/${applicationId}/planner/tasks/${microStep.id}`} className="text-gb-sm font-semibold text-fg hover:underline">{microStep.title}</Link><p className="mt-gb-xxs text-gb-xs text-fg-tertiary">{microStep.readiness === 'requires_user_input' ? 'Needs your input' : 'Needs enrichment'}</p></div><div className="flex flex-wrap items-center gap-gb-sm"><StatusSelect microStep={microStep} onStatus={onStatus} /><DeadlineControl deadline={microStep.deadline} label={`Deadline for ${microStep.title}`} onChange={(deadline) => onDeadline(microStep.id, deadline)} /></div></article>;
}

function MicroStepCalendar({ applicationId, planner, onDeadline }: { applicationId: string; planner: PlannerReadModel; onDeadline: (id: string, deadline: string | null) => Promise<void> }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const tasks = getCalendarMicroSteps(planner);
  const groups = new Map<string, typeof tasks>();
  for (const task of tasks) groups.set(task.deadline!, [...(groups.get(task.deadline!) ?? []), task]);
  return <div className="grid gap-gb-lg p-gb-xl lg:grid-cols-[1fr_18rem]"><div className="flex flex-col gap-gb-md">{[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => <section key={date} onDragOver={(event) => event.preventDefault()} onDrop={() => draggingId && void onDeadline(draggingId, date)} className="rounded-gb-xl border border-line p-gb-lg"><h3 className="mb-gb-md text-gb-sm font-semibold text-fg">{date}</h3>{items.map((item) => <MicroStepCard key={item.id} applicationId={applicationId} item={item} onDragStart={setDraggingId} />)}</section>)}</div><aside onDragOver={(event) => event.preventDefault()} onDrop={() => draggingId && void onDeadline(draggingId, null)} className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-lg"><h3 className="text-gb-sm font-semibold">Unscheduled</h3>{getPlannerMicroSteps(planner).filter((item) => item.deadline === null).map((item) => <div key={item.id} className="rounded-gb-lg bg-surface p-gb-md"><MicroStepCard applicationId={applicationId} item={item} onDragStart={setDraggingId} /><DeadlineControl deadline={item.deadline} label={`Deadline for ${item.title}`} onChange={(deadline) => onDeadline(item.id, deadline)} /></div>)}</aside></div>;
}

function MicroStepBoard({ applicationId, planner, onStatus }: { applicationId: string; planner: PlannerReadModel; onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void> }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const items = getKanbanMicroSteps(planner);
  return <div className="grid gap-gb-lg p-gb-xl md:grid-cols-3 xl:grid-cols-5">{KANBAN_COLUMNS.map((status) => <section key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => draggingId && void onStatus(draggingId, status)} className="flex min-h-[14rem] flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-lg"><header className="flex justify-between"><h3 className="text-gb-sm font-semibold">{KANBAN_COLUMN_LABEL[status]}</h3><span>{items.filter((item) => item.status === status).length}</span></header>{items.filter((item) => item.status === status).map((item) => <div key={item.id} className="rounded-gb-lg bg-surface p-gb-md"><MicroStepCard applicationId={applicationId} item={item} onDragStart={setDraggingId} /><StatusSelect microStep={item} onStatus={onStatus} /></div>)}</section>)}</div>;
}

function MicroStepCard({ applicationId, item, onDragStart }: { applicationId: string; item: ReturnType<typeof getPlannerMicroSteps>[number]; onDragStart: (id: string) => void }) {
  return <article draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', item.id); onDragStart(item.id); }} className="mb-gb-sm cursor-grab"><Link href={`/ai-strategy/${applicationId}/planner/tasks/${item.id}`} className="block text-gb-sm font-semibold text-fg hover:underline">{item.title}</Link><p className="text-gb-xs text-fg-tertiary">{item.phaseTitle} · {item.stepTitle}</p>{item.deadline ? <p className="text-gb-xs text-fg-muted">Due {item.deadline}</p> : null}</article>;
}

function StatusSelect({ microStep, onStatus }: { microStep: PlannerMicroStep; onStatus: (id: string, status: PlannerMicroStep['status']) => Promise<void> }) {
  return <select aria-label={`Status for ${microStep.title}`} value={microStep.status} onChange={(event) => void onStatus(microStep.id, event.target.value as PlannerMicroStep['status'])} className="rounded-gb-full border border-line bg-surface px-gb-md py-gb-xs text-gb-xs">{PROGRESS_STATUS.map((status) => <option key={status} value={status}>{PROGRESS_STATUS_LABEL[status]}</option>)}</select>;
}

function filterPlanner(model: PlannerReadModel, query: string, status: PlannerMicroStep['status'] | 'all'): PlannerReadModel {
  const needle = query.trim().toLowerCase();
  const phases = model.phases.map((phase) => ({ ...phase, steps: phase.steps.map((step) => ({ ...step, microSteps: step.microSteps.filter((microStep) => (status === 'all' || microStep.status === status) && [microStep.title, step.title, phase.title].join(' ').toLowerCase().includes(needle)) })).filter((step) => step.microSteps.length > 0) })).filter((phase) => phase.steps.length > 0);
  return { ...model, phases };
}
