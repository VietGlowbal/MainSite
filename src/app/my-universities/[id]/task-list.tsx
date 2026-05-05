'use client';

import { useMemo, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ApplicationTask } from '@/lib/types';

type Props = {
  tasks: ApplicationTask[];
  userUniversityId: number;
};

const CATEGORY_ICONS: Record<string, string> = {
  research: '🔍',
  documents: '📄',
  tests: '📝',
  deadlines: '📅',
  visits: '🏫',
  general: '📌',
};

const CATEGORY_COLORS: Record<string, string> = {
  research: 'bg-violet-50 border-violet-200 text-violet-600',
  documents: 'bg-sky-50 border-sky-200 text-sky-600',
  tests: 'bg-amber-50 border-amber-200 text-amber-600',
  deadlines: 'bg-red-50 border-red-200 text-red-600',
  visits: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  general: 'bg-slate-50 border-slate-200 text-slate-600',
};

export function TaskList({ tasks, userUniversityId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(
    new Set(tasks.filter((t) => t.is_completed).map((t) => t.id)),
  );
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const completed = tasks.filter((t) => completedTasks.has(t.id)).length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const handleToggle = async (taskId: number) => {
    const isNowCompleted = !completedTasks.has(taskId);

    startTransition(() => {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        if (isNowCompleted) next.add(taskId);
        else next.delete(taskId);
        return next;
      });
    });

    await supabase
      .from('application_tasks')
      .update({
        is_completed: isNowCompleted,
        completed_at: isNowCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskId);
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="glow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Application progress</h2>
          <span className="text-sm font-semibold text-slate-500">{completed} of {tasks.length} tasks</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => {
          const isDone = completedTasks.has(task.id);
          const isExpanded = expandedTask === task.id;

          return (
            <div
              key={task.id}
              className={`glow-card transition-all ${isDone ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => handleToggle(task.id)}
                  className="mt-1 rounded border-slate-300 text-pink-500 focus:ring-pink-300"
                  aria-label={`Mark "${task.title}" as ${isDone ? 'incomplete' : 'complete'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span aria-hidden="true">{CATEGORY_ICONS[task.category] ?? '📌'}</span>
                    <h3 className={`text-sm font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {task.title}
                    </h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.general}`}>
                      {task.category}
                    </span>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">{task.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="shrink-0 rounded-lg border border-black/5 bg-white/80 p-1.5 text-slate-400 hover:text-slate-600 transition"
                  aria-label={isExpanded ? 'Collapse tips' : 'Show tips'}
                >
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>

              {/* Expanded tips */}
              {isExpanded && task.tips?.content && (
                <div className="mt-3 ml-8 rounded-xl bg-gradient-to-br from-sky-50 to-violet-50 border border-sky-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-500 mb-2">💡 Tips</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {task.tips.content}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <div className="glow-card text-center py-8">
          <p className="text-slate-400 text-sm">No tasks generated yet. Try removing and re-adding this university.</p>
        </div>
      )}
    </div>
  );
}
