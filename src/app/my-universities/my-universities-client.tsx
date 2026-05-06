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

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: UserUniversity['status'][] = [
  'interested', 'applying', 'applied', 'offer', 'rejected', 'enrolled',
];

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  interested: { label: 'Interested',  pill: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
  applying:   { label: 'Applying',    pill: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-400' },
  applied:    { label: 'Applied',     pill: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-500' },
  offer:      { label: 'Offer',       pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rejected:   { label: 'Rejected',    pill: 'bg-red-50 text-red-600 border-red-200',           dot: 'bg-red-400' },
  enrolled:   { label: 'Enrolled',    pill: 'bg-purple-50 text-purple-700 border-purple-200',  dot: 'bg-purple-500' },
};

// ── External support links per task category ─────────────────────────────────

const SUPPORT_LINKS: Record<string, { label: string; url: string }[]> = {
  research: [
    { label: 'QS World Rankings', url: 'https://www.topuniversities.com/world-university-rankings' },
    { label: 'Times Higher Education', url: 'https://www.timeshighereducation.com/world-university-rankings' },
    { label: 'Uni Compare', url: 'https://www.universitycompare.com' },
  ],
  documents: [
    { label: 'UCAS Personal Statement guide', url: 'https://www.ucas.com/undergraduate/applying-university/writing-personal-statement' },
    { label: 'Common App essay tips', url: 'https://www.commonapp.org/apply/essay-prompts' },
    { label: 'Glowbal AI Writer', url: null as unknown as string }, // internal — handled separately
  ],
  tests: [
    { label: 'IELTS preparation', url: 'https://www.ielts.org/study-and-prepare' },
    { label: 'TOEFL resources', url: 'https://www.ets.org/toefl/test-takers/ibt/prepare.html' },
    { label: 'SAT practice (Khan Academy)', url: 'https://www.khanacademy.org/test-prep/sat' },
    { label: 'GRE prep', url: 'https://www.ets.org/gre/test-takers/general/prepare.html' },
  ],
  deadlines: [
    { label: 'UCAS key dates', url: 'https://www.ucas.com/undergraduate/applying-university/ucas-undergraduate-key-dates' },
    { label: 'Common App deadlines', url: 'https://www.commonapp.org/apply/deadlines' },
  ],
  visits: [
    { label: 'Book an open day (UCAS)', url: 'https://www.ucas.com/undergraduate/what-and-where-study/university-open-days' },
    { label: 'Virtual campus tours', url: 'https://www.youvisit.com/collegesearch/' },
  ],
  general: [
    { label: 'Student finance (UK)', url: 'https://www.gov.uk/student-finance' },
    { label: 'Scholarship search', url: 'https://www.scholarshipportal.com' },
    { label: 'Visa guidance', url: 'https://www.gov.uk/student-visa' },
  ],
};

const CATEGORY_ICONS: Record<string, string> = {
  research: '🔍', documents: '📄', tests: '📝',
  deadlines: '📅', visits: '🏫', general: '📌',
};

// ── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ completed, total, size = 40 }: { completed: number; total: number; size?: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const r = (size / 2) - 3;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const cx = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={pct >= 100 ? '#10b981' : '#ff4d8c'} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600">
        {completed}/{total}
      </span>
    </div>
  );
}

// ── Inline deadline editor ───────────────────────────────────────────────────

function DeadlineEditor({ taskId, current, onSave }: { taskId: number; current: string | null; onSave: (d: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? '');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-xs tabular-nums transition hover:text-pink-600 ${current ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}
        title="Click to set deadline"
      >
        {current ? new Date(current).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set deadline'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-pink-200 bg-pink-50 px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-300"
        autoFocus
      />
      <button type="button" onClick={() => { onSave(value || null); setEditing(false); }}
        className="rounded-lg bg-pink-500 px-2 py-0.5 text-xs font-semibold text-white hover:bg-pink-600">✓</button>
      <button type="button" onClick={() => setEditing(false)}
        className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50">✕</button>
    </div>
  );
}

// ── University row (expanded task panel) ─────────────────────────────────────

function UniversityRow({
  uu, tasks, completedTasks, statuses,
  onStatusChange, onToggleTask, onDeadlineChange,
}: {
  uu: UUWithUni;
  tasks: ApplicationTask[];
  completedTasks: Set<number>;
  statuses: Record<number, string>;
  onStatusChange: (id: number, s: string) => void;
  onToggleTask: (id: number) => void;
  onDeadlineChange: (taskId: number, d: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completed = tasks.filter((t) => completedTasks.has(t.id)).length;
  const status = statuses[uu.id] ?? uu.status;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.interested;

  // Next upcoming deadline
  const nextDeadline = tasks
    .filter((t) => t.deadline && !completedTasks.has(t.id))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0]?.deadline ?? null;

  const isOverdue = nextDeadline && new Date(nextDeadline) < new Date();

  return (
    <div className="glow-card p-0 overflow-hidden">
      {/* ── Row header ── */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Progress */}
        <ProgressRing completed={completed} total={tasks.length} />

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{uu.university.name}</h3>
            {uu.match_score != null && (
              <span className="rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-[10px] font-semibold text-pink-600">
                {uu.match_score}% match
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400">{uu.university.country}</span>
            {uu.university.qs_rank && (
              <span className="text-xs text-slate-400">QS #{uu.university.qs_rank}</span>
            )}
            {nextDeadline && (
              <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                {isOverdue ? '⚠ Overdue: ' : '⏰ Next: '}
                {new Date(nextDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {/* Status pill */}
        <select
          value={status}
          onChange={(e) => onStatusChange(uu.id, e.target.value)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${cfg.pill}`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/my-universities/${uu.id}/writer`}
            className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-100 transition"
          >
            AI Writer
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-black/5 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition flex items-center gap-1"
          >
            Tasks
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Expanded task panel ── */}
      {expanded && (
        <div className="border-t border-black/[.04] bg-slate-50/60 px-5 py-4 space-y-3">
          {tasks.length === 0 && (
            <p className="text-sm text-slate-400 italic">No tasks yet — try removing and re-adding this university.</p>
          )}

          {/* Group tasks by category */}
          {Object.entries(
            tasks.reduce<Record<string, ApplicationTask[]>>((acc, t) => {
              (acc[t.category] ??= []).push(t);
              return acc;
            }, {})
          ).map(([category, catTasks]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {CATEGORY_ICONS[category]} {category}
                </p>
                {/* Support links for this category */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {(SUPPORT_LINKS[category] ?? []).map((link) =>
                    link.url ? (
                      <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-semibold text-[#00b4d8] hover:underline underline-offset-2">
                        {link.label} ↗
                      </a>
                    ) : (
                      <Link key={link.label} href={`/my-universities/${uu.id}/writer`}
                        className="text-[10px] font-semibold text-pink-500 hover:underline underline-offset-2">
                        {link.label} →
                      </Link>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                {catTasks.map((task) => {
                  const done = completedTasks.has(task.id);
                  return (
                    <div key={task.id} className={`flex items-start gap-3 rounded-xl border border-black/[.04] bg-white px-3 py-2.5 transition ${done ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => onToggleTask(task.id)}
                        className="mt-0.5 rounded border-slate-300 text-pink-500 focus:ring-pink-300 shrink-0"
                        aria-label={task.title}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${done ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{task.description}</p>
                        )}
                        {task.tips?.content && (
                          <details className="mt-1">
                            <summary className="text-[10px] font-semibold text-sky-500 cursor-pointer select-none">💡 Show tips</summary>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed whitespace-pre-line">{task.tips.content}</p>
                          </details>
                        )}
                      </div>
                      <DeadlineEditor
                        taskId={task.id}
                        current={task.deadline ?? null}
                        onSave={(d) => onDeadlineChange(task.id, d)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comparison table ─────────────────────────────────────────────────────────

function ComparisonTable({ userUniversities, statuses, onStatusChange }: {
  userUniversities: UUWithUni[];
  statuses: Record<number, string>;
  onStatusChange: (id: number, s: string) => void;
}) {
  const fields: { key: keyof University; label: string }[] = [
    { key: 'qs_rank',              label: 'QS Rank' },
    { key: 'accept_rate',          label: 'Accept Rate' },
    { key: 'tuition_usd',          label: 'Tuition (USD)' },
    { key: 'living_cost_usd',      label: 'Living Cost' },
    { key: 'admission_difficulty', label: 'Difficulty' },
    { key: 'english_requirement',  label: 'English Req.' },
    { key: 'application_deadline', label: 'Deadline' },
    { key: 'scholarship',          label: 'Scholarships' },
    { key: 'employability',        label: 'Employability' },
    { key: 'best_for',             label: 'Best For' },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[.05] bg-white/80 shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-black/[.05]">
            <th className="sticky left-0 bg-white/95 backdrop-blur px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400 min-w-[140px]">
              Field
            </th>
            {userUniversities.map((uu) => (
              <th key={uu.id} className="px-4 py-3 text-left min-w-[180px]">
                <div className="font-semibold text-slate-900 leading-snug">{uu.university.name}</div>
                <div className="text-xs text-slate-400 font-normal mt-0.5">{uu.university.country}</div>
                {uu.match_score != null && (
                  <span className="mt-1 inline-block rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-[10px] font-semibold text-pink-600">
                    {uu.match_score}% match
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Status row */}
          <tr className="border-b border-black/[.04] bg-slate-50/40">
            <td className="sticky left-0 bg-slate-50/80 backdrop-blur px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Status
            </td>
            {userUniversities.map((uu) => {
              const status = statuses[uu.id] ?? uu.status;
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.interested;
              return (
                <td key={uu.id} className="px-4 py-2.5">
                  <select
                    value={status}
                    onChange={(e) => onStatusChange(uu.id, e.target.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer ${cfg.pill}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </td>
              );
            })}
          </tr>

          {fields.map(({ key, label }, i) => (
            <tr key={key} className={`border-b border-black/[.04] ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
              <td className="sticky left-0 bg-white/90 backdrop-blur px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {label}
              </td>
              {userUniversities.map((uu) => {
                const val = uu.university[key];
                const display = val != null && val !== '' ? String(val) : '—';
                return (
                  <td key={uu.id} className="px-4 py-2.5 text-sm text-slate-700">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Links row */}
          <tr>
            <td className="sticky left-0 bg-white/90 backdrop-blur px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Apply
            </td>
            {userUniversities.map((uu) => (
              <td key={uu.id} className="px-4 py-2.5">
                <div className="flex flex-col gap-1">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(uu.university.name + ' application portal')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#00b4d8] hover:underline underline-offset-2"
                  >
                    Application portal ↗
                  </a>
                  <Link
                    href={`/my-universities/${uu.id}/writer`}
                    className="text-xs font-semibold text-pink-500 hover:underline underline-offset-2"
                  >
                    AI Writer →
                  </Link>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main client component ────────────────────────────────────────────────────

export function MyUniversitiesClient({ userUniversities, allTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'tracker' | 'compare'>('tracker');
  const [statuses, setStatuses] = useState<Record<number, string>>(
    Object.fromEntries(userUniversities.map((uu) => [uu.id, uu.status])),
  );
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(
    new Set(allTasks.filter((t) => t.is_completed).map((t) => t.id)),
  );
  const [taskDeadlines, setTaskDeadlines] = useState<Record<number, string | null>>(
    Object.fromEntries(allTasks.map((t) => [t.id, t.deadline ?? null])),
  );
  const [, startTransition] = useTransition();

  const tasksByUU = useMemo(() => {
    const map: Record<number, ApplicationTask[]> = {};
    for (const task of allTasks) {
      (map[task.user_university_id] ??= []).push(task);
    }
    return map;
  }, [allTasks]);

  // Merge live deadlines into tasks
  const tasksWithDeadlines = useMemo(() =>
    allTasks.map((t) => ({ ...t, deadline: taskDeadlines[t.id] ?? t.deadline ?? null })),
    [allTasks, taskDeadlines]
  );

  const tasksByUULive = useMemo(() => {
    const map: Record<number, ApplicationTask[]> = {};
    for (const task of tasksWithDeadlines) {
      (map[task.user_university_id] ??= []).push(task);
    }
    return map;
  }, [tasksWithDeadlines]);

  const handleStatusChange = async (uuId: number, newStatus: string) => {
    setStatuses((prev) => ({ ...prev, [uuId]: newStatus }));
    await supabase.from('user_universities')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', uuId);
  };

  const handleToggleTask = async (taskId: number) => {
    const isNowCompleted = !completedTasks.has(taskId);
    startTransition(() => {
      setCompletedTasks((prev) => {
        const next = new Set(prev);
        if (isNowCompleted) next.add(taskId); else next.delete(taskId);
        return next;
      });
    });
    await supabase.from('application_tasks')
      .update({ is_completed: isNowCompleted, completed_at: isNowCompleted ? new Date().toISOString() : null })
      .eq('id', taskId);
  };

  const handleDeadlineChange = async (taskId: number, deadline: string | null) => {
    setTaskDeadlines((prev) => ({ ...prev, [taskId]: deadline }));
    await supabase.from('application_tasks')
      .update({ deadline })
      .eq('id', taskId);
  };

  // Summary stats
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => completedTasks.has(t.id)).length;
  const overdueTasks = tasksWithDeadlines.filter(
    (t) => t.deadline && !completedTasks.has(t.id) && new Date(t.deadline) < new Date()
  ).length;

  if (userUniversities.length === 0) {
    return (
      <div className="glow-card text-center py-16 space-y-4">
        <p className="text-4xl" aria-hidden="true">🎓</p>
        <p className="text-slate-500">No universities saved yet.</p>
        <a href="/universities"
          className="inline-flex rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)]">
          Browse universities
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Summary bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Universities', value: userUniversities.length, color: 'text-slate-900' },
          { label: 'Tasks done', value: `${doneTasks}/${totalTasks}`, color: 'text-pink-600' },
          { label: 'Overdue', value: overdueTasks, color: overdueTasks > 0 ? 'text-red-500' : 'text-slate-900' },
          { label: 'Offers', value: Object.values(statuses).filter((s) => s === 'offer').length, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="glow-card py-4 text-center">
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── View toggle ── */}
      <div className="flex items-center gap-2">
        {(['tracker', 'compare'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              view === v
                ? 'bg-pink-50 text-pink-600 border border-pink-200'
                : 'bg-white/80 text-slate-500 border border-black/5 hover:text-slate-700'
            }`}>
            {v === 'tracker' ? 'Application Tracker' : 'Compare Universities'}
          </button>
        ))}
        <a href="/universities"
          className="ml-auto rounded-full border border-black/5 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition">
          + Add university
        </a>
      </div>

      {/* ── Tracker view ── */}
      {view === 'tracker' && (
        <div className="space-y-3">
          {userUniversities.map((uu) => (
            <UniversityRow
              key={uu.id}
              uu={uu}
              tasks={tasksByUULive[uu.id] ?? []}
              completedTasks={completedTasks}
              statuses={statuses}
              onStatusChange={handleStatusChange}
              onToggleTask={handleToggleTask}
              onDeadlineChange={handleDeadlineChange}
            />
          ))}
        </div>
      )}

      {/* ── Compare view ── */}
      {view === 'compare' && (
        <ComparisonTable
          userUniversities={userUniversities}
          statuses={statuses}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
