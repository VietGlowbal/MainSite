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

/* ─────────────────────────────────────────────────────────────────────────
   COUNTRY FLAGS
───────────────────────────────────────────────────────────────────────── */

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Canada: '🇨🇦',
  Australia: '🇦🇺', Germany: '🇩🇪', Netherlands: '🇳🇱', France: '🇫🇷',
  Singapore: '🇸🇬', Japan: '🇯🇵', Switzerland: '🇨🇭', Ireland: '🇮🇪',
  Sweden: '🇸🇪', Spain: '🇪🇸', Italy: '🇮🇹', 'South Korea': '🇰🇷',
  'Hong Kong': '🇭🇰', 'New Zealand': '🇳🇿', 'United Arab Emirates': '🇦🇪',
  Qatar: '🇶🇦', China: '🇨🇳', India: '🇮🇳',
};

/* ─────────────────────────────────────────────────────────────────────────
   STAGE MAPPING — converts status to stage progression
───────────────────────────────────────────────────────────────────────── */

const STAGES = ['Shortlisted', 'Course chosen', 'SOP drafted', 'Mentor reviewed', 'Applied'] as const;
type StageKey = typeof STAGES[number];

function statusToStageIndex(status: string): number {
  switch (status) {
    case 'interested': return 0;
    case 'applying': return 2;
    case 'applied':
    case 'offer':
    case 'rejected':
    case 'enrolled': return 5;
    default: return 0;
  }
}

