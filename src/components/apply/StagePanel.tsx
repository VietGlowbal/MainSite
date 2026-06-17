/**
 * Stage Panel Component
 * Shows active stage with tasks and "Why this matters" section
 */

'use client';

import type { ApplicationStage, ApplicationTask } from '@/lib/apply-types';
import { TaskItem } from './TaskItem';

type Props = {
  stage: ApplicationStage;
  stageNumber: number;
  totalStages: number;
  onTaskToggle: (taskId: string, newStatus: 'completed' | 'not_started') => void;
  onTaskAction: (task: ApplicationTask) => void;
  onStatementFeedback?: (task: ApplicationTask) => void;
};

export function StagePanel({ stage, stageNumber, totalStages, onTaskToggle, onTaskAction, onStatementFeedback }: Props) {
  const tasks = stage.tasks || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="p-6">
        {/* Stage header */}
        <div className="mb-4">
          <p className="text-sm font-medium text-pink-600 mb-1">
            Step {stageNumber} of {totalStages}
          </p>
          <h2 className="text-xl font-bold text-slate-900">{stage.name}</h2>
          {stage.description && (
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{stage.description}</p>
          )}
        </div>

        {/* Why this matters */}
        {stage.whyThisMatters && (
          <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 mt-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-900 mb-1">Why this matters</p>
                <p className="text-xs text-blue-800 leading-relaxed">{stage.whyThisMatters}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tasks section */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Your tasks</h3>
          
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onTaskToggle}
                  onAction={onTaskAction}
                  onStatementFeedback={onStatementFeedback}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-900">No tasks yet</p>
              <p className="mt-1 text-xs text-slate-500">Tasks will appear here as you progress</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
