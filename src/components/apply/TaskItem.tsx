/**
 * Task Item Component
 * Individual task with checkbox, icon, and action button
 */

'use client';

import type { ApplicationTask } from '@/lib/apply-types';

type Props = {
  task: ApplicationTask;
  onToggle: (taskId: string, newStatus: 'completed' | 'not_started') => void;
  onAction: (task: ApplicationTask) => void;
};

// Task type icons
const taskIcons: Record<string, JSX.Element> = {
  research: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  eligibility: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  ),
  document: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  general: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
};

export function TaskItem({ task, onToggle, onAction }: Props) {
  const isCompleted = task.status === 'completed';
  const icon = taskIcons[task.taskType] || taskIcons.general;

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 transition ${
      isCompleted 
        ? 'border-green-200 bg-green-50/50' 
        : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(task.id, isCompleted ? 'not_started' : 'completed')}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
          isCompleted
            ? 'border-green-500 bg-green-500'
            : 'border-slate-300 hover:border-pink-400'
        }`}
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Task icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        isCompleted ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
      }`}>
        {icon}
      </div>

      {/* Task content */}
      <div className="min-w-0 flex-1">
        <h4 className={`text-sm font-semibold leading-snug ${
          isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
        }`}>
          {task.title}
        </h4>
        {task.description && (
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{task.description}</p>
        )}
        {task.priority === 'high' && !isCompleted && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            High priority
          </span>
        )}
      </div>

      {/* Action button */}
      {task.actionLabel && task.actionType && !isCompleted && (
        <button
          type="button"
          onClick={() => onAction(task)}
          className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-full border border-pink-300 bg-white px-3 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
        >
          {task.actionLabel}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