function statusToTabKey(status: string): 'not_started' | 'in_progress' | 'applied' | 'decided' {
  switch (status) {
    case 'interested': return 'not_started';
    case 'applying': return 'in_progress';
    case 'applied': return 'applied';
    case 'offer':
    case 'rejected':
    case 'enrolled': return 'decided';
    default: return 'not_started';
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   DEADLINE GROUPING
───────────────────────────────────────────────────────────────────────── */

type DeadlineItem = {
  task: ApplicationTask;
  university: University;
  uuId: number;
  daysUntil: number;
};

function groupDeadlines(items: DeadlineItem[]) {
  const today: DeadlineItem[] = [];
  const thisWeek: DeadlineItem[] = [];
  const thisMonth: DeadlineItem[] = [];
  const later: DeadlineItem[] = [];

  for (const item of items) {
    if (item.daysUntil < 0 || item.daysUntil === 0) today.push(item);
    else if (item.daysUntil <= 7) thisWeek.push(item);
    else if (item.daysUntil <= 30) thisMonth.push(item);
    else later.push(item);
  }

  return { today, thisWeek, thisMonth, later };
}

/* ─────────────────────────────────────────────────────────────────────────
   STATS (top row)
───────────────────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="mt-1 text-[0.7rem] text-slate-500 leading-tight">{label}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HORIZONTAL STAGE PROGRESS
───────────────────────────────────────────────────────────────────────── */

function StageProgress({ currentStageIndex }: { currentStageIndex: number }) {
  return (
    <div className="flex items-center justify-between w-full">
      {STAGES.map((stage, i) => {
        const isCompleted = i < currentStageIndex;
        const isCurrent = i === currentStageIndex;
        const isLast = i === STAGES.length - 1;
        return (
          <div key={stage} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-pink-500 text-white ring-4 ring-pink-100'
                    : 'bg-slate-100 text-slate-300 border border-slate-200'
                }`}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <div className={`h-2 w-2 rounded-full ${isCurrent ? 'bg-white' : 'bg-current'}`} />
                )}
              </div>
              <p className={`text-[0.6rem] text-center leading-tight max-w-[60px] ${
                isCompleted || isCurrent ? 'text-slate-700 font-medium' : 'text-slate-400'
              }`}>
                {stage}
              </p>
            </div>
            {!isLast && (
              <div className={`flex-1 h-[2px] mx-1 mb-5 ${
                isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY APPLICATION CARD (main row)
───────────────────────────────────────────────────────────────────────── */

function UniversityApplicationCard({
  uu,
  tasks,
  completedTasks,
  onToggleTask,
}: {
  uu: UUWithUni;
  tasks: ApplicationTask[];
  completedTasks: Set<number>;
  onToggleTask: (id: number) => void;
}) {
  const flag = COUNTRY_FLAGS[uu.university.country] ?? '🎓';
  const stageIndex = statusToStageIndex(uu.status);
  const incompleteTasks = tasks.filter((t) => !completedTasks.has(t.id));

  // Determine next step based on stage
  const nextStepInfo = (() => {
    if (uu.status === 'interested') return { label: 'Choose your preferred course', cta: 'Find Courses' };
    if (stageIndex < 2) return { label: 'Draft your statement of purpose', cta: 'Start SOP' };
    if (stageIndex < 3) return { label: 'Submit your application', cta: 'Submit Application' };
    if (stageIndex < 4) return { label: 'Book your mentor review', cta: 'Book Review' };
    return { label: 'Track your application', cta: 'View Status' };
  })();

  const nextDeadline = tasks
    .filter((t) => t.deadline && !completedTasks.has(t.id))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0]?.deadline ?? null;

  const wikiImage = (uu.university as University & { image_url?: string }).image_url;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="grid lg:grid-cols-[120px_1fr_180px] gap-0">
        {/* Image */}
        <div className="relative h-32 lg:h-full overflow-hidden bg-slate-100">
          {wikiImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wikiImage}
              alt={uu.university.name}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-200 to-cyan-200">
              <span className="text-4xl">🎓</span>
            </div>
          )}
          <button
            type="button"
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-pink-500 shadow-sm backdrop-blur-sm"
            aria-label="Saved"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ec4899" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Main content */}
        <div className="px-4 py-4 space-y-3 lg:border-r lg:border-slate-100">
          {/* Header: name, flag, ranking */}
          <div>
            <h3 className="text-base font-semibold text-slate-900">{uu.university.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {uu.notes ?? uu.university.best_for ?? 'Application in progress'}
            </p>
            <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span>{flag}</span>
                <span>{uu.university.country}</span>
              </span>
              {uu.university.qs_rank && (
                <span className="text-slate-500">· #{uu.university.qs_rank} QS World Ranking</span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs">
              {nextDeadline && (
                <span className="text-slate-600">
                  <span className="font-semibold">Deadline:</span>{' '}
                  {new Date(nextDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {uu.match_score != null && (
                <span className="rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-[0.65rem] font-bold text-pink-600">
                  {uu.match_score}% Match
                </span>
              )}
              <Link
                href={`/achievers?university=${uu.university_id}`}
                className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700 hover:underline transition"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Find a mentor here
              </Link>
            </div>
          </div>

          {/* Stage progress */}
          <div className="py-2">
            <StageProgress currentStageIndex={stageIndex} />
          </div>

          {/* Tasks summary */}
          {tasks.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[0.7rem] font-semibold text-slate-600">
                  Tasks ({incompleteTasks.length})
                </p>
                <Link
                  href={`/my-universities/${uu.id}`}
                  className="text-[0.7rem] font-semibold text-cyan-600 hover:underline"
                >
                  View all →
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {incompleteTasks.slice(0, 3).map((task) => (
                  <label
                    key={task.id}
                    className="flex items-center gap-1.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={completedTasks.has(task.id)}
                      onChange={() => onToggleTask(task.id)}
                      className="rounded border-slate-300 text-pink-500 focus:ring-pink-300 h-3 w-3"
                    />
                    <span className="text-xs text-slate-600 group-hover:text-slate-900">
                      {task.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next Step panel */}
        <div className="px-4 py-4 bg-slate-50/50 flex flex-col justify-between gap-3 lg:py-5">
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Next Step</p>
              <button
                type="button"
                aria-label="More options"
                className="text-slate-400 hover:text-slate-600"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            </div>
            <p className="text-sm font-medium text-slate-900 leading-snug">{nextStepInfo.label}</p>
          </div>
          <Link
            href={uu.status === 'interested' ? '/universities' : `/my-universities/${uu.id}/writer`}
            className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-4 py-2 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition"
          >
            {nextStepInfo.cta}
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UPCOMING DEADLINES LIST
───────────────────────────────────────────────────────────────────────── */

function DeadlineRow({
  item,
  badgeText,
  badgeStyle,
}: {
  item: DeadlineItem;
  badgeText: string;
  badgeStyle: string;
}) {
  const wikiImage = (item.university as University & { image_url?: string }).image_url;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-slate-100">
        {wikiImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wikiImage} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">{item.task.title}</p>
        <p className="text-[0.65rem] text-slate-500 truncate">{item.university.name}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-[0.65rem] text-slate-400">
          {item.task.deadline ? new Date(item.task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold ${badgeStyle}`}>
          {badgeText}
        </span>
      </div>
    </div>
  );
}

function UpcomingDeadlines({
  userUniversities,
  tasks,
  completedTasks,
}: {
  userUniversities: UUWithUni[];
  tasks: ApplicationTask[];
  completedTasks: Set<number>;
}) {
  const uuMap = useMemo(() => {
    const map: Record<number, UUWithUni> = {};
    for (const uu of userUniversities) map[uu.id] = uu;
    return map;
  }, [userUniversities]);

  const items: DeadlineItem[] = useMemo(() => {
    return tasks
      .filter((t) => t.deadline && !completedTasks.has(t.id))
      .map((t) => {
        const uu = uuMap[t.user_university_id];
        if (!uu) return null;
        const date = new Date(t.deadline!);
        const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return {
          task: t,
          university: uu.university,
          uuId: uu.id,
          daysUntil,
        };
      })
      .filter((x): x is DeadlineItem => x !== null)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [tasks, completedTasks, uuMap]);

  const grouped = groupDeadlines(items);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-pink-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-slate-900">Upcoming Deadlines</h3>
        </div>
        <button type="button" className="text-xs font-semibold text-cyan-600 hover:underline">
          View All
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No upcoming deadlines.</p>
      ) : (
        <div className="space-y-3">
          {grouped.today.length > 0 && (
            <div>
              <p className="text-pink-500 text-[0.65rem] font-bold uppercase tracking-wider mb-1">Today</p>
              {grouped.today.map((item) => (
                <DeadlineRow key={item.task.id} item={item} badgeText="Due today" badgeStyle="border-red-200 bg-red-50 text-red-600" />
              ))}
            </div>
          )}
          {grouped.thisWeek.length > 0 && (
            <div>
              <p className="text-pink-500 text-[0.65rem] font-bold uppercase tracking-wider mb-1">This Week</p>
              {grouped.thisWeek.map((item) => (
                <DeadlineRow
                  key={item.task.id}
                  item={item}
                  badgeText={`In ${item.daysUntil} day${item.daysUntil !== 1 ? 's' : ''}`}
                  badgeStyle="border-amber-200 bg-amber-50 text-amber-600"
                />
              ))}
            </div>
          )}
          {grouped.thisMonth.length > 0 && (
            <div>
              <p className="text-pink-500 text-[0.65rem] font-bold uppercase tracking-wider mb-1">This Month</p>
              {grouped.thisMonth.map((item) => (
                <DeadlineRow
                  key={item.task.id}
                  item={item}
                  badgeText={`In ${item.daysUntil} days`}
                  badgeStyle="border-slate-200 bg-slate-50 text-slate-600"
                />
              ))}
            </div>
          )}
          {grouped.later.length > 0 && (
            <div>
              <p className="text-slate-400 text-[0.65rem] font-bold uppercase tracking-wider mb-1">Later</p>
              {grouped.later.slice(0, 3).map((item) => (
                <DeadlineRow
                  key={item.task.id}
                  item={item}
                  badgeText={`In ${item.daysUntil} days`}
                  badgeStyle="border-slate-200 bg-slate-50 text-slate-500"
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 text-center">
        <button type="button" className="text-xs font-semibold text-cyan-600 hover:underline">
          View Full Timeline →
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   NEXT BEST ACTION CARD
───────────────────────────────────────────────────────────────────────── */

function NextBestActionCard({
  userUniversities,
  tasks,
  completedTasks,
}: {
  userUniversities: UUWithUni[];
  tasks: ApplicationTask[];
  completedTasks: Set<number>;
}) {
  // Find the most urgent next action: closest deadline among incomplete tasks
  const uuMap = useMemo(() => {
    const map: Record<number, UUWithUni> = {};
    for (const uu of userUniversities) map[uu.id] = uu;
    return map;
  }, [userUniversities]);

  const upcoming = useMemo(() => {
    return tasks
      .filter((t) => t.deadline && !completedTasks.has(t.id))
      .map((t) => {
        const uu = uuMap[t.user_university_id];
        if (!uu) return null;
        const date = new Date(t.deadline!);
        const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return { task: t, university: uu.university, uuId: uu.id, daysUntil };
      })
      .filter((x): x is { task: ApplicationTask; university: University; uuId: number; daysUntil: number } => x !== null)
      .sort((a, b) => a.daysUntil - b.daysUntil)[0];
  }, [tasks, completedTasks, uuMap]);

  if (!upcoming) return null;

  const wikiImage = (upcoming.university as University & { image_url?: string }).image_url;

  return (
    <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50/50 to-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-pink-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 11.5L11.5 14L15.5 9.5L17 11L11.5 17L7.5 13L9 11.5Z" />
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
        <h3 className="text-sm font-semibold text-slate-900">Next Best Action</h3>
      </div>

      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-slate-100">
          {wikiImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wikiImage} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight">{upcoming.task.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{upcoming.university.name}</p>
          <p className="text-xs text-slate-500 mt-1">
            Application deadline in{' '}
            <span className="text-pink-600 font-semibold">
              {upcoming.daysUntil < 0 ? 'overdue' : `${upcoming.daysUntil} days`}
            </span>
          </p>
        </div>
        <div className="text-2xl">📝</div>
      </div>

      <Link
        href={`/my-universities/${upcoming.uuId}`}
        className="mt-3 flex items-center justify-between w-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5"
      >
        Continue Application
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HELP CTA CARD (sidebar bottom)
───────────────────────────────────────────────────────────────────────── */

function HelpCTACard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-pink-50 to-cyan-50/50 p-4 text-center">
      <div className="text-3xl mb-2">📚</div>
      <p className="text-xs font-semibold text-slate-900 leading-tight mb-1">
        Need help with your<br />application?
      </p>
      <p className="text-[0.65rem] text-slate-500 leading-relaxed mb-3">
        Book a 1:1 session with our<br />mentors and alumni.
      </p>
      <Link
        href="/achievers"
        className="inline-flex rounded-full border border-pink-300 bg-white px-3 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition"
      >
        Book a Session
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   LEFT SIDEBAR NAV
───────────────────────────────────────────────────────────────────────── */

function LeftSidebar() {
  const navItems = [
    { icon: '♡', label: 'My Universities', href: '/my-universities', active: true },
    { icon: '🎓', label: 'Search', href: '/universities' },
    { icon: '👥', label: 'Mentors', href: '/achievers' },
    { icon: '📁', label: 'Documents', href: '/profile' },
    { icon: '👤', label: 'Profile', href: '/profile' },
  ];

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                item.active
                  ? 'bg-pink-50 text-pink-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <HelpCTACard />
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN CLIENT
───────────────────────────────────────────────────────────────────────── */

type TabKey = 'all' | 'not_started' | 'in_progress' | 'applied' | 'decided';

export function MyUniversitiesClient({ userUniversities, allTasks }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<TabKey>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'match' | 'name'>('deadline');
  const [view] = useState<'list' | 'grid'>('list');
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(
    new Set(allTasks.filter((t) => t.is_completed).map((t) => t.id)),
  );
  const [, startTransition] = useTransition();

  // Tasks per university
  const tasksByUU = useMemo(() => {
    const map: Record<number, ApplicationTask[]> = {};
    for (const task of allTasks) {
      (map[task.user_university_id] ??= []).push(task);
    }
    return map;
  }, [allTasks]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: userUniversities.length, not_started: 0, in_progress: 0, applied: 0, decided: 0 };
    for (const uu of userUniversities) {
      counts[statusToTabKey(uu.status)]++;
    }
    return counts;
  }, [userUniversities]);

  // Filtered + sorted universities
  const visibleUniversities = useMemo(() => {
    let filtered = userUniversities;
    if (tab !== 'all') {
      filtered = filtered.filter((uu) => statusToTabKey(uu.status) === tab);
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.university.name.localeCompare(b.university.name);
      if (sortBy === 'match') return (b.match_score ?? 0) - (a.match_score ?? 0);
      // deadline
      const aTasks = tasksByUU[a.id] ?? [];
      const bTasks = tasksByUU[b.id] ?? [];
      const aDeadline = aTasks
        .filter((t) => t.deadline && !completedTasks.has(t.id))
        .sort((x, y) => (x.deadline ?? '').localeCompare(y.deadline ?? ''))[0]?.deadline ?? '9999';
      const bDeadline = bTasks
        .filter((t) => t.deadline && !completedTasks.has(t.id))
        .sort((x, y) => (x.deadline ?? '').localeCompare(y.deadline ?? ''))[0]?.deadline ?? '9999';
      return aDeadline.localeCompare(bDeadline);
    });
  }, [userUniversities, tab, sortBy, tasksByUU, completedTasks]);

  // Stats
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t) => completedTasks.has(t.id)).length;
  const tasksRemaining = totalTasks - doneTasks;

  const deadlinesThisMonth = useMemo(() => {
    return allTasks.filter((t) => {
      if (!t.deadline || completedTasks.has(t.id)) return false;
      const date = new Date(t.deadline);
      const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
  }, [allTasks, completedTasks]);

  const applicationsInProgress = userUniversities.filter((uu) => uu.status === 'applying' || uu.status === 'applied').length;

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
      .update({ is_completed: isNowCompleted, completed_at: isNowCompleted ? new Date().toISOString() : null })
      .eq('id', taskId);
  };

  if (userUniversities.length === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <LeftSidebar />
        <div className="rounded-2xl border border-slate-200 bg-white text-center py-16 space-y-4">
          <p className="text-4xl" aria-hidden="true">🎓</p>
          <p className="text-slate-500">No universities saved yet.</p>
          <Link
            href="/universities"
            className="inline-flex rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)]"
          >
            Browse universities
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* Left sidebar nav */}
      <LeftSidebar />

      <div className="space-y-5 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Universities</h1>
            <p className="mt-1 text-sm text-slate-500">Track your applications and never miss a deadline.</p>
          </div>
          <Link
            href="/universities"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-pink-200 hover:text-pink-600 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add University
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            value={userUniversities.length}
            label="Universities Tracked"
            iconBg="bg-cyan-50"
            iconColor="text-cyan-600"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            }
          />
          <StatCard
            value={deadlinesThisMonth}
            label="Deadlines This Month"
            iconBg="bg-pink-50"
            iconColor="text-pink-600"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
          />
          <StatCard
            value={tasksRemaining}
            label="Tasks Remaining"
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
          />
          <StatCard
            value={0}
            label="Mentor Review Pending"
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <StatCard
            value={applicationsInProgress}
            label="Applications in Progress"
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            }
          />
        </div>

        {/* Body: 2 columns */}
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Left column: Next Best Action + Upcoming Deadlines */}
          <div className="space-y-4">
            <NextBestActionCard
              userUniversities={userUniversities}
              tasks={allTasks}
              completedTasks={completedTasks}
            />
            <UpcomingDeadlines
              userUniversities={userUniversities}
              tasks={allTasks}
              completedTasks={completedTasks}
            />
          </div>

          {/* Right column: Tabs + Cards */}
          <div className="space-y-4 min-w-0">
            {/* Tabs + sort */}
            <div className="flex items-center gap-2 flex-wrap">
              <TabButton tab="all" current={tab} onClick={setTab} count={tabCounts.all} />
              <TabButton tab="not_started" current={tab} onClick={setTab} count={tabCounts.not_started} label="Not Started" />
              <TabButton tab="in_progress" current={tab} onClick={setTab} count={tabCounts.in_progress} label="In Progress" />
              <TabButton tab="applied" current={tab} onClick={setTab} count={tabCounts.applied} label="Applied" />
              <TabButton tab="decided" current={tab} onClick={setTab} count={tabCounts.decided} label="Decided" />

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'deadline' | 'match' | 'name')}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-cyan-300 cursor-pointer"
                >
                  <option value="deadline">Sort by: Deadline</option>
                  <option value="match">Sort by: Match</option>
                  <option value="name">Sort by: Name</option>
                </select>

                <div className="hidden sm:flex rounded-full border border-slate-200 bg-white p-0.5">
                  <button
                    type="button"
                    aria-label="List view"
                    className={`rounded-full p-1.5 transition ${view === 'list' ? 'bg-pink-500 text-white' : 'text-slate-400'}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Grid view"
                    className={`rounded-full p-1.5 transition ${view === 'grid' ? 'bg-pink-500 text-white' : 'text-slate-400'}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Application cards */}
            <div className="space-y-3">
              {visibleUniversities.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white text-center py-12">
                  <p className="text-sm text-slate-500">No universities in this status.</p>
                </div>
              ) : (
                visibleUniversities.map((uu) => (
                  <UniversityApplicationCard
                    key={uu.id}
                    uu={uu}
                    tasks={tasksByUU[uu.id] ?? []}
                    completedTasks={completedTasks}
                    onToggleTask={handleToggleTask}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TAB BUTTON
───────────────────────────────────────────────────────────────────────── */

function TabButton({
  tab,
  current,
  onClick,
  count,
  label,
}: {
  tab: TabKey;
  current: TabKey;
  onClick: (t: TabKey) => void;
  count: number;
  label?: string;
}) {
  const display = label ?? (tab === 'all' ? 'All' : tab);
  const active = current === tab;
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={`relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)]'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {display} ({count})
    </button>
  );
}
