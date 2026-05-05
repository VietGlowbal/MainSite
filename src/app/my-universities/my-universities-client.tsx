'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { UserUniversity, ApplicationTask, University } from '@/lib/types';

type UUWithUni = UserUniversity & { university: University };

type Props = {
  userUniversities: UUWithUni[];
  allTasks: ApplicationTask[];
};

const STATUS_OPTIONS: UserUniversity['status'][] = [
  'interested', 'applying', 'applied', 'offer', 'rejected', 'enrolled',
];

const STATUS_COLORS: Record<string, string> = {
  interested: 'bg-slate-100 text-slate-600 border-slate-200',
  applying: 'bg-amber-50 text-amber-700 border-amber-200',
  applied: 'bg-blue-50 text-blue-700 border-blue-200',
  offer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  enrolled: 'bg-purple-50 text-purple-700 border-purple-200',
};

const CATEGORY_ICONS: Record<string, string> = {
  research: '🔍',
  documents: '📄',
  tests: '📝',
  deadlines: '📅',
  visits: '🏫',
  general: '📌',
};

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const circumference = 2 * Math.PI * 14;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative w-10 h-10 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
        <circle
          cx="16" cy="16" r="14" fill="none"
          stroke={pct >= 100 ? '#10b981' : '#ff4d8c'} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600">
        {completed}/{total}
      </span>
    </div>
  );
}

export function MyUniversitiesClient({ userUniversities, allTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'grid' | 'roadmap'>('grid');
  const [statuses, setStatuses] = useState<Record<number, string>>(
    Object.fromEntries(userUniversities.map((uu) => [uu.id, uu.status])),
  );
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(
    new Set(allTasks.filter((t) => t.is_completed).map((t) => t.id)),
  );
  const [isPending, startTransition] = useTransition();

  const tasksByUU = useMemo(() => {
    const map: Record<number, ApplicationTask[]> = {};
    for (const task of allTasks) {
      if (!map[task.user_university_id]) map[task.user_university_id] = [];
      map[task.user_university_id].push(task);
    }
    return map;
  }, [allTasks]);

  const handleStatusChange = async (uuId: number, newStatus: string) => {
    setStatuses((prev) => ({ ...prev, [uuId]: newStatus }));
    await supabase
      .from('user_universities')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', uuId);
  };

  const handleToggleTask = async (taskId: number) => {
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

  if (userUniversities.length === 0) {
    return (
      <div className="glow-card text-center py-16 space-y-4">
        <p className="text-4xl" aria-hidden="true">🎓</p>
        <p className="text-slate-500">No universities saved yet.</p>
        <a
          href="/universities"
          className="inline-flex rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)]"
        >
          Browse universities
        </a>
      </div>
    );
  }

  // Roadmap: all tasks sorted by deadline then sort_order
  const roadmapTasks = allTasks
    .map((task) => {
      const uu = userUniversities.find((u) => u.id === task.user_university_id);
      return { ...task, university: uu?.university };
    })
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return a.sort_order - b.sort_order;
    });

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView('grid')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            view === 'grid'
              ? 'bg-pink-50 text-pink-600 border border-pink-200'
              : 'bg-white/80 text-slate-500 border border-black/5 hover:text-slate-700'
          }`}
        >
          Grid view
        </button>
        <button
          type="button"
          onClick={() => setView('roadmap')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            view === 'roadmap'
              ? 'bg-pink-50 text-pink-600 border border-pink-200'
              : 'bg-white/80 text-slate-500 border border-black/5 hover:text-slate-700'
          }`}
        >
          Roadmap view
        </button>
      </div>

      {/* ── Grid View ── */}
      {view === 'grid' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userUniversities.map((uu) => {
            const tasks = tasksByUU[uu.id] ?? [];
            const completed = tasks.filter((t) => completedTasks.has(t.id)).length;
            const status = statuses[uu.id] ?? uu.status;

            return (
              <article key={uu.id} className="glow-card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {uu.university.country}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 leading-snug">
                      {uu.university.name}
                    </h3>
                  </div>
                  <ProgressRing completed={completed} total={tasks.length} />
                </div>

                {/* Match score */}
                {uu.match_score != null && (
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-pink-600">{uu.match_score}%</span> match
                  </p>
                )}

                {/* Status selector */}
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(uu.id, e.target.value)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${STATUS_COLORS[status] ?? STATUS_COLORS.interested}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Task preview */}
                <div className="space-y-1.5">
                  {tasks.slice(0, 3).map((task) => (
                    <label key={task.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completedTasks.has(task.id)}
                        onChange={() => handleToggleTask(task.id)}
                        className="rounded border-slate-300 text-pink-500 focus:ring-pink-300"
                      />
                      <span className={completedTasks.has(task.id) ? 'line-through text-slate-400' : 'text-slate-600'}>
                        {task.title}
                      </span>
                    </label>
                  ))}
                  {tasks.length > 3 && (
                    <p className="text-xs text-slate-400">+{tasks.length - 3} more tasks</p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2 pt-2">
                  <Link
                    href={`/my-universities/${uu.id}`}
                    className="flex-1 rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-center text-xs font-semibold text-slate-600 hover:border-pink-200 hover:text-pink-600 transition"
                  >
                    View tasks
                  </Link>
                  <Link
                    href={`/my-universities/${uu.id}/writer`}
                    className="flex-1 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-center text-xs font-semibold text-pink-600 hover:bg-pink-100 transition"
                  >
                    AI Writer
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Roadmap View ── */}
      {view === 'roadmap' && (
        <div className="glow-card space-y-1">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-0.5 items-center px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400 border-b border-black/5">
            <span>Done</span>
            <span>Task</span>
            <span>University</span>
            <span>Deadline</span>
          </div>
          {roadmapTasks.map((task) => (
            <div
              key={task.id}
              className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center px-2 py-2.5 rounded-xl transition ${
                completedTasks.has(task.id) ? 'opacity-50' : 'hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={completedTasks.has(task.id)}
                onChange={() => handleToggleTask(task.id)}
                className="rounded border-slate-300 text-pink-500 focus:ring-pink-300"
                aria-label={`Mark "${task.title}" as ${completedTasks.has(task.id) ? 'incomplete' : 'complete'}`}
              />
              <div className="min-w-0">
                <span className="mr-1.5" aria-hidden="true">{CATEGORY_ICONS[task.category] ?? '📌'}</span>
                <span className={`text-sm ${completedTasks.has(task.id) ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {task.title}
                </span>
              </div>
              <span className="text-xs text-slate-500 truncate max-w-[160px]">
                {task.university?.name ?? '—'}
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {task.deadline ?? '—'}
              </span>
            </div>
          ))}
          {roadmapTasks.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No tasks yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
