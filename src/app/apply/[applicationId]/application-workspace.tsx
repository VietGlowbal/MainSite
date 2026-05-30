'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/app-sidebar';
import type {
  ApplicationWorkspace,
  ApplicationStage,
  ApplicationWorkspaceTask,
  StageStatus,
  TaskStatus,
} from '@/lib/apply-types';

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function stageStatusIcon(status: StageStatus) {
  switch (status) {
    case 'completed':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    case 'in_progress':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      );
    case 'blocked':
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-500 text-[10px] font-bold">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
      );
    case 'not_started':
    default:
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-slate-400">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
      );
  }
}

function taskTypeTag(type: ApplicationWorkspaceTask['type']) {
  switch (type) {
    case 'required': return null;
    case 'recommended': return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Recommended</span>;
    case 'optional': return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Optional</span>;
    case 'risk': return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Risk</span>;
  }
}

function confidenceBadge(confidence: 'high' | 'medium' | 'low') {
  switch (confidence) {
    case 'high': return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">High confidence</span>;
    case 'medium': return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Medium confidence</span>;
    case 'low': return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Low confidence</span>;
  }
}

function applicationMethodBadge(method?: string) {
  if (!method) return null;
  const colors: Record<string, string> = {
    UCAS: 'bg-blue-100 text-blue-700',
    'Direct Apply': 'bg-pink-100 text-pink-700',
    'Common App': 'bg-violet-100 text-violet-700',
    'University Portal': 'bg-cyan-100 text-cyan-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[method] ?? 'bg-slate-100 text-slate-700'}`}>
      {method}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   WORKSPACE HEADER
───────────────────────────────────────────────────────────────────────── */

function WorkspaceHeader({ workspace }: { workspace: ApplicationWorkspace }) {
  const { application } = workspace;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-start gap-5 p-5">
        {/* University image */}
        <div className="hidden sm:block h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-slate-100">
          {application.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={application.imageUrl} alt={application.universityName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-snug">{application.courseName}</h1>
              <p className="mt-0.5 text-sm text-slate-600">
                {application.countryFlag} {application.universityName}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {application.degreeLevel && <span>{application.degreeLevel}</span>}
                {application.studyMode && <><span className="text-slate-300">·</span><span>{application.studyMode}</span></>}
                {application.intake && <><span className="text-slate-300">·</span><span>{application.intake}</span></>}
                {application.applicationMethod && <>{applicationMethodBadge(application.applicationMethod)}</>}
                {application.applicationCode && (
                  <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    UCAS code: {application.applicationCode}
                  </span>
                )}
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-700">On track</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {application.courseUrl && (
                <a
                  href={application.courseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  View official course page
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-50"
                aria-label="More actions"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   KEY FACTS BAR
───────────────────────────────────────────────────────────────────────── */

function KeyFactsBar({ workspace }: { workspace: ApplicationWorkspace }) {
  const { keyFacts } = workspace;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {keyFacts.deadline && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Application deadline</p>
          <p className="mt-1 text-lg font-bold text-[#FF3D9A] leading-tight">{keyFacts.deadline.value}</p>
          {keyFacts.deadline.label && <p className="mt-0.5 text-xs text-slate-500">{keyFacts.deadline.label}</p>}
        </div>
      )}
      {keyFacts.tuitionFee && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Tuition fees (Intl.)</p>
          <p className="mt-1 text-base font-bold text-slate-900 leading-tight">{keyFacts.tuitionFee.value}</p>
          {keyFacts.tuitionFee.sourceUrl && (
            <a href={keyFacts.tuitionFee.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs font-semibold text-pink-600 hover:text-pink-700">
              View fees page ↗
            </a>
          )}
        </div>
      )}
      {keyFacts.applicationMethod && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Application method</p>
          <p className="mt-1 text-base font-bold text-slate-900 leading-tight">{keyFacts.applicationMethod.value}</p>
          {keyFacts.applicationMethod.sourceUrl && (
            <a href={keyFacts.applicationMethod.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs font-semibold text-pink-600 hover:text-pink-700">
              View how to apply ↗
            </a>
          )}
        </div>
      )}
      {keyFacts.entryRequirements && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Entry requirements</p>
          <p className="mt-1 text-base font-bold text-slate-900 leading-tight">{keyFacts.entryRequirements.value}</p>
          {keyFacts.entryRequirements.sourceUrl && (
            <a href={keyFacts.entryRequirements.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs font-semibold text-pink-600 hover:text-pink-700">
              View full requirements ↗
            </a>
          )}
        </div>
      )}
      {keyFacts.matchScore !== undefined && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Your match</p>
          <div className="mt-1 flex items-baseline gap-1">
            <p className="text-2xl font-bold text-slate-900 leading-tight">{keyFacts.matchScore}%</p>
          </div>
          {keyFacts.matchLabel && (
            <p className="mt-0.5 text-xs font-semibold text-green-600">{keyFacts.matchLabel}</p>
          )}
          <button type="button" className="mt-0.5 block text-xs font-semibold text-pink-600 hover:text-pink-700">
            Why this score? →
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STAGE PIPELINE (business process flow)
───────────────────────────────────────────────────────────────────────── */

function StagePipeline({
  stages,
  activeStageId,
  onSelectStage,
}: {
  stages: ApplicationStage[];
  activeStageId: string;
  onSelectStage: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Your application journey</h2>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          View full timeline
        </button>
      </div>

      {/* Scrollable stage pipeline */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const isActive = stage.id === activeStageId;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={`flex min-w-[80px] flex-col items-center gap-2 rounded-xl p-2.5 transition ${
                isActive
                  ? 'bg-pink-50'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                {stageStatusIcon(stage.status)}
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
                  {i + 1}
                </span>
              </div>
              <span className={`text-center text-[11px] font-semibold leading-tight ${isActive ? 'text-pink-600' : 'text-slate-600'}`}>
                {stage.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TASK ITEM
───────────────────────────────────────────────────────────────────────── */

function TaskItem({
  task,
  onToggle,
}: {
  task: ApplicationWorkspaceTask;
  onToggle: (id: string, status: TaskStatus) => void;
}) {
  const isCompleted = task.status === 'completed';

  return (
    <div className={`flex items-start gap-3 py-3 ${isCompleted ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={() => onToggle(task.id, isCompleted ? 'not_started' : 'completed')}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          isCompleted
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-slate-300 hover:border-pink-400'
        }`}
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
            {task.title}
          </span>
          {taskTypeTag(task.type)}
          {task.supportToolType === 'sop_maximiser' && (
            <button type="button" className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-600 hover:bg-pink-100 transition">
              Use SOP Maximiser
            </button>
          )}
          {task.supportToolType === 'mentor' && (
            <Link href="/mentors" className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-100 transition">
              Find a mentor
            </Link>
          )}
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{task.description}</p>
        )}
        {task.sourceUrl && (
          <a
            href={task.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-pink-600 hover:text-pink-700"
          >
            View source ↗
          </a>
        )}
      </div>
      {task.dueDate && (
        <span className="shrink-0 text-[11px] text-slate-400">
          {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STAGE DETAIL PANEL
───────────────────────────────────────────────────────────────────────── */

type SubNav = 'overview' | 'key_info' | 'requirements' | 'dates' | 'links';

function StageDetail({
  stage,
  tasks,
  onTaskToggle,
}: {
  stage: ApplicationStage;
  tasks: ApplicationWorkspaceTask[];
  onTaskToggle: (id: string, status: TaskStatus) => void;
}) {
  const [subNav, setSubNav] = useState<SubNav>('overview');

  const subnav: { key: SubNav; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'key_info', label: 'Key information' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'dates', label: 'Important dates' },
    { key: 'links', label: 'Useful links' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex gap-0">
        {/* Left mini nav */}
        <div className="hidden w-44 shrink-0 border-r border-slate-100 p-4 md:block">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">In this section</p>
          <nav className="space-y-0.5">
            {subnav.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSubNav(item.key)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition ${
                  subNav === item.key
                    ? 'bg-pink-50 text-pink-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main panel */}
        <div className="min-w-0 flex-1 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{stage.order}. {stage.name}</h3>
              {stage.description && (
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{stage.description}</p>
              )}
            </div>
            {stageStatusIcon(stage.status)}
          </div>

          {/* Tasks */}
          {tasks.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tasks ({tasks.length})
              </p>
              <div className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <TaskItem key={task.id} task={task} onToggle={onTaskToggle} />
                ))}
              </div>
              <button
                type="button"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-pink-300 bg-white px-4 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
              >
                Mark section as complete
              </button>
            </div>
          )}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-900">This stage is locked</p>
              <p className="mt-1 text-xs text-slate-500">Complete earlier stages to unlock tasks here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   COLLAPSED STAGE ROW (for non-active stages)
───────────────────────────────────────────────────────────────────────── */

function CollapsedStageRow({
  stage,
  onExpand,
}: {
  stage: ApplicationStage;
  onExpand: () => void;
}) {
  const completedTasks = (stage.tasks ?? []).filter((t) => t.status === 'completed').length;
  const totalTasks = (stage.tasks ?? []).length;

  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)] text-left"
    >
      <div className="flex items-center gap-3">
        {stageStatusIcon(stage.status)}
        <span className="text-sm font-semibold text-slate-900">
          {stage.order}. {stage.name}
        </span>
        {totalTasks > 0 && (
          <span className="text-xs text-slate-400">
            {completedTasks}/{totalTasks} tasks
          </span>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   RIGHT SIDEBAR
───────────────────────────────────────────────────────────────────────── */

function ProgressCard({ workspace }: { workspace: ApplicationWorkspace }) {
  const { application, stages } = workspace;
  const allTasks = stages.flatMap((s) => s.tasks ?? []);
  const completed = allTasks.filter((t) => t.status === 'completed').length;
  const inProgress = allTasks.filter((t) => t.status === 'in_progress').length;
  const notStarted = allTasks.filter((t) => t.status === 'not_started').length;
  const blocked = allTasks.filter((t) => t.status === 'blocked').length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Application progress</h3>
      </div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">Overall progress</p>
        <p className="text-sm font-bold text-slate-900">{application.progressPercentage}%</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-4">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#FF3D9A,#FF85B3)]"
          style={{ width: `${application.progressPercentage}%` }}
        />
      </div>
      <div className="space-y-2">
        {[
          { label: 'Completed', value: completed, total: allTasks.length, color: 'text-green-600' },
          { label: 'In progress', value: inProgress, total: null, color: 'text-blue-600' },
          { label: 'Not started', value: notStarted, total: null, color: 'text-slate-500' },
          { label: 'Blocked', value: blocked, total: null, color: 'text-red-500' },
        ].map(({ label, value, total, color }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`inline mr-1.5 ${color}`}><circle cx="4" cy="4" r="4" /></svg>
              {label}
            </span>
            <span className="font-semibold text-slate-700">
              {total !== null ? `${value}/${total}` : value}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-full border border-pink-300 py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
      >
        View task list
      </button>
    </div>
  );
}

function WorkspaceDeadlinesCard() {
  const deadlines = [
    { month: 'MAY', day: '30', label: 'Scholarship deadline', sub: 'VinUniversity', daysLeft: 10 },
    { month: 'JAN', day: '15', label: 'UCAS deadline', sub: 'University of Manchester', daysLeft: 155 },
    { month: 'OCT', day: '22', label: 'Test registration deadline (TMUA)', sub: 'Cambridge', daysLeft: 240 },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Upcoming deadlines</h3>
        <button type="button" className="text-xs font-semibold text-pink-600 hover:text-pink-700">View all</button>
      </div>
      <div className="space-y-3">
        {deadlines.map((d) => (
          <div key={`${d.month}-${d.day}-${d.label}`} className="flex items-center gap-3">
            <div className="flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{d.month}</p>
              <p className="text-base font-bold text-slate-900 leading-none">{d.day}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 leading-snug">{d.label}</p>
              <p className="text-[11px] text-slate-500 truncate">{d.sub}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.daysLeft <= 14 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
              {d.daysLeft}d left
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImproveToolsCard() {
  const tools = [
    { label: 'SOP Maximiser', desc: 'Get AI feedback on your personal statement', icon: '📝' },
    { label: 'Interview Prep', desc: 'Practice questions and mock interviews', icon: '🎤' },
    { label: 'Profile Review', desc: 'Get expert feedback on your overall profile', icon: '👤' },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Improve your application</h3>
      <div className="space-y-2">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-left transition hover:bg-pink-50 hover:border-pink-200 group"
          >
            <span className="text-lg">{t.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 group-hover:text-pink-700">{t.label}</p>
              <p className="text-[11px] text-slate-500">{t.desc}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 group-hover:text-pink-400">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
      <button type="button" className="mt-3 w-full text-center text-xs font-semibold text-pink-600 hover:text-pink-700">
        Explore all tools →
      </button>
    </div>
  );
}

function MentorsCard({ universityName }: { universityName: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Mentors from this university</h3>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex -space-x-2">
          {['#FF3D9A', '#3B82F6', '#10B981', '#F59E0B'].map((c, i) => (
            <div
              key={i}
              className="h-8 w-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-[11px] font-bold"
              style={{ background: c }}
            >
              {['J', 'S', 'A', 'M'][i]}
            </div>
          ))}
        </div>
        <span className="text-xs text-slate-500">+24</span>
      </div>
      <p className="mt-2 text-xs text-slate-500 leading-relaxed">
        Get advice from current students and alumni at {universityName}.
      </p>
      <Link
        href="/mentors"
        className="mt-3 flex h-9 w-full items-center justify-center rounded-full border border-pink-300 bg-white text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
      >
        Find a mentor
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AI EXTRACTION FOOTER
───────────────────────────────────────────────────────────────────────── */

function ExtractionFooter({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        Information extracted on 11 May 2025
      </span>
      {confidenceBadge(confidence)}
      <span>Always verify key details on the official university website.</span>
      <button type="button" className="font-semibold text-pink-600 hover:text-pink-700">
        Something wrong? Report issue
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN WORKSPACE
───────────────────────────────────────────────────────────────────────── */

export function ApplicationWorkspaceView({ workspace }: { workspace: ApplicationWorkspace }) {
  const { stages, application } = workspace;
  const [activeStageId, setActiveStageId] = useState(
    stages.find((s) => s.status === 'in_progress')?.id ?? stages[0]?.id ?? ''
  );
  const [taskStates, setTaskStates] = useState<Record<string, TaskStatus>>(() => {
    const map: Record<string, TaskStatus> = {};
    for (const stage of stages) {
      for (const task of stage.tasks ?? []) {
        map[task.id] = task.status;
      }
    }
    return map;
  });

  const handleTaskToggle = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistically update UI
    setTaskStates((prev) => ({ ...prev, [taskId]: newStatus }));
    
    // Persist to database
    try {
      const response = await fetch(`/api/applications/${application.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        // Revert on error
        const task = stages.flatMap(s => s.tasks ?? []).find(t => t.id === taskId);
        setTaskStates((prev) => ({ ...prev, [taskId]: task?.status ?? 'not_started' }));
        console.error('Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      // Revert on error
      const task = stages.flatMap(s => s.tasks ?? []).find(t => t.id === taskId);
      setTaskStates((prev) => ({ ...prev, [taskId]: task?.status ?? 'not_started' }));
    }
  };

  const activeStage = stages.find((s) => s.id === activeStageId);

  return (
    <div className="flex gap-6">
      {/* Left sidebar */}
      <div className="w-52 shrink-0">
        <AppSidebar />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/apply" className="hover:text-pink-600">My Applications</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-slate-900 font-medium">{application.courseName}</span>
        </nav>

        {/* Header */}
        <WorkspaceHeader workspace={workspace} />

        {/* Key facts */}
        <KeyFactsBar workspace={workspace} />

        {/* Stage pipeline */}
        <StagePipeline
          stages={stages}
          activeStageId={activeStageId}
          onSelectStage={setActiveStageId}
        />

        {/* Active stage detail */}
        {activeStage && (
          <StageDetail
            stage={activeStage}
            tasks={(activeStage.tasks ?? []).map((t) => ({
              ...t,
              status: taskStates[t.id] ?? t.status,
            }))}
            onTaskToggle={handleTaskToggle}
          />
        )}

        {/* Other stages collapsed */}
        <div className="space-y-2">
          {stages
            .filter((s) => s.id !== activeStageId)
            .map((stage) => (
              <CollapsedStageRow
                key={stage.id}
                stage={{
                  ...stage,
                  tasks: (stage.tasks ?? []).map((t) => ({
                    ...t,
                    status: taskStates[t.id] ?? t.status,
                  })),
                }}
                onExpand={() => setActiveStageId(stage.id)}
              />
            ))}
        </div>

        {/* AI extraction footer */}
        <ExtractionFooter confidence={workspace.application.sourceConfidence} />
      </div>

      {/* Right sidebar */}
      <div className="hidden xl:block w-72 shrink-0 space-y-4">
        <ProgressCard workspace={workspace} />
        <WorkspaceDeadlinesCard />
        <ImproveToolsCard />
        <MentorsCard universityName={application.universityName} />
      </div>
    </div>
  );
}
